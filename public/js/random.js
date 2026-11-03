import * as utils from './index.js'
import { initViewer } from './viewer.js'
import {
  setupContextMenu,
  createContextMenu,
  setContextIcons,
} from './contextmenu.js'
import { IMAGE_SCALE, IMAGE_KERNEL } from './settings.js'
import { getMediaKind } from './helpers/media.js'
import { readLocalJson, writeLocalJson } from './helpers/storage.js'

const API_URL = '/api/random'
const HISTORY_KEY = 'randomMediaHistory'
const HISTORY_LIMIT = 10
const mediaContainer = document.getElementById('media-container')
const loading = document.getElementById('loading')
const imageInfo = document.getElementById('item-info')

/** @typedef {Record<string, unknown>} RandomMedia */
/** @typedef {{back: string, shuffle: string, forward: string, image: string, video: string, audio: string, text: string, other: string, nav: {exit: string, next: string, prev: string, link: string, copy: string, download: string}}} RandomIcons */

/** @type {RandomIcons} */
let icons = {
  back: '',
  shuffle: '',
  forward: '',
  image: '',
  video: '',
  audio: '',
  text: '',
  other: '',
  nav: { exit: '', next: '', prev: '', link: '', copy: '', download: '' },
}
/**
 * Reads a string icon from a nested icon catalog section.
 *
 * @param {Record<string, unknown>} catalog Icon catalog.
 * @param {string} section Catalog section name.
 * @param {string} name Icon name.
 * @returns {string} Icon markup or an empty string.
 */
function getIcon(catalog, section, name) {
  const group = catalog[section]
  if (!group || typeof group !== 'object' || Array.isArray(group)) return ''
  const value = /** @type {Record<string, unknown>} */ (group)[name]
  return typeof value === 'string' ? value : ''
}

/**
 * Loads the small icon subset used by the random-media page.
 *
 * @returns {Promise<void>} Resolves when the icon catalog request completes.
 */
async function loadIcons() {
  try {
    const icon = await utils.getIcons()
    icons = {
      back: getIcon(icon, 'arrow', 'left'),
      shuffle: getIcon(icon, 'arrow', 'shuffle'),
      forward: getIcon(icon, 'arrow', 'right'),
      image: getIcon(icon, 'file', 'image'),
      video: getIcon(icon, 'file', 'video'),
      audio: getIcon(icon, 'file', 'audio'),
      text: getIcon(icon, 'file', 'text'),
      other: getIcon(icon, 'file', 'default'),
      nav: {
        exit: getIcon(icon, 'nav', 'exit'),
        next: getIcon(icon, 'nav', 'next'),
        prev: getIcon(icon, 'nav', 'prev'),
        link: getIcon(icon, 'nav', 'link'),
        copy: getIcon(icon, 'nav', 'copy'),
        download: getIcon(icon, 'nav', 'download'),
      },
    }
  } catch (error) {
    console.error('Error loading icons:', error)
    icons = {
      back: '',
      shuffle: '',
      forward: '',
      image: '',
      video: '',
      audio: '',
      text: '',
      other: '',
      nav: { exit: '', next: '', prev: '', link: '', copy: '', download: '' },
    }
  }
}

/** @type {RandomMedia[]} */
let history = []
let historyIndex = 0
/** @type {RandomMedia | null} */
let currentMediaData = null
/** @type {{setItemList: (items: Array<{name: string, path: string, type: 'image' | 'video' | 'audio' | 'text' | 'other', uuid?: string, size?: number, modified?: string | number | null, encodedPath: string, previewSrc?: string | null}>) => void, showViewer: (index: number) => void} | null} */
let viewerApi = null

/**
 * Removes the current random-page preview, including audio elements that the
 * old image/video-only cleanup left playing in the background.
 *
 * @returns {void}
 */
function clearMedia() {
  mediaContainer?.querySelectorAll('img, video, audio').forEach((element) => {
    if (element instanceof HTMLMediaElement) element.pause()
    element.remove()
  })
}

