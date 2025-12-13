const mongoose = require('mongoose')
const uuid = require('uuid')
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, unique: true },
  password: { type: String },
  roles: [{ type: String }],
  uuid: { type: String, required: true, default: uuid.v4 },
  created: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned'],
    default: 'active',
  },
  sessions: [
    {
      uuid: { type: String, required: true, default: uuid.v4 },
      created: { type: Date, default: Date.now },
      modified: { type: Date, default: Date.now },
      expires: {
        type: Date,
        default: () => Date.now() + 30 * 24 * 60 * 60 * 1000,
      },
      ip: { type: String },
      useragent: { type: String },
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
module.exports = mongoose.model('User', userSchema)
