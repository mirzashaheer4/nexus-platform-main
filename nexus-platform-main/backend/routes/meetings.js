const express = require('express');
const auth = require('../middleware/auth');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const router = express.Router();

// Get all meetings for the logged-in user
router.get('/', auth, async (req, res) => {
  const meetings = await Meeting.find({
    $or: [{ organizer: req.user.id }, { participant: req.user.id }]
  }).populate('organizer participant', 'name email');
  res.json(meetings);
});

// Schedule a meeting (with conflict detection)
router.post('/', auth, async (req, res) => {
  const { title, description, participant, startTime, endTime } = req.body;
  // Check for overlapping meetings for either user
  const overlapping = await Meeting.findOne({
    $or: [
      { organizer: req.user.id, participant },
      { organizer: participant, participant: req.user.id }
    ],
    startTime: { $lt: endTime },
    endTime: { $gt: startTime }
  });
  if (overlapping) return res.status(400).json({ message: 'Time slot conflict' });
  const meeting = new Meeting({
    title, description, organizer: req.user.id, participant, startTime, endTime,
    roomId: Math.random().toString(36).substring(7)
  });
  await meeting.save();
  res.status(201).json(meeting);
});

// Accept/reject meeting
router.put('/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  const meeting = await Meeting.findByIdAndUpdate(req.params.id, { status }, { new: true });
  res.json(meeting);
});

module.exports = router;
