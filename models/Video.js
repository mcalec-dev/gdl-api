const mongoose = require('mongoose')
const uuid = require('uuid')
const videoSchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  mimetype: { type: String, required: true },
  created: { type: Date },
  modified: { type: Date },
  uuid: { type: String, default: uuid.v4 },
})
module.exports = mongoose.model('Video', videoSchema)