/**
 * Displays an empty-state message with the media metadata hidden.
 *
 * @param {string} message Message shown in the random-page loading area.
 * @returns {void}
 */
function showEmptyState(message) {
  mediaContainer?.classList.remove('has-image')
  clearMedia()
  if (loading) {
    loading.textContent = message
    loading.hidden = false
  }
  if (imageInfo) imageInfo.hidden = true
}

/**
 * Renders a random file preview using its actual media type.
 *
 * @param {Record<string, unknown> | null | undefined} data Random API payload.
 * @returns {void}
 */
function showMedia(data) {
  const rawUrl = utils.toDisplayText(data?.url)
  if (!data || !rawUrl || !mediaContainer || !loading || !imageInfo) {
    showEmptyState('Unable to load media')
    currentMediaData = null
    return
  }
  if (history.length === 0) {
    showEmptyState('Click the button to load media')
    currentMediaData = null
    return
  }

  const fileName = utils.toDisplayText(data.file, 'media')
  const mediaKind = getMediaKind(fileName)
  if (!['image', 'video', 'audio'].includes(mediaKind)) {
    showEmptyState('This file type cannot be previewed here')
    currentMediaData = data
    return
  }

  currentMediaData = data
  mediaContainer.classList.remove('has-image')
  loading.textContent = 'Loading...'
  loading.hidden = false
  loading.classList.remove('error')
  clearMedia()
  const mediaUrl =
    mediaKind === 'image'
      ? utils.constructURL(rawUrl, {
          scale: IMAGE_SCALE,
          kernel: IMAGE_KERNEL,
        }) || rawUrl
      : rawUrl
  const mediaElement =
    /** @type {HTMLImageElement | HTMLVideoElement | HTMLAudioElement} */ (
      document.createElement(
        mediaKind === 'video'
          ? 'video'
          : mediaKind === 'audio'
            ? 'audio'
            : 'img'
      )
    )
  mediaElement.className =
    'object-contain w-auto h-auto max-w-full max-h-[50vh] overflow-hidden border-none rounded-lg inline-block cursor-pointer'
  mediaElement.hidden = false
  mediaElement.id = 'random-media-element'
  if (mediaKind === 'video') {
    const videoElement = /** @type {HTMLVideoElement} */ (mediaElement)
    videoElement.controls = true
    videoElement.muted = false
    videoElement.loop = false
    videoElement.autoplay = false
    videoElement.playsInline = true
  }
  if (mediaKind === 'audio') {
    const audioElement = /** @type {HTMLAudioElement} */ (mediaElement)
    audioElement.controls = true
    audioElement.preload = 'metadata'
  }
  imageInfo.innerHTML = `
    <span id="image-author" class="font-medium text-gray-300">${utils.escapeHtml(utils.toDisplayText(data.author, 'Unknown author'))}</span>
    <span class="text-gray-500 text-light"> on </span>
    <span id="image-collection" class="font-medium text-gray-300">${utils.escapeHtml(utils.toDisplayText(data.collection, 'Unknown collection'))}</span><br>
    <span id="image-size" class="text-gray-500 text-light">${utils.escapeHtml(utils.formatSize(data.size) || 'Size unavailable')}</span>
  `
  /**
   * Reveals a successfully loaded random-media preview.
   *
   * @returns {void}
   */
  const loadHandler = () => {
    loading.hidden = true
    mediaElement.hidden = false
    imageInfo.hidden = false
    mediaContainer.classList.add('has-image')
  }
  mediaElement.addEventListener(
    mediaKind === 'image' ? 'load' : 'loadeddata',
    loadHandler
  )
  mediaElement.addEventListener('error', handleMediaError)
  mediaElement.src = mediaUrl
  mediaElement.onclick = async () => {
    try {
      if (viewerApi) {
        const previewSrc = mediaUrl
        const item = {
          name: fileName.split('/').pop() || fileName,
          path: fileName,
          type: mediaKind,
          uuid: utils.normalizeIdentifier(data.uuid) || undefined,
          size:
            typeof data.size === 'number' && Number.isFinite(data.size)
              ? data.size
              : 0,
          modified:
            typeof data.modified === 'string' ||
            typeof data.modified === 'number'
              ? data.modified
              : null,
          encodedPath: encodeURIComponent(fileName).replace(/%2F/g, '/'),
          previewSrc,
        }
        viewerApi.setItemList([item])
        viewerApi.showViewer(0)
      } else {
        window.open(mediaUrl, '_blank')
      }
    } catch (error) {
      console.error('Error opening viewer:', error)
      utils.handleError(error)
      window.open(mediaUrl, '_blank')
    }
  }
  mediaContainer.appendChild(mediaElement)
}

