import { formatSize } from '../min/index.min.js'
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
let historyIndex = 0
function showMedia(data) {
  if (!data || !data.url) {
    console.error('Invalid media data:', data)
    imageContainer.classList.remove('has-image')
    loading.textContent = 'Failed to load media. Try again.'
    loading.style.display = 'block'
    imageInfo.style.display = 'none'
    return
  }
  if (history.length === 0) {
    imageContainer.classList.remove('has-image')
    loading.textContent = 'Click the button to load media'
    loading.style.display = 'block'
    return
  }
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
    'object-contain w-auto h-auto max-w-full max-h-[60vh] overflow-hidden border-none rounded transition-transform duration-500'
  mediaElement.style.display = 'none'
  if (isVideo) {
    mediaElement.controls = true
    mediaElement.muted = false
    mediaElement.loop = false
    mediaElement.autoplay = false
  }
  imageInfo.innerHTML = `
    <span id="image-author" class="font-semibold text-gray-300">${data.author}</span>
    <span class="text-gray-400"> on </span>
    <span id="image-collection" class="font-semibold text-gray-300">${data.collection}</span><br>
    <span id="image-size" class="text-gray-400">${formatSize(data.size)}</span>
  `
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
    if (history.length === 0) {
      history.push({})
    }
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1)
    }
    history.push(data)
    if (history.length > HISTORY_LIMIT + 1) {
      history.splice(1, 1)
    }
    historyIndex = history.length - 1
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
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
  if (history.length === 0 || historyIndex <= 0) {
    historyIndex = 0
    imageContainer.classList.remove('has-image')
    loading.textContent = 'Click the button to load media'
    loading.style.display = 'block'
    imageInfo.style.display = 'none'
    imageContainer.querySelectorAll('img, video').forEach((el) => el.remove())
  } else {
    let previousIndex = historyIndex - 1
    while (
      previousIndex >= 0 &&
      (!history[previousIndex] || !history[previousIndex].url)
    ) {
      console.error('Skipping invalid media data at index:', previousIndex)
      previousIndex--
    }
    if (previousIndex >= 0) {
      historyIndex = previousIndex
      const mediaData = history[historyIndex]
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
      showMedia(mediaData, true)
    } else {
      console.error('No valid media data found when navigating back.')
    }
  }
}
function showNextMedia() {
  if (historyIndex < history.length - 1) {
    let nextIndex = historyIndex + 1
    while (
      nextIndex < history.length &&
      (!history[nextIndex] || !history[nextIndex].url)
    ) {
      console.error('Skipping invalid media data at index:', nextIndex)
      nextIndex++
    }
    if (nextIndex < history.length) {
      historyIndex = nextIndex
      const mediaData = history[historyIndex]
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
      showMedia(mediaData, true)
    } else {
      console.error('No valid media data found when navigating forward.')
    }
  } else {
    historyIndex = Math.max(0, historyIndex)
    imageContainer.classList.remove('has-image')
    loading.textContent = 'Click the button to load media'
    loading.style.display = 'block'
    imageInfo.style.display = 'none'
    imageContainer.querySelectorAll('img, video').forEach((el) => el.remove())
  }
}
document.addEventListener('DOMContentLoaded', async () => {
  API_URL = `/api/random/`
  const h = JSON.parse(localStorage.getItem(HISTORY_KEY))
  if (Array.isArray(h) && h.length > 0) {
    history = h
    historyIndex = history.length + 1
  } else {
    history = [{}]
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }
  loadImageBtn.addEventListener('click', loadRandomMedia)
  backImageBtn.addEventListener('click', showPreviousMedia)
  forwardImageBtn.addEventListener('click', showNextMedia)
})
