const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs').promises
const debug = require('debug')('gdl-api:api:files')
const {
  GALLERY_DL_DIR,
  DISALLOWED_DIRS,
  DISALLOWED_FILES,
  DISALLOWED_EXTENSIONS,
} = require('../../config')
const { isExcluded, hasAllowedExtension } = require('../../utils/fileUtils')
const { normalizeUrl } = require('../../utils/urlUtils')
const pathUtils = require('../../utils/pathUtils')
const { getUserPermission } = require('../../utils/authUtils')
const { resizeImage } = require('../../utils/imageUtils')
const isImageFile = (filename) => {
  const ext = ['.jpg', '.jpeg', '.png', '.webp', '.avif']
  return ext.some((e) => filename.toLowerCase().endsWith(e))
}
// DO NOT DELETE THIS
// will replace existing video function in imageUtils.js/fileUtils.js
/*
const isVideoFile = (filename) => {
  const ext = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
  return ext.some(e => filename.toLowerCase().endsWith(e));
};
*/
const isDisallowedExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase()
  return DISALLOWED_EXTENSIONS.some(
    (disallowedExt) =>
      ext === disallowedExt.toLowerCase() ||
      ext === `.${disallowedExt.toLowerCase()}`
  )
}
async function getDirectorySize(dirPath) {
  let total = 0
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += await getDirectorySize(entryPath)
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(entryPath)
          total += stats.size
        } catch (error) {
          debug('Error getting file stats:', error)
        }
      }
    }
  } catch (error) {
    debug('Error reading directory:', dirPath, error)
    return 0
  }
  return total
}
/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: Get all files
 *     responses:
 *       200:
 *         description: A list of all files
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   type:
 *                     type: string
 *                   size:
 *                     type: integer
 *                   modified:
 *                     type: string
 *                     format: date-time
 *                   path:
 *                     type: string
 *                   url:
 *                     type: string
 */
