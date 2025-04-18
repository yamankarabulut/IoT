const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  private_key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  role: Number,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
