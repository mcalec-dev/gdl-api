const path = require('path')
const fs = require('fs').promises
const uuid = require('uuid')
const File = require('../../models/File')
const config = /** @type {any} */ (require('../../config'))
const { buildPaths, deriveCollectionAuthor } = require('../pathUtils')
const { getImageMeta } = require('../image/metadata.js')
const { isImageFile } = require('./typeGuards')
const { getFileMime, calculateFileHash } = require('./mimeAndHash')
const { readSidecarFile } = require('./sidecar')
const log = require('../logHandler')

const { BASE_DIR, BASE_PATH } = config

const fileFields = new Set([
  'name',
  'paths',
  'size',
  'type',
  'collection',
  'author',
  'mime',
  'created',
  'modified',
  'tags',
  'meta',
  'sidecar',
  'hash',
  'uuid',
])

/** @param {unknown} value */
function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

/** @param {unknown} value */
function hasStringValue(value) {
  return typeof value === 'string' && value.trim() !== ''
}

/** @param {unknown} value */
function isDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

/**
 * @param {string} localPath
 * @returns {Promise<{ found: boolean, updated: boolean }>}
 */
async function checkFileRecord(localPath) {
  if (typeof localPath !== 'string' || !localPath) {
    return { found: false, updated: false }
  }
  const record = await File.findOne({ 'paths.local': localPath })
  if (!record) return { found: false, updated: false }
  let stats
  try {
    stats = await fs.stat(localPath)
  } catch (error) {
    log.debug(`Unable to check file record path: ${localPath}`, error)
    return { found: true, updated: false }
  }
  const relativePath = path
    .relative(path.resolve(BASE_DIR), localPath)
    .replace(/\\/g, '/')
  const paths = buildPaths(BASE_DIR, relativePath, BASE_PATH) || {
    local: localPath,
    relative: relativePath,
    remote: '',
  }
  const { collection, author } = deriveCollectionAuthor(relativePath)
  /** @type {Record<string, any>} */
  const updates = {}
  if (!hasStringValue(record.name)) updates.name = path.basename(localPath)
  if (!record.paths || typeof record.paths !== 'object') {
    updates.paths = paths
  } else {
    const storedPaths = /** @type {any} */ (record.paths)
    updates.paths = {
      local: hasStringValue(storedPaths.local)
        ? storedPaths.local
        : paths.local,
      relative: hasStringValue(storedPaths.relative)
        ? storedPaths.relative
        : paths.relative,
      remote: hasStringValue(storedPaths.remote)
        ? storedPaths.remote
        : paths.remote,
    }
  }
  if (typeof record.size !== 'number' || !Number.isFinite(record.size)) {
    updates.size = stats.size
  }
  if (!hasStringValue(record.type)) updates.type = 'file'
  if (!hasStringValue(record.collection)) {
    updates.collection = collection || 'unknown'
  }
  if (!hasStringValue(record.author)) updates.author = author || 'unknown'
  if (!hasStringValue(record.mime)) {
    updates.mime = (await getFileMime(localPath)) || 'application/octet-stream'
  }
  if (!isDate(record.created)) updates.created = stats.birthtime
  if (!isDate(record.modified)) updates.modified = stats.mtime
  if (!Array.isArray(record.tags)) updates.tags = /** @type {any[]} */ ([])
  if (
    !record.meta ||
    typeof record.meta !== 'object' ||
    Array.isArray(record.meta) ||
    (isImageFile(localPath) && Object.keys(record.meta).length === 0)
  ) {
    updates.meta = isImageFile(localPath) ? await getImageMeta(localPath) : {}
  }
  if (
    record.sidecar !== null &&
    (typeof record.sidecar !== 'object' || Array.isArray(record.sidecar))
  ) {
    updates.sidecar = await readSidecarFile(localPath)
  }
  if (!hasStringValue(record.hash)) {
    updates.hash = (await calculateFileHash(localPath)) || 'unavailable'
  }
  if (!hasStringValue(record.uuid)) updates.uuid = uuid.v4()
  const unknownFields = Object.keys(record.toObject()).filter(
    (field) => field !== '_id' && !fileFields.has(field)
  )
  if (unknownFields.length > 0) {
    updates.$unset = Object.fromEntries(
      unknownFields.map((field) => [field, 1])
    )
  }
  if (Object.keys(updates).length === 0) {
    return { found: true, updated: false }
  }
  const { $unset: unset, ...setUpdates } = updates
  await File.updateOne(
    { _id: record._id },
    {
      ...(Object.keys(setUpdates).length > 0 ? { $set: setUpdates } : {}),
      ...(unset ? { $unset: unset } : {}),
    }
  )
  return { found: true, updated: true }
}

/** @returns {Promise<{ checked: number, updated: number }>} */
async function checkAllFileRecords() {
  const records = await File.find({}, { 'paths.local': 1 }).lean()
  let updated = 0
  for (const record of records) {
    const result = await checkFileRecord(record.paths?.local || '')
    if (result.updated) updated++
  }
  return { checked: records.length, updated }
}

module.exports = { checkFileRecord, checkAllFileRecords }
