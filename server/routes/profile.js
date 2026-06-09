const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const verifyToken = require('../middleware/auth');
const Profile = require('../models/Profile');
const User = require('../models/User');

const router = express.Router();

// Helper validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('Validation errors:', errors.array());
    }
    const errorMsg = errors.array().map(e => `${e.path || e.param}: ${e.msg}`).join(', ');
    return res.status(400).json({ message: errorMsg, errors: errors.array() });
  };
};

// ─── Multer config (local storage in /uploads) ────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  },
});

// Wrapper to handle Multer errors gracefully
const uploadMiddleware = (req, res, next) => {
  upload.single('picture')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// ─── Helper: get profile with user data merged ────────────────────────────────
const getProfileWithUser = async (userId) => {
  const [profile, user] = await Promise.all([
    Profile.findOne({ userId }),
    User.findById(userId).select('-password'),
  ]);
  if (!profile || !user) return null;
  return { ...profile.toObject(), name: user.name, email: user.email, role: user.role, twoFactorEnabled: user.twoFactorEnabled };
};

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/profile/me:
 *   get:
 *     summary: Retrieve own profile merged with user details
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Profile details
 *       404:
 *         description: Profile not found
 */
router.get('/me', verifyToken, async (req, res) => {
  const data = await getProfileWithUser(req.user.id);
  if (!data) return res.status(404).json({ message: 'Profile not found.' });
  res.json(data);
});

/**
 * @swagger
 * /api/profile/me:
 *   put:
 *     summary: Update own profile details
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bio: { type: string }
 *               location: { type: string }
 *               website: { type: string }
 *               startupName: { type: string }
 *               startupStage: { type: string }
 *               fundingRequired: { type: integer }
 *               teamSize: { type: integer }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put(
  '/me',
  verifyToken,
  validate([
    body('bio').optional({ checkFalsy: true }).isString().trim().escape(),
    body('location').optional({ checkFalsy: true }).isString().trim().escape(),
    body('website').optional({ checkFalsy: true }).isString().trim(),
    body('startupName').optional({ checkFalsy: true }).isString().trim().escape(),
    body('startupStage').optional({ checkFalsy: true }).isString().trim().escape(),
    body('fundingRequired').optional({ checkFalsy: true }).isInt({ min: 0 }),
    body('teamSize').optional({ checkFalsy: true }).isInt({ min: 0 })
  ]),
  async (req, res) => {
    const {
      bio, location, website,
      // Investor fields
      investmentRange, industriesOfInterest, portfolioCompanies,
      // Entrepreneur fields
      startupName, startupStage, fundingRequired, pitchDeckUrl, teamSize,
    } = req.body;

    const update = {
      bio, location, website,
      investmentRange, industriesOfInterest, portfolioCompanies,
      startupName, startupStage, fundingRequired, pitchDeckUrl, teamSize,
    };

    Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

    await Profile.findOneAndUpdate(
      { userId: req.user.id },
      { $set: update },
      { new: true, upsert: true }
    );

    const data = await getProfileWithUser(req.user.id);
    res.json(data);
  }
);

/**
 * @swagger
 * /api/profile/{userId}:
 *   get:
 *     summary: View another user's profile
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile details
 *       404:
 *         description: Profile not found
 */
router.get(
  '/:userId',
  verifyToken,
  validate([
    body('userId').optional().custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Invalid User ID.')
  ]),
  async (req, res) => {
    const data = await getProfileWithUser(req.params.userId);
    if (!data) return res.status(404).json({ message: 'Profile not found.' });
    res.json(data);
  }
);

/**
 * @swagger
 * /api/profile/picture:
 *   post:
 *     summary: Upload own profile picture
 *     tags: [Profile]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               picture:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Picture uploaded successfully
 *       400:
 *         description: No file uploaded or invalid format
 */
router.post('/picture', verifyToken, uploadMiddleware, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const picturePath = `/uploads/${req.file.filename}`;

  await Profile.findOneAndUpdate(
    { userId: req.user.id },
    { $set: { profilePicture: picturePath } },
    { upsert: true }
  );

  res.json({ success: true, profilePicture: picturePath });
});

const mongoose = require('mongoose');

module.exports = router;
