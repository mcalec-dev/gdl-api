export const url = window.location.origin
export const host = window.location.hostname
export const path = window.location.pathname
export const query = window.location.search
export function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  const formattedSize = `${Math.round((size * 100) / 100)} ${units[unitIndex]}`
  return formattedSize
}
export function formatDate(timestamp) {
  const date = new Date(timestamp)
  const options = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZone: 'America/New_York',
    hour12: true,
  }
  return date.toLocaleString('en-US', options)
}
let cachedMimeDB = null
export async function getFileType(file) {
  if (!cachedMimeDB) {
    try {
      const res = await fetch('https://cdn.jsdelivr.net/npm/mime-db/db.json')
      cachedMimeDB = await res.json()
    } catch (error) {
      console.error('Failed to fetch MIME database...', error)
      cachedMimeDB = {}
    }
  }
  const ext = file.split('.').pop().toLowerCase()
  function getMimeType() {
    for (const [type, data] of Object.entries(cachedMimeDB)) {
      if (data.extensions && data.extensions.includes(ext)) {
        return type
      }
    }
    return null
  }
  const mimeType = getMimeType()
  const videoFallbacks = ['mp4', 'mkv', 'webm', 'mov', 'avi']
  const imageFallbacks = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']
  if (!mimeType) {
    console.warn(`Unknown file ext:`, ext)
    if (imageFallbacks.includes(ext)) return 'image'
    if (videoFallbacks.includes(ext)) return 'video'
    return 'other'
  }
  console.log(`${file} = ${mimeType}`)
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (imageFallbacks.includes(ext)) return 'image'
  if (videoFallbacks.includes(ext)) return 'video'
  return 'other'
}
export async function getName() {
  let name
  try {
    const host = document.location.origin + '/api'
    if (!host) throw new Error('No API host available')
    const res = await fetch(host)
    if (res && typeof res.json === 'function') {
      const data = await res.json()
      name = data && data.name
    } else if (res && res.name) {
      name = res.name
    }
  } catch (error) {
    console.error('Failed to fetch name:', error)
    name = undefined
  }
  return name
}