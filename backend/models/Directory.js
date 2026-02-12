const mongoose = require('mongoose')
module.exports = mongoose.model(
  'Directory',
  new mongoose.Schema(
    {
      name: { type: String, required: true, unique: true, index: true },
      paths: {
        local: { type: String, required: true, index: true },
        relative: { type: String, required: true, index: true },
        remote: { type: String, required: true, index: true },
      },
      size: { type: Number, required: true, index: true },
      collection: { type: String, required: true, index: true },
      author: { type: String, required: false, index: true },
      created: { type: Date, required: true, index: true },
      modified: { type: Date, required: true, index: true },
      tags: { type: Array, required: true, index: true },
      meta: { type: Object, required: false, index: false },
      uuid: { type: String, required: true, index: true, unique: true },
    },
    { suppressReservedKeysWarning: true, versionKey: false }
  )
)
