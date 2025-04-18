const ViewLog = require('../models/viewLog');

const logViewMiddleware = async (req, res, next) => {
  try {
    await ViewLog.create({
      user_id: req.user.user_id,
      timeStamp: Date.now(),
      action: 'viewed_logs',
    });
  } catch (err) {
    console.error('Error logViewMiddleware:', err.message);
  }
  next();
};

module.exports = logViewMiddleware;