/**
 * Requests, records, and displays the next random media item.
 *
 * @returns {Promise<void>} Resolves after the request has settled.
 */
async function loadRandomMedia() {
  try {
    mediaContainer?.classList.remove('has-image')
    if (loading) {
      loading.textContent = 'Loading...'
      loading.hidden = false
      loading.classList.remove('error')
    }
    clearMedia()
    const data = await utils.requestJson(utils.getAppUrl(API_URL), {
      credentials: 'same-origin',
    })
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('The random media response was invalid')
    }
    if (history.length === 0) {
      history.push({})
    }
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1)
    }
    const mediaData = /** @type {RandomMedia} */ (data)
    history.push(mediaData)
    if (history.length > HISTORY_LIMIT + 1) {
      history.splice(1, 1)
    }
    historyIndex = history.length - 1
    writeLocalJson(HISTORY_KEY, history)
    showMedia(mediaData)
  } catch (error) {
    utils.handleError(error)
    handleMediaError(error)
  }
}

/**
 * Shows a meaningful preview error for both Error values and media events.
 *
 * @param {unknown} error Failed request or media event.
 * @returns {void}
 */
function handleMediaError(error) {
  if (loading) {
    loading.textContent = utils.getErrorMessage(
      error,
      'Media could not be loaded'
    )
    loading.classList.add('error')
    loading.hidden = false
  }
  if (imageInfo) imageInfo.hidden = true
  mediaContainer?.classList.remove('has-image')
}

/**
 * Displays the preceding usable entry from local random-media history.
 *
 * @returns {void}
 */
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
      writeLocalJson(HISTORY_KEY, history)
      showMedia(mediaData)
    } else {
      historyIndex = 0
      showEmptyState('Click the button to load media')
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
      writeLocalJson(HISTORY_KEY, history)
      showMedia(mediaData)
    } else {
      historyIndex = 0
      showEmptyState('Click the button to load media')
    }
  }
}

/**
 * Displays the following usable entry from local random-media history.
 *
 * @returns {void}
 */
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
      writeLocalJson(HISTORY_KEY, history)
      showMedia(mediaData)
    } else {
      console.error('No valid media data found when navigating forward.')
    }
  } else {
    historyIndex = Math.max(0, historyIndex)
    showEmptyState('Click the button to load media')
  }
}

/**
 * Configures the context menu actions for the currently displayed random item.
 *
 * @returns {void}
 */
