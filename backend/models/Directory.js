const mongoose = require('mongoose')
const uuid = require('uuid')
const directorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  paths: {
    local: { type: String, required: true },
    relative: { type: String, required: true },
    remote: { type: String, required: true },
  },
  size: { type: Number, required: true },
  created: { type: Date },
  modified: { type: Date },
  tags: [{ type: String, index: true }],
  meta: {},
  uuid: { type: String, required: true, default: uuid.v4 },
})
module.exports = mongoose.model('Directory', directorySchema)
