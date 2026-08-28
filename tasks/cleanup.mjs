import { access } from 'node:fs/promises'
import File from '../models/File.js'
import upsert from '../utils/file/upsert.js'
import log from '../utils/logHandler.js'

const { deleteEntry } = upsert

export default async function cleanupMissingFiles() {
  const files = await File.find({}, { 'paths.local': 1 }).lean()
  let removed = 0
  for (const file of files) {
    const localPath = file.paths?.local
    if (typeof localPath !== 'string' || !localPath) continue
    try {
      await access(localPath)
    } catch (/** @type {any} */ error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') {
        log.warn(`Could not check file path: ${localPath}`, error)
        continue
      }
      await deleteEntry(localPath, false)
      removed += 1
    }
  }
  log.info(`File cleanup completed (${removed} stale record(s) removed)`)
}
