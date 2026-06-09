const express = require('express');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/role');
const Profile = require('../models/Profile');
const Meeting = require('../models/Meeting');

const router = express.Router();

/**
 * @swagger
 * /api/investor/dashboard:
 *   get:
 *     summary: Retrieve investor dashboard metrics
 *     tags: [Dashboard]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get('/investor/dashboard', verifyToken, requireRole('investor'), async (req, res) => {
  const [profile, meetingsCount] = await Promise.all([
    Profile.findOne({ userId: req.user.id }),
    Meeting.countDocuments({
      $or: [{ organizer: req.user.id }, { invitee: req.user.id }],
    }),
  ]);

  res.json({
    success: true,
    totalInvestments: (profile?.portfolioCompanies || []).length,
    activeDeals: 0,
    industriesOfInterest: profile?.industriesOfInterest || [],
    investmentRange: profile?.investmentRange || { min: 0, max: 0 },
    meetingsCount,
  });
});

/**
 * @swagger
 * /api/entrepreneur/dashboard:
 *   get:
 *     summary: Retrieve entrepreneur dashboard metrics
 *     tags: [Dashboard]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get('/entrepreneur/dashboard', verifyToken, requireRole('entrepreneur'), async (req, res) => {
  const [profile, meetingsCount] = await Promise.all([
    Profile.findOne({ userId: req.user.id }),
    Meeting.countDocuments({
      $or: [{ organizer: req.user.id }, { invitee: req.user.id }],
    }),
  ]);

  res.json({
    success: true,
    startupName: profile?.startupName || '',
    startupStage: profile?.startupStage || 'N/A',
    fundingRequired: profile?.fundingRequired || 0,
    pitchDeckUrl: profile?.pitchDeckUrl || '',
    teamSize: profile?.teamSize || 0,
    meetingsCount,
  });
});

module.exports = router;
