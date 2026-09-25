const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  workerId: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['Flood', 'Cyclone', 'Landslide', 'Heavy Rainfall']
  },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  severity: {
    type: String,
    required: true,
    enum: ['Low', 'Medium', 'High', 'Critical']
  },
  description: { type: String },
  peopleAffected: { type: Number, default: 0 },
  version: { type: Number, default: 1 },
  appliedOperations: [String],
  fieldUpdates: {
    type: Map,
    of: Date,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Incident', incidentSchema);
