'use strict'
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
export async function getIcons() {
  const res = await fetch('/icons.json')
  const data = await res.json()
  return data
}
export async function parseEmojis(text) {
  const icons = await getIcons()
  return text.replace(/:([a-zA-Z0-9_+-]+):/g, (match, key) => {
    return icons[key] || match
  })
}
export function handleError(error) {
  console.error(error)
  window.alert(`${error.message || error}`)
}
