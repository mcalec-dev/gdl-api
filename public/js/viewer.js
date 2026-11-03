import * as utils from './index.js'
import { lockScroll, unlockScroll } from './helpers/scroll.js'
import {
  IMAGE_KERNEL,
  IMAGE_SCALE,
  MAX_IMAGE_SCALE,
  TRANSCODE_AUDIO_CODEC,
  TRANSCODE_AUDIO_ENABLED,
  TRANSCODE_VIDEO_CODEC,
  TRANSCODE_VIDEO_ENABLED,
} from './settings.js'

/** @typedef {'image' | 'video' | 'audio' | 'text' | 'other'} ViewerMediaType */
/** @typedef {{name: string, path: string, type: ViewerMediaType, uuid?: string, size?: number, modified?: string | number | null, encodedPath: string, previewSrc?: string | null}} ViewerItem */
/** @typedef {{showViewer: (index: number) => void, closeViewer: () => void, next: () => void, prev: () => void, setItemList: (items: ViewerItem[]) => void, getCurrentItemList: () => ViewerItem[], getCurrentItemIndex: () => number, setupFileClickHandlers: (selector?: string) => Promise<void>, preloadMedia: (item: ViewerItem) => void, getMediaUrl: (item: ViewerItem) => string}} ViewerApi */
/** @typedef {{overlay: HTMLElement, image: HTMLImageElement, video: HTMLVideoElement, audio: HTMLAudioElement, embed: HTMLIFrameElement, title: HTMLElement, modified: HTMLElement, size: HTMLElement, counter: HTMLElement, close: HTMLButtonElement, next: HTMLButtonElement, prev: HTMLButtonElement, open: HTMLButtonElement, download: HTMLButtonElement, copy: HTMLButtonElement}} ViewerElements */

/** @type {ViewerItem[]} */
let currentItemList = []
let currentItemIndex = 0
let isViewerOpen = false
let eventsBound = false
let isZoomed = false

/**
 * Returns all required viewer markup, or null on a page without the viewer partial.
 *
 * @returns {ViewerElements | null} Viewer DOM references.
 */
function getViewerElements() {
  const overlay = document.getElementById('file-viewer')
  const image = document.getElementById('viewer-container-image')
  const video = document.getElementById('viewer-container-video')
  const audio = document.getElementById('viewer-container-audio')
  const embed = document.getElementById('viewer-container-embed')
  const title = document.getElementById('viewer-info-title')
  const modified = document.getElementById('viewer-info-modified')
  const size = document.getElementById('viewer-info-size')
  const counter = document.getElementById('viewer-info-counter')
  const close = document.getElementById('close-popup')
  const next = document.getElementById('next-image')
  const prev = document.getElementById('prev-image')
  const open = document.getElementById('open-new-tab')
  const download = document.getElementById('download-file')
  const copy = document.getElementById('copy-link')
  if (
    !(overlay instanceof HTMLElement) ||
    !(image instanceof HTMLImageElement) ||
    !(video instanceof HTMLVideoElement) ||
    !(audio instanceof HTMLAudioElement) ||
    !(embed instanceof HTMLIFrameElement) ||
    !(title instanceof HTMLElement) ||
    !(modified instanceof HTMLElement) ||
    !(size instanceof HTMLElement) ||
    !(counter instanceof HTMLElement) ||
    !(close instanceof HTMLButtonElement) ||
    !(next instanceof HTMLButtonElement) ||
    !(prev instanceof HTMLButtonElement) ||
    !(open instanceof HTMLButtonElement) ||
    !(download instanceof HTMLButtonElement) ||
    !(copy instanceof HTMLButtonElement)
  ) {
    return null
  }
  return {
    overlay,
    image,
    video,
    audio,
    embed,
    title,
    modified,
    size,
    counter,
    close,
    next,
    prev,
    open,
    download,
    copy,
  }
}

/**
 * Resolves the direct media URL for a viewer item.
 *
 * @param {ViewerItem} item Viewer item.
 * @returns {string} Absolute media URL.
 */
function getMediaUrl(item) {
  const preview = utils.toDisplayText(item.previewSrc)
  if (preview) {
    try {
      const url = new URL(preview, window.location.origin)
      return url.toString()
    } catch {
      return `${window.location.origin}${utils.getAppUrl(preview.startsWith('/') ? preview : `/${preview}`)}`
    }
  }
  return `${window.location.origin}${utils.getAppUrl(`/api/files/${item.encodedPath}`)}`
}

/**
 * Stops and clears all viewer media elements.
 *
 * @param {ViewerElements} elements Viewer DOM references.
 * @returns {void}
 */
function clearMedia(elements) {
  elements.image.removeAttribute('src')
  elements.image.hidden = true
  for (const media of [elements.video, elements.audio]) {
    media.pause()
    media.removeAttribute('src')
    media.load()
    media.hidden = true
  }
  elements.embed.removeAttribute('src')
  elements.embed.hidden = true
  isZoomed = false
  elements.image.classList.remove('zoomed')
  elements.image.style.transform = ''
}

