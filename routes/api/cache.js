const express = require('express');
const router = express.Router();
const { fsCache, searchCache } = require('../../utils/cacheUtils');

router.post('/cache/clear', async (req, res) => {
  try {
    fsCache.flushAll();
    searchCache.flushAll();
    
    res.json({
      message: 'Cache cleared successfully',
      status: {
        fsCache: { size: fsCache.getStats().keys },
        searchCache: { size: searchCache.getStats().keys }
      }
    });

  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

module.exports = router;