'use strict'
import * as utils from '/js/index.js'
import { IMAGE_SCALE, MAX_IMAGE_SCALE } from '/js/settings.js'
let currentItemIndex = 0
let currentItemList = []
let itemLoadControllers = new Map()
const zoomedImageSize = `?x=${MAX_IMAGE_SCALE}`
const defaultImageSize = `?x=${IMAGE_SCALE}`
let icons
async function loadViewerIcons() {
  const icon = await utils.getIcons()
  icons = {
    exit: icon.nav.exit,
    next: icon.nav.next,
    prev: icon.nav.prev,
    link: icon.nav.link,
    copy: icon.nav.copy,
    download: icon.nav.download,
  }
}
let _prevBodyOverflow = null
function lockScroll() {
  try {
    _prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } catch {
    utils.handleError('Unable to lock scroll')
  }
  document.body.style.removeProperty('overflow')
}
function unlockScroll() {
  try {
    if (_prevBodyOverflow === null || _prevBodyOverflow === undefined) {
      document.body.style.removeProperty('overflow')
    } else {
      document.body.style.overflow = _prevBodyOverflow
    }
    _prevBodyOverflow = null
  } catch {
    utils.handleError('Unable to unlock scroll')
  }
  document.body.style.removeProperty('overflow')
}
function getMediaUrl(item) {
  return item.previewSrc || `/api/files/${item.encodedPath}`
}
function preloadMedia(item) {
  if (!item || item.type === 'video') return
  const preloadImg = document.createElement('img')
  preloadImg.src =
    item.type === 'image'
      ? getMediaUrl(item) + defaultImageSize
      : getMediaUrl(item)
}
// let me just find a way to make this work in other files
// like random.js for previewing those damn images
function showViewer(index) {
  lockScroll()
  if (index < 0 || index >= currentItemList.length) return
  const item = currentItemList[index]
  const popupViewer = document.getElementById('popup-viewer')
  const popupImage = document.getElementById('popup-image')
  const popupVideo = document.getElementById('popup-video')
  const popupAudio = document.getElementById('popup-audio')
  const popupEmbed = document.getElementById('popup-embed')
  const imageTitle = document.getElementById('image-title')
  const imageCounter = document.getElementById('image-counter')
  const prevButton = document.getElementById('prev-image')
  const nextButton = document.getElementById('next-image')
  const closePopup = document.getElementById('close-popup')
  const openNewTab = document.getElementById('open-new-tab')
  const downloadFile = document.getElementById('download-file')
  const copyLink = document.getElementById('copy-link')
  const btnStyle = 'w-5 h-5 m-0 items-center'
  closePopup.innerHTML = `<span class="${btnStyle}">${icons.exit}</span>`
  openNewTab.innerHTML = `<span class="${btnStyle}">${icons.link}</span>`
  downloadFile.innerHTML = `<span class="${btnStyle}">${icons.download}</span>`
  copyLink.innerHTML = `<span class="${btnStyle}">${icons.copy}</span>`
  nextButton.innerHTML = `<span class="${btnStyle}">${icons.next}</span>`
  prevButton.innerHTML = `<span class="${btnStyle}">${icons.prev}</span>`
  popupImage.style.display = 'none'
  popupVideo.style.display = 'none'
  popupAudio.style.display = 'none'
  popupEmbed.style.display = 'none'
  popupVideo.pause()
  popupAudio.pause()
  const url = getMediaUrl(item)
  if (item.type === 'audio') {
    popupAudio.src = url
    popupAudio.style.display = 'block'
    popupAudio.controls = true
    popupAudio.style.width = '85vw'
    popupAudio.style.maxWidth = '600px'
  }
  if (item.type === 'image') {
    popupImage.src = url + defaultImageSize
    popupImage.style.display = 'block'
    popupImage.style.cursor = 'zoom-in'
    popupImage.style.maxHeight = '85vh'
    popupImage.style.maxWidth = '85vw'
  }
  if (item.type === 'video') {
    popupVideo.src = url
    popupVideo.style.display = 'block'
    popupVideo.controls = true
    popupVideo.style.maxHeight = '85vh'
    popupVideo.style.maxWidth = '85vw'
    popupVideo.style.height = 'auto'
    popupVideo.style.width = 'auto'
  }
  if (item.type === 'text') {
    popupEmbed.src = url
    popupEmbed.style.display = 'block'
    popupEmbed.style.maxHeight = '85vh'
    popupEmbed.style.maxWidth = '85vw'
    popupEmbed.style.width = '85vw'
    popupEmbed.style.height = '85vh'
    popupEmbed.style.border = 'none'
  }
  imageTitle.textContent = item.name
  imageCounter.textContent = `${index + 1} / ${currentItemList.length}`
  prevButton.disabled = index === 0
  nextButton.disabled = index === currentItemList.length - 1
  popupViewer.style.display = 'flex'
  popupViewer.classList.remove('hidden')
  currentItemIndex = index
  if (index > 0) {
    preloadMedia(currentItemList[index - 1])
  }
  if (index < currentItemList.length - 1) {
    preloadMedia(currentItemList[index + 1])
  }
}
async function setupViewerEvents() {
  const popupViewer = document.getElementById('popup-viewer')
  const closeButton = document.getElementById('close-popup')
  const newTabButton = document.getElementById('open-new-tab')
  const downloadButton = document.getElementById('download-file')
  const copyLinkButton = document.getElementById('copy-link')
  const prevButton = document.getElementById('prev-image')
  const nextButton = document.getElementById('next-image')
  const popupImage = document.getElementById('popup-image')
  const popupVideo = document.getElementById('popup-video')
  const popupAudio = document.getElementById('popup-audio')
  const popupEmbed = document.getElementById('popup-embed')
  let isZoomed = false
  function closeViewer() {
    if (isZoomed) {
      handleZoom(0, 0)
    }
    isZoomed = false
    if (!popupVideo.paused) {
      popupVideo.pause()
    }
    if (!popupAudio.paused) {
      popupAudio.pause()
    }
    popupImage.src = ''
    popupVideo.src = ''
    popupAudio.src = ''
    popupEmbed.src = ''
    popupViewer.hidden = true
    popupViewer.style.display = 'none'
    unlockScroll()
  }
  function next() {
    if (currentItemIndex < currentItemList.length - 1) {
      if (isZoomed) {
        handleZoom(0, 0)
      }
      showViewer(currentItemIndex + 1)
    }
  }
  function prev() {
    if (currentItemIndex > 0) {
      if (isZoomed) {
        handleZoom(0, 0)
      }
      showViewer(currentItemIndex - 1)
    }
  }
  newTabButton.addEventListener('click', async () => {
    const item = currentItemList[currentItemIndex]
    const fullUrl = await getMediaUrl(item)
    window.open(fullUrl, '_blank')
  })
  downloadButton.addEventListener('click', async () => {
    const item = currentItemList[currentItemIndex]
    const fileUrl = await getMediaUrl(item)
    const a = document.createElement('a')
    a.href = `/api/download/?url="${encodeURIComponent(fileUrl)}"`
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  })
  copyLinkButton.addEventListener('click', async () => {
    const item = currentItemList[currentItemIndex]
    const fileUrl = await getMediaUrl(item)
    navigator.clipboard.writeText(fileUrl)
  })
  closeButton.addEventListener('click', async () => {
    closeViewer()
  })
  popupViewer.addEventListener('click', async (e) => {
    if (e.target === popupViewer) {
      closeViewer()
    }
  })
  nextButton.addEventListener('click', next)
  prevButton.addEventListener('click', prev)
  window.addEventListener('beforeunload', async () => {
    if (!popupViewer.hidden || popupViewer.style.display !== 'none') {
      unlockScroll()
    }
  })
  document.addEventListener('keydown', async (e) => {
    if (!popupViewer.hidden || popupViewer.style.display !== 'none') {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          closeViewer()
          break
        case 'ArrowUp':
          e.preventDefault()
          break
        case 'ArrowLeft':
          e.preventDefault()
          prev()
          break
        case 'ArrowRight':
          e.preventDefault()
          next()
          break
        case 'ArrowDown':
          e.preventDefault()
          break
        case 'Space':
          e.preventDefault()
          break
        default:
          break
      }
    }
  })
  async function handleZoom(x, y) {
    if (isZoomed) {
      const item = currentItemList[currentItemIndex]
      popupImage.src = getMediaUrl(item) + defaultImageSize
      popupImage.classList.remove('zoomed')
      popupImage.style.transform = 'none'
      popupImage.style.cursor = 'zoom-in'
      popupImage.style.maxHeight = ''
      popupImage.style.maxWidth = ''
      popupImage.style.height = ''
      popupImage.style.width = ''
      popupImage.style.objectFit = ''
      isZoomed = false
      popupImage.removeEventListener('mousemove', handleMouseMove)
    } else {
      const item = currentItemList[currentItemIndex]
      const zoomedSrc = (await getMediaUrl(item)) + zoomedImageSize
      popupImage.onload = function () {
        popupImage.style.maxHeight = '95vh'
        popupImage.style.maxWidth = '95vw'
        popupImage.style.height = '95vh'
        popupImage.style.width = '95vw'
        popupImage.style.objectFit = 'contain'
        const rect = popupImage.getBoundingClientRect()
        const relativeX = (x - rect.left) / rect.width
        const relativeY = (y - rect.top) / rect.height
        popupImage.classList.add('zoomed')
        updateZoomPosition(relativeX, relativeY)
        popupImage.style.cursor = 'zoom-out'
        isZoomed = true
        popupImage.addEventListener('mousemove', handleMouseMove)
        popupImage.onload = null
      }
      popupImage.src = zoomedSrc
    }
  }
  function handleMouseMove(e) {
    if (!isZoomed) return
    const rect = popupImage.getBoundingClientRect()
    const relativeX = (e.clientX - rect.left) / rect.width
    const relativeY = (e.clientY - rect.top) / rect.height
    updateZoomPosition(relativeX, relativeY)
  }
  function updateZoomPosition(relativeX, relativeY) {
    const boundedX = Math.max(0, Math.min(1, relativeX))
    const boundedY = Math.max(0, Math.min(1, relativeY))
    popupImage.style.transformOrigin = `${boundedX * 100}% ${boundedY * 100}%`
    popupImage.style.transform = 'scale(2)'
  }
  popupImage.addEventListener('click', async (e) => {
    await handleZoom(e.clientX, e.clientY)
  })
  return {
    closeViewer,
    next,
    prev,
    isZoomed: () => isZoomed,
  }
}
async function setupFileClickHandlers(fileListSelector = '#fileList') {
  const fileList = document.querySelector(fileListSelector)
  if (!fileList) return
  fileList.addEventListener('click', (e) => {
    const media = e.target.closest('.file-item[data-file-type]')
    if (media && media.dataset.fileType) {
      if (media.dataset.fileType === 'directory') return
      e.preventDefault()
      currentItemList = Array.from(
        fileList.querySelectorAll('.file-item[data-file-type]')
      ).map((media) => {
        let preview = media.querySelector('img, video, audio')
        const mediaPath = media.dataset.path
        const fileType = media.dataset.fileType
        const encodedPath = mediaPath
          .split('/')
          .map((part) => encodeURIComponent(part))
          .join('/')
        let previewSrc = null
        if (fileType === 'text' || preview) {
          if (fileType === 'audio') {
            previewSrc =
              preview?.dataset?.src ||
              preview?.src ||
              `/api/files/${encodedPath}`
          } else if (fileType === 'text') {
            previewSrc = `/api/files/${encodedPath}`
          } else {
            previewSrc =
              preview?.dataset?.src?.split('?')[0] ||
              preview?.src ||
              `/api/files/${encodedPath}`
          }
        }
        return {
          name: mediaPath.split('/').pop(),
          path: mediaPath,
          type: fileType,
          encodedPath,
          previewSrc,
        }
      })
      currentItemIndex = currentItemList.findIndex(
        (item) => item.path === media.dataset.path
      )
      showViewer(currentItemIndex)
    }
  })
}
function cancelImageLoads() {
  itemLoadControllers.forEach((controller, element) => {
    controller.abort()
    element.src = ''
    if (element.tagName.toLowerCase() === 'video') {
      element.load()
    }
    element.classList.add('loading')
  })
  itemLoadControllers.clear()
}
function setItemList(itemList) {
  currentItemList = itemList
}
function getCurrentItemList() {
  return currentItemList
}
function getCurrentItemIndex() {
  return currentItemIndex
}
export {
  showViewer,
  setupViewerEvents,
  setupFileClickHandlers,
  cancelImageLoads,
  setItemList,
  getCurrentItemList,
  getCurrentItemIndex,
  preloadMedia,
  getMediaUrl,
  loadViewerIcons,
}
