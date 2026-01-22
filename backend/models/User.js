const mongoose = require('mongoose')
const uuid = require('uuid')
module.exports = mongoose.model(
  'User',
  new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, unique: true },
    password: { type: String, required: true },
    roles: { type: Array, required: true, index: true },
    uuid: { type: String, required: true, default: uuid.v4 },
    created: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'inactive', 'banned'],
      default: 'active',
    },
    sessions: [
      {
        uuid: { type: String, required: true, default: uuid.v4 },
        created: { type: Date, required: true, default: Date.now },
        modified: { type: Date, required: true, default: Date.now },
        expires: { type: Date, required: true },
        ip: { type: String, required: true },
        useragent: { type: String, required: true },
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
  })
)