/**
 * Applies configured transcode preferences to an audio or video source.
 *
 * @param {ViewerItem} item Viewer item.
 * @param {string} url Direct media URL.
 * @returns {string} Playback URL.
 */
function getPlaybackUrl(item, url) {
  if (
    item.type === 'video' &&
    TRANSCODE_VIDEO_ENABLED &&
    TRANSCODE_VIDEO_CODEC
  ) {
    const convert =
      TRANSCODE_AUDIO_ENABLED && TRANSCODE_AUDIO_CODEC
        ? `${TRANSCODE_VIDEO_CODEC},${TRANSCODE_AUDIO_CODEC}`
        : TRANSCODE_VIDEO_CODEC
    return utils.constructURL(url, { convert }) || url
  }
  if (
    item.type === 'audio' &&
    TRANSCODE_AUDIO_ENABLED &&
    TRANSCODE_AUDIO_CODEC
  ) {
    return utils.constructURL(url, { convert: TRANSCODE_AUDIO_CODEC }) || url
  }
  return url
}

/**
 * Updates navigation button state.
 *
 * @param {ViewerElements} elements Viewer DOM references.
 * @returns {void}
 */
function updateNavigation(elements) {
  elements.prev.disabled = currentItemIndex <= 0
  elements.next.disabled = currentItemIndex >= currentItemList.length - 1
}

/**
 * Shows one item from the current list in the viewer.
 *
 * @param {number} index Item index.
 * @returns {void}
 */
function showViewer(index) {
  const elements = getViewerElements()
  const item = currentItemList[index]
  if (!elements || !item) return
  if (!isViewerOpen) {
    lockScroll()
    isViewerOpen = true
  }
  clearMedia(elements)
  const source = getMediaUrl(item)
  const playback = getPlaybackUrl(item, source)
  if (item.type === 'image') {
    elements.image.src =
      utils.constructURL(source, {
        scale: IMAGE_SCALE,
        kernel: IMAGE_KERNEL,
      }) || source
    elements.image.hidden = false
  } else if (item.type === 'video') {
    elements.video.src = playback
    elements.video.hidden = false
  } else if (item.type === 'audio') {
    elements.audio.src = playback
    elements.audio.hidden = false
  } else {
    elements.embed.src = playback
    elements.embed.hidden = false
  }
  currentItemIndex = index
  elements.title.textContent = item.name
  elements.modified.textContent = item.modified
    ? `Modified: ${utils.formatDate(item.modified)}`
    : ''
  elements.size.textContent = utils.formatSize(item.size) || ''
  elements.counter.textContent = `${index + 1} / ${currentItemList.length}`
  elements.overlay.hidden = false
  elements.overlay.style.display = 'flex'
  updateNavigation(elements)
  if (currentItemList[index - 1]) preloadMedia(currentItemList[index - 1])
  if (currentItemList[index + 1]) preloadMedia(currentItemList[index + 1])
}

/**
 * Closes the viewer and restores page scrolling.
 *
 * @returns {void}
 */
function closeViewer() {
  const elements = getViewerElements()
  if (elements) {
    clearMedia(elements)
    elements.overlay.hidden = true
    elements.overlay.style.display = 'none'
  }
  if (isViewerOpen) unlockScroll()
  isViewerOpen = false
}

/**
 * Moves to the next item when one exists.
 *
 * @returns {void}
 */
function next() {
  if (currentItemIndex < currentItemList.length - 1)
    showViewer(currentItemIndex + 1)
}

/**
 * Moves to the previous item when one exists.
 *
 * @returns {void}
 */
function prev() {
  if (currentItemIndex > 0) showViewer(currentItemIndex - 1)
}

/**
 * Preloads an image source without opening the viewer.
 *
 * @param {ViewerItem} item Viewer item.
 * @returns {void}
 */
function preloadMedia(item) {
  if (item.type !== 'image') return
  const image = new Image()
  const url = getMediaUrl(item)
  image.src =
    utils.constructURL(url, { scale: IMAGE_SCALE, kernel: IMAGE_KERNEL }) || url
}

/**
 * Toggles image zoom in the active viewer.
 *
 * @returns {void}
 */
function toggleZoom() {
  const elements = getViewerElements()
  const item = currentItemList[currentItemIndex]
  if (!elements || !item || item.type !== 'image') return
  const url = getMediaUrl(item)
  isZoomed = !isZoomed
  if (isZoomed) {
    elements.image.src =
      utils.constructURL(url, {
        scale: MAX_IMAGE_SCALE,
        kernel: IMAGE_KERNEL,
      }) || url
    elements.image.classList.add('zoomed')
    elements.image.style.transform = 'scale(2)'
  } else {
    elements.image.src =
      utils.constructURL(url, { scale: IMAGE_SCALE, kernel: IMAGE_KERNEL }) ||
      url
    elements.image.classList.remove('zoomed')
    elements.image.style.transform = ''
  }
}

/**
 * Binds viewer controls once for the current document.
 *
 * @returns {Promise<{closeViewer: () => void, next: () => void, prev: () => void, isZoomed: () => boolean}>} Viewer control API.
 */
