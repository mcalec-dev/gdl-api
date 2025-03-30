const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const debug = require('debug')('gdl-api:stats');
const { fsCache, searchCache } = require('../../utils/cacheUtils');
const { isExcluded, hasAllowedExtension, getAllDirectoriesAndFiles } = require('../../utils/fileUtils');
const { GALLERY_DL_DIR } = require('../../config');

// Cache stats for 5 minutes
const STATS_CACHE_KEY = 'api-stats';
const STATS_CACHE_TTL = 5 * 60 * 1000;

router.get('/', async (req, res) => {
    try {
        // Try to get stats from cache
        const cachedStats = fsCache.get(STATS_CACHE_KEY);
        if (cachedStats) {
            debug('Returning cached stats');
            return res.json(cachedStats);
        }

        debug('Generating fresh stats');
        const stats = {
            api: {
                version: process.env.npm_package_version || '1.0.0',
                uptime: process.uptime(),
                memory: {
                    ...process.memoryUsage(),
                    formatted: {
                        heapUsed: convertToHumanSize(process.memoryUsage().heapUsed),
                        rss: convertToHumanSize(process.memoryUsage().rss)
                    }
                },
                timestamp: new Date().toISOString(),
                node: process.version
            },
            collections: {
                total: 0,
                totalSize: 0,
                totalFiles: 0,
                totalDirectories: 0,
                averageFileSize: 0,
                fileTypes: {},
                details: {},
                humanReadableSize: '0 B'
            },
            cache: {
                fsCache: {
                    size: fsCache.size,
                    keys: Array.from(fsCache.keys()),
                    stats: {
                        hits: fsCache.stats?.hits || 0,
                        misses: fsCache.stats?.misses || 0
                    }
                },
                searchCache: {
                    size: searchCache.size,
                    keys: Array.from(searchCache.keys()),
                    stats: {
                        hits: searchCache.stats?.hits || 0,
                        misses: searchCache.stats?.misses || 0
                    }
                }
            }
        };

        const collections = await fs.readdir(GALLERY_DL_DIR);
        stats.collections.total = collections.length;

        // Process collections in parallel
        await Promise.all(collections.map(collection => 
            processCollection(collection, stats).catch(err => {
                debug(`Error processing collection ${collection}:`, err);
            })
        ));

        // Calculate final statistics
        if (stats.collections.totalFiles > 0) {
            stats.collections.averageFileSize = stats.collections.totalSize / stats.collections.totalFiles;
        }

        stats.collections.humanReadableSize = convertToHumanSize(stats.collections.totalSize);
        stats.collections.summary = calculateSummary(stats);

        // Sort file types by count
        stats.collections.fileTypes = Object.fromEntries(
            Object.entries(stats.collections.fileTypes)
                .sort(([,a], [,b]) => b.count - a.count)
        );

        // Cache the results
        fsCache.set(STATS_CACHE_KEY, stats, STATS_CACHE_TTL);
        debug('Stats cached for', STATS_CACHE_TTL/1000, 'seconds');

        res.json(stats);
    } catch (error) {
        debug('Error generating API stats:', error);
        res.status(500).json({ 
            error: 'Failed to generate API statistics',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

async function processCollection(collection, stats) {
    const collectionPath = path.join(GALLERY_DL_DIR, collection);
    try {
        const dirStats = await fs.stat(collectionPath);
        if (dirStats.isDirectory() && !isExcluded(collection)) {
            stats.collections.totalDirectories++;
            stats.collections.details[collection] = {
                files: 0,
                size: 0,
                lastModified: null,
                fileTypes: {}
            };
            
            const files = await getAllDirectoriesAndFiles(collectionPath);
            for (const file of files) {
                if (file.type === 'file' && hasAllowedExtension(file.name)) {
                    const ext = path.extname(file.name).toLowerCase();
                    const fileSize = file.size || 0;
                    
                    // Update global stats
                    stats.collections.totalFiles++;
                    stats.collections.totalSize += fileSize;
                    
                    // Update file type stats
                    if (!stats.collections.fileTypes[ext]) {
                        stats.collections.fileTypes[ext] = { count: 0, size: 0 };
                    }
                    stats.collections.fileTypes[ext].count++;
                    stats.collections.fileTypes[ext].size += fileSize;
                    
                    // Update collection details
                    stats.collections.details[collection].files++;
                    stats.collections.details[collection].size += fileSize;
                    if (!stats.collections.details[collection].lastModified || 
                        file.modified > stats.collections.details[collection].lastModified) {
                        stats.collections.details[collection].lastModified = file.modified;
                    }
                    
                    // Update collection file types
                    if (!stats.collections.details[collection].fileTypes[ext]) {
                        stats.collections.details[collection].fileTypes[ext] = 0;
                    }
                    stats.collections.details[collection].fileTypes[ext]++;
                }
            }
            
            // Add human readable size to collection details
            stats.collections.details[collection].humanReadableSize = 
                convertToHumanSize(stats.collections.details[collection].size);
        }
    } catch (error) {
        debug(`Error processing collection ${collection}:`, error);
    }
}

function convertToHumanSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = Math.abs(bytes);
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function calculateSummary(stats) {
    const fileTypes = stats.collections.fileTypes;
    return {
        averageFilesPerCollection: (stats.collections.totalFiles / stats.collections.total).toFixed(2),
        averageFileSizeFormatted: convertToHumanSize(stats.collections.averageFileSize),
        mostCommonFileTypes: Object.entries(fileTypes)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 3)
            .map(([ext, data]) => ({
                extension: ext,
                count: data.count,
                size: convertToHumanSize(data.size)
            })),
        largestCollection: Object.entries(stats.collections.details)
            .sort((a, b) => b[1].size - a[1].size)[0]?.[0] || 'none',
        newestCollection: Object.entries(stats.collections.details)
            .sort((a, b) => b[1].lastModified - a[1].lastModified)[0]?.[0] || 'none'
    };
}

module.exports = router;