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
const cache = require('../../utils/cache')
const { cacheControl } = require('../../utils/cacheControl')
const { checkETag } = require('../../utils/etag')

/**
 * @param {Record<string, any>} pool
 * @returns {Record<string, any>}
 */
function serializePool(pool) {
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

/** @param {string} uuid @param {string} userId */
async function invalidatePoolCache(uuid, userId) {
  await Promise.all([
    cache.del(`pool:${uuid}:true`),
    cache.del(`pool:${uuid}:false`),
    cache.del(`pool:${uuid}:files`),
    cache.delPattern(`pool:list:${userId}:`),
  ])
}

router.get('/', cacheControl('privateVeryShort'), requireRole('user'), async (req, res) => {
  try {
    const { limit, page, skip } = parsePagination(
      req.query.limit,
      req.query.page,
      PAGINATION_LIMIT
    )
    const userId = String(/** @type {any} */ (req.user)?.uuid)
    const result = await cache.wrap(
      `pool:list:${userId}:${page}:${limit}`,
      20,
      async () => {
        const [count, pools] = await Promise.all([
          Pool.countDocuments(),
          Pool.find()
            .sort({ modified: -1 })
            .skip(skip)
            .limit(limit)
            .select('-files')
            .lean(),
        ])
        return { total: count, page, limit, results: pools.map(serializePool) }
      },
    )
    return sendResponse(res, 200).json(result)
  } catch (error) {
    log.error('Error retrieving pools:', error)
    return sendResponse.error(res, 500, 'Internal Server Error')
  }
})

router.post(
  '/',
  cacheControl('noStore'),
  requireRole('user'),
  async (req, res) => {
    const { name, description, tags, files } = req.body || {}
    if (!name || typeof name !== 'string' || !name.trim()) {
      return sendResponse.error(res, 400, 'Pool name is required')
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
        },
      ).lean()
      if (!createdPool) {
        return sendResponse.error(res, 500, 'Pool could not be created')
      }
      log.debug('Pool created:', createdPool.uuid)
      await cache.delPattern(
        `pool:list:${String(/** @type {any} */ (req.user)?.uuid)}:`,
      )
      return sendResponse(res, 201).json(serializePool(createdPool))
    } catch (error) {
      log.error('Error creating pool:', error)
      return sendResponse.error(res, 500, 'Internal Server Error')
    }
  },
)

router.get(
  ['/:uuid', '/:uuid/'],
  cacheControl('privateShort'),
  requireRole('user'),
  async (req, res) => {
    const { uuid } = req.params
    if (!isValidUuidParam(uuid)) {
      return sendResponse.error(res, 400, 'Invalid UUID parameter')
    }
    try {
      const pool = await cache.wrap(`pool:${uuid}:false`, 30, () =>
        Pool.findOne({ uuid: { $eq: uuid } }).lean(),
      )
      if (!pool) {
        return sendResponse.error(res, 404, 'Pool not found')
      }
      if (checkETag(req, res, pool.modified)) return
      return sendResponse(res, 200).json(serializePool(pool))
    } catch (error) {
      log.error('Error retrieving pool:', error)
      return sendResponse.error(res, 500, 'Internal Server Error')
    }
  },
)

router.put(
  ['/:uuid', '/:uuid/'],
  cacheControl('noStore'),
  requireRole('user'),
  async (req, res) => {
    const { uuid } = req.params
    if (!isValidUuidParam(uuid)) {
      return sendResponse.error(res, 400, 'Invalid UUID parameter')
    }
    const { name, description, tags, files } = req.body || {}
    /** @type {{ modified: Date, name?: string, description?: string, tags?: string[], files?: string[] }} */
    const updateDoc = {
      modified: new Date(),
    }
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return sendResponse.error(
          res,
          400,
          'Pool name must be a non-empty string',
        )
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
        { returnDocument: 'after' },
      ).lean()
      if (!updatedPool) {
        return sendResponse(res, 404, 'Pool not found')
      }
      await invalidatePoolCache(
        uuid,
        String(/** @type {any} */ (req.user)?.uuid),
      )
      return sendResponse(res, 200).json(serializePool(updatedPool))
    } catch (error) {
      log.error('Error updating pool:', error)
      return sendResponse.error(res, 500, 'Internal Server Error')
    }
  },
)

