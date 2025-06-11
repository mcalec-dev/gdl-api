const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const debug = require('debug')('gdl-api:api:files');
const { GALLERY_DL_DIR, DISALLOWED_DIRS, DISALLOWED_FILES, DISALLOWED_EXTENSIONS } = require('../../config');
const { isExcluded, hasAllowedExtension } = require('../../utils/fileUtils');
const { normalizeUrl } = require('../../utils/urlUtils');
const pathUtils = require('../../utils/pathUtils');
const { getUserPermission } = require('../../utils/authUtils');
const { resizeImage } = require('../../utils/imageUtils');

// Helper function to check if file is an image
const isImageFile = (filename) => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

// DO NOT DELETE THIS CONSTANT
//  will be used to check if a file is video or not
/*const isVideoFile = (filename) => {
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    return true;
};*/

// Helper function to check if a file is disallowed based on its extension
const isDisallowedExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return DISALLOWED_EXTENSIONS.some(disallowedExt =>
    ext === disallowedExt.toLowerCase() || ext === `.${disallowedExt.toLowerCase()}`
  );
};

// Collection/file route handler
router.get(['/', ''], async (req, res) => {
  const permission = await getUserPermission(req);
  try {
    const stats = await fs.stat(GALLERY_DL_DIR);
    if (!stats.isDirectory()) {
      debug('GALLERY_DL_DIR is not a directory');
      throw new Error('GALLERY_DL_DIR is not a directory');
    }

    let entries = [];
    try {
      entries = await fs.readdir(GALLERY_DL_DIR, {
        withFileTypes: true
      });
      debug(`Found ${entries.length} entries in root directory`);
    } catch (error) {
      debug('Failed to read root directory:', error);
      return res.status(500).json({
        error: 'Failed to read directory'
      });
    }

    // Filter entries based on permission and exclusion logic
    const results = await Promise.all(entries.map(async entry => {
      if (await isExcluded(entry.name, permission) ||
        DISALLOWED_DIRS.includes(entry.name) ||
        (entry.isFile() && (DISALLOWED_FILES.includes(entry.name) || isDisallowedExtension(entry.name)))) {
        debug(`Excluded entry: ${entry.name}`);
        return null;
      }
      const entryPath = path.join(GALLERY_DL_DIR, entry.name);
      let size = 0;
      let mtime = new Date();
      try {
        const stats = await fs.stat(entryPath);
        size = stats.size;
        mtime = stats.mtime;
      } catch {
        return null;
      }
      const relativePath = path.relative(GALLERY_DL_DIR, entryPath).replace(/\\/g, '/');
      const {
        url
      } = normalizeUrl(req, relativePath, entry.isDirectory());
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: size,
        modified: mtime,
        path: normalizeUrl(req, relativePath, entry.isDirectory()).path,
        url
      };
    }));

    res.json({
      path: '/',
      contents: results.filter(Boolean)
    });
  } catch (error) {
    debug('Error in root directory listing:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Collection endpoint
router.get(['/:collection', '/:collection/', '/:collection/*'], async (req, res) => {
  const permission = await getUserPermission(req);
  const collection = req.params.collection;
  const subPath = req.params[0] || '';

  const normalizedGalleryDir = path.normalize(GALLERY_DL_DIR);

  // Construct the real path carefully
  let realPath;
  if (path.isAbsolute(collection)) {
    // If collection is an absolute path, use it directly
    realPath = path.join(collection, subPath);
    // Ensure the path is within the GALLERY_DL_DIR
    if (!realPath.startsWith(normalizedGalleryDir)) {
      debug(`Access attempt outside of GALLERY_DL_DIR: ${realPath}`);
      return res.status(403).json({
        error: 'Access denied - Path outside gallery'
      });
    }
  } else {
    realPath = path.join(normalizedGalleryDir, collection, subPath);
  }

  // Security: Prevent directory traversal
  if (!pathUtils.isSubPath(realPath, normalizedGalleryDir)) {
    debug(`Directory traversal attempt: ${realPath}`);
    return res.status(403).json({
      error: 'Access denied - Path outside gallery'
    });
  }

  // Check if collection/path is excluded based on permissions
  const relativePath = path.relative(normalizedGalleryDir, realPath).replace(/\\/g, '/');
  if (await isExcluded(relativePath, permission)) {
    debug(`Access denied to: ${relativePath}`);
    return res.status(403).json({
      error: 'Access denied - Collection excluded'
    });
  }

  try {
    await fs.access(realPath);
  } catch (error) {
    debug(`Path not found: ${realPath}`, error);
    return res.status(404).json({
      error: 'Path not found',
      path: `/gdl/api/files/${relativePath}`
    });
  }

  const stats = await fs.stat(realPath);
  if (stats.isDirectory()) {
    let entries = [];
    try {
      entries = await fs.readdir(realPath, {
        withFileTypes: true
      });
      debug(`Found ${entries.length} entries in directory`);
    } catch (error) {
      debug('Failed to read directory:', error);
      return res.status(500).json({
        error: 'Failed to read directory'
      });
    }

    // Filter entries based on permission and exclusion logic
    const formattedContents = await Promise.all(entries.map(async entry => {
      const entryRelativePath = path.join(collection, subPath, entry.name);
      if (await isExcluded(entryRelativePath, permission) ||
        DISALLOWED_DIRS.includes(entry.name) ||
        (entry.isFile() && (DISALLOWED_FILES.includes(entry.name) || isDisallowedExtension(entry.name)))) {
        debug(`Excluded entry: ${entryRelativePath}`);
        return null;
      }
      const entryPath = path.join(realPath, entry.name);
      const relativePath = path.relative(normalizedGalleryDir, entryPath).replace(/\\/g, '/');
      const isDir = entry.isDirectory();

      let size = 0;
      let mtime = new Date();
      try {
        const stats = await fs.stat(entryPath);
        size = stats.size;
        mtime = stats.mtime;
      } catch {
        return null;
      }

      const {
        url
      } = normalizeUrl(req, relativePath, isDir);
      return {
        name: entry.name,
        type: isDir ? 'directory' : 'file',
        size: size,
        modified: mtime,
        path: normalizeUrl(req, relativePath, isDir).path,
        url
      };
    }));
    res.json({
      path: `/${collection}${subPath ? '/' + subPath : ''}`,
      contents: formattedContents.filter(Boolean)
    });
  } else {
    // File access check based on permissions
    if (!hasAllowedExtension(realPath, permission) ||
      DISALLOWED_FILES.includes(path.basename(realPath)) ||
      isDisallowedExtension(path.basename(realPath))) {
      debug(`Access denied to file: ${realPath}`);
      return res.status(403).json({
        error: 'Access denied - File type not allowed'
      });
    }

    // Check for image scaling parameter
    const scaleMatch = req.url.match(/\?x=(\d+)/);
    if (scaleMatch && isImageFile(realPath)) {
      const scale = parseInt(scaleMatch[1]);
      if (!isNaN(scale) && scale > 0) {
        try {
          const transformer = await resizeImage(realPath, {
            scale
          });
          res.type(path.extname(realPath));
          res.set('Cache-Control', 'public, max-age=180'); // Cache for 1 hour
          transformer.pipe(res);
          return;
        } catch (error) {
          debug('Error processing image:', error);
          return res.status(500).json({
            error: 'Failed to process image'
          });
        }
      }
    }
    res.sendFile(realPath);
  }
});

module.exports = router;