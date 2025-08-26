const mongoose = require('mongoose')
const uuid = require('uuid')
const imageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  mimetype: { type: String, required: true },
  created: { type: Date },
  modified: { type: Date },
  tags: [{ type: String, index: true }],
  uuid: { type: String, default: uuid.v4 },
  exif: {},
})
module.exports = mongoose.model('Image', imageSchema)
