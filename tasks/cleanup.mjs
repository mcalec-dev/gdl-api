import path from 'node:path'
import File from '../models/File.js'
import upsert from '../utils/file/upsert.js'
import log from '../utils/logHandler.js'
import config from '../config.js'
import pathUtils from '../utils/pathUtils.js'

const { deleteEntry } = upsert
const { BASE_DIR } = config
const { pathExists } = pathUtils

export default async function cleanupMissingFiles() {
  if (typeof BASE_DIR !== 'string' || !BASE_DIR) {
    throw new Error('BASE_DIR must be configured')
  }
  if (!(await pathExists(BASE_DIR))) {
    throw new Error(`BASE_DIR does not exist: ${BASE_DIR}`)
  }
  const files = await File.find(
    {},
    { 'paths.local': 1, 'paths.relative': 1 },
  ).lean()
  let removed = 0
  for (const file of files) {
    const localPath = file.paths?.local
    if (typeof localPath !== 'string' || !localPath) continue
    try {
      if (await pathExists(localPath)) continue
      const relativePath = file.paths?.relative
      if (typeof relativePath === 'string' && relativePath) {
        const canonicalPath = path.resolve(BASE_DIR, relativePath)
        const relativeToBase = path.relative(
          path.resolve(BASE_DIR),
          canonicalPath
        )
        if (
          relativeToBase !== '..' &&
          !relativeToBase.startsWith(`..${path.sep}`) &&
          !(await pathExists(canonicalPath))
        ) {
          await deleteEntry(localPath, false)
          removed += 1
        }
      }
    } catch (/** @type {any} */ error) {
      log.warn(`Could not check file path: ${localPath}`, error)
    }
  }
  log.info(`File cleanup completed (${removed} stale record(s) removed)`)
}
