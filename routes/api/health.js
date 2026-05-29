const router = require('express').Router()
const log = require('../../utils/logHandler')
const sendResponse = require('../../utils/resUtils')
router.get('/', async (req, res) => {
  log.debug('Sent health check response for GET request')
  return sendResponse.error(res, 204)
})
router.post('/', async (req, res) => {
  log.debug('Sent health check response for POST request')
  return sendResponse.error(res, 204)
})
router.put('/', async (req, res) => {
  log.debug('Sent health check response for PUT request')
  return sendResponse.error(res, 204)
})
router.delete('/', async (req, res) => {
  log.debug('Sent health check response for DELETE request')
  return sendResponse.error(res, 204)
})
router.patch('/', async (req, res) => {
  log.debug('Sent health check response for PATCH request')
  return sendResponse.error(res, 204)
})
router.options('/', async (req, res) => {
  log.debug('Sent health check response for OPTIONS request')
  return sendResponse.error(res, 204)
})
router.head('/', async (req, res) => {
  log.debug('Sent health check response for HEAD request')
  return sendResponse.error(res, 204)
})
module.exports = router
