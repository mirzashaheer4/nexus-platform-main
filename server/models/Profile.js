const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  // Common fields
  bio:            { type: String, default: '' },
  profilePicture: { type: String, default: '' },
  location:       { type: String, default: '' },
  website:        { type: String, default: '' },

  // Investor-specific fields
  investmentRange: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
  },
  industriesOfInterest: [{ type: String }],
  portfolioCompanies:   [{ type: String }],

  // Entrepreneur-specific fields
  startupName:    { type: String, default: '' },
  startupStage:   { type: String, default: '' },
  fundingRequired:{ type: Number, default: 0 },
  pitchDeckUrl:   { type: String, default: '' },
  teamSize:       { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Profile', profileSchema);
