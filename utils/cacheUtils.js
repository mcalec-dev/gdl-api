const NodeCache = require('node-cache');
const memoryCache = require('memory-cache');

// Cache for file system operations (30 min TTL)
const fsCache = new NodeCache({ 
  stdTTL: 1800,
  checkperiod: 120,
  useClones: false
});

// Cache for search index (1 hour TTL)
const searchCache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 300,
  useClones: false
});

const clearCaches = () => {
  fsCache.flushAll();
  searchCache.flushAll();
  memoryCache.clear();
  // Remove the fsCache.clear() call since it doesn't exist
};

module.exports = {
  fsCache,
  searchCache,
  memoryCache,
  clearCaches
};