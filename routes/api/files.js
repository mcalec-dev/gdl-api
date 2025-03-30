const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { GALLERY_DL_DIR, PAGE_SIZE } = require('../../config'); // Add PAGE_SIZE to imports
const { isExcluded, hasAllowedExtension, getAllDirectoriesAndFiles, normalizeFileName } = require('../../utils/fileUtils');
const { normalizeUrl } = require('../../utils/urlUtils');
const pathUtils = require('../../utils/pathUtils');
const debug = require('debug')('gdl-api:files');

// GET /api/files/ - List root directory
router.get(['/', ''], async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        debug('GALLERY_DL_DIR value:', GALLERY_DL_DIR);
        debug('Listing root directory:', GALLERY_DL_DIR);
        
        // Check if directory exists and is accessible
        try {
            const stats = await fs.stat(GALLERY_DL_DIR);
            if (!stats.isDirectory()) {
                throw new Error('GALLERY_DL_DIR is not a directory');
            }
        } catch (error) {
            debug('Directory access error:', error);
            return res.status(500).json({ 
                error: 'Failed to access gallery directory',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }

        // Only get top-level directories without recursion
        const entries = await fs.readdir(GALLERY_DL_DIR, { withFileTypes: true });
        debug('Found entries:', entries.length);

        const directories = entries
            .filter(entry => {
                try {
                    return entry.isDirectory() && !isExcluded(entry.name);
                } catch (err) {
                    debug('Error checking entry:', entry.name, err);
                    return false;
                }
            })
            .map(entry => ({
                name: entry.name,
                type: 'directory',
                size: null,
                modified: new Date(),
                path: `/gdl/api/files/${entry.name}`,
                url: `${req.protocol}://${req.get('host')}/gdl/api/files/${entry.name}`
            }));

        debug('Filtered directories:', directories.length);

        // Handle pagination
        const total = directories.length;
        const totalPages = Math.ceil(total / PAGE_SIZE);
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const paginatedDirs = directories.slice(start, end);

        res.json({
            path: '/gdl/api/files',
            contents: paginatedDirs,
            pagination: {
                total,
                totalPages,
                currentPage: page,
                pageSize: PAGE_SIZE
            }
        });
    } catch (error) {
        debug('Error listing directory:', error);
        res.status(500).json({ 
            error: 'Failed to list directory',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update the collection route handler
router.get(['/:collection', '/:collection/*'], async (req, res) => {
    try {
        const collection = pathUtils.normalizeString(req.params.collection);
        const subPath = req.params[0] ? pathUtils.normalizeString(req.params[0]) : '';
        
        debug('Request params:', {
            collection,
            subPath,
            query: req.query
        });

        const normalizedGalleryDir = path.resolve(GALLERY_DL_DIR);
        const fullPath = path.join(normalizedGalleryDir, collection, subPath);
        const realPath = path.resolve(fullPath);

        debug('Path resolution:', {
            normalizedGalleryDir,
            fullPath,
            realPath
        });

        // Security checks
        if (!realPath.startsWith(normalizedGalleryDir)) {
            debug('Path traversal attempt:', realPath);
            return res.status(403).json({ error: 'Access denied - Invalid path' });
        }

        if (isExcluded(collection)) {
            debug('Attempt to access excluded collection:', collection);
            return res.status(403).json({ error: 'Access denied - Collection excluded' });
        }

        // Check if path exists before proceeding
        try {
            await fs.access(realPath);
        } catch (error) {
            debug('Path not found:', realPath);
            return res.status(404).json({ 
                error: 'Path not found',
                path: `/${collection}${subPath ? '/' + subPath : ''}`
            });
        }

        const stats = await fs.stat(realPath);
        
        if (stats.isDirectory()) {
            const page = parseInt(req.query.page) || 1;
            const { items, total, totalPages, currentPage } = await getAllDirectoriesAndFiles(realPath, '', 0, false, page);
            
            const formattedContents = items.map(item => ({
                name: item.name,
                type: item.type,
                size: item.size,
                modified: item.modified,
                // Fix the path to prevent duplication
                path: pathUtils.normalizePath(path.relative(normalizedGalleryDir, item.fullPath)),
                url: item.type === 'file' 
                    ? `${req.baseUrl}/${pathUtils.normalizeAndEncodePath(path.relative(normalizedGalleryDir, item.fullPath))}`
                    : `/gdl/api/files/${pathUtils.normalizeAndEncodePath(path.relative(normalizedGalleryDir, item.fullPath))}`
            }));

            res.json({
                // Fix the path prefix
                path: pathUtils.normalizePath(path.relative(normalizedGalleryDir, realPath)),
                contents: formattedContents,
                pagination: {
                    total,
                    totalPages,
                    currentPage,
                    pageSize: PAGE_SIZE
                }
            });
        } else if (stats.isFile()) {
            if (!hasAllowedExtension(realPath)) {
                debug('File type not allowed:', path.extname(realPath));
                return res.status(403).json({ error: 'File type not allowed' });
            }

            // Handle image resizing
            const { w, h, x } = req.query;
            let width = parseInt(w);
            let height = parseInt(h);
            let scale = parseInt(x);

            if (scale || width || height) {
                try {
                    let resizeOptions = {};
                    
                    if (scale) {
                        // Get original image metadata
                        const metadata = await sharp(realPath).metadata();
                        
                        // Calculate new dimensions based on percentage
                        width = Math.round(metadata.width * (scale / 100));
                        height = Math.round(metadata.height * (scale / 100));
                        resizeOptions = { 
                            width, 
                            height,
                            // Use different kernels based on scaling factor
                            kernel: scale > 100 ? 'lanczos2' : 'mitchell',
                            // Add fastShrink: true for better performance when downscaling
                            fastShrink: scale < 100
                        };
                    } else {
                        // Handle specific dimensions (w and h parameters)
                        if (width) resizeOptions.width = width;
                        if (height) resizeOptions.height = height;
                        
                        // Check if we're upscaling based on either dimension
                        const metadata = await sharp(realPath).metadata();
                        const isUpscaling = width > metadata.width || height > metadata.height;
                        
                        resizeOptions.kernel = isUpscaling ? 'lanczos2' : 'mitchell';
                        resizeOptions.fastShrink = !isUpscaling;
                    }

                    const imageStream = sharp(realPath)
                        // First pass: Noise reduction and initial resize
                        .median(1) // Light noise reduction
                        .resize({
                            ...resizeOptions,
                            kernel: 'lanczos3'
                        })
                        // Second pass: Enhance details
                        .sharpen({
                            sigma: 0.8,    // Increase radius of sharpening
                            m1: 0.6,       // Sharpening flat areas
                            m2: 0.45,       // Sharpening edges
                            x1: 5,         // Threshold flat areas
                            y2: 20         // Threshold edges
                        })
                        .removeAlpha()     // Remove alpha channel if present
                        .withMetadata();

                    res.set({
                        'Content-Type': `image/${path.extname(realPath).toLowerCase().slice(1)}`,
                        'Cache-Control': 'public, max-age=86400',
                        'X-Content-Type-Options': 'nosniff'
                    });

                    imageStream.pipe(res);
                    return;
                } catch (error) {
                    debug('Image resize error:', error);
                    return res.status(500).json({ error: 'Image processing failed' });
                }
            }

            // If no resizing, serve original file
            res.set({
                'Content-Type': `image/${path.extname(realPath).toLowerCase().slice(1)}`,
                'Cache-Control': 'public, max-age=86400',
                'X-Content-Type-Options': 'nosniff'
            });
            
            res.sendFile(realPath);
        }

    } catch (error) {
        debug('Error in route handler:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

module.exports = router;