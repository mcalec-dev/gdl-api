const mongoose = require('mongoose')
const { GridFSBucket, ObjectId } = require('mongodb')
const log = require('./logHandler')
let gridFSBucket
function initGridFS(dbName = 'gdl') {
  try {
    gridFSBucket = new GridFSBucket(mongoose.connection.getClient().db(dbName))
    log.info('GridFS bucket initialized for database:', dbName)
    return gridFSBucket
  } catch (error) {
    log.error('Error initializing GridFS:', error)
  }
}
function getGridFS() {
  return gridFSBucket
}
async function uploadFile(fileBuffer, filename, options = {}) {
  try {
    const bucket = getGridFS()
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
      uploadStream.on('error', (error) => {
        log.error('Upload error:', error)
        reject(error)
      })
    })
  } catch (error) {
    log.error('uploadFile error:', error)
  }
}
async function downloadFile(fileId) {
  try {
    const bucket = getGridFS()
    const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId
    const downloadStream = bucket.openDownloadStream(objectId)
    return new Promise((resolve, reject) => {
      const chunks = []
      downloadStream.on('data', (chunk) => chunks.push(chunk))
      downloadStream.on('end', () => {
        log.debug(`File downloaded: ${objectId}`)
        resolve(Buffer.concat(chunks))
      })
      downloadStream.on('error', (error) => {
        log.error('Download error:', error)
        reject(error)
      })
    })
  } catch (error) {
    log.error('downloadFile error:', error)
  }
}
async function getFileInfo(fileId) {
  try {
    const bucket = getGridFS()
    const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId
    const file = await bucket.find({ _id: objectId }).toArray()
    return file[0]
  } catch (error) {
    log.error('getFileInfo error:', error)
  }
}
async function deleteFile(fileId) {
  try {
    const bucket = getGridFS()
    const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId
    await bucket.delete(objectId)
    log.debug(`File deleted: ${objectId}`)
  } catch (error) {
    log.error('deleteFile error:', error)
  }
}
async function listFiles(query = {}, options = {}) {
  try {
    const bucket = getGridFS()
    const files = await bucket.find(query, options).toArray()
    return files
  } catch (error) {
    log.error('listFiles error:', error)
    throw error
  }
}
async function fileExists(fileId) {
  try {
    const bucket = getGridFS()
    const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId
    const file = await bucket.find({ _id: objectId }).toArray()
    return file.length > 0
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
