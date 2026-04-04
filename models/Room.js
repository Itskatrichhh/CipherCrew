const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['dm', 'group'], required: true },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  settings: {
    autoDelete: { type: Boolean, default: false },
    deleteAfter: { type: Number, default: 24 },
    allowReactions: { type: Boolean, default: true }
  },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
