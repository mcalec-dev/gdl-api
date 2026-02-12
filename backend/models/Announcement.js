const mongoose = require('mongoose')
module.exports = mongoose.model(
  'Announcement',
  new mongoose.Schema(
    {
      title: { type: String, required: true, index: true },
      message: { type: String, required: false, index: false },
      severity: {
        type: String,
        enum: ['info', 'success', 'warning', 'error'],
        default: 'info',
      },
      author: { type: String, required: true, index: true },
      created: { type: Date, required: true, index: true },
      modified: { type: Date, required: true, index: true },
      uuid: { type: String, required: true, index: true, unique: true },
    },
    { versionKey: false }
  )
)
