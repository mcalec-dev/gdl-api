'use strict'
import * as utils from '../min/index.min.js'
const API_URL = '/api/random'
const mediaContainer = document.getElementById('media-container')
const loading = document.getElementById('loading')
const imageInfo = document.getElementById('item-info')
const HISTORY_KEY = 'randomMediaHistory'
const HISTORY_LIMIT = 10
let history = []
let historyIndex = 0
function showMedia(data) {
  if (!data || !data.url) {
    console.error('Invalid media data:', data)
    mediaContainer.classList.remove('has-image')
    loading.textContent = ''
    loading.hidden = false
    imageInfo.hidden = true
    return
  }
  if (history.length === 0) {
    mediaContainer.classList.remove('has-image')
    loading.textContent = 'Click the button to load media'
    loading.hidden = false
    return
  }
  mediaContainer.classList.remove('has-image')
  loading.textContent = 'Loading...'
  loading.hidden = false
  loading.classList.remove('error')
  mediaContainer.querySelectorAll('img, video').forEach((el) => el.remove())
  const mediaUrl = data.url
  const isVideo = data.file.toLowerCase().match(/\.(mp4|webm|mov)$/)
  const mediaElement = isVideo
    ? document.createElement('video')
    : document.createElement('img')
  mediaElement.classList =
    'object-contain w-auto h-auto max-w-full max-h-[50vh] overflow-hidden border-none rounded-lg inline-block cursor-pointer'
  mediaElement.hidden = false
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
    <span id="image-size" class="text-gray-400">${utils.formatSize(data.size)}</span>
  `
  const loadHandler = () => {
    loading.hidden = true
    mediaElement.hidden = false
    imageInfo.hidden = false
    mediaContainer.classList.add('has-image')
  }
  mediaElement.addEventListener(isVideo ? 'loadeddata' : 'load', loadHandler)
  mediaElement.addEventListener('error', handleMediaError)
  mediaElement.src = mediaUrl + ''
  mediaElement.onclick = () => window.open(mediaUrl, '_blank')
  mediaContainer.appendChild(mediaElement)
}
async function loadRandomMedia() {
  try {
    mediaContainer.classList.remove('has-image')
    loading.textContent = 'Loading...'
    loading.hidden = false
    loading.classList.remove('error')
    mediaContainer.querySelectorAll('img, video').forEach((el) => el.remove())
    const response = await fetch(API_URL).catch((error) => {
      utils.handleError(error)
      handleMediaError(error)
    })
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
    utils.handleError(error)
    handleMediaError(error)
  }
}
function handleMediaError(error) {
  loading.textContent = error.message
  loading.classList.add('error')
  imageInfo.hidden = true
  mediaContainer.classList.remove('has-image')
}
function showPreviousMedia() {
  if (history.length === 0 || historyIndex <= 0) {
    let lastValidIndex = history.length - 1
    while (
      lastValidIndex > 0 &&
      (!history[lastValidIndex] || !history[lastValidIndex].url)
    ) {
      lastValidIndex--
    }
    if (lastValidIndex > 0) {
      historyIndex = lastValidIndex
      const mediaData = history[historyIndex]
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
      showMedia(mediaData, true)
    } else {
      historyIndex = 0
      mediaContainer.classList.remove('has-image')
      loading.textContent = 'Click the button to load media'
      loading.hidden = false
      imageInfo.hidden = true
      mediaContainer.querySelectorAll('img, video').forEach((el) => el.remove())
    }
  } else {
    let previousIndex = historyIndex - 1
    while (
      previousIndex > 0 &&
      (!history[previousIndex] || !history[previousIndex].url)
    ) {
      console.error('Skipping invalid media data at index:', previousIndex)
      previousIndex--
    }
    if (previousIndex > 0) {
      historyIndex = previousIndex
      const mediaData = history[historyIndex]
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
      showMedia(mediaData, true)
    } else {
      historyIndex = 0
      mediaContainer.classList.remove('has-image')
      loading.textContent = 'Click the button to load media'
      loading.hidden = false
      imageInfo.hidden = true
      mediaContainer.querySelectorAll('img, video').forEach((el) => el.remove())
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
    mediaContainer.classList.remove('has-image')
    loading.textContent = 'Click the button to load media'
    loading.hidden = false
    imageInfo.hidden = true
    mediaContainer.querySelectorAll('img, video').forEach((el) => el.remove())
  }
}
let icons
async function loadIcons() {
  const icon = await utils.getIcons()
  icons = {
    back: icon.arrow.left,
    shuffle: icon.arrow.shuffle,
    forward: icon.arrow.right,
  }
}
document.addEventListener('DOMContentLoaded', async () => {
  const loadImageBtn = document.getElementById('loadImageBtn')
  const backImageBtn = document.getElementById('backImageBtn')
  const forwardImageBtn = document.getElementById('forwardImageBtn')
  const h = JSON.parse(localStorage.getItem(HISTORY_KEY))
  if (Array.isArray(h) && h.length > 0) {
    history = h
    let lastValidIndex = h.length - 1
    while (
      lastValidIndex > 0 &&
      (!h[lastValidIndex] || !h[lastValidIndex].url)
    ) {
      lastValidIndex--
    }
    historyIndex = lastValidIndex > 0 ? lastValidIndex : 0
  } else {
    history = [{}]
    historyIndex = 0
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }
  loadImageBtn.addEventListener('click', loadRandomMedia)
  backImageBtn.addEventListener('click', showPreviousMedia)
  forwardImageBtn.addEventListener('click', showNextMedia)
  await loadIcons()
  backImageBtn.innerHTML = `<span class="w-4 h-4 m-0 items-center">${icons.back}</span>`
  loadImageBtn.innerHTML = `<span class="w-4 h-4 m-0 items-center">${icons.shuffle}</span>`
  forwardImageBtn.innerHTML = `<span class="w-4 h-4 m-0 items-center">${icons.forward}</span>`
  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        showPreviousMedia()
        break
      case 'ArrowRight':
        e.preventDefault()
        showNextMedia()
        break
      case ' ':
        e.preventDefault()
        loadRandomMedia()
        break
    }
  })
})
