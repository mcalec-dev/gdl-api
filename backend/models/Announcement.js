const mongoose = require('mongoose')
const uuid = require('uuid')
module.exports = mongoose.model(
  'Announcement',
  new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, required: false },
    severity: {
      type: String,
      enum: ['info', 'success', 'warning', 'error'],
      default: 'info',
    },
    author: { type: String, required: true },
    created: { type: Date, required: true },
    modified: { type: Date, required: true },
    uuid: { type: String, required: true, default: uuid.v4 },
  })
)
