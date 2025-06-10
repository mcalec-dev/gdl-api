const express = require('express');
const path = require('path');
const router = express.Router();
const { walkAndSearchFiles } = require('../../utils/searchUtils');
const { GALLERY_DL_DIR } = require('../../config');
const debug = require('debug')('gdl-api:search');
const { normalizeUrl } = require('../../utils/urlUtils');
const { normalizePath } = require('../../utils/pathUtils');

const MAX_SEARCH_RESULTS = 1000;

router.get('/', async (req, res) => {
  const {
    q
  } = req.query;
  debug('Searching for: %s', q);

  if (!q || q.length === 0) {
    return res.status(400).json({
      error: 'Invalid search query'
    });
  }

  try {
    const results = [];
    for await (const result of walkAndSearchFiles(GALLERY_DL_DIR, q.toLowerCase(), MAX_SEARCH_RESULTS)) {
      results.push(result);
      if (results.length >= MAX_SEARCH_RESULTS) break;
    }

    const simplifiedResults = results.map(result => {
      const relativePath = path.relative(GALLERY_DL_DIR, result.path);
      const pathParts = relativePath.split(path.sep);
      const collection = pathParts[0] || '';

      // Normalize the path
      const normalizedPath = normalizePath(relativePath).replace(/^F:\/gallery-dl\//i, '');

      // Generate and normalize the URL
      const {
        url
      } = normalizeUrl(req, relativePath, result.type === 'directory');
      const normalizedUrl = url.replace(/F:\/gdl-api\//i, '');

      return {
        name: result.name,
        type: result.type,
        collection: collection,
        path: normalizedPath,
        url: normalizedUrl,
      };
    });

    res.json({
      query: q,
      count: results.length,
      results: simplifiedResults,
    });
  } catch (error) {
    debug('Search error:', error.stack);
    res.status(500).json({
      error: `Search failed: ${error.message}`
    });
  }
});

module.exports = router;