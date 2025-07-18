const mongoose = require('mongoose')
const uuid = require('uuid')
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, unique: true },
  password: { type: String },
  roles: [{ type: String }],
  uuid: { type: String, default: uuid.v4 },
  created: { type: Date, default: Date.now },
  oauth: {
    github: {
      id: String,
      username: String,
      avatar: String,
    },
    discord: {
      id: String,
      username: String,
      avatar: String,
    },
  },
})
module.exports = mongoose.model('User', userSchema)