async function setupViewerEvents() {
  const elements = getViewerElements()
  if (!elements || eventsBound)
    return { closeViewer, next, prev, isZoomed: () => isZoomed }
  eventsBound = true
  elements.close.addEventListener('click', closeViewer)
  elements.next.addEventListener('click', next)
  elements.prev.addEventListener('click', prev)
  elements.open.addEventListener('click', () => {
    const item = currentItemList[currentItemIndex]
    if (item) window.open(getMediaUrl(item), '_blank', 'noopener')
  })
  elements.download.addEventListener('click', () => {
    const item = currentItemList[currentItemIndex]
    if (!item?.uuid) return
    const link = document.createElement('a')
    link.href = utils.getAppUrl(
      `/api/download/?uuid=${encodeURIComponent(item.uuid)}`
    )
    link.download = ''
    link.click()
  })
  elements.copy.addEventListener('click', () => {
    const item = currentItemList[currentItemIndex]
    if (!item) return
    void utils.copyText(getMediaUrl(item)).then((copied) => {
      if (!copied) utils.statusMessage('Unable to copy file link', true)
    })
  })
  elements.image.addEventListener('click', toggleZoom)
  elements.overlay.addEventListener('click', (event) => {
    if (event.target === elements.overlay) closeViewer()
  })
  document.addEventListener('keydown', (event) => {
    if (!isViewerOpen) return
    if (event.key === 'Escape') closeViewer()
    if (event.key === 'ArrowLeft') prev()
    if (event.key === 'ArrowRight') next()
  })
  window.addEventListener('beforeunload', closeViewer)
  return { closeViewer, next, prev, isZoomed: () => isZoomed }
}

/**
 * Builds a viewer item from a clickable file-list element.
 *
 * @param {HTMLElement} media File-list item.
 * @returns {ViewerItem | null} Viewer item or null for invalid markup.
 */
function toViewerItem(media) {
  const path = utils.toDisplayText(media.dataset.path)
  const type = media.dataset.fileType
  if (
    !path ||
    !['image', 'video', 'audio', 'text', 'other'].includes(String(type))
  )
    return null
  const preview = media.querySelector('img, video, audio')
  const encodedPath = path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
  return {
    name: path.split('/').pop() || path,
    path,
    type: /** @type {ViewerMediaType} */ (type),
    uuid: utils.normalizeIdentifier(media.dataset.uuid) || undefined,
    size: Number(media.dataset.size) || 0,
    modified: utils.toDisplayText(media.dataset.modified) || null,
    encodedPath,
    previewSrc:
      preview instanceof HTMLMediaElement || preview instanceof HTMLImageElement
        ? preview.dataset.src || preview.src
        : null,
  }
}

/**
 * Binds file-list clicks to the viewer without duplicate listeners.
 *
 * @param {string} [fileListSelector='#fileList'] File-list selector.
 * @returns {Promise<void>} Resolves after binding.
 */
async function setupFileClickHandlers(fileListSelector = '#fileList') {
  const fileList = document.querySelector(fileListSelector)
  if (
    !(fileList instanceof HTMLElement) ||
    fileList.dataset.viewerBound === 'true'
  )
    return
  fileList.dataset.viewerBound = 'true'
  fileList.addEventListener('click', (event) => {
    const target = event.target
    const media =
      target instanceof HTMLElement
        ? target.closest('.file-item[data-file-type]')
        : null
    if (
      !(media instanceof HTMLElement) ||
      media.dataset.fileType === 'directory'
    )
      return
    const items = Array.from(
      fileList.querySelectorAll('.file-item[data-file-type]')
    )
      .filter((element) => element instanceof HTMLElement)
      .map(toViewerItem)
      .filter((item) => item !== null)
    const selectedPath = media.dataset.path
    const index = items.findIndex((item) => item.path === selectedPath)
    if (index < 0) return
    event.preventDefault()
    setItemList(items)
    showViewer(index)
  })
}

/**
 * Stops media in the viewer. Kept as a compatibility export for existing callers.
 *
 * @returns {void}
 */
function cancelImageLoads() {
  const elements = getViewerElements()
  if (elements) clearMedia(elements)
}

/**
 * Replaces the viewer item list.
 *
 * @param {ViewerItem[]} itemList New item list.
 * @returns {void}
 */
function setItemList(itemList) {
  currentItemList = itemList
  currentItemIndex = 0
}

/** @returns {ViewerItem[]} Current viewer item list. */
function getCurrentItemList() {
  return currentItemList
}

/** @returns {number} Current viewer item index. */
function getCurrentItemIndex() {
  return currentItemIndex
}

/**
 * Initializes viewer controls and optional file-list handling.
 *
 * @param {{fileListSelector?: string}} [options] Viewer initialization options.
 * @returns {Promise<ViewerApi>} Viewer API.
 */
async function initViewer(options = {}) {
  await setupViewerEvents()
  await setupFileClickHandlers(options.fileListSelector)
  return {
    showViewer,
    closeViewer,
    next,
    prev,
    setItemList,
    getCurrentItemList,
    getCurrentItemIndex,
    setupFileClickHandlers,
    preloadMedia,
    getMediaUrl,
  }
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
  initViewer,
}
