const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  errorType: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
    required: true,
  },
  timestamp: {
    type: Date,
    default: () => Date.now(),
  },
});

module.exports = mongoose.model('ErrorLog', errorLogSchema);
