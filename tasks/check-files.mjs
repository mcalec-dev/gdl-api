import checker from '../utils/file/check.js'
import log from '../utils/logHandler.js'

const { checkAllFileRecords } = checker

export default async function checkFileRecords() {
  const result = await checkAllFileRecords()
  log.info(
    `File record check completed (${result.checked} checked, ${result.updated} updated)`
  )
}
