'use strict'
import * as utils from '../min/index.min.js'
import {
  IMAGE_SCALE,
  MAX_IMAGE_SCALE,
  IMAGE_KERNEL,
} from '../min/settings.min.js'
import scroll from 'https://utils.mcalec.dev/scroll.js/scroll.min.js'
/** @type {number} Current index in the item list being viewed */
let currentItemIndex = 0
/** @type {Array<Object>} List of media items available for viewing */
let currentItemList = []

/** @type {Map<Element, AbortController>} Map of elements to their corresponding abort controllers for load cancellation */
let itemLoadControllers = new Map()
/** @type {Object} Set of loaded icon SVG strings for viewer UI */
let icons

/** @type {boolean} Tracks whether the viewer modal is currently open */
let isViewerOpen = false
/**
 * Loads viewer-specific icons from the utility icons collection.
 * Sets the icons object with exit, navigation, and action icons.
 * @async
 * @returns {Promise<void>}
 */
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
/**
 * Constructs the full media URL for a given item.
 * Handles both absolute HTTP URLs and relative API paths.
 * @param {Object} item - The media item object
 * @param {string} item.previewSrc - Optional preview source URL
 * @param {string} item.encodedPath - Encoded file path for fallback URL construction
 * @returns {string} The full media URL
 */
function getMediaUrl(item) {
  if (item.previewSrc) {
    return item.previewSrc.startsWith('http')
      ? item.previewSrc
      : `${document.location.origin}${item.previewSrc.startsWith('/') ? '' : '/'}${item.previewSrc}`
  }
  return `${document.location.origin}/api/files/${item.encodedPath}`
}
/**
 * Preloads media content to improve perceived loading performance.
 * Skips preloading for video files.
 * @param {Object} item - The media item to preload
 * @param {string} item.type - Media type (image, video, audio, text)
 * @returns {void}
 */
function preloadMedia(item) {
  if (!item || item.type === 'video') return
  const preloadImg = document.createElement('img')
  preloadImg.src =
    item.type === 'image'
      ? utils.upscaleImage(getMediaUrl(item), IMAGE_SCALE, IMAGE_KERNEL)
      : getMediaUrl(item)
}
/**
 * Displays a media item in the viewer modal at the specified index.
 * Handles all media types (image, video, audio, text) and manages UI state.
 * Preloads adjacent items for smooth navigation.
 * @param {number} index - The index of the item to display from currentItemList
 * @returns {void}
 */
