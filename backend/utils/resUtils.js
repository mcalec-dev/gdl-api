const log = require('./logHandler')
const { STATUS_CODES } = require('http')
/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string | null} [message]
 */
module.exports = (res, status, message = null) => {
  if (!res || !status)
    throw new Error('Response and status are required to send a response')
  if (typeof status !== 'number') throw new Error('Status must be a number')
  if (status < 100 || status > 599)
    throw new Error('Status must be a valid HTTP status code')
  if (!STATUS_CODES[status])
    log.warn(
      `Status code ${status} is not recognized. Sending response with unknown error message.`
    )
  if (!message) message = STATUS_CODES[status] || null
  if (message === null) message = 'Unknown Error'
  res.status(status).json({
    message,
    status,
  })
}
