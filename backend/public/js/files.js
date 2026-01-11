'use strict'
import * as utils from '../min/index.min.js'
import { MIN_IMAGE_SCALE, PAGINATION } from '../min/settings.min.js'
import {
  setupViewerEvents,
  setupFileClickHandlers,
  loadViewerIcons,
} from '../min/viewer.min.js'
import {
  setupFileItemContextMenu,
  setContextIcons,
  setContextBasePaths,
} from '../min/contextmenu.min.js'
function setCookie(name, value, days = 365) {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`
}
function getCookie(name) {
  const nameEQ = name + '='
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') c = c.substring(1, c.length)
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length)
  }
  return null
}
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
function saveSortState() {
  const sortState = JSON.stringify({
    sort: currentSort,
    dir: currentSortDir,
    states: SORT_STATES,
  })
  setCookie('fileSortState', sortState)
}
function loadSortState() {
  const saved = getCookie('fileSortState')
  if (saved) {
    try {
      const state = JSON.parse(saved)
      currentSort = state.sort || 'name'
      currentSortDir = state.dir || 'none'
      SORT_STATES = state.states || {
        name: 'none',
        modified: 'none',
        type: 'none',
        size: 'none',
        created: 'none',
      }
    } catch (error) {
      console.error('Failed to parse sort state cookie:', error)
    }
  }
}
function getSortIcon(state) {
  switch (state) {
    case 'asc':
      return icons?.sort?.asc || ''
    case 'desc':
      return icons?.sort?.desc || ''
    default:
      return icons?.sort?.default || ''
  }
}
function renderSortToolbar() {
  const sortToolbar = document.getElementById('sort-toolbar')
  sortToolbar.classList.remove('invisible')
  const sortButtonStyle =
    'flex items-center text-center justify-between min-w-full md:min-w-[8vw] px-3 py-2 bg-black/20 backdrop-blur-md border border-white/20 rounded-xl pointer text-white transition'
  const sortStateStyle = 'w-4 h-4 align-middle font-white'
  const isRootDirectory =
    !currentDirectoryData || currentDirectoryData.path === ''
  const goBackButton = isRootDirectory
    ? ''
    : `
    <button id="goBack" class="${sortButtonStyle}">
      <span>Back</span>
      <span class="${sortStateStyle}">${icons?.back || ''}</span>
    </button>
  `
  const sortToolbarHtml = `
    ${goBackButton}
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
    let queryString = window.location.search
    if (PAGINATION.enabled && PAGINATION.limit) {
      const url = new URL(window.location.href)
      url.searchParams.set('limit', PAGINATION.limit)
      queryString = url.search
    }
    const apiPath = constructApiPath(path) + queryString
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
              const fileItem = element.closest('.file-item')
              const iconPlaceholder = fileItem?.querySelector(
                '.file-icon-placeholder'
              )
              tempImage.onload = () => {
                element.addEventListener(
                  'load',
                  () => {
                    element.classList.remove('loading')
                    element.classList.add('loaded')
                    if (iconPlaceholder && iconPlaceholder.parentNode) {
                      iconPlaceholder.parentNode.removeChild(iconPlaceholder)
                    }
                  },
                  { once: true }
                )
                element.addEventListener(
                  'error',
                  () => {
                    element.classList.remove('loading')
                    element.classList.add('error')
                    element.style.display = 'none'
                  },
                  { once: true }
                )
                element.src = element.dataset.src
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
              const fileItem = element.closest('.file-item')
              const iconPlaceholder = fileItem?.querySelector(
                '.file-icon-placeholder'
              )
              element.preload = 'metadata'
              element.src = element.dataset.src
              element.muted = element.tagName.toLowerCase() === 'video'
              element.addEventListener(
                'loadeddata',
                () => {
                  element.classList.remove('loading')
                  element.classList.add('loaded')
                  if (iconPlaceholder && iconPlaceholder.parentNode) {
                    iconPlaceholder.parentNode.removeChild(iconPlaceholder)
                  }
                },
                { once: true }
              )
              element.addEventListener(
                'error',
                () => {
                  element.classList.remove('loading')
                  element.classList.add('error')
                  element.style.display = 'none'
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
            const iconPlaceholder = element
              .closest('.file-item')
              ?.querySelector('.file-icon-placeholder, .absolute.inset-0')
            if (iconPlaceholder) {
              iconPlaceholder.style.display = ''
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
  url.searchParams.set('page', '1')
  if (PAGINATION.enabled && PAGINATION.limit) {
    url.searchParams.set('limit', PAGINATION.limit)
  }
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
      saveSortState()
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
      const useServerSort = getCookie('server-sort') !== 'false'
      if (useServerSort) {
        if (
          currentDirectoryData &&
          typeof currentDirectoryData.path === 'string'
        ) {
          loadDirectory(currentDirectoryData.path, null, true)
        } else {
          loadDirectory('', null, true)
        }
      } else {
        if (
          currentDirectoryData &&
          Array.isArray(currentDirectoryData.contents)
        ) {
          const sorted = sortContents(
            currentDirectoryData.contents,
            currentSort,
            currentSortDir
          )
          currentDirectoryData.contents = sorted
          renderDirectory(sorted, currentDirectoryData.path || '')
        } else {
          loadDirectory('', null, true)
        }
      }
    })
  })
}
async function renderDirectory(contents, path) {
  const hasFiles = contents.some((item) => item.type === 'file')
  const hasDirectories = contents.some((item) => item.type === 'directory')
  fileList.className = ''
  fileList.style.gridAutoFlow = ''
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
  const sortedContents = contents
  renderSortToolbar()
  const goBack = document.getElementById('goBack')
  if (goBack) {
    goBack.addEventListener('click', () => {
      const parentPath = currentDirectoryData.path
        .split('/')
        .slice(0, -1)
        .join('/')
      const url = new URL(window.location.href)
      url.searchParams.set('page', '1')
      if (PAGINATION.enabled && PAGINATION.limit) {
        url.searchParams.set('limit', PAGINATION.limit)
      }
      const params = url.search
      window.history.pushState(
        {},
        '',
        `${frontendBasePath}/${parentPath}${params}`
      )
      loadDirectory(parentPath, null, true)
    })
  }
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
        <div class="file-item directory group bg-black/80 flex items-center h-auto w-full p-4 m-0 border border-white/20 rounded-xl text-white pointer-events-auto box-border overflow-hidden select-none ${cursorClass}" data-type="${itemType}" data-file-type="${itemType}" data-path="${itemPath}" ${item.uuid ? `data-uuid="${item.uuid}"` : ''}>
          <div class="file-icon ${itemType} flex flex-shrink-0 w-8 h-8 mr-3 items-center justify-center">${(icons && icons[itemType]) || (icons && icons.directory) || (icons && icons.other) || ''}</div>
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
        <div class="file-item directory group place-items-start bg-black/80 flex-row h-auto w-full p-0 m-0 border border-white/20 rounded-xl text-white pointer-events-auto box-border overflow-hidden select-none ${cursorClass}" data-type="${itemType}" data-file-type="${itemType}" data-path="${itemPath}" ${item.uuid ? `data-uuid="${item.uuid}"` : ''}>
          <div class="group w-full min-w-0 p-2 mr-2 overflow-hidden">
            <div class="file-icon ${itemType} flex flex-shrink-0 w-6 h-6 items-center justify-center">${(icons && icons[itemType]) || (icons && icons.directory) || (icons && icons.other) || ''}</div>
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
        <div class="file-item ${item.type} group relative bg-black/80 block w-full h-full align-middle items-center justify-center p-0 break-inside-avoid border border-white/20 rounded-xl text-white pointer-events-auto box-border overflow-hidden select-none ${cursorClass}" data-type="${itemType}" data-file-type="${itemType}" data-path="${itemPath}" ${item.uuid ? `data-uuid="${item.uuid}"` : ''}>
          <div class="w-full h-full">
            ${(() => {
              const iconPlaceholder = `<div class="file-icon-placeholder absolute inset-0 flex items-center justify-center w-full h-full pointer-events-none z-10"><span class="w-16 h-16 opacity-50">${(icons && icons[itemType]) || (icons && icons.other) || ''}</span></div>`
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
                    <div class="file-preview text loading w-full h-full object-contain select-none flex items-center justify-center p-4 text-sm text-gray-300 bg-black/50 border border-white/10 rounded">${(icons && icons.text) || ''}</div>
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
        <div class="file-item other group bg-black/80 relative flex w-full h-auto p-3 border border-white/20 rounded-xl text-white pointer-events-auto box-border overflow-hidden select-none ${cursorClass}" data-type="${itemType}" data-file-type="${itemType}" data-path="${itemPath}" ${item.uuid ? `data-uuid="${item.uuid}"` : ''}>
          <div class="flex items-center w-full gap-3">
            <div class="file-icon ${itemType} flex flex-shrink-0 w-6 h-6 items-center justify-center">${icons?.[itemType] || icons?.other || ''}</div>
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
  renderPaginationUI(contents)
}
function renderPaginationUI(contents) {
  try {
    const controls =
      document.getElementById('pagination-controls') ||
      document.getElementById('pagination-container')
    if (!controls) return
    const url = new URL(window.location.href)
    const limitRaw = parseInt(url.searchParams.get('limit'), 10)
    if (isNaN(limitRaw) || limitRaw <= 0) {
      controls.hidden = true
      return
    }
    const limit = limitRaw
    controls.hidden = false
    const page = Math.max(
      1,
      parseInt(url.searchParams.get('page') || 'Page 0', 10) || 1
    )
    const disablePrev = page <= 1
    const disableNext = Array.isArray(contents) ? contents.length < limit : true
    const prevBtn = document.getElementById('pager-prev')
    const nextBtn = document.getElementById('pager-next')
    const currentSpan = document.getElementById('pager-current')
    if (prevBtn) {
      prevBtn.innerHTML = ''
      if (icons?.nav?.prev)
        prevBtn.insertAdjacentHTML('afterbegin', icons.nav.prev)
      else
        prevBtn.insertAdjacentHTML('afterbegin', prevBtn.innerHTML || '&#8249;')
      const prevSvg = prevBtn.querySelector('svg')
      if (prevSvg) {
        prevSvg.style.display = 'block'
        prevSvg.style.width = prevSvg.style.width || '20px'
        prevSvg.style.height = prevSvg.style.height || '20px'
        prevSvg.setAttribute('focusable', 'false')
      }
      if (disablePrev) {
        prevBtn.classList.add('opacity-50')
        prevBtn.classList.add('pointer-events-none')
      } else {
        prevBtn.classList.remove('opacity-50')
        prevBtn.classList.remove('pointer-events-none')
      }
      prevBtn.onclick = () => {
        if (disablePrev) return
        const u = new URL(window.location.href)
        u.searchParams.set('page', String(Math.max(1, page - 1)))
        if (PAGINATION.enabled && PAGINATION.limit) {
          u.searchParams.set('limit', PAGINATION.limit)
        }
        window.history.replaceState({}, '', u.pathname + u.search)
        loadDirectory(
          currentDirectoryData ? currentDirectoryData.path : '',
          null,
          true
        )
      }
    }
    if (nextBtn) {
      nextBtn.innerHTML = ''
      if (icons?.nav?.next)
        nextBtn.insertAdjacentHTML('afterbegin', icons.nav.next)
      else
        nextBtn.insertAdjacentHTML('afterbegin', nextBtn.innerHTML || '&#8250;')
      const nextSvg = nextBtn.querySelector('svg')
      if (nextSvg) {
        nextSvg.style.display = 'block'
        nextSvg.style.width = nextSvg.style.width || '20px'
        nextSvg.style.height = nextSvg.style.height || '20px'
        nextSvg.setAttribute('focusable', 'false')
      }
      if (disableNext) {
        nextBtn.classList.add('opacity-50')
        nextBtn.classList.add('pointer-events-none')
      } else {
        nextBtn.classList.remove('opacity-50')
        nextBtn.classList.remove('pointer-events-none')
      }
      nextBtn.onclick = () => {
        if (disableNext) return
        const u = new URL(window.location.href)
        u.searchParams.set('page', String(page + 1))
        if (PAGINATION.enabled && PAGINATION.limit) {
          u.searchParams.set('limit', PAGINATION.limit)
        }
        window.history.replaceState({}, '', u.pathname + u.search)
        loadDirectory(
          currentDirectoryData ? currentDirectoryData.path : '',
          null,
          true
        )
      }
    }
    if (currentSpan) currentSpan.textContent = `Page ${String(page)}`
  } catch (err) {
    console.error('Failed to render pagination UI:', err)
  }
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
    loadSortState()
    if (currentSortDir !== 'none') {
      const url = new URL(window.location.href)
      url.searchParams.set(currentSort, currentSortDir)
      let pathname = url.pathname
      if (!pathname.endsWith('/')) pathname += '/'
      window.history.replaceState({}, '', pathname + url.search)
    }
  } else {
    saveSortState()
  }
}
async function init() {
  if (isInitialized) return
  isInitialized = true
  try {
    await loadIcons()
    setContextIcons(icons)
    setContextBasePaths(frontendBasePath, apiBasePath)
    await loadViewerIcons()
    await setupViewerEvents()
    getSortFromQuery()
    setupFileItemContextMenu()
  } catch {
    utils.handleError('Failed to finish initialization')
    console.error('Failed to finish initialization.')
    return
  }
  const frontendBasePathEscaped = escapeRegExp(frontendBasePath)
  const initialPath = window.location.pathname
    .replace(new RegExp(`^${frontendBasePathEscaped}/?`), '')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
    .replace(/^files\/?/, '')
  document.addEventListener('click', handleDirectoryClick)
  const url = new URL(window.location.href)
  let hasChanges = false
  if (!url.searchParams.has('page')) {
    url.searchParams.set('page', '1')
    hasChanges = true
  }
  if (
    PAGINATION.enabled &&
    PAGINATION.limit &&
    !url.searchParams.has('limit')
  ) {
    url.searchParams.set('limit', PAGINATION.limit)
    hasChanges = true
  }
  if (hasChanges) {
    window.history.replaceState({}, '', url.pathname + url.search)
  }
  await loadDirectory(initialPath)
}
document.addEventListener('DOMContentLoaded', init)