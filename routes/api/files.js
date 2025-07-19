const express = require('express')
const router = express.Router()
const path = require('path')
const Directory = require('../../models/Directory')
const Image = require('../../models/Image')
const Video = require('../../models/Video')
const fs = require('fs').promises
const debug = require('debug')('gdl-api:api:files')
const {
  BASE_DIR,
  DISALLOWED_DIRS,
  DISALLOWED_FILES,
  DISALLOWED_EXTENSIONS,
  BASE_PATH,
} = require('../../config')
const { isExcluded, hasAllowedExtension } = require('../../utils/fileUtils')
const pathUtils = require('../../utils/pathUtils')
const { resizeImage } = require('../../utils/imageUtils')
const isImageFile = (filename) => {
  const ext = ['.jpg', '.jpeg', '.png', '.webp', '.avif']
  return ext.some((e) => filename.toLowerCase().endsWith(e))
}
const isDisallowedExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase()
  return DISALLOWED_EXTENSIONS.some(
    (disallowedExt) =>
      ext === disallowedExt.toLowerCase() ||
      ext === `.${disallowedExt.toLowerCase()}`
  )
}
async function upsertDirectoryEntry(dirObj) {
  await Directory.findOneAndUpdate(
    { path: dirObj.path },
    { $set: dirObj },
    { upsert: true, new: true }
  )
}
async function upsertImageEntry(imgObj) {
  await Image.findOneAndUpdate(
    { path: imgObj.path },
    { $set: imgObj },
    { upsert: true, new: true }
  )
}
async function upsertVideoEntry(vidObj) {
  await Video.findOneAndUpdate(
    { path: vidObj.path },
    { $set: vidObj },
    { upsert: true, new: true }
  )
}
async function createDbEntriesForContents(contents, parentPath = '') {
  const apiPrefix = `${BASE_PATH}/api/files`
  for (const item of contents) {
    const relPath = parentPath ? `${parentPath}/${item.name}` : item.name
    const dbPath = `${apiPrefix}/${relPath}`.replace(/\/+/g, '/')
    if (item.type === 'directory') {
      await upsertDirectoryEntry({
        name: item.name,
        path: dbPath,
        size: item.size || 0,
        created: item.created || new Date(),
        modified: item.modified || new Date(),
        files: item.files || [],
      })
      if (item.contents) {
        await createDbEntriesForContents(item.contents, relPath)
      }
    } else if (item.type === 'file') {
      const ext = path.extname(item.name).toLowerCase()
      const isImage = [
        '.jpg',
        '.jpeg',
        '.png',
        '.webp',
        '.bmp',
        '.gif',
        '.tiff',
        '.svg',
        '.avif',
      ].includes(ext)
      const isVideo = ['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)
      if (isImage) {
        await upsertImageEntry({
          name: item.name,
          path: dbPath,
          size: item.size || 0,
          mimetype: item.mimetype || '',
          created: item.created || new Date(),
          modified: item.modified || new Date(),
          exif: item.exif || {},
        })
      } else if (isVideo) {
        await upsertVideoEntry({
          name: item.name,
          path: dbPath,
          size: item.size || 0,
          mimetype: item.mimetype || '',
          created: item.created || new Date(),
          modified: item.modified || new Date(),
        })
      }
    }
  }
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
 *                   created:
 *                     type: string
 *                     format: date-time
 *                   path:
 *                     type: string
 *                   url:
 *                     type: string
 */
router.get(['/', ''], async (req, res) => {
  try {
    const stats = await fs.stat(BASE_DIR)
    if (!stats.isDirectory()) {
      debug(BASE_DIR, 'is not a directory')
    }
    let entries = []
    try {
      entries = await fs.readdir(BASE_DIR, {
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
          (await isExcluded(entry.name)) ||
          DISALLOWED_DIRS.includes(entry.name) ||
          (entry.isFile() &&
            (DISALLOWED_FILES.includes(entry.name) ||
              isDisallowedExtension(entry.name)))
        ) {
          debug(`Excluded entry: ${entry.name}`)
          return null
        }
        const entryPath = path.join(BASE_DIR, entry.name)
        let size = 0
        let mtime = new Date()
        let ctime = new Date()
        try {
          const stats = await fs.stat(entryPath)
          if (entry.isDirectory()) {
            size = await getDirectorySize(entryPath)
          } else {
            size = stats.size
          }
          mtime = stats.mtime
          ctime = stats.birthtime
        } catch {
          return null
        }
        const relativePath = path
          .relative(BASE_DIR, entryPath)
          .replace(/\\/g, '/')
        const apiPrefix = `${BASE_PATH}/api/files`
        const fullPath = `${apiPrefix}/${relativePath}`.replace(/\/+/g, '/')
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: size,
          modified: mtime,
          created: ctime,
          path: fullPath,
          url: fullPath,
        }
      })
    )
    res.json({
      contents: results.filter(Boolean),
    })
    if (results && results.length) {
      await createDbEntriesForContents(results.filter(Boolean), '')
    }
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
    const collection = req.params.collection
    const subPath = req.params[0] || ''
    const normalizedDir = path.normalize(BASE_DIR)
    let realPath
    if (path.isAbsolute(collection)) {
      realPath = path.join(collection, subPath)
      if (!realPath.startsWith(normalizedDir)) {
        debug('Access attempt outside of BASE_DIR:', realPath)
        return res.status(403).json({
          message: 'Forbidden',
          status: 403,
        })
      }
    } else {
      realPath = path.join(normalizedDir, collection, subPath)
    }
    if (!pathUtils.isSubPath(realPath, normalizedDir)) {
      debug(`Directory traversal attempt: ${realPath}`)
      return res.status(403).json({
        message: 'Forbidden',
        status: 403,
      })
    }
    const relativePath = path
      .relative(normalizedDir, realPath)
      .replace(/\\/g, '/')
    if (await isExcluded(relativePath)) {
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
            (await isExcluded(entryRelativePath)) ||
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
            .relative(normalizedDir, entryPath)
            .replace(/\\/g, '/')
          const isDir = entry.isDirectory()
          let size = 0
          let mtime = new Date()
          let ctime = new Date()
          try {
            const stats = await fs.stat(entryPath)
            if (isDir) {
              size = await getDirectorySize(entryPath)
            } else {
              size = stats.size
            }
            mtime = stats.mtime
            ctime = stats.birthtime
          } catch {
            return null
          }
          const apiPrefix = `${BASE_PATH}/api/files`
          const fullPath = `${apiPrefix}/${relativePath}`.replace(/\/+/g, '/')
          return {
            name: entry.name,
            type: isDir ? 'directory' : 'file',
            size: size,
            modified: mtime,
            created: ctime,
            path: fullPath,
            url: fullPath,
          }
        })
      )
      res.json({
        contents: formattedContents.filter(Boolean),
      })
      if (formattedContents && formattedContents.length) {
        await createDbEntriesForContents(
          formattedContents.filter(Boolean),
          relativePath
        )
      }
    } else {
      if (
        !hasAllowedExtension(realPath) ||
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
              message: 'Internal Server Error',
              status: 500,
            })
          }
        }
      })
    }
  }
)
module.exports = router
