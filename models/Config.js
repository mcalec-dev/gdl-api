const mongoose = require('mongoose')
const uuid = require('uuid')
const configSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  created: { type: Date, default: Date.now(), required: true },
  modified: { type: Date, required: true },
  uuid: { type: String, default: uuid.v4 },
})
module.exports = mongoose.model('Config', configSchema)
