const express = require('express');
const router = express.Router();
const { buildSearchIndex, searchFiles } = require('../../utils/searchUtils');
const { GALLERY_DL_DIR } = require('../../config');

router.get('/search', async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 3) {
    return res.status(400).json({ 
      error: 'Search query must be at least 3 characters long'
    });
  }

  try {
    const searchIndex = await buildSearchIndex(GALLERY_DL_DIR);
    const results = searchFiles(q, searchIndex);

    const simplifiedResults = results.slice(0, 100).map(result => ({
      name: result.name,
      path: result.path,
      type: result.type,
      score: result.score,
      collection: result.collection
    }));

    res.json({
      query: q,
      count: results.length,
      results: simplifiedResults
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;