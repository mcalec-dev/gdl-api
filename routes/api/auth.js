const express = require('express');
const router = express.Router();
const { validateUser } = require('../../utils/authUtils');
const { getAPIUrl } = require('../../utils/urlUtils');
const debug = require('debug')('gdl-api:api:auth');
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  debug(`Login attempt for user: ${username}`);
  if (!username || !password) {
    debug('Login failed: Username or password missing');
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (await validateUser(username, password)) {
    debug(`User ${username} logged in successfully`);
    req.session.authenticated = true;
    req.session.username = username;
    res.json({ success: true });
  } else {
    debug(`Login failed for user: ${username}`);
    res.status(401).json({ error: 'Invalid username or password' });
  }
});
router.post('/logout', (req, res) => {
  debug(`User ${req.session?.username || 'Unknown'} logged out`);
  req.session.destroy();
  res.json({ success: true });
});
router.get('/logout', (req, res) => {
  debug(`User ${req.session?.username || 'Unknown'} logged out (GET request)`);
  req.session.destroy();
  res.json({ success: true });
});
router.get('/check', (req, res) => {
  const authenticated = req.session && req.session.authenticated || false;
  const username = req.session?.username || null;
  debug(`Auth check: authenticated=${authenticated}, username=${username}`);
  res.json({
    authenticated: authenticated,
    username: username,
  });
});
/* @swagger
 * /api/auth:
 *   get:
 *     summary: Get authentication routes information
 *     responses:
 *       200:
 *         description: Authentication routes information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 login_url:
 *                   type: string
 *                 logout_url:
 *                   type: string
 *                 check_url:
 *                   type: string
 */
router.get('/', (req, res) => {
  const baseURL = getAPIUrl(req) + `/auth`;
  debug(`Auth routes info requested`);
  res.json({
    login_url: baseURL + '/login',
    logout_url: baseURL + '/logout',
    check_url: baseURL + '/check',
  });
});
module.exports = router;