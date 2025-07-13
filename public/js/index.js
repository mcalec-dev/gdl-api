export const url = window.location.origin;
export const host = window.location.hostname;
export const path = window.location.pathname;
export const query = window.location.search;
export function formatSize(bytes) {
  const units =   ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  const formattedSize = `${Math.round(size * 100 / 100)} ${units[unitIndex]}`;
  return formattedSize;
}
export function formatDate(timestamp) {
  const date = new Date(timestamp);
  const options = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZone: 'America/New_York',
    hour12: true,
  };
  return date.toLocaleString('en-US', options);
}
export async function apiHost() {
  const endpoints = [
    'https://alt-api.mcalec.dev/gdl/api',
    'https://api.mcalec.dev/gdl/api'
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { 
        method: 'GET'
      });
      if (response.ok) {
        return endpoint;
      }
    } catch(error) {
      debug('An error occured when fetching api endpoints:', error)
    }
  }
  debug('No API endpoints are available');
}
export async function getFileType(file) {
  let cachedMimeDB = null;
  if (!cachedMimeDB) {
    const res = await fetch('https://cdn.jsdelivr.net/npm/mime-db/db.json');
    cachedMimeDB = await res.json;
  }
  const ext = file.split('.').pop().toLowerCase();
  function getMimeType() {
    for (const [type, data] of Object.entries(cachedMimeDB)) {
      if (data.extensions && data.extensions.includes(ext)) {
        return type;
      }
    }
    return null;
  }
  const mimeType = getMimeType();
  const videoFallbacks = ['mp4', 'mkv', 'webm', 'mov', 'avi'];
  const imageFallbacks = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
  if (!mimeType) {
    console.warn(`Unknown file ext:`, ext);
    if (imageFallbacks.includes(ext)) return 'image';
    if (videoFallbacks.includes(ext)) return 'video';
    return 'other';
  }
  console.log(`File ${file} → MIME: ${mimeType}`);
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (imageFallbacks.includes(ext)) return 'image';
  if (videoFallbacks.includes(ext)) return 'video';
  return 'other';
}