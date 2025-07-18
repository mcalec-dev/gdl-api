const mongoose = require('mongoose')
const uuid = require('uuid')
const directorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  created: { type: Date },
  modified: { type: Date },
  uuid: { type: String, default: uuid.v4 },
  files: [],
})
module.exports = mongoose.model('Directory', directorySchema)
