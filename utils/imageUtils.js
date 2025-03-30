const sharp = require('sharp');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const crypto = require('crypto');
const debug = require('debug')('gdl-api:thumbnails');

const THUMBNAILS_DIR = path.join(__dirname, '..', 'public', 'thumbnails');

// Initialize thumbnails directory
(async () => {
    try {
        await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
        debug(`Thumbnails directory ready: ${THUMBNAILS_DIR}`);
    } catch (error) {
        console.error('Failed to create thumbnails directory:', error);
    }
})();

// Update the generateThumbnail function

async function generateThumbnail(filePath) {
    if (!fsSync.existsSync(filePath)) {
        debug(`Source file not found: ${filePath}`);
        return null;
    }

    try {
        const stats = await fs.stat(filePath);
        const hash = crypto
            .createHash('md5')
            .update(`${filePath}:${stats.mtime.getTime()}`)
            .digest('hex');

        // Instead of generating and storing thumbnails, return a URL with query params
        const fileUrl = filePath.replace(GALLERY_DL_DIR, '/gdl/api/files');
        return `${fileUrl}`;

    } catch (error) {
        console.error(`Thumbnail generation failed for: ${filePath}`, error);
        return null;
    }
}

module.exports = {
    generateThumbnail,
    THUMBNAILS_DIR
};