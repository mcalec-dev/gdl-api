const { HOST, NAME } = /** @type {any} */ (require('../../config'))
/** @param {Date | string | number} date */
function formatExifDateTime(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`
}
/** @param {Date} mtime */
async function buildExifPayload(mtime) {
  const host = await Promise.resolve(HOST)
  const siteName = typeof NAME === 'string' ? NAME : 'Unknown'
  const description = `Downloaded from: ${siteName} on ${host}\nDate Processed: ${new Date().toISOString()}`
  /** @type {any} */
  const exif = {
    IFD0: {
      Software: 'sharp',
      ProcessingSoftware: 'sharp',
      Description: description,
      ImageDescription: description,
      XPComment: description,
      UserComment: description,
      Copyright: 'All Rights Reserved',
      DateTime: formatExifDateTime(mtime),
      DateTimeOriginal: formatExifDateTime(mtime),
      DateTimeDigitized: formatExifDateTime(mtime),
      ModifyDate: formatExifDateTime(mtime),
    },
    ExifIFD: {
      Software: 'sharp',
      ProcessingSoftware: 'sharp',
      Description: description,
      ImageDescription: description,
      XPComment: description,
      UserComment: description,
      Copyright: 'All Rights Reserved',
      DateTimeOriginal: formatExifDateTime(mtime),
      DateTimeDigitized: formatExifDateTime(mtime),
      ModifyDate: formatExifDateTime(mtime),
    },
  }
  return exif
}
module.exports = {
  formatExifDateTime,
  buildExifPayload,
}
