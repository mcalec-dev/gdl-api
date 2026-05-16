const log = require('./logHandler')
const { STATUS_CODES } = require('http')
/** @param {number} status */
function assertValidStatus(status) {
  if (typeof status !== 'number') throw new Error('Status must be a number')
  if (status < 100 || status > 599) {
    throw new Error('Status must be a valid HTTP status code')
  }
}
/** @param {number} status @param {string | null} message */
function resolveMessage(status, message) {
  if (message) return message
  if (!STATUS_CODES[status]) {
    log.warn(
      `Status code ${status} is not recognized. Sending response with unknown error message.`
    )
  }
  return STATUS_CODES[status] || 'Unknown Error'
}
/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {unknown} payload
 */
function sendJson(res, status, payload) {
  if (!res || !status) {
    throw new Error('Response and status are required to send a response')
  }
  assertValidStatus(status)
  return res.status(status).json(payload)
}
/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string | null} [message]
 */
function sendResponse(res, status, message = null) {
  if (!res || !status)
    throw new Error('Response and status are required to send a response')
  assertValidStatus(status)
  const finalMessage = resolveMessage(status, message)
  return res.status(status).json({
    message: finalMessage,
    status,
  })
}
sendResponse.json = sendJson

module.exports = sendResponse
