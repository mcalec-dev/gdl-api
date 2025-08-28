const mongoose = require('mongoose')
const uuid = require('uuid')
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  severity: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info',
  },
  created: { type: Date, default: Date.now },
  createdBy: { type: String, required: true },
  uuid: { type: String, default: uuid.v4 },
})
module.exports = mongoose.model('Announcements', announcementSchema)
