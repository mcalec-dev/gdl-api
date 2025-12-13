const mongoose = require('mongoose')
const uuid = require('uuid')
const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  paths: {
    local: { type: String, required: true },
    relative: { type: String, required: true },
    remote: { type: String, required: true },
  },
  size: { type: Number, required: true },
  type: { type: String, required: true },
  collection: { type: String, required: true },
  author: { type: String, required: true },
  mime: { type: String, required: true },
  created: { type: Date, required: true },
  modified: { type: Date, required: true },
  tags: [{ type: String, index: true }],
  meta: {},
  uuid: { type: String, required: true, default: uuid.v4 },
})
module.exports = mongoose.model('File', fileSchema)