function showViewer(index) {
  if (!isViewerOpen) {
    scroll.lock()
    isViewerOpen = true
  }
  const item = currentItemList[index]
  const fileViewer = document.getElementById('file-viewer')
  const viewerImage = document.getElementById('viewer-container-image')
  const viewerVideo = document.getElementById('viewer-container-video')
  const viewerAudio = document.getElementById('viewer-container-audio')
  const viewerEmbed = document.getElementById('viewer-container-embed')
  const viewerTitle = document.getElementById('viewer-info-title')
  const viewerModified = document.getElementById('viewer-info-modified')
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
    viewerImage.src = utils.upscaleImage(url, IMAGE_SCALE, IMAGE_KERNEL) || url
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
  viewerModified.textContent = item.modified
    ? `Modified: ${utils.formatDate(item.modified)}`
    : ''
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
/**
 * Initializes event listeners for the viewer modal.
 * Sets up handlers for navigation, closing, media actions, keyboard controls, and image zoom.
 * Returns control functions if markup is present; returns stub handlers otherwise.
 * @async
 * @returns {Promise<Object>} Event handler object with closeViewer, next, prev, and isZoomed methods
 */
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
  if (
    !fileViewer ||
    !viewerImage ||
    !viewerVideo ||
    !viewerAudio ||
    !viewerEmbed
  ) {
    console.warn(
      'Viewer markup not found in DOM. Ensure viewer.ejs partial is included in the template.'
    )
    return {
      closeViewer: () => {},
      next: () => {},
      prev: () => {},
      isZoomed: () => false,
    }
  }
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
    } finally {
      if (isViewerOpen) {
        scroll.unlock()
        isViewerOpen = false
      }
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
  newTabButton.addEventListener('click', () => {
    const item = currentItemList[currentItemIndex]
    const fullUrl = getMediaUrl(item)
    window.open(fullUrl, '_blank')
  })
  downloadButton.addEventListener('click', () => {
    const item = currentItemList[currentItemIndex]
    if (!item.uuid) {
      utils.handleError('File UUID not available')
      return
    }
    const a = document.createElement('a')
    a.href = `${document.location.origin}/api/download/?uuid=${item.uuid}`
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  })
  copyLinkButton.addEventListener('click', () => {
    const item = currentItemList[currentItemIndex]
    const fileUrl = getMediaUrl(item)
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
      viewerImage.src =
        utils.upscaleImage(
          await getMediaUrl(item),
          IMAGE_SCALE,
          IMAGE_KERNEL
        ) || getMediaUrl(item)
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
      const zoomedSrc =
        utils.upscaleImage(
          await getMediaUrl(item),
          MAX_IMAGE_SCALE,
          IMAGE_KERNEL
        ) || getMediaUrl(item)
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
  window.addEventListener('beforeunload', () => {
    if (isViewerOpen) {
      scroll.unlock()
      isViewerOpen = false
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (
      document.hidden &&
      fileViewer.style.display === 'flex' &&
      isViewerOpen
    ) {
      scroll.unlock()
      isViewerOpen = false
    }
  })
  return {
    closeViewer,
    next,
    prev,
    isZoomed: () => isZoomed,
  }
}
/**
 * Attaches click handlers to file list items to open them in the viewer.
 * Builds the current item list from all file items matching the selector.
 * @async
 * @param {string} [fileListSelector='#fileList'] - CSS selector for the file list container
 * @returns {Promise<void>}
 */
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
        const modified = media.dataset.modified || null
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
              `${document.location.origin}/api/files/${encodedPath}`
          } else if (fileType === 'text') {
            previewSrc = `${document.location.origin}/api/files/${encodedPath}`
          } else {
            previewSrc =
              preview?.dataset?.src?.split('?')[0] ||
              preview?.src ||
              `${document.location.origin}/api/files/${encodedPath}`
          }
        }
        return {
          name: mediaPath.split('/').pop(),
          path: mediaPath,
          type: fileType,
          uuid,
          size,
          modified,
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
/**
 * Initializes the viewer module and returns the public API.
 * Loads icons, sets up event handlers, and attaches file click handlers.
 * @async
 * @param {Object} [options={}] - Initialization options
 * @param {string} [options.fileListSelector] - CSS selector for the file list container
 * @returns {Promise<Object>} Public API object with viewer control methods
 * @returns {Function} returns.showViewer - Display media at specified index
 * @returns {Function} returns.closeViewer - Close the viewer modal
 * @returns {Function} returns.next - Navigate to next item in list
 * @returns {Function} returns.prev - Navigate to previous item in list
 * @returns {Function} returns.isZoomed - Check if image zoom is active
 * @returns {Function} returns.setItemList - Set the media items list
 * @returns {Function} returns.getCurrentItemList - Get current media items list
 * @returns {Function} returns.getCurrentItemIndex - Get index of currently viewed item
 * @returns {Function} returns.preloadMedia - Preload media content for smooth viewing
 * @returns {Function} returns.getMediaUrl - Get full URL for a media item
 * @returns {Function} returns.loadViewerIcons - Reload viewer UI icons
 */
async function initViewer({ fileListSelector } = {}) {
  await loadViewerIcons()
  const events = await setupViewerEvents()
  await setupFileClickHandlers(fileListSelector)
  return {
    showViewer,
    closeViewer: events?.closeViewer,
    next: events?.next,
    prev: events?.prev,
    isZoomed: events?.isZoomed,
    setupFileClickHandlers,
    setItemList,
    getCurrentItemList,
    getCurrentItemIndex,
    preloadMedia,
    getMediaUrl,
    loadViewerIcons,
  }
}
/**
 * Cancels all pending media load operations.
 * Aborts fetch requests and clears load controller tracking.
 * @returns {void}
 */
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
/**
 * Sets the current item list for the viewer.
 * @param {Array<Object>} itemList - Array of media item objects
 * @param {string} itemList[].name - File name
 * @param {string} itemList[].path - File path
 * @param {string} itemList[].type - Media type (image, video, audio, text)
 * @param {string} [itemList[].uuid] - Unique identifier for download
 * @param {number} [itemList[].size] - File size in bytes
 * @param {string} [itemList[].modified] - Last modified timestamp
 * @param {string} itemList[].encodedPath - URL-encoded file path
 * @param {string} [itemList[].previewSrc] - Preview source URL
 * @returns {void}
 */
function setItemList(itemList) {
  currentItemList = itemList
}
/**
 * Gets the current item list.
 * @returns {Array<Object>} The current list of media items
 */
function getCurrentItemList() {
  return currentItemList
}
/**
 * Gets the current item index being viewed.
 * @returns {number} The index of the currently viewed item
 */
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
  initViewer,
}
