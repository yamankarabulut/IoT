const mongoose = require('mongoose');

const mqttDataSchema = new mongoose.Schema({
    sensor_id: { type: String, required: true },
    temperature: Number,
    humidity: Number,
    timestamp: Number,
    user_id: String,
}, { timestamps: true });

module.exports = mongoose.model('MqttData', mqttDataSchema);
