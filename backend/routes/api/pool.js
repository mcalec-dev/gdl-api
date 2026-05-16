const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const { requireRole } = require('../../utils/authUtils')
const log = require('../../utils/logHandler')
const sendResponse = require('../../utils/resUtils')
const config = require('../../config')
const Pool = require('../../models/Pool')
const {
  normalizeTags,
  isValidUuidParam,
  isNonEmptyArray,
  normalizeFileUuidsInput,
  parsePagination,
  resolveFileUuidsFromInput,
  findFilesByUuids,
} = require('../../utils/pool/helpers')
/** @param {Record<string, any> | null | undefined} pool */
function serializePool(pool) {
  if (!pool || typeof pool !== 'object') {
    return pool
  }
  if (!('_id' in pool)) {
    return pool
  }
  return {
    ...pool,
    _id:
      pool._id && typeof pool._id.toString === 'function'
        ? pool._id.toString()
        : pool._id,
  }
}
const PAGINATION_LIMIT =
  typeof config.PAGINATION_LIMIT === 'number' &&
  Number.isFinite(config.PAGINATION_LIMIT)
    ? config.PAGINATION_LIMIT
    : 100
router.get('/', requireRole('user'), async (req, res) => {
  try {
    const { limit, page, skip } = parsePagination(
      req.query.limit,
      req.query.page,
      PAGINATION_LIMIT
    )
    const [count, pools] = await Promise.all([
      Pool.countDocuments(),
      Pool.find()
        .sort({ modified: -1 })
        .skip(skip)
        .limit(limit)
        .select('-files')
        .lean(),
    ])
    return sendResponse.json(res, 200, {
      count,
      page,
      limit,
      results: pools.map((pool) => serializePool(pool)),
    })
  } catch (error) {
    log.error('Error retrieving pools:', error)
    return sendResponse(res, 500)
  }
})
router.post('/', requireRole('user'), async (req, res) => {
  const { name, description, tags, files } = req.body || {}
  if (!name || typeof name !== 'string' || !name.trim()) {
    return sendResponse(res, 400, 'Pool name is required')
  }
  try {
    const normalizedFileUuids = normalizeFileUuidsInput(files)
    const resolvedFileUuids = await resolveFileUuidsFromInput(files)
    const fileUuids =
      resolvedFileUuids.length > 0 ? resolvedFileUuids : normalizedFileUuids
    const now = new Date()
    const createdPool = await Pool.findOneAndUpdate(
      { uuid: { $eq: uuidv4() } },
      {
        $setOnInsert: {
          name: name.trim(),
          description:
            typeof description === 'string' && description.trim()
              ? description.trim()
              : undefined,
          created: now,
          modified: now,
          tags: normalizeTags(tags),
          files: fileUuids,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      }
    ).lean()
    log.debug('Pool created:', createdPool.uuid)
    return sendResponse.json(res, 201, serializePool(createdPool))
  } catch (error) {
    log.error('Error creating pool:', error)
    return sendResponse(res, 500)
  }
})
router.get(['/:uuid', '/:uuid/'], requireRole('user'), async (req, res) => {
  const { uuid } = req.params
  if (!isValidUuidParam(uuid)) {
    return sendResponse(res, 400, 'Invalid UUID parameter')
  }
  try {
    const includeFiles = req.query.includeFiles === 'true'
    const pool = await Pool.findOne({ uuid: { $eq: uuid } }).lean()
    if (!pool) {
      return sendResponse(res, 404, 'Pool not found')
    }
    if (includeFiles) {
      return sendResponse.json(res, 200, {
        ...serializePool(pool),
        files: await findFilesByUuids(pool.files),
      })
    }
    return sendResponse.json(res, 200, serializePool(pool))
  } catch (error) {
    log.error('Error retrieving pool:', error)
    return sendResponse(res, 500)
  }
})
router.put(['/:uuid', '/:uuid/'], requireRole('user'), async (req, res) => {
  const { uuid } = req.params
  if (!isValidUuidParam(uuid)) {
    return sendResponse(res, 400, 'Invalid UUID parameter')
  }
  const { name, description, tags, files } = req.body || {}
  /** @type {{ modified: Date, name?: string, description?: string, tags?: string[], files?: string[] }} */
  const updateDoc = {
    modified: new Date(),
  }
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return sendResponse(res, 400, 'Pool name must be a non-empty string')
    }
    updateDoc.name = name.trim()
  }
  if (description !== undefined) {
    updateDoc.description =
      typeof description === 'string' && description.trim()
        ? description.trim()
        : ''
  }
  if (tags !== undefined) {
    updateDoc.tags = normalizeTags(tags)
  }
  try {
    if (files !== undefined) {
      const normalizedFileUuids = normalizeFileUuidsInput(files)
      const resolvedFileUuids = await resolveFileUuidsFromInput(files)
      updateDoc.files =
        resolvedFileUuids.length > 0 ? resolvedFileUuids : normalizedFileUuids
    }
    const updatedPool = await Pool.findOneAndUpdate(
      { uuid: { $eq: uuid } },
      updateDoc,
      { returnDocument: 'after' }
    ).lean()
    if (!updatedPool) {
      return sendResponse(res, 404, 'Pool not found')
    }
    return sendResponse.json(res, 200, serializePool(updatedPool))
  } catch (error) {
    log.error('Error updating pool:', error)
    return sendResponse(res, 500)
  }
})
router.delete(['/:uuid', '/:uuid/'], requireRole('user'), async (req, res) => {
  const { uuid } = req.params
  if (!isValidUuidParam(uuid)) {
    return sendResponse(res, 400, 'Invalid UUID parameter')
  }
  try {
    const deletedPool = await Pool.findOneAndDelete({ uuid: { $eq: uuid } })
    if (!deletedPool) {
      return sendResponse(res, 404, 'Pool not found')
    }
    return sendResponse(res, 204, 'Pool deleted successfully')
  } catch (error) {
    log.error('Error deleting pool:', error)
    return sendResponse(res, 500)
  }
})
router.get(
  ['/:uuid/files', '/:uuid/files/'],
  requireRole('user'),
  async (req, res) => {
    const { uuid } = req.params
    if (!isValidUuidParam(uuid)) {
      return sendResponse(res, 400, 'Invalid UUID parameter')
    }
    try {
      const pool = await Pool.findOne(
        { uuid: { $eq: uuid } },
        { files: 1 }
      ).lean()
      if (!pool) {
        return sendResponse(res, 404, 'Pool not found')
      }
      if (!Array.isArray(pool.files) || pool.files.length === 0) {
        return sendResponse.json(res, 200, [])
      }
      const files = await findFilesByUuids(pool.files)
      return sendResponse.json(res, 200, files)
    } catch (error) {
      log.error('Error retrieving files for pool:', error)
      return sendResponse(res, 500)
    }
  }
)
router.post(
  ['/:uuid/files', '/:uuid/files/'],
  requireRole('user'),
  async (req, res) => {
    const { uuid } = req.params
    const { files } = req.body || {}
    if (!isValidUuidParam(uuid)) {
      return sendResponse(res, 400, 'Invalid UUID parameter')
    }
    if (!isNonEmptyArray(files)) {
      return sendResponse(res, 400, 'files must be a non-empty array')
    }
    try {
      const normalizedFileUuids = normalizeFileUuidsInput(files)
      const resolvedFileUuids = await resolveFileUuidsFromInput(files)
      const fileUuids =
        resolvedFileUuids.length > 0 ? resolvedFileUuids : normalizedFileUuids
      if (fileUuids.length === 0) {
        return sendResponse(res, 404, 'No valid files were found')
      }
      const updatedPool = await Pool.findOneAndUpdate(
        { uuid: { $eq: uuid } },
        [
          {
            $set: {
              files: {
                $setUnion: [{ $ifNull: ['$files', []] }, fileUuids],
              },
              modified: new Date(),
            },
          },
        ],
        {
          updatePipeline: true,
          returnDocument: 'after',
          projection: { files: 1 },
        }
      ).lean()
      if (!updatedPool) {
        return sendResponse(res, 404, 'Pool not found')
      }
      return sendResponse.json(res, 200, {
        message: 'Files added to pool',
        count: Array.isArray(updatedPool.files) ? updatedPool.files.length : 0,
      })
    } catch (error) {
      log.error('Error adding files to pool:', error)
      return sendResponse(res, 500)
    }
  }
)
router.delete(
  ['/:uuid/files', '/:uuid/files/'],
  requireRole('user'),
  async (req, res) => {
    const { uuid } = req.params
    const { files } = req.body || {}
    if (!isValidUuidParam(uuid)) {
      return sendResponse(res, 400, 'Invalid UUID parameter')
    }
    if (!isNonEmptyArray(files)) {
      return sendResponse(res, 400, 'files must be a non-empty array')
    }
    try {
      const normalizedFileUuids = normalizeFileUuidsInput(files)
      const resolvedFileUuids = await resolveFileUuidsFromInput(files)
      const fileUuidsToRemove = new Set(
        resolvedFileUuids.length > 0 ? resolvedFileUuids : normalizedFileUuids
      )
      if (fileUuidsToRemove.size === 0) {
        return sendResponse(res, 404, 'No valid files were found')
      }
      const updatedPool = await Pool.findOneAndUpdate(
        { uuid: { $eq: uuid } },
        {
          $pull: { files: { $in: [...fileUuidsToRemove] } },
          $set: { modified: new Date() },
        },
        {
          returnDocument: 'after',
          projection: { files: 1 },
        }
      ).lean()
      if (!updatedPool) {
        return sendResponse(res, 404, 'Pool not found')
      }
      return sendResponse.json(res, 200, {
        message: 'Files removed from pool',
        count: Array.isArray(updatedPool.files) ? updatedPool.files.length : 0,
      })
    } catch (error) {
      log.error('Error removing files from pool:', error)
      return sendResponse(res, 500)
    }
  }
)
module.exports = router