router.get(['/', ''], async (req, res) => {
  const permission = await getUserPermission(req)
  try {
    const stats = await fs.stat(GALLERY_DL_DIR)
    if (!stats.isDirectory()) {
      debug('GALLERY_DL_DIR is not a directory')
      throw new Error('GALLERY_DL_DIR is not a directory')
    }
    let entries = []
    try {
      entries = await fs.readdir(GALLERY_DL_DIR, {
        withFileTypes: true,
      })
      debug(`Found ${entries.length} entries in root directory`)
    } catch (error) {
      debug('Failed to read root directory:', error)
      return res.status(500).json({
        message: 'Internal Server Error',
        status: 500,
      })
    }
    const results = await Promise.all(
      entries.map(async (entry) => {
        if (
          (await isExcluded(entry.name, permission)) ||
          DISALLOWED_DIRS.includes(entry.name) ||
          (entry.isFile() &&
            (DISALLOWED_FILES.includes(entry.name) ||
              isDisallowedExtension(entry.name)))
        ) {
          debug(`Excluded entry: ${entry.name}`)
          return null
        }
        const entryPath = path.join(GALLERY_DL_DIR, entry.name)
        let size = 0
        let mtime = new Date()
        try {
          const stats = await fs.stat(entryPath)
          if (entry.isDirectory()) {
            size = await getDirectorySize(entryPath)
          } else {
            size = stats.size
          }
          mtime = stats.mtime
        } catch {
          return null
        }
        const relativePath = path
          .relative(GALLERY_DL_DIR, entryPath)
          .replace(/\\/g, '/')
        const { url } = normalizeUrl(req, relativePath, entry.isDirectory())
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: size,
          modified: mtime,
          path: normalizeUrl(req, relativePath, entry.isDirectory()).path,
          url,
        }
      })
    )
    res.json({
      contents: results.filter(Boolean),
    })
  } catch (error) {
    debug('Error in root directory listing:', error)
    res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
router.get(
  ['/:collection', '/:collection/', '/:collection/*'],
  async (req, res) => {
    const permission = await getUserPermission(req)
    const collection = req.params.collection
    const subPath = req.params[0] || ''
    const normalizedGalleryDir = path.normalize(GALLERY_DL_DIR)
    let realPath
    if (path.isAbsolute(collection)) {
      realPath = path.join(collection, subPath)
      if (!realPath.startsWith(normalizedGalleryDir)) {
        debug(`Access attempt outside of GALLERY_DL_DIR: ${realPath}`)
        return res.status(403).json({
          message: 'Not Found',
          status: 404,
        })
      }
    } else {
      realPath = path.join(normalizedGalleryDir, collection, subPath)
    }
    if (!pathUtils.isSubPath(realPath, normalizedGalleryDir)) {
      debug(`Directory traversal attempt: ${realPath}`)
      return res.status(404).json({
        message: 'Forbidden',
        status: 403,
      })
    }
    const relativePath = path
      .relative(normalizedGalleryDir, realPath)
      .replace(/\\/g, '/')
    if (await isExcluded(relativePath, permission)) {
      debug(`Access denied to: ${relativePath}`)
      return res.status(404).json({
        message: 'Not Found',
        status: 404,
      })
    }
    try {
      await fs.access(realPath)
    } catch (error) {
      debug(`Path not found: ${realPath}`, error)
      return res.status(404).json({
        message: 'Not Found',
        status: 404,
      })
    }
    const stats = await fs.stat(realPath)
    if (stats.isDirectory()) {
      let entries = []
      try {
        entries = await fs.readdir(realPath, {
          withFileTypes: true,
        })
        debug(`Found ${entries.length} entries in directory`)
      } catch (error) {
        debug('Failed to read directory:', error)
        return res.status(500).json({
          message: 'Internal Server Error',
          status: 500,
        })
      }
      const formattedContents = await Promise.all(
        entries.map(async (entry) => {
          const entryRelativePath = path.join(collection, subPath, entry.name)
          if (
            (await isExcluded(entryRelativePath, permission)) ||
            DISALLOWED_DIRS.includes(entry.name) ||
            (entry.isFile() &&
              (DISALLOWED_FILES.includes(entry.name) ||
                isDisallowedExtension(entry.name)))
          ) {
            debug(`Excluded entry: ${entryRelativePath}`)
            return null
          }
          const entryPath = path.join(realPath, entry.name)
          const relativePath = path
            .relative(normalizedGalleryDir, entryPath)
            .replace(/\\/g, '/')
          const isDir = entry.isDirectory()
          let size = 0
          let mtime = new Date()
          try {
            const stats = await fs.stat(entryPath)
            if (isDir) {
              size = await getDirectorySize(entryPath)
            } else {
              size = stats.size
            }
            mtime = stats.mtime
          } catch {
            return null
          }
          const { url } = normalizeUrl(req, relativePath, isDir)
          return {
            name: entry.name,
            type: isDir ? 'directory' : 'file',
            size: size,
            modified: mtime,
            path: normalizeUrl(req, relativePath, isDir).path,
            url,
          }
        })
      )
      res.json({
        contents: formattedContents.filter(Boolean),
      })
    } else {
      if (
        !hasAllowedExtension(realPath, permission) ||
        DISALLOWED_FILES.includes(path.basename(realPath)) ||
        isDisallowedExtension(path.basename(realPath))
      ) {
        debug(`Access denied to file: ${realPath}`)
        return res.status(404).json({
          message: 'Not Found',
          status: 404,
        })
      }
      const scaleMatch = req.url.match(/\?x=(\d+)/)
      if (isImageFile(realPath)) {
        let scale = null
        if (scaleMatch) {
          scale = parseInt(scaleMatch[1])
        }
        try {
          const transformer = await resizeImage(
            realPath,
            !scaleMatch || isNaN(scale) || scale <= 0 || scale === 100
              ? {}
              : { scale }
          )
          if (transformer) {
            res.type(path.extname(realPath).slice(1))
            transformer.pipe(res)
            return
          }
        } catch (error) {
          debug('Error resizing image:', error)
          return res.status(500).json({
            message: 'Internal Server Error',
            status: 500,
          })
        }
      }
      res.download(realPath, (error) => {
        if (error) {
          debug('Error in file download:', error)
          if (!res.headersSent) {
            res.status(500).json({
              message: 'Error processing image',
              status: 500,
            })
          }
        }
      })
    }
  }
)
module.exports = router
