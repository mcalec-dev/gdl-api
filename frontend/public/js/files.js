'use strict'
import * as utils from './index.js'
import { MIN_IMAGE_SCALE } from './settings.js'
import {
  setupViewerEvents,
  setupFileClickHandlers,
  loadViewerIcons,
} from './viewer.js'
let frontendBasePath = document.location.origin + '/files'
let apiBasePath = document.location.origin + '/api/files'
let icons
async function loadIcons() {
  const icon = await utils.getIcons()
  icons = {
    directory: icon.folder,
    image: icon.file.image,
    video: icon.file.video,
    audio: icon.file.audio,
    text: icon.file.text,
    other: icon.file.default,
    back: icon.nav.back,
    sort: {
      asc: icon.arrow.asc,
      desc: icon.arrow.desc,
      default: icon.arrow.default,
    },
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
let contextMenu = null
let _contextOutsideHandler = null
let _prevBodyOverflow = null
async function lockScroll() {
  try {
    _prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } catch {
    try {
      document.body.style.removeProperty('overflow')
    } catch {
      utils.handleError('Unable to lock scroll')
    }
  }
}
async function unlockScroll() {
  try {
    if (_prevBodyOverflow === null || _prevBodyOverflow === undefined) {
      document.body.style.removeProperty('overflow')
    } else {
      document.body.style.overflow = _prevBodyOverflow
    }
    _prevBodyOverflow = null
  } catch {
    try {
      document.body.style.removeProperty('overflow')
    } catch {
      utils.handleError('Unable to unlock scroll')
    }
  }
}
function createContextMenu() {
  if (contextMenu) return
  contextMenu = document.getElementById('context-menu-container')
  if (!contextMenu) {
    contextMenu = document.createElement('div')
    contextMenu.id = 'context-menu-container'
    document.body.appendChild(contextMenu)
  }
  contextMenu.hidden = true
}
async function showContextMenu(e, itemElem) {
  if (!contextMenu) createContextMenu()
  contextMenu.innerHTML = ''
  const fileType = itemElem.dataset.fileType
  const itemPath = itemElem.dataset.path
  const encodedPath = itemPath.split('/').map(encodeURIComponent).join('/')
  const fileUrl = `${apiBasePath}/${encodedPath}`
  contextMenu.innerHTML = `
    <div class="border-b border-white/20 px-2 py-2 mb-2 flex items-center gap-1">
      <span class="w-4 h-4">${icons[fileType]}</span>
      <span class="truncate">${itemPath.split('/').pop()}</span>
    </div>
  `
  const menuItems = []
  menuItems.push({
    label: 'Copy URL',
    icon: icons.nav.copy,
    handler: () => {
      navigator.clipboard.writeText(fileUrl)
    },
  })
  if (fileType === 'image' || fileType === 'video' || fileType === 'audio') {
    menuItems.push({
      label: 'Open in New Tab',
      icon: icons.nav.link,
      handler: () => {
        window.open(fileUrl, '_blank')
      },
    })
    if (fileType === 'image') {
      menuItems.push({
        label: 'Copy Image',
        icon: icons.nav.copy,
        handler: async () => {
          try {
            const req = await fetch(fileUrl)
            const blob = await req.blob()
            const type = blob.type || 'image/png'
            await navigator.clipboard.write([
              new window.ClipboardItem({ [type]: blob }),
            ])
          } catch {
            utils.handleError('Failed to copy image.')
          }
        },
      })
    }
  }
  menuItems.push({
    label: 'Download',
    icon: icons.nav.download,
    handler: () => {
      const a = document.createElement('a')
      a.href = `/api/download/?url="${encodeURIComponent(fileUrl)}"`
      a.download = ''
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    },
  })
  const menuContainer = document.createElement('div')
  menuContainer.className = 'menu-items flex flex-col gap-1'
  menuItems.forEach(({ label, icon }, index) => {
    const item = document.createElement('div')
    item.className =
      'px-2 py-1 rounded-lg cursor-pointer flex items-center gap-2 menu-item'
    item.dataset.index = index.toString()
    item.innerHTML = `
      <span class="w-3.5 h-3.5 stroke-white stroke-2">${icon}</span>
      <span>${label}</span>
    `
    menuContainer.appendChild(item)
  })
  contextMenu.appendChild(menuContainer)
  menuContainer.addEventListener('click', (ev) => {
    const menuItem = ev.target.closest('.menu-item')
    if (!menuItem) return
    ev.preventDefault()
    ev.stopPropagation()
    ev.stopImmediatePropagation()
    const index = parseInt(menuItem.dataset.index)
    if (!isNaN(index) && menuItems[index]) {
      hideContextMenu()
      menuItems[index].handler()
    }
  })
  menuContainer.addEventListener('mouseover', (ev) => {
    const menuItem = ev.target.closest('.menu-item')
    if (menuItem) {
      menuItem.style.background = 'rgba(255,255,255,0.08)'
    }
  })
  menuContainer.addEventListener('mouseout', (ev) => {
    const menuItem = ev.target.closest('.menu-item')
    if (menuItem) {
      menuItem.style.background = 'none'
    }
  })
  const rect = contextMenu.getBoundingClientRect()
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight
  let left = e.clientX
  let top = e.clientY
  contextMenu.style.display = 'block'
  contextMenu.hidden = false
  const menuW = contextMenu.offsetWidth || rect.width || 180
  const menuH = contextMenu.offsetHeight || rect.height || 40
  if (left + menuW > viewportW) left = Math.max(8, viewportW - menuW - 8)
  if (top + menuH > viewportH) top = Math.max(8, viewportH - menuH - 8)
  contextMenu.style.left = left + 'px'
  contextMenu.style.top = top + 'px'
  if (_contextOutsideHandler) {
    document.removeEventListener('pointerdown', _contextOutsideHandler, true)
    _contextOutsideHandler = null
  }
  _contextOutsideHandler = function outsideHandler(ev) {
    if (!contextMenu.contains(ev.target)) {
      ev.preventDefault()
      ev.stopPropagation()
      hideContextMenu()
      document.removeEventListener('pointerdown', _contextOutsideHandler, true)
      _contextOutsideHandler = null
    }
  }
  document.addEventListener('pointerdown', _contextOutsideHandler, true)
  await lockScroll()
}
async function hideContextMenu() {
  if (!contextMenu) return
  contextMenu.style.display = 'none'
  contextMenu.hidden = true
  if (_contextOutsideHandler) {
    document.removeEventListener('pointerdown', _contextOutsideHandler, true)
    _contextOutsideHandler = null
  }
  await unlockScroll()
}
function setupFileItemContextMenu() {
  if (!contextMenu) createContextMenu()
  document.addEventListener('contextmenu', (e) => {
    e.stopPropagation()
    e.stopImmediatePropagation()
    const itemElem = e.target.closest('.file-item[data-file-type]')
    if (
      itemElem &&
      itemElem.dataset.fileType &&
      itemElem.dataset.fileType !== 'directory'
    ) {
      e.preventDefault()
      showContextMenu(e, itemElem)
    } else {
      hideContextMenu()
    }
  })
}
function constructApiPath(path) {
  const cleanPath = path.replace(/^\/|\/$/g, '').replace(/^files\/?/, '')
  return cleanPath ? `${apiBasePath}/${cleanPath}` : apiBasePath
}
const previewSize = `?x=${MIN_IMAGE_SCALE}`
const fileList = document.getElementById('file-list')
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function getFileType(mime) {
  if (!mime || mime === 'n/a' || typeof mime !== 'string') return 'other'
  switch (true) {
    case mime === 'application/mp4':
      return 'video'
    case mime.includes('audio'):
      return 'audio'
    case mime.includes('image'):
      return 'image'
    case mime.includes('text'):
      return 'text'
    case mime.includes('video'):
      return 'video'
    case mime.includes('application'):
      return 'other'
    default:
      return 'other'
  }
}
let currentDirectoryData = null
let currentSort = 'name'
let currentSortDir = 'none'
let currentFetchController = null
let isInitialized = false
let SORT_STATES = {
  name: 'none',
  modified: 'none',
  type: 'none',
  size: 'none',
  created: 'none',
}
function getSortIcon(state) {
  switch (state) {
    case 'asc':
      return icons.sort.asc
    case 'desc':
      return icons.sort.desc
    default:
      return icons.sort.default
  }
}
function renderSortToolbar() {
  const sortToolbar = document.getElementById('sort-toolbar')
  sortToolbar.classList.remove('invisible')
  const sortButtonStyle =
    'flex items-center text-center justify-between min-w-[8vw] px-3 py-2 bg-black/20 backdrop-blur-md border border-white/20 rounded-xl pointer text-white transition'
  const sortStateStyle = 'w-4 h-4 align-middle font-white'
  const sortToolbarHtml = `
    <button id="goBack" class="${sortButtonStyle}">
      <span>Back</span>
      <span class="${sortStateStyle}">${icons.back}</span>
    </button>
    <button id="sortByName" class="${sortButtonStyle}" data-sort="name">
      <span>Name</span>
      <span class="${sortStateStyle}">${getSortIcon(SORT_STATES.name)}</span>
    </button>
    <button id="sortByModified" class="${sortButtonStyle}" data-sort="modified">
      <span>Modified</span>
      <span class="${sortStateStyle}">${getSortIcon(SORT_STATES.modified)}</span>
    </button>
    <button id="sortByType" class="${sortButtonStyle}" data-sort="type">
      <span>Type</span>
      <span class="${sortStateStyle}">${getSortIcon(SORT_STATES.type)}</span>
    </button>
    <button id="sortBySize" class="${sortButtonStyle}" data-sort="size">
      <span>Size</span>
      <span class="${sortStateStyle}">${getSortIcon(SORT_STATES.size)}</span>
    </button>
    <button id="sortByCreated" class="${sortButtonStyle}" data-sort="created">
      <span>Created</span>
      <span class="${sortStateStyle}">${getSortIcon(SORT_STATES.created)}</span>
    </button>
  `
  sortToolbar.innerHTML = sortToolbarHtml
}
function sortContents(contents, sortBy, direction) {
  if (direction === 'none') {
    return [...contents].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
      })
    })
  }
  return [...contents].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    let comparison = 0
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, undefined, {
          numeric: true,
        })
        break
      case 'modified':
        comparison = new Date(a.modified || 0) - new Date(b.modified || 0)
        break
      case 'type': {
        const extA = a.name.split('.').pop() || ''
        const extB = b.name.split('.').pop() || ''
        comparison = extA.localeCompare(extB)
        break
      }
      case 'size':
        comparison = (a.size || 0) - (b.size || 0)
        break
      case 'created':
        comparison = new Date(a.created || 0) - new Date(b.created || 0)
        break
      default:
        comparison = a.name.localeCompare(b.name, undefined, {
          numeric: true,
        })
    }
    return direction === 'asc' ? comparison : -comparison
  })
}
async function loadDirectory(path = '', callback, forceRefresh = false) {
  try {
    if (currentFetchController) {
      currentFetchController.abort()
    }
    currentFetchController = new AbortController()
    const { signal } = currentFetchController
    path = path ? decodeURIComponent(path) : ''
    if (path) {
      const frontendBasePathEscaped = escapeRegExp(frontendBasePath)
      path = path
        .replace(new RegExp(`^${frontendBasePathEscaped}/?`), '')
        .replace(/\/+/g, '/')
        .replace(/^\/|\/$/g, '')
        .replace(/^files\/?/, '')
    }
    fileList.innerHTML = ''
    const loadingIndicator = document.createElement('div')
    loadingIndicator.className =
      'loading fixed left-1/2 top-1/2 min-w-[180px] max-w-[320px] p-4 bg-black/80 select-none rounded-xl text-white border border-white/20 text-center transform -translate-x-1/2 -translate-y-1/2 z-50 cursor-not-allowed'
    loadingIndicator.innerHTML = '<span>Loading...</span>'
    fileList.appendChild(loadingIndicator)
    const apiPath = constructApiPath(path)
    let needsFetch =
      !currentDirectoryData ||
      currentDirectoryData.path !== path ||
      forceRefresh
    if (needsFetch) {
      try {
        const response = await fetch(apiPath, { signal })
        if (!response.ok) {
          fileList.innerHTML = `
            <div class="error">
              Error loading directory contents<br>
              <small>${response.statusText}</small>
            </div>
          `
          if (fileList.contains(loadingIndicator))
            fileList.removeChild(loadingIndicator)
          return
        }
        const data = await response.json()
        let contents = []
        if (Array.isArray(data)) {
          contents = data
        } else if (Array.isArray(data.contents)) {
          contents = data.contents
        } else if (Array.isArray(data.files)) {
          contents = data.files
        } else if (data.data && Array.isArray(data.data)) {
          contents = data.data
        }
        currentDirectoryData = { path, contents }
      } catch (error) {
        if (error.name !== 'AbortError') {
          utils.handleError(error)
          console.error('Fetch error:', error)
          fileList.innerHTML = `
            <div class="error">
              Error loading directory contents<br>
              <small>${error.message}</small>
            </div>
          `
        }
        if (fileList.contains(loadingIndicator))
          fileList.removeChild(loadingIndicator)
        return
      }
    }
    if (fileList.contains(loadingIndicator))
      fileList.removeChild(loadingIndicator)
    renderDirectory(currentDirectoryData.contents, path)
    if (callback) {
      callback()
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      utils.handleError(error)
      console.error('Load directory error:', error)
      fileList.innerHTML = `
        <div class="error">
          Error loading directory contents<br>
          <small>${error.message}</small>
        </div>
      `
    }
  }
}
window.addEventListener('popstate', (event) => {
  const state = event.state || {}
  if (state.sortBy) {
    currentSort = state.sortBy
    currentSortDir = state.sortDir
  }
  const location = window.location.pathname
  const frontendBasePathEscaped = escapeRegExp(frontendBasePath)
  const currentPath =
    location === frontendBasePath || location === `${frontendBasePath}/`
      ? ''
      : location
          .replace(new RegExp(`^${frontendBasePathEscaped}/?`), '')
          .replace(/\/+/g, '/')
          .replace(/^\/|\/$/g, '')
  loadDirectory(currentPath, null, true)
})
function setupLazyLoading() {
  if (window.lazyLoadObserver) {
    window.lazyLoadObserver.disconnect()
  }
  window.lazyLoadObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const element = entry.target
        if (entry.isIntersecting) {
          if (
            element.classList.contains('loading') &&
            element.dataset.src &&
            !element.src
          ) {
            const loadImage = () => {
              const tempImage = new window.Image()
              const iconPlaceholder =
                element.parentElement?.parentElement?.querySelector(
                  '.absolute.inset-0'
                )
              tempImage.onload = () => {
                element.src = element.dataset.src
                element.classList.remove('loading')
                element.classList.add('loaded')
                if (iconPlaceholder) {
                  iconPlaceholder.style.display = 'none'
                }
              }
              tempImage.onerror = () => {
                element.classList.remove('loading')
                element.classList.add('error')
                element.style.display = 'none'
              }
              tempImage.src = element.dataset.src
            }
            if (
              element.tagName.toLowerCase() === 'video' ||
              element.tagName.toLowerCase() === 'audio'
            ) {
              const iconPlaceholder =
                element.parentElement?.parentElement?.querySelector(
                  '.absolute.inset-0'
                )
              element.preload = 'metadata'
              element.src = element.dataset.src
              element.muted = element.tagName.toLowerCase() === 'video'
              element.classList.remove('loading')
              element.classList.add('loaded')
              element.addEventListener(
                'loadeddata',
                () => {
                  if (iconPlaceholder) {
                    iconPlaceholder.style.display = 'none'
                  }
                },
                { once: true }
              )

              element.addEventListener(
                'error',
                () => {
                  element.style.display = 'none'
                },
                { once: true }
              )
            } else {
              loadImage()
            }
          }
        } else {
          if (!element.classList.contains('zoomed')) {
            const iconPlaceholder =
              element.parentElement?.parentElement?.querySelector(
                '.absolute.inset-0'
              )
            if (iconPlaceholder) {
              iconPlaceholder.style.display = 'flex'
            }

            if (
              element.tagName.toLowerCase() === 'video' ||
              element.tagName.toLowerCase() === 'audio'
            ) {
              element.pause()
              element.currentTime = 0
              element.removeAttribute('src')
              element.preload = 'none'
              element.load()
            } else if (!element.classList.contains('loaded')) {
              element.removeAttribute('src')
            }
            element.classList.add('loading')
          }
        }
      })
    },
    {
      rootMargin: '100px 0px',
      threshold: 0.1,
    }
  )
  document.querySelectorAll('.file-preview').forEach((element) => {
    window.lazyLoadObserver.observe(element)
  })
}
function handleDirectoryClick(event) {
  const target = event.target.closest('.file-item.directory')
  if (!target) return
  event.preventDefault()
  const itemPath = target.dataset.path
  if (!itemPath) return
  let newPath = `${frontendBasePath}/${itemPath}`
    .replace(new RegExp(`^${document.location.origin}`), '')
    .replace(/\/+/g, '/')
    .replace(/\/\//g, '/')
  if (!newPath.endsWith('/')) newPath += '/'
  const cleanPath = itemPath.replace(new RegExp(`^${frontendBasePath}/?`), '')
  const url = new URL(window.location.href)
  const params = url.search
  history.pushState({ path: cleanPath }, '', newPath + params)
  loadDirectory(cleanPath, null, true)
}
function setupSortButtons() {
  const sortButtons = [
    document.getElementById('sortByName'),
    document.getElementById('sortByModified'),
    document.getElementById('sortByType'),
    document.getElementById('sortBySize'),
    document.getElementById('sortByCreated'),
  ]
  sortButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const sortBy = button.dataset.sort
      Object.keys(SORT_STATES).forEach((key) => {
        if (key !== sortBy) SORT_STATES[key] = 'none'
      })
      if (SORT_STATES[sortBy] === 'none') {
        SORT_STATES[sortBy] = 'desc'
      } else if (SORT_STATES[sortBy] === 'desc') {
        SORT_STATES[sortBy] = 'asc'
      } else {
        SORT_STATES[sortBy] = 'none'
      }
      currentSort = sortBy
      currentSortDir = SORT_STATES[sortBy]
      const url = new URL(window.location.href)
      ;['name', 'size', 'type', 'modified', 'created'].forEach((param) =>
        url.searchParams.delete(param)
      )
      if (SORT_STATES[sortBy] !== 'none') {
        url.searchParams.set(sortBy, SORT_STATES[sortBy])
      }
      let pathname = url.pathname
      if (!pathname.endsWith('/')) pathname += '/'
      window.history.replaceState({}, '', pathname + url.search)
      renderDirectory(currentDirectoryData.contents, currentDirectoryData.path)
    })
  })
}
async function renderDirectory(contents, path) {
  const hasFiles = contents.some((item) => item.type === 'file')
  const hasDirectories = contents.some((item) => item.type === 'directory')
  fileList.className = ''
  fileList.style.gridAutoFlow = ''
  // all this styling is pissing me off
  // im the original mcalec
  if (hasFiles) {
    fileList.classList.add(
      'grid-view',
      'grid',
      '[grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]',
      'auto-rows-[200px]',
      'items-start',
      'justify-items-stretch',
      'gap-3'
    )
    fileList.style.gridAutoFlow = 'dense'
  } else if (hasDirectories) {
    fileList.classList.remove(
      'grid-view',
      'grid',
      'sm:grid-cols-2',
      'md:grid-cols-4',
      'lg:grid-cols-6'
    )
    fileList.style.gridAutoFlow = ''
    fileList.style.gridAutoRows = ''
    fileList.classList.add('flex', 'flex-col', 'items-start', 'gap-4')
  }
  const sortedContents = sortContents(contents, currentSort, currentSortDir)
  renderSortToolbar()
  const goBack = document.getElementById('goBack')
  goBack.addEventListener('click', () => {
    const parentPath = currentDirectoryData.path
      .split('/')
      .slice(0, -1)
      .join('/')
    loadDirectory(parentPath)
    window.history.pushState({}, '', `${frontendBasePath}/${parentPath}`)
  })
  await setupFileClickHandlers('#file-list')
  let html = ''
  for (const item of sortedContents) {
    const itemPath = path ? `${path}/${item.name}` : item.name
    const itemType =
      item.type === 'directory' ? 'directory' : getFileType(item.mime)
    let previewUrl = null
    if (
      item.type === 'file' &&
      (itemType === 'image' || itemType === 'video' || itemType === 'audio')
    ) {
      const encodedPath = itemPath
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/')
      previewUrl = item.url || `${apiBasePath}/${encodedPath}`
      if (itemType === 'image') {
        previewUrl += previewSize
      }
    }
    let cursorClass = ''
    if (item.type === 'directory') {
      cursorClass = 'cursor-pointer'
    } else {
      cursorClass = 'cursor-help'
    }
    if (itemType === 'directory') {
      if (hasDirectories && !hasFiles) {
        html += `
        <div class="file-item directory group bg-black/80 flex items-center h-auto w-full p-4 m-0 border border-white/20 rounded-xl text-white pointer-events-auto box-border overflow-hidden select-none ${cursorClass}" data-type="${itemType}" data-file-type="${itemType}" data-path="${itemPath}">
          <div class="file-icon ${itemType} flex w-8 h-8 flex-shrink-0 mr-3">${icons[itemType]}</div>
          <div class="flex-1 min-w- overflow-hidden">
            <div class="text-white text-decoration-none text-nowrap overflow-hidden text-ellipsis">${item.name}</div>
            <div class="text-gray-300 text-sm text-nowrap overflow-hidden text-ellipsis">
              <span>${utils.formatDate(item.modified)}</span>
              <br />
              <span>${utils.formatSize(item.size)}</span>
            </div>
          </div>
        </div>
      `
      } else {
        html += `
        <div class="file-item directory group place-items-start bg-black/80 flex-row h-auto w-full p-0 m-0 border border-white/20 rounded-xl text-white pointer-events-auto box-border overflow-hidden select-none ${cursorClass}" data-type="${itemType}" data-file-type="${itemType}" data-path="${itemPath}">
          <div class="group w-full min-w-0 p-2 mr-2 overflow-hidden">
            <div class="file-icon ${itemType} flex w-6 h-6">${icons[itemType]}</div>
            <div class="flex-col text-white text-decoration-none text-nowrap overflow-hidden text-ellipsis">${item.name}</div>
            <div class="text-gray-300 text-sm text-nowrap overflow-hidden text-ellipsis">
              <span>${utils.formatDate(item.modified)}</span>
              <br />
              <span>${utils.formatSize(item.size)}</span>
            </div>
          </div>
        </div>
      `
      }
    } else if (
      (itemType === 'image' || itemType === 'video' || itemType === 'audio') &&
      previewUrl
    ) {
      html += `
        <div class="file-item ${item.type} group relative bg-black/80 block w-full h-full align-middle items-center justify-center p-0 break-inside-avoid border border-white/20 rounded-xl text-white pointer-events-auto box-border overflow-hidden select-none ${cursorClass}" data-type="${itemType}" data-file-type="${itemType}" data-path="${itemPath}">
          <div class="w-full h-full">
            ${(() => {
              const iconPlaceholder = `<div class="absolute inset-0 flex items-center justify-center w-full h-full pointer-events-none z-10"><span class="w-16 h-16 opacity-50">${icons[itemType]}</span></div>`
              if (itemType === 'audio') {
                return `
                  ${iconPlaceholder}
                  <div class="audio-preview-container aspect-auto h-full w-full bg-transparent flex items-center justify-center overflow-hidden select-none">
                    <audio class="file-preview audio loading w-full object-contain select-none" data-src="${previewUrl}" alt="${item.name}" preload="none" onmouseover="if(this.src) { this.play(); this.muted=false; }" onmouseout="if(this.src) { this.pause(); this.currentTime=0; this.muted=true; }" draggable="false"></audio>
                  </div>
                `
              }
              if (itemType === 'image') {
                return `
                  ${iconPlaceholder}
                  <div class="image-preview-container aspect-auto h-full w-full bg-transparent flex items-center justify-center overflow-hidden select-none">
                    <img class="file-preview image loading w-full h-full object-contain select-none" data-src="${previewUrl}" alt="${item.name}" draggable="false" onerror="this.style.display='none'">
                  </div>
                `
              }
              if (itemType === 'video') {
                return `
                  ${iconPlaceholder}
                  <div class="video-preview-container aspect-video h-full w-full bg-transparent flex items-center justify-center overflow-hidden select-none">
                    <video class="file-preview video loading w-full h-full object-contain select-none" data-src="${previewUrl}" alt="${item.name}" preload="none" onmouseover="if(this.src) { this.play(); this.muted=false; }" onmouseout="if(this.src) { this.pause(); this.currentTime=0; this.muted=true; }" draggable="false" onerror="this.style.display='none'"></video>
                  </div>
                `
              }
              if (itemType === 'text') {
                return `
                  <div class="text-preview-container aspect-auto h-full w-full bg-transparent flex items-center justify-center overflow-hidden select-none">
                    <div class="file-preview text loading w-full h-full object-contain select-none flex items-center justify-center p-4 text-sm text-gray-300 bg-black/50 border border-white/10 rounded">${icons.text}</div>
                  </div>
                `
              }
              return ''
            })()}
          </div>
          <div class="file-details absolute inset-x-0 bottom-0 duration-300 z-20 bg-black/85 p-2 opacity-0 transition-opacity group-hover:opacity-100">
            <div class="text-white text-decoration-none text-nowrap overflow-hidden text-ellipsis">${item.name}</div>
            <div class="flex-col text-gray-300 text-sm text-nowrap overflow-hidden text-ellipsis">
              <span>${utils.formatDate(item.modified)}</span><br>
              <span>${utils.formatSize(item.size)}</span>
            </div>
          </div>
        </div>
      `
    } else {
      html += `
        <div class="file-item other group bg-black/80 relative flex w-full h-auto p-3 border border-white/20 rounded-xl text-white pointer-events-auto box-border overflow-hidden select-none ${cursorClass}" data-type="${itemType}" data-file-type="${itemType}" data-path="${itemPath}">
          <div class="flex items-center w-full gap-3">
            <div class="file-icon ${itemType} flex w-6 h-6 flex-shrink-0">${icons[itemType] || icons.other}</div>
            <div class="file-details flex-1 min-w-0">
              <div class="text-white text-decoration-none text-nowrap overflow-hidden text-ellipsis">${item.name}</div>
              <div class="text-gray-300 text-sm text-nowrap overflow-hidden text-ellipsis">
                <span>${utils.formatDate(item.modified)}</span><br>
                <span>${utils.formatSize(item.size)}</span>
              </div>
            </div>
          </div>
        </div>
      `
    }
  }
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  fileList.innerHTML = ''
  while (tempDiv.firstChild) {
    fileList.appendChild(tempDiv.firstChild)
  }
  setupSortButtons()
  fileList
    .querySelectorAll('.file-item[data-file-type="audio"]')
    .forEach((item) => {
      const audio = item.querySelector('.file-preview.audio')
      if (!audio) return
      item.addEventListener('mouseenter', function () {
        if (audio.src) {
          audio.play()
        }
      })
      item.addEventListener('mouseleave', function () {
        audio.pause()
        audio.currentTime = 0
      })
    })
  setupLazyLoading()
}
function getSortFromQuery() {
  const params = new URLSearchParams(window.location.search)
  let found = false
  ;['name', 'size', 'type', 'modified', 'created'].forEach((param) => {
    const dir = params.get(param)
    if (dir === 'asc' || dir === 'desc') {
      currentSort = param
      currentSortDir = dir
      Object.keys(SORT_STATES).forEach((key) => (SORT_STATES[key] = 'none'))
      SORT_STATES[param] = dir
      found = true
    }
  })
  if (!found) {
    currentSort = 'name'
    currentSortDir = 'none'
    Object.keys(SORT_STATES).forEach((key) => (SORT_STATES[key] = 'none'))
  }
}
async function init() {
  if (isInitialized) return
  isInitialized = true
  await loadIcons()
  await loadViewerIcons()
  await setupViewerEvents()
  getSortFromQuery()
  setupFileItemContextMenu()
  const frontendBasePathEscaped = escapeRegExp(frontendBasePath)
  const initialPath = window.location.pathname
    .replace(new RegExp(`^${frontendBasePathEscaped}/?`), '')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
    .replace(/^files\/?/, '')
  document.addEventListener('click', handleDirectoryClick)
  await loadDirectory(initialPath)
}
document.addEventListener('DOMContentLoaded', init)
