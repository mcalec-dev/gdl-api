const log = require('./logHandler')
const { STATUS_CODES } = require('http')
/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string | null} [message]
 */
function validate(res, status, message = null) {
  if (!res || !status)
    throw new Error('Response and status are required to send a response')
  if (!STATUS_CODES[status])
    log.warn(`Status code ${status} isn't a valid status code.`)
  if (message !== null && typeof message !== 'string')
    throw new Error('Message must be a string if provided')
  if (status >= 200 && status < 300 && message)
    log.warn(`Status code ${status} shouldn't include a message.`)
  if (status >= 400 && !message)
    log.warn(`Status code ${status} should include a message.`)
  if (status >= 400 && (status < 400 || status >= 600))
    log.warn(`Status code ${status} shouldn't be used for errors.`)
}
/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {object} json
 */
function sendJson(res, status, json) {
  validate(res, status)
  if (typeof json !== 'object' || json === null)
    throw new Error('JSON must be a non-null object')
  return res.status(status).json(json)
}
/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string | null} [message]
 * @returns {{ json: (json: object) => void }}
 */
function sendResponse(res, status, message = null) {
  validate(res, status, message)
  const chain = {
    /** @param {object} json */
    json: (json) => sendJson(res, status, json),
  }
  if (status === 204 && message) {
    log.warn('Status code 204 should not include a message.')
  }
  if (status === 204) {
    res.status(204).end()
  }
  if (message !== null) {
    res.status(status).json({ message, status })
  }
  return chain
}
/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string | null} [message]
 */
function sendError(res, status, message = null) {
  validate(res, status, message)
  return res.status(status).json({ message, status, error: true })
}
sendResponse.json = sendJson
sendResponse.error = sendError
module.exports = sendResponse
