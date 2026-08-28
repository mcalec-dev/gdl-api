const mongoose = require('mongoose')
module.exports = mongoose.model(
  'Pool',
  new mongoose.Schema(
    {
      name: { type: String, required: true, index: true },
      description: { type: String, required: false, index: false },
      created: { type: Date, required: true, index: true },
      modified: { type: Date, required: true, index: true },
      tags: { type: Array, required: false, index: true },
      files: [{ type: String, required: true, index: false }],
      uuid: { type: String, required: true, index: true, unique: true },
    },
    { suppressReservedKeysWarning: true, versionKey: false }
  )
)
