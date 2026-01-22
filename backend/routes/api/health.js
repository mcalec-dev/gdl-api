/* future health endpoint */
const router = require('express').Router()
const debug = require('debug')('gdl-api:api:health')
const { requireRole } = require('../../utils/authUtils')
/**
 * @swagger
 * /api/health/:
 *   get:
 *     summary: Health check endpoint
 *     description: Check the health status of the API (future implementation)
 *     responses:
 *       501:
 *         description: Not Implemented - This endpoint is planned for future implementation
 */
router.get('', requireRole('user'), async (req, res) => {
  debug('Health endpoint is not implemented yet.')
  return res.status(501).json({
    message: 'Not Implemented',
    status: 501,
  })
})
module.exports = router
