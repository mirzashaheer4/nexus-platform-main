const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Wallet = require('../models/Wallet');
const OTP = require('../models/OTP');
const verifyToken = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// Helper validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    return res.status(400).json({ errors: errors.array() });
  };
};

// ─── Cookie helper ────────────────────────────────────────────────────────────

const cookieOptions = {
  accessToken: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
  },
  refreshToken: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  jwtPayload: {
    httpOnly: false, // Must be readable by frontend JS to decode role
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 15 * 60 * 1000,
  },
  socketToken: {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 15 * 60 * 1000,
  },
};

const generateTokens = (user) => {
  const payload = { id: user._id, role: user.role };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const setAuthCookies = (res, user, accessToken, refreshToken) => {
  const payloadData = Buffer.from(
    JSON.stringify({ id: user._id, name: user.name, role: user.role })
  ).toString('base64');

  res.cookie('accessToken', accessToken, cookieOptions.accessToken);
  res.cookie('refreshToken', refreshToken, cookieOptions.refreshToken);
  res.cookie('jwtPayload', payloadData, cookieOptions.jwtPayload);
  res.cookie('_st', accessToken, cookieOptions.socketToken);
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('jwtPayload');
  res.clearCookie('_st');
};

// ─── Swagger Documentation & Handlers ──────────────────────────────────────────

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user and create their profile & wallet
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *                 minimum: 8
 *               role:
 *                 type: string
 *                 enum: [investor, entrepreneur]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or email exists
 */
router.post(
  '/register',
  validate([
    body('name').isString().trim().escape().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('role').isIn(['investor', 'entrepreneur']).withMessage('Role must be investor or entrepreneur.')
  ]),
  async (req, res) => {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const user = new User({ name, email, password, role });
    await user.save();

    // Create Profile (Week 1)
    await Profile.create({ userId: user._id });

    // Create Wallet (Fix 6)
    await Wallet.create({ userId: user._id, balance: 0 });

    const { accessToken, refreshToken } = generateTokens(user);
    setAuthCookies(res, user, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      user: { id: user._id, name: user.name, role: user.role }
    });
  }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user (checks 2FA status)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authenticated successfully or requires 2FA
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email required.'),
    body('password').notEmpty().withMessage('Password is required.')
  ]),
  async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Fix 14 - Login response structure for 2FA
    if (user.twoFactorEnabled) {
      // Generate 6-digit OTP code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOTP = await bcrypt.hash(otpCode, 12);

      // Save OTP record
      const otpRecord = new OTP({
        userId: user._id,
        otp: hashedOTP,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
        used: false
      });
      await otpRecord.save();

      // Email plain OTP code
      await sendEmail(user.email, '2FA Verification Code', `Your OTP code is: <strong>${otpCode}</strong>. Valid for 5 minutes.`);

      return res.json({ requires2FA: true, userId: user._id });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    setAuthCookies(res, user, accessToken, refreshToken);

    res.json({
      success: true,
      user: { id: user._id, name: user.name, role: user.role },
      requires2FA: false
    });
  }
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Clear cookies and log out user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Rotate access and refresh tokens
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Tokens rotated
 *       401:
 *         description: Stale or missing token
 */
router.post('/refresh', async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ message: 'No refresh token provided.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Refresh token invalid or expired. Please log in again.' });
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'User not found.' });
  }

  const { accessToken, refreshToken } = generateTokens(user);
  setAuthCookies(res, user, accessToken, refreshToken);

  res.json({ success: true, message: 'Tokens refreshed.' });
});

/**
 * @swagger
 * /api/auth/request-otp:
 *   post:
 *     summary: Request OTP for 2FA validation manually (unauthenticated wrapper helper)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP generated and emailed
 *       404:
 *         description: User not found
 */
router.post(
  '/request-otp',
  validate([
    body('userId').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Invalid User ID.')
  ]),
  async (req, res) => {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOTP = await bcrypt.hash(otpCode, 12);

    const otpRecord = new OTP({
      userId: user._id,
      otp: hashedOTP,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      used: false
    });
    await otpRecord.save();

    await sendEmail(user.email, '2FA Verification Code', `Your OTP: ${otpCode}`);
    res.json({ message: 'Verification code sent to email.' });
  }
);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and log user in by setting auth cookies
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - otp
 *             properties:
 *               userId:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified and cookies set
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 */
router.post(
  '/verify-otp',
  validate([
    body('userId').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Invalid User ID.'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits.')
  ]),
  async (req, res) => {
    const { userId, otp } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const otpRecord = await OTP.findOne({ userId, used: false }).sort({ createdAt: -1 });

    if (!otpRecord) return res.status(400).json({ message: 'OTP not found or already used' });
    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isValid) return res.status(400).json({ message: 'Invalid OTP' });

    otpRecord.used = true;
    await otpRecord.save();

    const { accessToken, refreshToken } = generateTokens(user);
    setAuthCookies(res, user, accessToken, refreshToken);

    res.json({
      success: true,
      user: { id: user._id, name: user.name, role: user.role }
    });
  }
);

/**
 * @swagger
 * /api/auth/enable-2fa:
 *   post:
 *     summary: Enable 2FA authentication for the logged-in user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 2FA enabled
 */
router.post('/enable-2fa', verifyToken, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  user.twoFactorEnabled = true;
  await user.save();

  res.json({ message: '2FA enabled successfully', twoFactorEnabled: true });
});

/**
 * @swagger
 * /api/auth/disable-2fa:
 *   post:
 *     summary: Disable 2FA authentication for the logged-in user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 2FA disabled
 */
router.post('/disable-2fa', verifyToken, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  user.twoFactorEnabled = false;
  await user.save();

  res.json({ message: '2FA disabled successfully', twoFactorEnabled: false });
});

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change password for logged-in user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minimum: 8
 *     responses:
 *       200:
 *         description: Password updated
 *       400:
 *         description: Invalid current password
 */
router.post(
  '/change-password',
  verifyToken,
  validate([
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.')
  ]),
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user || !(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ message: 'Invalid current password.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully.' });
  }
);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Send password reset link to user's email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset link emailed
 *       404:
 *         description: User not found
 */
router.post(
  '/forgot-password',
  validate([
    body('email').isEmail().normalizeEmail().withMessage('Valid email required.')
  ]),
  async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Generate raw token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash token for database storage
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send RAW token in email URL (Fix 5)
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    await sendEmail(
      user.email,
      'Password Reset Request',
      `<p>You requested a password reset. Click the link below to reset your password:</p>
       <a href="${resetUrl}">${resetUrl}</a>
       <p>This link is valid for 1 hour.</p>`
    );

    res.json({ message: 'Password reset link sent to email' });
  }
);

/**
 * @swagger
 * /api/auth/reset-password/{token}:
 *   post:
 *     summary: Reset password using unique token
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 minimum: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post(
  '/reset-password/:token',
  validate([
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
  ]),
  async (req, res) => {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' });

    // Pre-save hook hashes new password automatically
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  }
);

const mongoose = require('mongoose');

module.exports = router;
