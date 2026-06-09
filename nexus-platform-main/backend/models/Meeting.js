const mongoose = require('mongoose');
const meetingSchema = new mongoose.Schema({
  title: String, description: String,
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  participant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  startTime: Date, endTime: Date,
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  roomId: String
}, { timestamps: true });
module.exports = mongoose.model('Meeting', meetingSchema);
