const path = require('path')
const fs = require('fs').promises
const log = require('../logHandler')
const { DISALLOWED_DIRS, DISALLOWED_FILES, BASE_DIR, BASE_PATH } =
  /** @type {any} */ (require('../../config'))
const { buildPaths, deriveCollectionAuthor } = require('../pathUtils')
const { getImageMeta } = require('../image/metadata.js')
const { isSidecarFile, readSidecarFile } = require('./sidecar')
const {
  hasAllowedExtension,
  isImageFile,
  isDisallowedExtension,
} = require('./typeGuards')
const { getStoredSize, getStoredItemSize, isExcluded } = require('./listing')
const { getFileMime, calculateFileHash } = require('./mimeAndHash')
const {
  ensureFileNameIndexAllowsDuplicates,
  upsertDirectoryEntry,
  upsertFileEntry,
} = require('./upsert')
/**
 * @param {string} dirPath
 * @param {string} [relativePath]
 */
async function scanAndSyncDirectory(dirPath, relativePath = '') {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const dirStats = { created: 0, updated: 0 }
    const fileStats = { created: 0, updated: 0 }
    const skipStats = { excluded: 0, disallowed: 0 }
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name)
      const entryRelativePath = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name
      if (
        (await isExcluded(entry.name)) ||
        (await isExcluded(entryRelativePath)) ||
        (entry.isFile() && isSidecarFile(entry.name)) ||
        DISALLOWED_DIRS.includes(entry.name) ||
        (entry.isFile() &&
          (DISALLOWED_FILES.includes(entry.name) ||
            isDisallowedExtension(entry.name)))
      ) {
        skipStats.excluded++
        continue
      }
      let mtime = new Date()
      let ctime = new Date()
      let stats
      try {
        stats = await fs.stat(entryPath)
        mtime = stats.mtime
        ctime = stats.birthtime
      } catch (statError) {
        log.error(`Error getting stats for ${entryPath}:`, statError)
        continue
      }
      const paths = buildPaths(dirPath, entryRelativePath, BASE_PATH)
      if (entry.isDirectory()) {
        const { collection, author } = deriveCollectionAuthor(entryRelativePath)
        const upsertResult = await upsertDirectoryEntry({
          name: entry.name,
          paths,
          size: getStoredSize(stats, true),
          collection,
          author,
          tags: [],
          created: ctime,
          modified: mtime,
        })
        if (upsertResult.isNew) dirStats.created++
        else dirStats.updated++
        const nestedStats = await scanAndSyncDirectory(
          entryPath,
          entryRelativePath
        )
        dirStats.created += nestedStats.created
        dirStats.updated += nestedStats.updated
        fileStats.created += nestedStats.files.created
        fileStats.updated += nestedStats.files.updated
        skipStats.excluded += nestedStats.skipped.excluded
        skipStats.disallowed += nestedStats.skipped.disallowed
      }
      if (entry.isFile()) {
        if (!hasAllowedExtension(entryPath)) {
          skipStats.disallowed++
          continue
        }
        let metadata = /** @type {any} */ ({})
        if (isImageFile(entryPath)) {
          metadata = await getImageMeta(entryPath)
        } else {
          metadata = {}
        }
        let hash = null
        try {
          hash = await calculateFileHash(entryPath)
        } catch (/** @type {any} */ error) {
          log.error('Error calculating file hash in scanAndSyncDirectory:', {
            path: entryRelativePath,
            error: error.message,
          })
        }
        const { collection, author } = deriveCollectionAuthor(entryRelativePath)
        const mime = await getFileMime(entryPath)
        const sidecar = await readSidecarFile(entryPath)
        const upsertResult = await upsertFileEntry(
          {
            name: entry.name,
            paths,
            author,
            collection,
            size: getStoredSize(stats, false),
            type: 'file',
            created: ctime,
            modified: mtime,
            mime,
            meta: metadata,
            hash,
            sidecar,
          },
          true
        )
        if (upsertResult?.isNew) fileStats.created++
        else if (upsertResult) fileStats.updated++
      }
    }
    return { ...dirStats, files: fileStats, skipped: skipStats }
  } catch (error) {
    log.error(`Error scanning directory ${dirPath}:`, error)
    throw error
  }
}
async function syncAllFilesToDatabase() {
  try {
    log.debug('Syncing database...')
    const stats = await fs.stat(BASE_DIR)
    if (!stats.isDirectory()) {
      throw new Error(`${BASE_DIR} is not a directory`)
    }
    const dirStats = await scanAndSyncDirectory(BASE_DIR, '')
    log.info(`Created ${dirStats.files.created} file entries`)
    log.info(`Updated ${dirStats.files.updated} file entries`)
    log.info(`Created ${dirStats.created} directory entries`)
    log.info(`Updated ${dirStats.updated} directory entries`)
    log.info(`Skipped ${dirStats.skipped.excluded} excluded items`)
    log.info(
      `Skipped ${dirStats.skipped.disallowed} files with disallowed extensions`
    )
    return {
      success: true,
      message: 'All files and directories synced to database',
      stats: dirStats,
    }
  } catch (/** @type {any} */ error) {
    log.error('Error during database sync:', error)
    return {
      success: false,
      message: `Database sync failed: ${error.message}`,
    }
  }
}
async function initializeDatabaseSync() {
  try {
    log.debug('Initializing database sync...')
    await ensureFileNameIndexAllowsDuplicates()
    await syncAllFilesToDatabase()
  } catch (error) {
    log.error('Failed to initialize database sync:', error)
  }
}
/**
 * @param {any[]} items
 * @param {string} [parentPath]
 */
