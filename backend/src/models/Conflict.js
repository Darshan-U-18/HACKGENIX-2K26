const mongoose = require('mongoose');

const conflictSchema = new mongoose.Schema({
  conflictId: { type: String, required: true },
  incidentId: { type: String, required: true },
  operationA: { type: String },
  operationB: { type: String },
  conflictingFields: [String],
  resolution: { type: String },
  resolvedValue: { type: String },
  status: { type: String, default: 'RESOLVED' },
  resolvedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('Conflict', conflictSchema);
