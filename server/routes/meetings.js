const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, body, param, validationResult } = require('express-validator');
const verifyToken = require('../middleware/auth');
const verifyOwnership = require('../middleware/verifyOwnership');
const Meeting = require('../models/Meeting');
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
    const errorMsg = errors.array().map(e => `${e.path || e.param}: ${e.msg}`).join(', ');
    return res.status(422).json({ message: errorMsg, errors: errors.array() });
  };
};

/**
 * @swagger
 * /api/meetings/calendar:
 *   get:
 *     summary: Get meetings within a specific date range
 *     tags: [Meetings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: List of meetings in range
 */
router.get(
  '/calendar',
  verifyToken,
  validate([
    query('start').isISO8601().withMessage('Valid ISO8601 start date required.'),
    query('end').isISO8601().withMessage('Valid ISO8601 end date required.')
  ]),
  async (req, res) => {
    const { start, end } = req.query;
    const startDate = new Date(start);
    const endDate = new Date(end);

    const meetings = await Meeting.find({
      $and: [
        {
          $or: [{ organizer: req.user.id }, { invitee: req.user.id }]
        },
        {
          $or: [
            {
              status: { $in: ['accepted', 'completed'] },
              'confirmedTime.startTime': { $lt: endDate },
              'confirmedTime.endTime': { $gt: startDate }
            },
            {
              status: 'pending',
              proposedTimes: {
                $elemMatch: {
                  startTime: { $lt: endDate },
                  endTime: { $gt: startDate }
                }
              }
            }
          ]
        }
      ]
    }).populate('organizer invitee', 'name email');

    res.json(meetings);
  }
);

/**
 * @swagger
 * /api/meetings/my:
 *   get:
 *     summary: Retrieve meetings for the logged-in user
 *     tags: [Meetings]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of user meetings
 */
router.get('/my', verifyToken, async (req, res) => {
  const meetings = await Meeting.find({
    $or: [{ organizer: req.user.id }, { invitee: req.user.id }]
  })
  .populate('organizer invitee', 'name email')
  .sort({ createdAt: -1 });

  res.json(meetings);
});

/**
 * @swagger
 * /api/meetings/{id}:
 *   get:
 *     summary: Get single meeting details
 *     tags: [Meetings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting details
 *       403:
 *         description: Access denied
 *       404:
 *         description: Meeting not found
 */
router.get(
  '/:id',
  verifyToken,
  validate([
    param('id').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Invalid Meeting ID.')
  ]),
  async (req, res) => {
    const meeting = await Meeting.findById(req.params.id).populate('organizer invitee', 'name email');
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found.' });
    }

    if (meeting.organizer._id.toString() !== req.user.id && meeting.invitee._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    res.json(meeting);
  }
);

/**
 * @swagger
 * /api/meetings/schedule:
 *   post:
 *     summary: Schedule a new meeting with proposed time slots
 *     tags: [Meetings]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - invitee
 *               - proposedTimes
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               invitee: { type: string }
 *               proposedTimes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     startTime: { type: string, format: date-time }
 *                     endTime: { type: string, format: date-time }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Meeting created successfully
 */
router.post(
  '/schedule',
  verifyToken,
  validate([
    body('title').isString().trim().escape().notEmpty().withMessage('Title is required.'),
    body('description').optional().isString().trim().escape(),
    body('invitee').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Valid invitee ID required.'),
    body('proposedTimes').isArray({ min: 1 }).withMessage('At least one proposedTime is required.'),
    body('proposedTimes.*.startTime').isISO8601().withMessage('Valid start date required for each slot.'),
    body('proposedTimes.*.endTime').isISO8601().withMessage('Valid end date required for each slot.'),
    body('notes').optional().isString().trim().escape()
  ]),
  async (req, res) => {
    const { title, description, invitee, proposedTimes, notes } = req.body;

    if (invitee === req.user.id) {
      return res.status(400).json({ message: 'You cannot schedule a meeting with yourself.' });
    }

    const inviteeUser = await User.findById(invitee);
    if (!inviteeUser) {
      return res.status(404).json({ message: 'Invitee user not found.' });
    }

    const formattedProposed = proposedTimes.map(t => ({
      startTime: new Date(t.startTime),
      endTime: new Date(t.endTime)
    }));

    const meeting = new Meeting({
      title,
      description: description || '',
      organizer: req.user.id,
      invitee,
      proposedTimes: formattedProposed,
      status: 'pending',
      notes: notes || ''
    });

    await meeting.save();
    await meeting.populate('organizer invitee', 'name email');
    res.status(201).json(meeting);
  }
);

