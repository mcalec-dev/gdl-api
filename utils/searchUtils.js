const lunr = require('lunr');
const { getAllDirectoriesAndFiles } = require('./fileUtils');
const { searchCache } = require('./cacheUtils');
const path = require('path');
const fs = require('fs').promises;
const { GALLERY_DL_DIR } = require('../config');

// Cache warmup interval (5 minutes)
const CACHE_WARMUP_INTERVAL = 5 * 60 * 1000;

// Initialize search index in background
async function initializeSearchIndex(basePath) {
  try {
    await buildSearchIndex(basePath);
    console.log('Search index initialized');
  } catch (error) {
    console.error('Failed to initialize search index:', error);
  }
}

async function buildSearchIndex(basePath) {
  // Check if index exists in cache
  let searchIndex = searchCache.get('fileIndex');
  if (searchIndex) {
    return searchIndex;
  }

  console.time('buildSearchIndex');
  const items = await getAllDirectoriesAndFiles(basePath);
  
  // Process items in batches for better memory usage
  const batchSize = 1000;
  const documents = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    for (const item of batch) {
      const pathParts = item.path.split('/').filter(Boolean);
      const collection = pathParts[0];
      const isCollection = pathParts.length === 1 && item.type === 'directory';
      
      const doc = {
        id: item.path,
        name: item.name,
        path: item.path,
        type: item.type,
        ext: path.extname(item.name).toLowerCase(),
        collection: collection,
        isCollection: isCollection,
        pathSegments: pathParts.join(' '),
        parentDir: path.dirname(item.path).split('/').pop(),
      };

      // Try to read metadata from adjacent .json file if it exists
      if (item.type === 'file') {
        try {
          const metadataPath = item.fullPath.replace(/\.[^/.]+$/, '.json');
          const metadataExists = await fs.access(metadataPath)
            .then(() => true)
            .catch(() => false);

          if (metadataExists) {
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            doc.metadata = metadata;
            doc.metadataText = JSON.stringify(metadata); // For full-text search
          }
        } catch (error) {
          console.warn(`Failed to read metadata for ${item.path}:`, error);
        }
      }

      documents.push(doc);
    }
  }

  // Build optimized search index
  searchIndex = lunr(function() {
    this.field('name', { boost: 10 });
    this.field('collection', { boost: 8 });
    this.field('parentDir', { boost: 5 });
    this.field('pathSegments', { boost: 3 });
    this.field('type', { boost: 2 });
    this.field('ext');
    this.field('metadataText');

    // Add metadata field if available
    this.field('metadata', { boost: 4 });

    // Store reference to document
    this.ref('id');

    // Optimize tokenizer for paths
    this.tokenizer.separator = /[\s/\-_]+/;

    documents.forEach(doc => {
      this.add(doc);
    });
  });

  // Store in cache
  searchCache.set('documents', documents);
  searchCache.set('fileIndex', searchIndex);
  
  console.timeEnd('buildSearchIndex');
  return searchIndex;
}

function searchFiles(query, index) {
  if (!index) throw new Error('Search index not initialized');
  
  // Get cached documents
  const documents = searchCache.get('documents');
  if (!documents) throw new Error('Documents not found in cache');

  // Clean and prepare query
  const cleanQuery = query.trim().toLowerCase();
  
  try {
    console.time('search');
    const results = index.search(cleanQuery);
    console.timeEnd('search');

    return results
      .filter(result => result.score > 0.01) // Filter low relevance results
      .map(result => {
        const doc = documents.find(d => d.id === result.ref);
        return doc ? { ...doc, score: result.score } : null;
      })
      .filter(Boolean);
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// Warm up cache periodically
setInterval(() => {
  initializeSearchIndex(GALLERY_DL_DIR).catch(error => {
    console.error('Failed to warm up search index:', error);
  });
}, CACHE_WARMUP_INTERVAL);

module.exports = {
  buildSearchIndex,
  searchFiles,
  initializeSearchIndex
};