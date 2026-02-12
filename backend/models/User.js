const mongoose = require('mongoose')
module.exports = mongoose.model(
  'User',
  new mongoose.Schema(
    {
      username: { type: String, required: true, unique: true, index: true },
      email: { type: String, unique: true, index: true },
      password: { type: String, required: true, index: true },
      roles: { type: Array, required: true, index: true },
      created: { type: Date, required: true, index: true },
      status: {
        type: String,
        enum: ['active', 'inactive', 'banned'],
        default: 'active',
      },
      sessions: [
        {
          uuid: { type: String, required: true, index: true, unique: true },
          created: { type: Date, required: true, index: true },
          modified: { type: Date, required: true, index: true },
          expires: { type: Date, required: true, index: true },
          ip: { type: String, required: true, index: true },
          useragent: { type: String, required: true, index: true },
        },
      ],
      oauth: {
        github: {
          id: String,
          username: String,
          email: String,
          avatar: String,
        },
        discord: {
          id: String,
          username: String,
          email: String,
          avatar: String,
        },
      },
      uuid: { type: String, required: true, index: true, unique: true },
    },
    { versionKey: false }
  )
)
