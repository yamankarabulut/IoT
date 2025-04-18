const mongoose = require('mongoose');

const viewLogSchema = new mongoose.Schema({
  user_id: String,
  timestamp: {
    type: Date,
    default: () => Date.now(),
  },
  action: String,
});

module.exports = mongoose.model('ViewLog', viewLogSchema);
