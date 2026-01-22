const router = require('express').Router()
const { requireRole } = require('../../../utils/authUtils')
const debug = require('debug')('gdl-api:api:user:session')
/**
 * @swagger
 * /api/user/session/:
 *   get:
 *     summary: Retrieve user sessions
 *     description: Get a list of all active sessions for the authenticated user
 *     responses:
 *       200:
 *         description: List of user sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   uuid:
 *                     type: string
 *                   modified:
 *                     type: string
 *                     format: date-time
 *                   ip:
 *                     type: string
 *                   useragent:
 *                     type: string
 *       401:
 *         description: User not authenticated
 *       500:
 *         description: Internal server error
 *
 * /api/user/session/{uuid}:
 *   delete:
 *     summary: Delete a specific user session
 *     description: Delete (logout) a specific session by UUID
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: Session UUID to delete
 *     responses:
 *       204:
 *         description: Session deleted successfully
 *       400:
 *         description: Missing or invalid UUID
 *       401:
 *         description: User not authenticated
 *       500:
 *         description: Internal server error
 */
router.get('', requireRole('user'), async (req, res) => {
  try {
    debug('Getting sessions for:', req.user.username || 'user')
    return res.json(req.user.sessions)
  } catch (error) {
    debug('Failed to get sessions for user:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
router.delete(['/:uuid', '/:uuid/'], requireRole('user'), async (req, res) => {
  const { uuid } = req.params
  if (!uuid) {
    debug('No UUID provided for session deletion')
    return res.status(400).json({
      message: 'Bad Request',
      status: 400,
    })
  }
  try {
    req.user.sessions = (req.user.sessions || []).filter((s) => s.uuid !== uuid)
    await req.user.save()
    debug('Deleted session', uuid, 'for user:', req.user.username || 'user')
    return res.status(204).send()
  } catch (error) {
    debug('Failed to delete session for user:', error)
    return res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
module.exports = router