async function createDbEntriesForContents(items, parentPath = '') {
  try {
    const dirStats = { created: 0, updated: 0 }
    for (const item of items) {
      const relPath = parentPath ? `${parentPath}/${item.name}` : item.name
      const paths = buildPaths(BASE_DIR, relPath, BASE_PATH)
      const localPath = paths?.local ?? ''
      let metadata = /** @type {any} */ ({})
      if (isImageFile(localPath)) {
        metadata = await getImageMeta(localPath)
      } else {
        metadata = {}
      }
      if (item.type === 'directory') {
        const { collection, author } = deriveCollectionAuthor(relPath)
        const upsertResult = await upsertDirectoryEntry({
          name: item.name,
          paths,
          size: getStoredItemSize(item, true),
          collection: item.collection || collection,
          author: item.author || author,
          tags: item.tags || [],
          created: item.created || null,
          modified: item.modified || null,
        })
        if (upsertResult.isNew) dirStats.created++
        else dirStats.updated++
        if (item.contents) {
          const nestedStats = await createDbEntriesForContents(
            item.contents,
            relPath
          )
          dirStats.created += nestedStats.created
          dirStats.updated += nestedStats.updated
        }
      }
      if (item.type === 'file') {
        if (isSidecarFile(item.name)) {
          continue
        }
        let hash = null
        try {
          hash = await calculateFileHash(localPath)
        } catch (/** @type {any} */ error) {
          log.error(
            'Error calculating file hash in createDbEntriesForContents:',
            {
              path: relPath,
              error: error.message,
            }
          )
        }
        await upsertFileEntry({
          name: item.name,
          paths,
          mime: item.mime || null,
          size: getStoredItemSize(item, false),
          type: item.type || null,
          collection: item.collection || null,
          author: item.author || null,
          created: item.created || null,
          modified: item.modified || null,
          hash,
          meta: { ...metadata },
          sidecar: await readSidecarFile(localPath),
        })
      }
    }
    return dirStats
  } catch (error) {
    log.error('Error creating DB entries for contents:', error)
    return { created: 0, updated: 0 }
  }
}
module.exports = {
  scanAndSyncDirectory,
  syncAllFilesToDatabase,
  initializeDatabaseSync,
  createDbEntriesForContents,
}
