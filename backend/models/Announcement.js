const mongoose = require('mongoose')
const uuid = require('uuid')
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String },
  severity: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info',
  },
  author: { type: String, required: true },
  created: { type: Date, default: Date.now(), required: true },
  modified: { type: Date, required: true },
  uuid: { type: String, default: uuid.v4 },
})
module.exports = mongoose.model('Announcements', announcementSchema)