function setupRandomMediaContextMenu() {
  setupContextMenu('#media-container', () => {
    if (!currentMediaData) return { items: [] }
    const mediaData = currentMediaData
    const mediaUrl = utils.toDisplayText(mediaData.url)
    const fileName = utils.toDisplayText(mediaData.file, 'media')
    const mediaKind = getMediaKind(fileName)
    const menuItems = []
    menuItems.push({
      label: 'Copy URL',
      icon: icons?.nav?.copy || '',
      handler: async () => {
        if (!mediaUrl) return
        if (!(await utils.copyText(mediaUrl))) {
          utils.statusMessage('Unable to copy URL', true)
        }
      },
    })
    menuItems.push({
      label: 'Open in New Tab',
      icon: icons?.nav?.link || '',
      handler: () => {
        if (!mediaUrl) return
        try {
          window.open(mediaUrl, '_blank', 'noopener')
        } catch (error) {
          utils.handleError(error, 'Unable to open media')
        }
      },
    })
    if (mediaKind === 'image') {
      menuItems.push({
        label: 'Copy Image',
        icon: icons?.nav?.copy || '',
        handler: async () => {
          if (!mediaUrl) return
          if (!(await utils.copyImage(mediaUrl))) {
            utils.statusMessage('Unable to copy image', true)
          }
        },
      })
    }
    menuItems.push({
      label: 'Download',
      icon: icons?.nav?.download || '',
      handler: () => {
        if (!mediaData.uuid) return
        try {
          const a = document.createElement('a')
          a.href = utils.getAppUrl(
            `/api/download/?uuid=${encodeURIComponent(String(mediaData.uuid))}`
          )
          a.download = ''
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        } catch (error) {
          utils.handleError(error)
        }
      },
    })
    menuItems.push({
      label: 'Add to Pool',
      icon: icons?.nav?.next || '',
      handler: async () => {
        if (!mediaData.uuid) return
        try {
          await utils.openAddToPoolModal(mediaData.uuid)
        } catch (error) {
          utils.handleError(error, 'Unable to open Add to Pool')
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
          handler: async () => {
            if (!mediaData.hash) return
            if (!(await utils.copyText(String(mediaData.hash)))) {
              utils.statusMessage('Unable to copy hash', true)
            }
          },
        },
        {
          label: 'UUID',
          icon: icons?.nav?.copy || '',
          handler: async () => {
            if (!mediaData.uuid) return
            if (!(await utils.copyText(String(mediaData.uuid)))) {
              utils.statusMessage('Unable to copy UUID', true)
            }
          },
        },
      ],
    })
    let mediaTypeIcon = icons?.other || ''
    if (mediaKind === 'image') {
      mediaTypeIcon = icons?.image || ''
    } else if (mediaKind === 'video') {
      mediaTypeIcon = icons?.video || ''
    } else if (mediaKind === 'audio') {
      mediaTypeIcon = icons?.audio || ''
    }
    return {
      header: {
        icon: mediaTypeIcon,
        label: fileName,
      },
      items: menuItems,
    }
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  const loadImageBtn = document.getElementById('loadImageBtn')
  const backImageBtn = document.getElementById('backImageBtn')
  const forwardImageBtn = document.getElementById('forwardImageBtn')
  const h = readLocalJson(HISTORY_KEY, /** @type {RandomMedia[]} */ ([]))
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
    writeLocalJson(HISTORY_KEY, history)
  }
  if (loadImageBtn instanceof HTMLButtonElement) {
    loadImageBtn.addEventListener('click', loadRandomMedia)
  }
  if (backImageBtn instanceof HTMLButtonElement) {
    backImageBtn.addEventListener('click', showPreviousMedia)
  }
  if (forwardImageBtn instanceof HTMLButtonElement) {
    forwardImageBtn.addEventListener('click', showNextMedia)
  }
  try {
    await loadIcons()
    setContextIcons(icons)
    if (backImageBtn instanceof HTMLButtonElement) {
      backImageBtn.innerHTML = `<span class="w-5 h-5 m-0 items-center">${icons.back}</span>`
    }
    if (loadImageBtn instanceof HTMLButtonElement) {
      loadImageBtn.innerHTML = `<span class="w-5 h-5 m-0 items-center">${icons.shuffle}</span>`
    }
    if (forwardImageBtn instanceof HTMLButtonElement) {
      forwardImageBtn.innerHTML = `<span class="w-5 h-5 m-0 items-center">${icons.forward}</span>`
    }
    createContextMenu()
    setupRandomMediaContextMenu()
    viewerApi = await initViewer()
    console.log('Viewer initialized successfully')
  } catch (error) {
    console.warn('Random page initialization warning:', error)
    try {
      utils.handleError(error)
    } catch (e) {
      console.warn('Error handler failed:', e)
    }
  }
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
