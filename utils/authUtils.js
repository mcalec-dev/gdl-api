const fs = require('fs').promises
const path = require('path')
const DATABASE = path.join(__dirname, '../db')
const DEFAULT = 'default'
async function getUserConfig(username) {
  let user = username || DEFAULT
  const configPath = path.join(DATABASE, user, 'config.json')
  try {
    const data = await fs.readFile(configPath, 'utf8')
    return JSON.parse(data)
  } catch {
    if (user !== DEFAULT) {
      const defPath = path.join(DATABASE, DEFAULT, 'config.json')
      const data = await fs.readFile(defPath, 'utf8')
      return JSON.parse(data)
    }
    return { username: '', password: '', permission: 'visitor' }
  }
}
async function validateUser(username, password) {
  const config = await getUserConfig(username)
  if (!config || !config.password) return false
  if (!config.password && !password) return true
  // Unsafe, but works for now
  // Otherwise, compare plaintext
  return config.password === password
}
function isAuthenticated(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next()
  }
  res.status(401).json({
    message: 'Not authenticated',
    status: 401,
  })
}
async function getUserPermission(req) {
  if (req.session && req.session.authenticated && req.session.username) {
    const config = await getUserConfig(req.session.username)
    return config.permission || DEFAULT
  }
  const config = await getUserConfig(DEFAULT)
  return config.permission || DEFAULT
}
module.exports = {
  isAuthenticated,
  validateUser,
  getUserConfig,
  getUserPermission,
}
