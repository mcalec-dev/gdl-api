import File from '../models/File.js'
import sidecar from '../utils/file/sidecar.js'
import log from '../utils/logHandler.js'

const { readSidecarFile } = sidecar

export default async function updateSidecarMetadata() {
  const files = await File.find({}, { 'paths.local': 1 }).lean()
  let updated = 0
  for (const file of files) {
    const localPath = file.paths?.local
    if (typeof localPath !== 'string' || !localPath) continue
    const metadata = await readSidecarFile(localPath)
    if (!metadata) continue
    await File.updateOne({ _id: file._id }, { $set: { sidecar: metadata } })
    updated += 1
  }
  log.info(`Sidecar metadata update completed (${updated} updated)`)
}
