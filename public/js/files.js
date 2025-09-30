'use strict'
import * as utils from '../min/index.min.js'
import { setupViewerEvents, setupFileClickHandlers } from '../min/viewer.min.js'
let frontendBasePath = document.location.origin + '/files'
let apiBasePath = document.location.origin + '/api/files'
function constructApiPath(path) {
  const cleanPath = path.replace(/^\/|\/$/g, '').replace(/^files\/?/, '')
  return cleanPath ? `${apiBasePath}/${cleanPath}` : apiBasePath
}
const previewSize = '?x=50'
const fileList = document.getElementById('file-list')
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function getFileType(mime) {
  if (!mime || mime === 'n/a') return 'other'
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
  }
}
let currentDirectoryData = null
let currentSort = 'name'
let currentSortDir = 'none'
let currentFetchController = null
let isInitialized = false
const SORT_STATES = {
  name: 'none',
  modified: 'none',
  type: 'none',
  size: 'none',
  created: 'none',
}
function getSortIcon(state) {
  switch (state) {
    case 'asc':
      return '↑'
    case 'desc':
      return '↓'
    default:
      return '↕'
  }
}
function renderSortToolbar() {
  const sortToolbar = document.getElementById('sort-toolbar')
  sortToolbar.classList.remove('invisible')
  const sortButtonStyle =
    'flex justify-between min-w-[8vw] px-3 py-2 transparent backdrop-blur-md border border-white/10 rounded-xl pointer text-white'
  const sortStateStyle = 'font-black'
  const sortToolbarHtml = `
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
      'loading fixed left-1/2 top-1/2 min-w-[180px] max-w-[320px] p-4 bg-[#232323] text-[#bbbbbb] border border-[#404040] text-center transform -translate-x-1/2 -translate-y-1/2 z-[1000] cursor-not-allowed'
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
            </div>`
          if (fileList.contains(loadingIndicator))
            fileList.removeChild(loadingIndicator)
          return
        }
        const data = await response.json()
        currentDirectoryData = { path, contents: data.contents }
      } catch (error) {
        if (error.name !== 'AbortError') {
          utils.handleError(error)
          fileList.innerHTML = `
            <div class="error">
              Error loading directory contents<br>
              <small>${error.message}</small>
            </div>`
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
      fileList.innerHTML = `
        <div class="error">
          Error loading directory contents<br>
          <small>${error.message}</small>
        </div>`
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
            if (
              element.tagName.toLowerCase() === 'video' ||
              element.tagName.toLowerCase() === 'audio'
            ) {
              element.preload = 'metadata'
              element.src = element.dataset.src
              element.muted = element.tagName.toLowerCase() === 'video'
              element.classList.remove('loading')
            } else {
              element.src = element.dataset.src
              element.onload = () => {
                element.classList.remove('loading')
              }
              element.onerror = () => {
                element.classList.remove('loading')
                element.classList.add('error')
              }
            }
          }
        } else {
          if (!element.classList.contains('zoomed')) {
            if (
              element.tagName.toLowerCase() === 'video' ||
              element.tagName.toLowerCase() === 'audio'
            ) {
              element.pause()
              element.currentTime = 0
              element.removeAttribute('src')
              element.preload = 'none'
              element.load()
            } else {
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
  window.scrollTo(0, 0)
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
    fileList.classList.remove(
      'columns-1',
      'columns-2',
      'columns-3',
      'columns-4',
      'columns-5',
      'columns-6'
    )
    fileList.classList.add(
      'grid-view',
      'grid',
      'sm:grid-cols-2',
      'md:grid-cols-4',
      'lg:grid-cols-6',
      'items-start',
      'gap-4'
    )
    fileList.style.gridAutoFlow = 'row dense'
    fileList.style.gridAutoRows = 'min-content'
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
  setupFileClickHandlers('#file-list')
  let html = ''
  for (const item of sortedContents) {
    const itemPath = path ? `${path}/${item.name}` : item.name
    const itemType =
      item.type === 'directory'
        ? 'directory'
        : getFileType(item.mime) || item.fileType
    let previewUrl = null
    if (
      item.type === 'file' &&
      (itemType === 'image' || itemType === 'video')
    ) {
      const encodedPath = itemPath
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/')
      previewUrl = item.url || `${apiBasePath}/${encodedPath}`
      if (itemType === 'image' && !item.name.toLowerCase().endsWith('.gif')) {
        previewUrl += previewSize
      }
    }
    let cursorClass = ''
    if (itemType === 'directory') {
      cursorClass = 'cursor-pointer'
    } else if (
      (itemType === 'image' || itemType === 'video' || itemType === 'audio') &&
      previewUrl
    ) {
      cursorClass = 'cursor-default'
    } else {
      cursorClass = 'cursor-help'
    }
    // same here with the styling
    const fileItemClasses = `group block h-full p-0 m-0 border border-white/10 rounded-xl text-white pointer-events-auto box-border overflow-hidden select-none`
    html += `<div id="file-item ${item.type}" class="file-item ${item.type} ${fileItemClasses} ${cursorClass}" data-type="${itemType}" data-file-type="${itemType}" data-path="${itemPath}">`
    if (itemType === 'directory') {
      html += `<div class="file-icon ${itemType}">${icons[itemType]}</div>`
      html += `<div class="group block bottom-0 left-0 right-0 bg-gray-800/85 p-2 border-t border-white/10">
      <div class="text-white text-decoration-none text-nowrap overflow-hidden text-ellipsis">${item.name}</div>
        <div class="text-gray-300 text-sm text-nowrap overflow-hidden text-ellipsis">
          <span>${utils.formatDate(item.modified)}</span>
          <br />
          <span>${utils.formatSize(item.size)}</span>
        </div>
      </div>`
    } else if (
      (itemType === 'image' || itemType === 'video' || itemType === 'audio') &&
      previewUrl
    ) {
      if (itemType === 'audio') {
        html += `
          <div id="audio-preview-container" class="w-full h-full bg-transparent flex items-center justify-center overflow-hidden select-none">
            <audio class="file-preview audio loading w-full h-auto object-contain select-none" data-src="${previewUrl}" alt="${item.name}" preload="none" onmouseover="if(this.src) { this.play(); this.muted=false; }" onmouseout="if(this.src) { this.pause(); this.currentTime=0; this.muted=true; }" draggable="false"></audio>
          </div>`
      }
      if (itemType === 'image') {
        html += `
          <div id="image-preview-container" class="w-full h-full bg-transparent flex items-center justify-center overflow-hidden select-none">
            <img class="file-preview loading w-full h-auto object-contain select-none" data-src="${previewUrl}" alt="${item.name}" preload="none" draggable="false">
          </div>`
      }
      if (itemType === 'video') {
        html += `
          <div id="video-preview-container" class="w-full h-full bg-transparent flex items-center justify-center overflow-hidden select-none">
            <video class="file-preview video loading w-full h-auto object-contain select-none" data-src="${previewUrl}" alt="${item.name}" preload="none" onmouseover="if(this.src) { this.play(); this.muted=false; }" onmouseout="if(this.src) { this.pause(); this.currentTime=0; this.muted=true; }" draggable="false"></video>
          </div>`
      }
      html += `
        <div class="file-details absolute left-4 right-4 bottom-4 bg-gray-800/85 p-2 hidden group-hover:block">
          <div class="text-white text-decoration-none text-nowrap overflow-hidden text-ellipsis">${item.name}</div>
          <div class="text-gray-300 text-sm text-nowrap overflow-hidden text-ellipsis">
            <span>${utils.formatDate(item.modified)}</span><br>
            <span>${utils.formatSize(item.size)}</span>
          </div>
        </div>`
    } else {
      html += `<div class="file-icon ${itemType}">${icons[itemType] || icons.other}</div>`
      html += `<div class="file-details block">
        <div class="text-white text-decoration-none text-nowrap overflow-hidden text-ellipsis">${item.name}</div>
        <div class="text-gray-300 text-sm text-nowrap overflow-hidden text-ellipsis">
          <span>${utils.formatDate(item.modified)}</span><br>
          <span>${utils.formatSize(item.size)}</span>
        </div>
      </div>`
    }
    html += `</div>`
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
  if (hasFiles) {
    setupLazyLoading()
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
    currentSort = 'name'
    currentSortDir = 'none'
    Object.keys(SORT_STATES).forEach((key) => (SORT_STATES[key] = 'none'))
  }
}
async function init() {
  if (isInitialized) return
  isInitialized = true
  await loadIcons()
  getSortFromQuery()
  setupViewerEvents()
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