router.delete(
  ['/:uuid', '/:uuid/'],
  cacheControl('noStore'),
  requireRole('user'),
  async (req, res) => {
    const { uuid } = req.params
    if (!isValidUuidParam(uuid)) {
      return sendResponse.error(res, 400, 'Invalid UUID parameter')
    }
    try {
      const deletedPool = await Pool.findOneAndDelete({ uuid: { $eq: uuid } })
      if (!deletedPool) {
        return sendResponse.error(res, 404, 'Pool not found')
      }
      await invalidatePoolCache(
        uuid,
        String(/** @type {any} */ (req.user)?.uuid),
      )
      return sendResponse(res, 204, 'Pool deleted successfully')
    } catch (error) {
      log.error('Error deleting pool:', error)
      return sendResponse.error(res, 500, 'Internal Server Error')
    }
  },
)

router.get(
  ['/:uuid/files', '/:uuid/files/'],
  cacheControl('privateShort'),
  requireRole('user'),
  async (req, res) => {
    const { uuid } = req.params
    if (!isValidUuidParam(uuid)) {
      return sendResponse.error(res, 400, 'Invalid UUID parameter')
    }
    try {
      const pool = await Pool.findOne(
        { uuid: { $eq: uuid } },
        { files: 1 },
      ).lean()
      if (!pool) {
        return sendResponse.error(res, 404, 'Pool not found')
      }
      if (!Array.isArray(pool.files) || pool.files.length === 0) {
        return sendResponse.error(
          res,
          404,
          'No files found for the specified pool',
        )
      }
      const files = await cache.wrap(`pool:${uuid}:files`, 30, () =>
        findFilesByUuids(pool.files),
      )
      return sendResponse(res, 200).json(files)
    } catch (error) {
      log.error('Error retrieving files for pool:', error)
      return sendResponse.error(res, 500, 'Internal Server Error')
    }
  },
)

router.post(
  ['/:uuid/files', '/:uuid/files/'],
  cacheControl('noStore'),
  requireRole('user'),
  async (req, res) => {
    const { uuid } = req.params
    const { files } = req.body || {}
    if (!isValidUuidParam(uuid)) {
      return sendResponse.error(res, 400, 'Invalid UUID parameter')
    }
    if (!isNonEmptyArray(files)) {
      return sendResponse.error(res, 400, 'files must be a non-empty array')
    }
    try {
      const normalizedFileUuids = normalizeFileUuidsInput(files)
      const resolvedFileUuids = await resolveFileUuidsFromInput(files)
      const fileUuids =
        resolvedFileUuids.length > 0 ? resolvedFileUuids : normalizedFileUuids
      if (fileUuids.length === 0) {
        return sendResponse.error(res, 404, 'No valid files were found')
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
        },
      ).lean()
      if (!updatedPool) {
        return sendResponse(res, 404, 'Pool not found')
      }
      await invalidatePoolCache(
        uuid,
        String(/** @type {any} */ (req.user)?.uuid),
      )
      return sendResponse(res, 200).json(serializePool(updatedPool))
    } catch (error) {
      log.error('Error adding files to pool:', error)
      return sendResponse.error(res, 500, 'Internal Server Error')
    }
  },
)

router.delete(
  ['/:uuid/files', '/:uuid/files/'],
  cacheControl('noStore'),
  requireRole('user'),
  async (req, res) => {
    const { uuid } = req.params
    const { files } = req.body || {}
    if (!isValidUuidParam(uuid)) {
      return sendResponse.error(res, 400, 'Invalid UUID parameter')
    }
    if (!isNonEmptyArray(files)) {
      return sendResponse.error(res, 400, 'files must be a non-empty array')
    }
    try {
      const normalizedFileUuids = normalizeFileUuidsInput(files)
      const resolvedFileUuids = await resolveFileUuidsFromInput(files)
      const fileUuidsToRemove = new Set(
        resolvedFileUuids.length > 0 ? resolvedFileUuids : normalizedFileUuids,
      )
      if (fileUuidsToRemove.size === 0) {
        return sendResponse.error(res, 404, 'No valid files were found')
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
        },
      ).lean()
      if (!updatedPool) {
        return sendResponse.error(res, 404, 'Pool not found')
      }
      await invalidatePoolCache(
        uuid,
        String(/** @type {any} */ (req.user)?.uuid),
      )
      return sendResponse(res, 200).json(serializePool(updatedPool))
    } catch (error) {
      log.error('Error removing files from pool:', error)
      return sendResponse.error(res, 500, 'Error removing files from pool')
    }
  },
)

module.exports = router