/**
 * @swagger
 * /api/meetings/{id}/accept:
 *   put:
 *     summary: Accept a scheduled meeting selecting a confirmed time slot
 *     tags: [Meetings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - confirmedTime
 *             properties:
 *               confirmedTime:
 *                 type: object
 *                 properties:
 *                   startTime: { type: string, format: date-time }
 *                   endTime: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Meeting accepted
 *       400:
 *         description: Status not pending or time mismatch
 *       409:
 *         description: Conflict found
 */
router.put(
  '/:id/accept',
  verifyToken,
  validate([
    param('id').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Invalid Meeting ID.'),
    body('confirmedTime.startTime').isISO8601().withMessage('Valid confirmed startTime required.'),
    body('confirmedTime.endTime').isISO8601().withMessage('Valid confirmed endTime required.')
  ]),
  verifyOwnership(Meeting, 'invitee'),
  async (req, res) => {
    const { confirmedTime } = req.body;
    const meeting = req.resource;

    if (meeting.status !== 'pending') {
      return res.status(400).json({
        message: `Cannot accept a meeting with status: ${meeting.status}`
      });
    }

    const selectedStart = new Date(confirmedTime.startTime).toISOString();
    const selectedEnd = new Date(confirmedTime.endTime).toISOString();

    const hasMatch = meeting.proposedTimes.some(t =>
      new Date(t.startTime).toISOString() === selectedStart &&
      new Date(t.endTime).toISOString() === selectedEnd
    );

    if (!hasMatch) {
      return res.status(400).json({ message: 'Selected time is not in the proposed times list.' });
    }

    const checkStart = new Date(confirmedTime.startTime);
    const checkEnd = new Date(confirmedTime.endTime);

    // Conflict detection
    const conflict = await Meeting.findOne({
      _id: { $ne: meeting._id },
      status: { $in: ['accepted', 'completed'] },
      $or: [
        { organizer: meeting.organizer },
        { invitee: meeting.organizer },
        { organizer: meeting.invitee },
        { invitee: meeting.invitee }
      ],
      'confirmedTime.startTime': { $lt: checkEnd },
      'confirmedTime.endTime': { $gt: checkStart }
    });

    if (conflict) {
      const s = new Date(conflict.confirmedTime.startTime).toLocaleString();
      const e = new Date(conflict.confirmedTime.endTime).toLocaleString();
      return res.status(409).json({
        message: `Conflict with meeting "${conflict.title}" scheduled at ${s} – ${e}`
      });
    }

    meeting.confirmedTime = { startTime: checkStart, endTime: checkEnd };
    meeting.meetingLink = uuidv4();
    meeting.status = 'accepted';

    await meeting.save();
    await meeting.populate('organizer invitee', 'name email');
    res.json(meeting);
  }
);

/**
 * @swagger
 * /api/meetings/{id}/reject:
 *   put:
 *     summary: Reject a scheduled meeting
 *     tags: [Meetings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Meeting rejected
 */
router.put(
  '/:id/reject',
  verifyToken,
  validate([
    param('id').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Invalid Meeting ID.'),
    body('notes').optional().isString().trim().escape()
  ]),
  verifyOwnership(Meeting, 'invitee'),
  async (req, res) => {
    const { notes } = req.body;
    const meeting = req.resource;

    meeting.status = 'rejected';
    if (notes) meeting.notes = notes;
    await meeting.save();
    res.json(meeting);
  }
);

/**
 * @swagger
 * /api/meetings/{id}/cancel:
 *   put:
 *     summary: Cancel a scheduled meeting
 *     tags: [Meetings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting cancelled
 */
router.put(
  '/:id/cancel',
  verifyToken,
  validate([
    param('id').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Invalid Meeting ID.')
  ]),
  verifyOwnership(Meeting, 'organizer'),
  async (req, res) => {
    const meeting = req.resource;
    meeting.status = 'cancelled';
    await meeting.save();
    res.json(meeting);
  }
);

const mongoose = require('mongoose');

module.exports = router;
