const express = require('express')
const router = express.Router()
const path = require('path')
const Directory = require('../../models/Directory')
const File = require('../../models/File')
const { requireRole } = require('../../utils/authUtils')
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
const { resizeImage, getImageMeta } = require('../../utils/imageUtils')
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
  try {
    await Directory.findOneAndUpdate(
      {
        paths: {
          local: dirObj.path,
          relative: dirObj.relativePath,
          remote: dirObj.remotePath,
        },
        collection: dirObj.collection || null,
        author: dirObj.author || null,
      },
      { $set: dirObj },
      { upsert: true, new: true }
    )
  } catch (error) {
    debug('Error upserting directory entry:', error)
  }
}
async function upsertFileEntry(fileObj) {
  try {
    await File.findOneAndUpdate(
      {
        paths: {
          local: fileObj.path,
          relative: fileObj.relativePath,
          remote: fileObj.remotePath,
        },
        collection: fileObj.collection || null,
        author: fileObj.author || null,
      },
      { $set: fileObj },
      { upsert: true, new: true }
    )
  } catch (error) {
    debug('Error upserting file entry:', error)
  }
}
async function createDbEntriesForContents(items, parentPath = '') {
  try {
    for (const item of items) {
      const apiPrefix = `${BASE_PATH}/api/files`
      const relPath = parentPath ? `${parentPath}/${item.name}` : item.name
      const dbPath = `${apiPrefix}/${relPath}`.replace(/\/+/g, '/')
      const localPath = `${BASE_DIR}/${relPath}`.replace(/\\/g, '/')
      const getMetadata = await getImageMeta(localPath)
      if (item.type === 'directory') {
        await upsertDirectoryEntry({
          name: item.name,
          paths: {
            local: localPath,
            relative: relPath,
            remote: dbPath,
          },
          size: item.size || 0,
          created: item.created || null,
          modified: item.modified || null,
        })
        if (item.contents) {
          await createDbEntriesForContents(item.contents, relPath)
        }
      }
      if (item.type === 'file') {
        await upsertFileEntry({
          name: item.name,
          paths: {
            local: `${BASE_DIR}/${relPath}`,
            relative: relPath,
            remote: dbPath,
          },
          size: item.size || 0,
          type: item.type || null,
          collection: item.collection || null,
          author: item.author || null,
          created: item.created || null,
          modified: item.modified || null,
          meta: { ...getMetadata },
        })
      }
    }
  } catch (error) {
    debug('Error creating DB entries for contents:', error)
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
 * /api/files/:
 *   get:
 *     summary: Get all files
 */
router.get(['', '/'], requireRole('admin'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      message: 'Unauthorized',
      status: 401,
    })
  }
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
        const encodedPath = relativePath
          .split('/')
          .map(encodeURIComponent)
          .join('/')
        const fullPath = `${apiPrefix}/${encodedPath}`.replace(/\/+/g, '/')
        const url = req.protocol + '://' + req.hostname + fullPath
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: size,
          modified: mtime,
          created: ctime,
          path: fullPath,
          url,
        }
      })
    )
    const filteredResults = results.filter(Boolean)
    //const directories = filteredResults.filter((entry) => entry.type === 'directory')
    const files = filteredResults.filter((entry) => entry.type === 'file')
    if (req.user) {
      res.json({
        contents: filteredResults,
      })
      if (filteredResults.length) {
        await createDbEntriesForContents(filteredResults, '')
      }
    } else {
      res.json({
        contents: files,
      })
      if (files.length) {
        await createDbEntriesForContents(files, '')
      }
    }
  } catch (error) {
    debug('Error in root directory listing:', error)
    res.status(500).json({
      message: 'Internal Server Error',
      status: 500,
    })
  }
})
/**
 * @swagger
 * /api/files/{collection}:
 *   get:
 *     summary: Get files in a collection
 *     parameters:
 *       - in: path
 *         name: collection
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of files in the collection
 *       404:
 *         description: Collection not found
 */
router.get(
  [
    '/:collection/',
    '/:collection/*',
    '/:collection/:author/',
    '/:collection/:author/*',
  ],
  requireRole('user'),
  async (req, res) => {
    if (!req.user) {
      debug('Unauthorized access attempt')
      return res.status(401).json({
        message: 'Unauthorized',
        status: 401,
      })
    }
    const collection = req.params.collection
    const author = req.params.author || ''
    const additionalPath = req.params[0] || ''
    const normalizedDir = path.normalize(BASE_DIR)
    let realPath
    if (path.isAbsolute(collection)) {
      realPath = path.join(collection, author, additionalPath)
      if (!realPath.startsWith(normalizedDir)) {
        debug('Access attempt outside of BASE_DIR:', realPath)
        return res.status(403).json({
          message: 'Forbidden',
          status: 403,
        })
      }
    } else {
      realPath = path.join(normalizedDir, collection, author, additionalPath)
    }
    realPath = realPath.replace(/\/$/, '').replace(/\\/g, '/')
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
      if (!req.user) {
        return res.status(403).json({
          message: 'Forbidden',
          status: 403,
        })
      }
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
          const entryRelativePath = path.join(
            collection,
            author,
            additionalPath,
            entry.name
          )
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
          const encodedPath = relativePath
            .split('/')
            .map(encodeURIComponent)
            .join('/')
          const fullPath = `${apiPrefix}/${encodedPath}`.replace(/\/+/g, '/')
          const url = req.protocol + '://' + req.hostname + fullPath
          return {
            name: entry.name,
            type: isDir ? 'directory' : 'file',
            size: size,
            modified: mtime,
            created: ctime,
            path: fullPath,
            url,
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
          if (transformer === null) {
            debug('Failure resizing image')
            return res.status(500).json({
              message: 'Internal Server Error',
              status: 500,
            })
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
          if (
            error.code === 'ECONNABORTED' ||
            error.message === 'Request aborted'
          ) {
            debug('Request aborted by the client:', error)
            return
          }
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
