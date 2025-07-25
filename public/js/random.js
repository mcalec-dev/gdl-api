import { formatSize, apiHost } from '../min/index.min.js'
let API_URL = ''
const loadImageBtn = document.getElementById('loadImageBtn')
const backImageBtn = document.getElementById('backImageBtn')
const forwardImageBtn = document.getElementById('forwardImageBtn')
const imageContainer = document.getElementById('imageContainer')
const loading = document.getElementById('loading')
const imageInfo = document.getElementById('imageInfo')
const HISTORY_KEY = 'randomMediaHistory'
const HISTORY_LIMIT = 10
let history = []
let historyIndex = -1
function loadHistory() {
  const h = JSON.parse(localStorage.getItem(HISTORY_KEY))
  if (Array.isArray(h)) {
    history = h
    historyIndex = history.length - 1
  }
}
function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}
function showMedia(data) {
  imageContainer.classList.remove('has-image')
  loading.textContent = 'Loading...'
  loading.style.display = 'block'
  loading.classList.remove('error')
  imageContainer.querySelectorAll('img, video').forEach((el) => el.remove())
  const mediaUrl = data.url
  const isVideo = data.file.toLowerCase().match(/\.(mp4|webm|mov)$/)
  const mediaElement = isVideo
    ? document.createElement('video')
    : document.createElement('img')
  mediaElement.classList =
    'object-contain w-full h-full overflow-hidden border-none rounded'
  mediaElement.style.display = 'none'
  if (isVideo) {
    mediaElement.controls = true
    mediaElement.muted = false
    mediaElement.loop = true
    mediaElement.autoplay = false
  }
  imageInfo.innerHTML = `
    <span id="image-author" class="font-semibold text-gray-300">${escapeHTML(data.author)}</span>
    <span class="text-gray-400"> on </span>
    <span id="image-collection" class="font-semibold text-gray-300">${escapeHTML(data.collection)}</span><br>
    <span id="image-size" class="text-gray-400">${formatSize(data.size)}</span>
  `
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  const loadHandler = () => {
    loading.style.display = 'none'
    mediaElement.style.display = 'block'
    imageInfo.style.display = 'block'
    imageContainer.classList.add('has-image')
  }
  mediaElement.addEventListener(isVideo ? 'loadeddata' : 'load', loadHandler)
  mediaElement.addEventListener('error', handleMediaError)
  mediaElement.src = mediaUrl + ''
  mediaElement.onclick = () => window.open(mediaUrl, '_blank')
  imageContainer.appendChild(mediaElement)
}
async function loadRandomMedia() {
  try {
    imageContainer.classList.remove('has-image')
    loading.textContent = 'Loading...'
    loading.style.display = 'block'
    loading.classList.remove('error')
    imageContainer.querySelectorAll('img, video').forEach((el) => el.remove())
    const response = await fetch(API_URL)
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`)
    const data = await response.json()
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1)
    }
    history.push(data)
    if (history.length > HISTORY_LIMIT) {
      history.shift()
    }
    historyIndex = history.length - 1
    saveHistory()
    showMedia(data)
  } catch (error) {
    handleMediaError(error)
  }
}
function handleMediaError(error) {
  ;((loading.textContent = 'Failed to load media. Try again.'), error)
  loading.classList.add('error')
  imageInfo.style.display = 'none'
  imageContainer.classList.remove('has-image')
  console.error('Media load error:', error)
}
function showPreviousMedia() {
  if (historyIndex > 0) {
    historyIndex--
    saveHistory()
    showMedia(history[historyIndex], true)
  }
}
function showNextMedia() {
  if (historyIndex < history.length - 1) {
    historyIndex++
    saveHistory()
    showMedia(history[historyIndex], true)
  }
}
document.addEventListener('DOMContentLoaded', async () => {
  const apiBase = await apiHost()
  API_URL = `${apiBase}/random`
  loadHistory()
  loadImageBtn.addEventListener('click', loadRandomMedia)
  backImageBtn.addEventListener('click', showPreviousMedia)
  forwardImageBtn.addEventListener('click', showNextMedia)
})
