'use strict'
import * as utils from '../min/index.min.js'
import { IMAGE_SCALE, MAX_IMAGE_SCALE } from '../min/settings.min.js'
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
function showViewer(index) {
  const item = currentItemList[index]
  const fileViewer = document.getElementById('file-viewer')
  const viewerImage = document.getElementById('viewer-container-image')
  const viewerVideo = document.getElementById('viewer-container-video')
  const viewerAudio = document.getElementById('viewer-container-audio')
  const viewerEmbed = document.getElementById('viewer-container-embed')
  const viewerTitle = document.getElementById('viewer-info-title')
  const viewerSize = document.getElementById('viewer-info-size')
  const viewerCounter = document.getElementById('viewer-info-counter')
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
  viewerImage.style.display = 'none'
  viewerVideo.style.display = 'none'
  viewerAudio.style.display = 'none'
  viewerEmbed.style.display = 'none'
  viewerVideo.pause()
  viewerAudio.pause()
  const url = getMediaUrl(item)
  if (item.type === 'audio') {
    viewerAudio.src = url
    viewerAudio.style.display = 'block'
    viewerAudio.controls = true
    viewerAudio.style.width = '85vw'
    viewerAudio.style.maxWidth = '600px'
  }
  if (item.type === 'image') {
    viewerImage.src = url + defaultImageSize
    viewerImage.style.display = 'block'
    viewerImage.style.cursor = 'zoom-in'
    viewerImage.style.maxHeight = '85vh'
    viewerImage.style.maxWidth = '85vw'
  }
  if (item.type === 'video') {
    viewerVideo.src = url
    viewerVideo.style.display = 'block'
    viewerVideo.controls = true
    viewerVideo.style.maxHeight = '85vh'
    viewerVideo.style.maxWidth = '85vw'
    viewerVideo.style.height = 'auto'
    viewerVideo.style.width = 'auto'
  }
  if (item.type === 'text') {
    viewerEmbed.src = url
    viewerEmbed.style.display = 'block'
    viewerEmbed.style.maxHeight = '85vh'
    viewerEmbed.style.maxWidth = '85vw'
    viewerEmbed.style.width = '85vw'
    viewerEmbed.style.height = '85vh'
    viewerEmbed.style.border = 'none'
  }
  viewerTitle.textContent = item.name
  viewerSize.textContent = utils.formatSize(item.size) || ''
  viewerCounter.textContent = `${index + 1} / ${currentItemList.length}`
  prevButton.disabled = index === 0
  nextButton.disabled = index === currentItemList.length - 1
  if (prevButton.disabled) {
    prevButton.classList.add(
      'opacity-50',
      'cursor-not-allowed',
      'pointer-events-none'
    )
  } else {
    prevButton.classList.remove(
      'opacity-50',
      'cursor-not-allowed',
      'pointer-events-none'
    )
  }
  if (nextButton.disabled) {
    nextButton.classList.add(
      'opacity-50',
      'cursor-not-allowed',
      'pointer-events-none'
    )
  } else {
    nextButton.classList.remove(
      'opacity-50',
      'cursor-not-allowed',
      'pointer-events-none'
    )
  }
  fileViewer.style.display = 'flex'
  fileViewer.classList.remove('hidden')
  currentItemIndex = index
  if (index > 0) {
    preloadMedia(currentItemList[index - 1])
  }
  if (index < currentItemList.length - 1) {
    preloadMedia(currentItemList[index + 1])
  }
}
async function setupViewerEvents() {
  const fileViewer = document.getElementById('file-viewer')
  const closeButton = document.getElementById('close-popup')
  const newTabButton = document.getElementById('open-new-tab')
  const downloadButton = document.getElementById('download-file')
  const copyLinkButton = document.getElementById('copy-link')
  const prevButton = document.getElementById('prev-image')
  const nextButton = document.getElementById('next-image')
  const viewerImage = document.getElementById('viewer-container-image')
  const viewerVideo = document.getElementById('viewer-container-video')
  const viewerAudio = document.getElementById('viewer-container-audio')
  const viewerEmbed = document.getElementById('viewer-container-embed')
  let isZoomed = false
  function closeViewer() {
    try {
      if (isZoomed) {
        handleZoom(0, 0)
      }
      isZoomed = false
      if (!viewerVideo.paused) {
        viewerVideo.pause()
      }
      if (!viewerAudio.paused) {
        viewerAudio.pause()
      }
      viewerImage.src = ''
      viewerVideo.src = ''
      viewerAudio.src = ''
      viewerEmbed.src = ''
      fileViewer.hidden = true
      fileViewer.style.display = 'none'
    } catch (error) {
      utils.handleError(error)
      return
    }
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
    if (!item.uuid) {
      utils.handleError('File UUID not available')
      return
    }
    const a = document.createElement('a')
    a.href = `/api/download/?uuid=${item.uuid}`
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
  fileViewer.addEventListener('click', async (e) => {
    if (e.target === fileViewer) {
      closeViewer()
    }
  })
  nextButton.addEventListener('click', next)
  prevButton.addEventListener('click', prev)
  if (typeof window.MutationObserver !== 'undefined') {
    const observer = new window.MutationObserver(() => {})
    observer.observe(fileViewer, {
      attributes: true,
      attributeFilter: ['hidden'],
    })
  }
  document.addEventListener('keydown', async (e) => {
    if (!fileViewer.hidden || fileViewer.style.display !== 'none') {
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
      viewerImage.src = getMediaUrl(item) + defaultImageSize
      viewerImage.classList.remove('zoomed')
      viewerImage.style.transform = 'none'
      viewerImage.style.cursor = 'zoom-in'
      viewerImage.style.maxHeight = ''
      viewerImage.style.maxWidth = ''
      viewerImage.style.height = ''
      viewerImage.style.width = ''
      viewerImage.style.objectFit = ''
      isZoomed = false
      viewerImage.removeEventListener('mousemove', handleMouseMove)
    } else {
      const item = currentItemList[currentItemIndex]
      const zoomedSrc = (await getMediaUrl(item)) + zoomedImageSize
      viewerImage.onload = function () {
        viewerImage.style.maxHeight = '95vh'
        viewerImage.style.maxWidth = '95vw'
        viewerImage.style.height = '95vh'
        viewerImage.style.width = '95vw'
        viewerImage.style.objectFit = 'contain'
        const rect = viewerImage.getBoundingClientRect()
        const relativeX = (x - rect.left) / rect.width
        const relativeY = (y - rect.top) / rect.height
        viewerImage.classList.add('zoomed')
        updateZoomPosition(relativeX, relativeY)
        viewerImage.style.cursor = 'zoom-out'
        isZoomed = true
        viewerImage.addEventListener('mousemove', handleMouseMove)
        viewerImage.onload = null
      }
      viewerImage.src = zoomedSrc
    }
  }
  function handleMouseMove(e) {
    if (!isZoomed) return
    const rect = viewerImage.getBoundingClientRect()
    const relativeX = (e.clientX - rect.left) / rect.width
    const relativeY = (e.clientY - rect.top) / rect.height
    updateZoomPosition(relativeX, relativeY)
  }
  function updateZoomPosition(relativeX, relativeY) {
    const boundedX = Math.max(0, Math.min(1, relativeX))
    const boundedY = Math.max(0, Math.min(1, relativeY))
    viewerImage.style.transformOrigin = `${boundedX * 100}% ${boundedY * 100}%`
    viewerImage.style.transform = 'scale(2)'
  }
  viewerImage.addEventListener('click', async (e) => {
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
        const uuid = media.dataset.uuid
        const size = parseInt(media.dataset.size) || 0
        const encodedPath = mediaPath
          .split('/')
          .filter(Boolean)
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
          uuid,
          size,
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
