const File = require('../../models/File')
/**
 * @typedef {{ uuid?: unknown }} FileInputObject
 */
/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeUuidValue(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === 'null' || normalized === 'undefined') {
    return null
  }
  return normalized
}
/**
 * @param {unknown} tags
 * @returns {string[]}
 */
function normalizeTags(tags) {
  if (!Array.isArray(tags)) return []
  const normalized = tags
    .map((tag) => String(tag || '').trim())
    .filter((tag) => tag.length > 0)
  return [...new Set(normalized)]
}
/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isValidUuidParam(value) {
  return Boolean(normalizeUuidValue(value))
}
/**
 * @param {unknown} value
 * @returns {value is unknown[]}
 */
function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0
}
/**
 * @param {unknown} filesInput
 * @returns {string[]}
 */
function normalizeFileUuidsInput(filesInput) {
  if (!Array.isArray(filesInput)) return []
  /** @type {Set<string>} */
  const uuidCandidates = new Set()
  for (const entry of filesInput) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const typedEntry = /** @type {FileInputObject} */ (entry)
      const objectUuid = normalizeUuidValue(typedEntry.uuid)
      if (objectUuid) {
        uuidCandidates.add(objectUuid)
        continue
      }
    }
    const stringUuid = normalizeUuidValue(entry)
    if (stringUuid) {
      uuidCandidates.add(stringUuid)
    }
  }
  return [...uuidCandidates]
}
/**
 * @param {unknown} limitQuery
 * @param {unknown} pageQuery
 * @param {number} paginationLimit
 * @returns {{ limit: number, page: number, skip: number }}
 */
function parsePagination(limitQuery, pageQuery, paginationLimit) {
  const limitRaw = parseInt(String(limitQuery || ''), 10)
  const pageRaw = parseInt(String(pageQuery || ''), 10)
  const limit =
    !isNaN(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, paginationLimit)
      : paginationLimit
  const page = !isNaN(pageRaw) && pageRaw > 0 ? pageRaw : 1
  const skip = (page - 1) * limit
  return { limit, page, skip }
}
/**
 * @param {unknown} filesInput
 * @returns {Promise<string[]>}
 */
async function resolveFileUuidsFromInput(filesInput) {
  const normalizedUuids = normalizeFileUuidsInput(filesInput)
  const filesByUuid = normalizedUuids.length
    ? await File.find({ uuid: { $in: normalizedUuids } }, { uuid: 1 }).lean()
    : []
  return [
    ...new Set(
      filesByUuid
        .map((doc) => {
          const value = /** @type {{ uuid?: unknown }} */ (doc).uuid
          return normalizeUuidValue(value) || ''
        })
        .filter(Boolean)
    ),
  ]
}
/**
 * @param {unknown[] | undefined | null} fileUuids
 * @returns {Promise<any[]>}
 */
async function findFilesByUuids(fileUuids) {
  if (!Array.isArray(fileUuids) || fileUuids.length === 0) return []
  const normalizedRefs = [
    ...new Set(
      fileUuids.map((value) => normalizeUuidValue(value)).filter(Boolean)
    ),
  ]
  if (normalizedRefs.length === 0) return []
  return File.find(
    { uuid: { $in: normalizedRefs } },
    {
      name: 1,
      paths: 1,
      size: 1,
      type: 1,
      collection: 1,
      author: 1,
      mime: 1,
      created: 1,
      modified: 1,
      hash: 1,
      uuid: 1,
    }
  )
    .sort({ modified: -1 })
    .lean()
}
module.exports = {
  normalizeTags,
  isValidUuidParam,
  isNonEmptyArray,
  normalizeFileUuidsInput,
  parsePagination,
  resolveFileUuidsFromInput,
  findFilesByUuids,
}
