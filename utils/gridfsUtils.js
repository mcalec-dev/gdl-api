const mongoose = require('mongoose')
const { GridFSBucket, ObjectId } = require('mongodb')
const log = require('./logHandler')
/** @type {import('mongodb').GridFSBucket | null} */
let gridFSBucket = null
function requireBucket() {
  const bucket = getGridFS()
  if (!bucket) {
    throw new Error('GridFS bucket is not initialized')
  }
  return bucket
}
/** @param {string | import('mongodb').ObjectId} fileId */
function toObjectId(fileId) {
  return typeof fileId === 'string' ? new ObjectId(fileId) : fileId
}
/** @param {string | import('mongodb').ObjectId} fileId */
async function findFileById(fileId) {
  const bucket = requireBucket()
  const objectId = toObjectId(fileId)
  const files = await bucket.find({ _id: objectId }).toArray()
  return {
    objectId,
    file: files[0],
  }
}
function initGridFS(dbName = 'gdl') {
  try {
    const db = /** @type {any} */ (mongoose.connection.getClient().db(dbName))
    gridFSBucket = new GridFSBucket(db)
    log.info('GridFS bucket initialized for database:', dbName)
    return gridFSBucket
  } catch (error) {
    log.error('Error initializing GridFS:', error)
  }
}
/** @returns {import('mongodb').GridFSBucket | null} */
function getGridFS() {
  return gridFSBucket
}
/** @param {Buffer} fileBuffer @param {string} filename @param {{ contentType?: string, metadata?: Record<string, unknown> }} [options] */
async function uploadFile(fileBuffer, filename, options = {}) {
  try {
    const bucket = requireBucket()
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: options.contentType || 'application/octet-stream',
      metadata: {
        uploadedAt: new Date(),
        originalName: filename,
        mimeType: options.contentType,
        size: fileBuffer.length,
        ...options.metadata,
      },
    })
    return new Promise((resolve, reject) => {
      uploadStream.end(fileBuffer)
      uploadStream.on('finish', () => {
        log.debug(`File uploaded: ${filename} (ID: ${uploadStream.id})`)
        resolve(uploadStream.id)
      })
      uploadStream.on('error', (/** @type {any} */ error) => {
        log.error('Upload error:', error)
        reject(error)
      })
    })
  } catch (error) {
    log.error('uploadFile error:', error)
  }
}
/** @param {string | import('mongodb').ObjectId} fileId */
async function downloadFile(fileId) {
  try {
    const bucket = requireBucket()
    const objectId = toObjectId(fileId)
    const downloadStream = bucket.openDownloadStream(objectId)
    return new Promise(
      (
        /** @type {(value: Buffer) => void} */ resolve,
        /** @type {(reason?: any) => void} */ reject
      ) => {
        /** @type {Buffer[]} */
        const chunks = []
        downloadStream.on('data', (/** @type {Buffer} */ chunk) =>
          chunks.push(chunk)
        )
        downloadStream.on('end', () => {
          log.debug(`File downloaded: ${objectId}`)
          resolve(Buffer.concat(chunks))
        })
        downloadStream.on('error', (/** @type {any} */ error) => {
          log.error('Download error:', error)
          reject(error)
        })
      }
    )
  } catch (error) {
    log.error('downloadFile error:', error)
  }
}
/** @param {string | import('mongodb').ObjectId} fileId */
async function getFileInfo(fileId) {
  try {
    const { file } = await findFileById(fileId)
    return file
  } catch (error) {
    log.error('getFileInfo error:', error)
  }
}
/** @param {string | import('mongodb').ObjectId} fileId */
async function deleteFile(fileId) {
  try {
    const bucket = requireBucket()
    const objectId = toObjectId(fileId)
    await bucket.delete(objectId)
    log.debug(`File deleted: ${objectId}`)
  } catch (error) {
    log.error('deleteFile error:', error)
  }
}
async function listFiles(query = {}, options = {}) {
  try {
    const bucket = requireBucket()
    return await bucket.find(query, options).toArray()
  } catch (error) {
    log.error('listFiles error:', error)
    throw error
  }
}
/** @param {string | import('mongodb').ObjectId} fileId */
async function fileExists(fileId) {
  try {
    const { file } = await findFileById(fileId)
    return Boolean(file)
  } catch (error) {
    log.error('fileExists error:', error)
    return false
  }
}
module.exports = {
  initGridFS,
  getGridFS,
  uploadFile,
  downloadFile,
  getFileInfo,
  deleteFile,
  listFiles,
  fileExists,
}
