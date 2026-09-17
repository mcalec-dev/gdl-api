const router = require('express').Router()
const log = require('../../utils/logHandler')
const sendResponse = require('../../utils/resUtils')
const { cacheControl } = require('../../utils/cacheControl')

router.get('/', cacheControl('noStore'), async (req, res) => {
  log.debug('Sent health check response for GET request')
  return sendResponse.error(res, 204)
})

router.post('/', cacheControl('noStore'), async (req, res) => {
  log.debug('Sent health check response for POST request')
  return sendResponse.error(res, 204)
})

router.put('/', cacheControl('noStore'), async (req, res) => {
  log.debug('Sent health check response for PUT request')
  return sendResponse.error(res, 204)
})

router.delete('/', cacheControl('noStore'), async (req, res) => {
  log.debug('Sent health check response for DELETE request')
  return sendResponse.error(res, 204)
})

router.patch('/', cacheControl('noStore'), async (req, res) => {
  log.debug('Sent health check response for PATCH request')
  return sendResponse.error(res, 204)
})

router.options('/', cacheControl('noStore'), async (req, res) => {
  log.debug('Sent health check response for OPTIONS request')
  return sendResponse.error(res, 204)
})

router.head('/', cacheControl('noStore'), async (req, res) => {
  log.debug('Sent health check response for HEAD request')
  return sendResponse.error(res, 204)
})

module.exports = router
