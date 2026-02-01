const mongoose = require('mongoose')
const uuid = require('uuid')
module.exports = mongoose.model(
  'Directory',
  new mongoose.Schema(
    {
      name: { type: String, required: true },
      paths: {
        local: { type: String, required: true },
        relative: { type: String, required: true },
        remote: { type: String, required: true },
      },
      size: { type: Number, required: true },
      collection: { type: String, required: true },
      author: { type: String, required: true },
      created: { type: Date, required: true },
      modified: { type: Date, required: true },
      tags: { type: Array, required: true, index: true },
      meta: { type: Object, required: false },
      uuid: { type: String, required: true, default: uuid.v4 },
    },
    { suppressReservedKeysWarning: true, versionKey: false }
  )
)
