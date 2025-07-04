const express = require('express');
const debug = require('debug')('gdl-api:api:download');
const router = express.Router();
const { HOST, ALT_HOST } = require('../../config');
async function handleDownload(req, res) {
  let q = req.query.q || req.body?.q;
  if (!q) {
    return res.status(400).json({ error: 'Missing ?q= parameter' });
  }
  q = q.trim();
  let allowedHosts = [];
  if (HOST) allowedHosts.push(HOST.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  if (ALT_HOST) allowedHosts.push(ALT_HOST.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  let parsedUrl;
  try {
    parsedUrl = new URL(q);
  } catch (error) {
    debug('Malformed URL:', error.message);
    return res.status(400).json({ error: 'Malformed URL' });
  }
  const urlHostParam = parsedUrl.hostname.toLowerCase();
  if (!allowedHosts.some(h => urlHostParam === h.replace(/:.*/, '') || urlHostParam === ('www.' + h.replace(/:.*/, '')))) {
    return res.status(403).json({ error: 'URL host not allowed' });
  }
  const https = require('https');
  const http = require('http');
  const protocol = parsedUrl.protocol === 'https:' ? https : http;
  protocol.get(q, (fileRes) => {
    if (fileRes.statusCode !== 200) {
      return res.status(404).json({ error: 'File not found on remote host' });
    }
    const filename = decodeURIComponent((parsedUrl.pathname || '').split('/').pop() || 'download');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', fileRes.headers['content-type'] || 'application/octet-stream');
    fileRes.pipe(res);
  }).on('error', (err) => {
    debug('Download error:', err);
    return res.status(404).json({ error: 'File not found' });
  });
}
router.get('/', handleDownload);
router.post('/', express.json(), handleDownload);
module.exports = router;
