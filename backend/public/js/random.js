'use strict'
import * as utils from '../min/index.min.js'
import { IMAGE_SCALE, IMAGE_KERNEL } from '../min/settings.min.js'
import {
  setupContextMenu,
  createContextMenu,
  setContextIcons,
} from '../min/contextmenu.min.js'
const API_URL = '/api/random'
const mediaContainer = document.getElementById('media-container')
const loading = document.getElementById('loading')
const imageInfo = document.getElementById('item-info')
const HISTORY_KEY = 'randomMediaHistory'
const HISTORY_LIMIT = 10
let history = []
let historyIndex = 0
let currentMediaData = null
function showMedia(data) {
  if (!data || !data.url) {
    console.error('Invalid media data:', data)
    mediaContainer.classList.remove('has-image')
    loading.textContent = ''
    loading.hidden = false
    imageInfo.hidden = true
    currentMediaData = null
    return
  }
  if (history.length === 0) {
    mediaContainer.classList.remove('has-image')
    loading.textContent = 'Click the button to load media'
    loading.hidden = false
    currentMediaData = null
    return
  }
  currentMediaData = data
  mediaContainer.classList.remove('has-image')
  loading.textContent = 'Loading...'
  loading.hidden = false
  loading.classList.remove('error')
  mediaContainer.querySelectorAll('img, video').forEach((el) => el.remove())
  const mediaUrl =
    utils.upscaleImage(data.url, IMAGE_SCALE, IMAGE_KERNEL) || data.url
  const isVideo = data.file.toLowerCase().match(/\.(mp4|webm|mov)$/)
  const mediaElement = isVideo
    ? document.createElement('video')
    : document.createElement('img')
  mediaElement.classList =
    'object-contain w-auto h-auto max-w-full max-h-[50vh] overflow-hidden border-none rounded-lg inline-block cursor-pointer'
  mediaElement.hidden = false
  mediaElement.id = 'random-media-element'
  if (isVideo) {
    mediaElement.controls = true
    mediaElement.muted = false
    mediaElement.loop = false
    mediaElement.autoplay = false
    mediaElement.playsInline = true
  }
  imageInfo.innerHTML = `
    <span id="image-author" class="font-medium text-gray-300">${data.author}</span>
    <span class="text-gray-500 text-light"> on </span>
    <span id="image-collection" class="font-medium text-gray-300">${data.collection}</span><br>
    <span id="image-size" class="text-gray-500 text-light">${utils.formatSize(data.size)}</span>
  `
  const loadHandler = () => {
    loading.hidden = true
    mediaElement.hidden = false
    imageInfo.hidden = false
    mediaContainer.classList.add('has-image')
  }
  mediaElement.addEventListener(isVideo ? 'loadeddata' : 'load', loadHandler)
  mediaElement.addEventListener('error', handleMediaError)
  mediaElement.src = mediaUrl
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
    image: icon.file.image,
    video: icon.file.video,
    audio: icon.file.audio,
    text: icon.file.text,
    other: icon.file.default,
    nav: {
      exit: icon.nav.exit,
      next: icon.nav.next,
      prev: icon.nav.prev,
      link: icon.nav.link,
      copy: icon.nav.copy,
      download: icon.nav.download,
    },
  }
}
function setupRandomMediaContextMenu() {
  setupContextMenu('#media-container', () => {
    if (!currentMediaData) return { items: [] }
    const menuItems = []
    menuItems.push({
      label: 'Copy URL',
      icon: icons?.nav?.copy || '',
      handler: () => {
        if (!currentMediaData.url) return
        try {
          navigator.clipboard.writeText(currentMediaData.url)
        } catch (error) {
          utils.handleError(error)
          return
        }
      },
    })
    menuItems.push({
      label: 'Open in New Tab',
      icon: icons?.nav?.link || '',
      handler: () => {
        if (!currentMediaData.url) return
        try {
          window.open(currentMediaData.url, '_blank')
        } catch (error) {
          utils.handleError(error)
          return
        }
      },
    })
    const isImage = currentMediaData.file
      .toLowerCase()
      .match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
    if (isImage) {
      menuItems.push({
        label: 'Copy Image',
        icon: icons?.nav?.copy || '',
        handler: async () => {
          if (!currentMediaData.url) return
          try {
            const req = await fetch(currentMediaData.url)
            const blob = await req.blob()
            const type = blob.type
            await navigator.clipboard.write([
              new window.ClipboardItem({ [type]: blob }),
            ])
          } catch (error) {
            utils.handleError(error)
            return
          }
        },
      })
    }
    menuItems.push({
      label: 'Download',
      icon: icons?.nav?.download || '',
      handler: () => {
        if (!currentMediaData.uuid) return
        try {
          const a = document.createElement('a')
          a.href = `/api/download/?uuid=${currentMediaData.uuid}`
          a.download = ''
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        } catch (error) {
          utils.handleError(error)
          return
        }
      },
    })
    menuItems.push({
      divider: true,
    })
    menuItems.push({
      label: 'Copy',
      icon: icons?.nav?.copy || '',
      submenu: [
        {
          label: 'Hash',
          icon: icons?.nav?.copy || '',
          handler: () => {
            if (!currentMediaData.hash) return
            try {
              navigator.clipboard.writeText(currentMediaData.hash)
            } catch (error) {
              utils.handleError(error)
              return
            }
          },
        },
        {
          label: 'UUID',
          icon: icons?.nav?.copy || '',
          handler: () => {
            if (!currentMediaData.uuid) return
            try {
              navigator.clipboard.writeText(currentMediaData.uuid)
            } catch (error) {
              utils.handleError(error)
              return
            }
          },
        },
      ],
    })
    const isVideo = currentMediaData.file
      .toLowerCase()
      .match(/\.(mp4|webm|mov)$/)
    const isAudio = currentMediaData.file
      .toLowerCase()
      .match(/\.(mp3|wav|ogg|flac)$/i)
    let mediaTypeIcon = icons?.image || ''
    if (isVideo) {
      mediaTypeIcon = icons?.video || ''
    } else if (isAudio) {
      mediaTypeIcon = icons?.audio || ''
    }
    return {
      header: {
        icon: mediaTypeIcon,
        label: currentMediaData.file,
      },
      items: menuItems,
    }
  })
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
  setContextIcons(icons)
  backImageBtn.innerHTML = `<span class="w-5 h-5 m-0 items-center">${icons.back}</span>`
  loadImageBtn.innerHTML = `<span class="w-5 h-5 m-0 items-center">${icons.shuffle}</span>`
  forwardImageBtn.innerHTML = `<span class="w-5 h-5 m-0 items-center">${icons.forward}</span>`
  createContextMenu()
  setupRandomMediaContextMenu()
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
