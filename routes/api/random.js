const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const debug = require('debug')('gdl-api:random');
const { GALLERY_DL_DIR } = require('../../config');
const { hasAllowedExtension, isExcluded } = require('../../utils/fileUtils');
const { fsCache } = require('../../utils/cacheUtils');

// Cache random file list with 15 minute TTL
const CACHE_KEY = 'random-file-list';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// GET /api/random
router.get('/', async (req, res) => {
    try {
        debug('Starting random image search');
        
        // Try to get file list from cache
        let allImages = fsCache.get(CACHE_KEY);
        let fromCache = true;

        if (!allImages) {
            fromCache = false;
            debug('Cache miss - scanning directory');
            allImages = await getAllImagesInDirectory(GALLERY_DL_DIR);
            
            if (allImages.length > 0) {
                fsCache.set(CACHE_KEY, allImages, CACHE_TTL);
                debug(`Cached ${allImages.length} files`);
            }
        } else {
            debug(`Using cached file list with ${allImages.length} files`);
        }

        if (allImages.length === 0) {
            debug('No images found');
            return res.status(404).json({ 
                error: 'No images found',
                path: GALLERY_DL_DIR 
            });
        }

        // Select random image
        const randomImage = allImages[Math.floor(Math.random() * allImages.length)];
        const relativePath = path.relative(GALLERY_DL_DIR, randomImage.path)
            .replace(/\\/g, '/');

        // Get base URL from request
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        
        const response = {
            file: path.basename(randomImage.path),
            path: `/gdl/api/files/${relativePath}`,
            collection: relativePath.split('/')[0],
            size: randomImage.size,
            url: `${baseUrl}/gdl/api/files/${relativePath}`,
            timestamp: new Date().toISOString(),
            fromCache
        };

        debug('Sending response');
        res.json(response);

    } catch (error) {
        debug('Error getting random image:', error);
        res.status(500).json({ 
            error: 'Failed to get random image',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

async function getAllImagesInDirectory(dir, results = []) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory() && !isExcluded(entry.name)) {
                // Recursively search subdirectories
                await getAllImagesInDirectory(fullPath, results);
            } else if (entry.isFile() && hasAllowedExtension(entry.name)) {
                const stats = await fs.stat(fullPath);
                results.push({ 
                    path: fullPath,
                    size: stats.size,
                    modified: stats.mtime
                });
            }
        }
        
        return results;
    } catch (error) {
        debug('Error scanning directory:', dir, error);
        return results; // Return whatever we found so far
    }
}

// Periodically refresh the cache in the background
setInterval(async () => {
    try {
        debug('Refreshing file cache');
        const files = await getAllImagesInDirectory(GALLERY_DL_DIR);
        if (files.length > 0) {
            fsCache.set(CACHE_KEY, files, CACHE_TTL);
            debug(`Refreshed cache with ${files.length} files`);
        }
    } catch (error) {
        debug('Error refreshing cache:', error);
    }
}, CACHE_TTL / 2); // Refresh halfway through TTL

module.exports = router;