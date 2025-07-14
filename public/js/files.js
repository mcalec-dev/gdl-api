import {
  formatSize,
  formatDate,
  apiHost,
  getFileType,
} from '../min/index.min.js'
let frontendBasePath = '/gdl/files'
let apiBasePath = '/gdl/api/files'
const previewSize = '?x=50'
const zoomedSize = '?x=400'
const fileList = document.getElementById('fileList')
const breadcrumb = document.getElementById('breadcrumb')
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
const icons = {
  directory:
    '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8z"/></svg>',
  other:
    '<svg viewBox="0 0 24 24"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm7 7V3.5L18.5 9z"/></svg>',
}
let currentDirectoryData = null
let currentImageIndex = 0
let currentImageList = []
let currentSort = 'name'
let currentSortDir = 'none'
let currentFetchController = null
let imageLoadControllers = new Map()
const SORT_STATES = {
  name: 'none',
  size: 'none',
  type: 'none',
  modified: 'none',
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
function updateBreadcrumb(path) {
  const parts = path.split('/').filter(Boolean)
  let currentPath = ''
  let breadcrumbHtml = `<a href="${frontendBasePath}/">Home</a>`
  parts.forEach((part, index) => {
    currentPath += `/${part}`
    if (index < parts.length - 1) {
      breadcrumbHtml += `<span>/</span><a href="${frontendBasePath}${currentPath}/">${part}</a>`
    } else {
      breadcrumbHtml += `<span>/</span><span>${part}</span><span>/</span>`
    }
  })
  breadcrumb.innerHTML = breadcrumbHtml
}
function renderSortToolbar() {
  const sortToolbarHtml = `
    <button class="sort-button" data-sort="name">
      <span>Name</span>
      <span class="sort-icon">${getSortIcon(SORT_STATES.name)}</span>
    </button>
    <button class="sort-button" data-sort="size">
      <span>Size</span>
      <span class="sort-icon">${getSortIcon(SORT_STATES.size)}</span>
    </button>
    <button class="sort-button" data-sort="type">
      <span>Type</span>
      <span class="sort-icon">${getSortIcon(SORT_STATES.type)}</span>
    </button>
    <button class="sort-button" data-sort="modified">
      <span>Modified</span>
      <span class="sort-icon">${getSortIcon(SORT_STATES.modified)}</span>
    </button>
    <button class="sort-button" data-sort="created">
      <span>Created</span>
      <span class="sort-icon">${getSortIcon(SORT_STATES.created)}</span>
    </button>
  `
  document.querySelector('.sort-toolbar').innerHTML = sortToolbarHtml
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
      case 'size':
        comparison = (a.size || 0) - (b.size || 0)
        break
      case 'type': {
        const extA = a.name.split('.').pop() || ''
        const extB = b.name.split('.').pop() || ''
        comparison = extA.localeCompare(extB)
        break
      }
      case 'modified':
        comparison = new Date(a.modified || 0) - new Date(b.modified || 0)
        break
      case 'created':
        comparison = new Date(a.created || 0) - new Date(b.created || 0)
        break
    }
    return direction === 'asc' ? comparison : -comparison
  })
}
async function loadDirectory(path = '', callback) {
  try {
    if (currentFetchController) {
      currentFetchController.abort()
    }
    cancelImageLoads()
    currentFetchController = new AbortController()
    const { signal } = currentFetchController
    path = path ? decodeURIComponent(path) : ''
    if (path) {
      const frontendBasePathEscaped = escapeRegExp(frontendBasePath)
      path = path
        .replace(new RegExp(`^${frontendBasePathEscaped}/?`), '')
        .replace(/\/+/g, '/')
        .replace(/^\/|\/$/g, '')
    }
    const loadingIndicator = document.createElement('div')
    loadingIndicator.className = 'loading'
    loadingIndicator.innerHTML = '<span>Loading...</span>'
    fileList.appendChild(loadingIndicator)
    updateBreadcrumb(path)
    const apiPath = path ? `/${path}/` : ''
    if (!currentDirectoryData || currentDirectoryData.path !== path) {
      const response = await fetch(`${apiBasePath}${apiPath}`, { signal })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Unknown error occurred')
      }
      currentDirectoryData = { path, contents: data.contents }
    }
    fileList.removeChild(loadingIndicator)
    const isRoot = !path
    const shouldUseGridView =
      !isRoot &&
      currentDirectoryData.contents.some((item) => item.type === 'file')
    fileList.classList.toggle('grid-view', shouldUseGridView)
    renderDirectory(currentDirectoryData.contents, path)
    if (callback) {
      callback()
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      fileList.innerHTML = `
        <div class="error">
            Error loading directory contents<br>
            <small>${error.message}</small>
        </div>`
    }
  }
}
function setupFileClickHandlers() {
  const fileList = document.getElementById('fileList')
  fileList.addEventListener('click', (event) => {
    const media = event.target.closest(
      '.file-item[data-type="image"], .file-item[data-type="video"]'
    )
    if (media) {
      event.preventDefault()
      currentImageList = Array.from(
        fileList.querySelectorAll(
          '.file-item[data-type="image"], .file-item[data-type="video"]'
        )
      ).map((media) => {
        const preview = media.querySelector('img, video')
        const mediaPath = media.dataset.path
        const fileType = getFileType(mediaPath)
        const encodedPath = mediaPath
          .split('/')
          .map((part) => encodeURIComponent(part))
          .join('/')
        return {
          name: mediaPath.split('/').pop(),
          path: mediaPath,
          type: fileType,
          encodedPath,
          previewSrc: preview?.dataset.src?.split('?')[0] || null,
        }
      })
      currentImageIndex = currentImageList.findIndex(
        (item) => item.path === media.dataset.path
      )
      showImagePopup(currentImageIndex)
    }
  })
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
  loadDirectory(currentPath)
})
const initialLocation = window.location.pathname
const frontendBasePathEscaped = escapeRegExp(frontendBasePath)
const currentPath =
  initialLocation === frontendBasePath ||
  initialLocation === `${frontendBasePath}/`
    ? ''
    : initialLocation
        .replace(new RegExp(`^${frontendBasePathEscaped}/?`), '')
        .replace(/\/+/g, '/')
        .replace(/^\/|\/$/g, '')
loadDirectory(currentPath)
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
            const controller = new AbortController()
            imageLoadControllers.set(element, controller)
            if (element.tagName.toLowerCase() === 'video') {
              element.preload = 'metadata'
              element.src = element.dataset.src
              element.muted = true
              element.classList.remove('loading')
              imageLoadControllers.delete(element)
            } else {
              element.src = element.dataset.src
              element.onload = () => {
                element.classList.remove('loading')
                imageLoadControllers.delete(element)
              }
              element.onerror = () => {
                console.error('Failed to load:', element.dataset.src)
                element.classList.remove('loading')
                element.classList.add('error')
                imageLoadControllers.delete(element)
              }
            }
          }
        } else {
          if (!element.classList.contains('zoomed')) {
            if (element.tagName.toLowerCase() === 'video') {
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
      rootMargin: '50px 0px',
      threshold: 0.1,
    }
  )
  document.querySelectorAll('.file-preview').forEach((element) => {
    window.lazyLoadObserver.observe(element)
  })
}
function cancelImageLoads() {
  imageLoadControllers.forEach((controller, element) => {
    controller.abort()
    element.src = ''
    if (element.tagName.toLowerCase() === 'video') {
      element.load()
    }
    element.classList.add('loading')
  })
  imageLoadControllers.clear()
}
function handleDirectoryClick(event) {
  const target = event.target.closest('.file-item.directory')
  if (!target) return
  event.preventDefault()
  const itemPath = target.dataset.path
  if (!itemPath) return
  let newPath = `${frontendBasePath}/${itemPath}`.replace(/\/+/g, '/')
  if (!newPath.endsWith('/')) newPath += '/'
  const cleanPath = itemPath.replace(new RegExp(`^${frontendBasePath}/?`), '')
  const url = new URL(window.location.href)
  const params = url.search
  history.pushState({ path: cleanPath }, '', newPath + params)
  loadDirectory(cleanPath)
  window.scrollTo(0, 0)
}
function getMediaUrl(item) {
  return item.previewSrc || `${apiBasePath}/${item.encodedPath}`
}
function preloadMedia(item) {
  if (!item || item.type === 'video') return
  const preloadImg = document.createElement('img')
  preloadImg.src = getMediaUrl(item)
}
function showImagePopup(index) {
  if (index < 0 || index >= currentImageList.length) return
  const item = currentImageList[index]
  const popupViewer = document.getElementById('popup-viewer')
  const popupImage = document.getElementById('popup-image')
  const popupVideo = document.getElementById('popup-video')
  const imageTitle = document.getElementById('image-title')
  const imageCounter = document.getElementById('image-counter')
  const prevButton = document.getElementById('prev-image')
  const nextButton = document.getElementById('next-image')
  popupImage.style.display = 'none'
  popupVideo.style.display = 'none'
  const url = getMediaUrl(item)
  if (item.type === 'video') {
    popupVideo.src = url
    popupVideo.style.display = 'block'
  } else {
    popupImage.src = url
    popupImage.style.display = 'block'
    popupImage.style.cursor = 'zoom-in'
  }
  imageTitle.textContent = item.name
  imageCounter.textContent = `${index + 1} / ${currentImageList.length}`
  prevButton.disabled = index === 0
  nextButton.disabled = index === currentImageList.length - 1
  popupViewer.style.display = 'flex'
  currentImageIndex = index
  if (index > 0) {
    preloadMedia(currentImageList[index - 1])
  }
  if (index < currentImageList.length - 1) {
    preloadMedia(currentImageList[index + 1])
  }
}
function setupImagePopupEvents() {
  const popupViewer = document.getElementById('popup-viewer')
  const closeButton = document.getElementById('close-popup')
  const newTabButton = document.getElementById('open-new-tab')
  const prevButton = document.getElementById('prev-image')
  const nextButton = document.getElementById('next-image')
  const popupImage = document.getElementById('popup-image')
  const popupVideo = document.getElementById('popup-video')
  let isZoomed = false
  function closePopup() {
    if (!popupVideo.paused) {
      popupVideo.pause()
    }
    if (isZoomed) {
      handleZoom(0, 0)
    }
    popupImage.src = ''
    popupVideo.src = ''
    popupViewer.style.display = 'none'
  }
  newTabButton.addEventListener('click', () => {
    const item = currentImageList[currentImageIndex]
    const fullUrl = getMediaUrl(item)
    window.open(fullUrl, '_blank')
  })
  closeButton.addEventListener('click', closePopup)
  popupViewer.addEventListener('click', (e) => {
    if (e.target === popupViewer) {
      closePopup()
    }
  })
  prevButton.addEventListener('click', () => {
    if (currentImageIndex > 0) {
      if (isZoomed) {
        handleZoom(0, 0)
      }
      showImagePopup(currentImageIndex - 1)
    }
  })
  nextButton.addEventListener('click', () => {
    if (currentImageIndex < currentImageList.length - 1) {
      if (isZoomed) {
        handleZoom(0, 0)
      }
      showImagePopup(currentImageIndex + 1)
    }
  })
  document.addEventListener('keydown', (e) => {
    if (popupViewer.style.display === 'flex') {
      switch (e.key) {
        case 'Escape':
          closePopup()
          break
        case 'ArrowLeft':
          if (currentImageIndex > 0) {
            if (isZoomed) {
              handleZoom(0, 0)
            }
            showImagePopup(currentImageIndex - 1)
          }
          break
        case 'ArrowRight':
          if (currentImageIndex < currentImageList.length - 1) {
            if (isZoomed) {
              handleZoom(0, 0)
            }
            showImagePopup(currentImageIndex + 1)
          }
          break
      }
    }
  })
  function handleZoom(x, y) {
    if (isZoomed) {
      const item = currentImageList[currentImageIndex]
      const originalUrl = getMediaUrl(item)
      popupImage.src = originalUrl
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
      const item = currentImageList[currentImageIndex]
      const highResUrl = getMediaUrl(item) + zoomedSize
      popupImage.src = highResUrl
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
  popupImage.addEventListener('click', (e) => {
    handleZoom(e.clientX, e.clientY)
  })
}
function setupSortButtons() {
  document.querySelectorAll('.sort-button').forEach((button) => {
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
  const isRoot = !path
  const shouldUseGridView =
    !isRoot && contents.some((item) => item.type === 'file')
  fileList.classList.toggle('grid-view', shouldUseGridView)
  const sortedContents = sortContents(contents, currentSort, currentSortDir)
  renderSortToolbar()
  let html = ''
  for (const item of sortedContents) {
    const itemPath = path ? `${path}/${item.name}` : item.name
    let itemType = 'directory'
    if (item.type === 'file') {
      try {
        itemType = await getFileType(item.name)
      } catch (e) {
        console.warn(`Error detecting type for ${item.name}`, e)
        itemType = 'other'
      }
    }
    let previewUrl = null
    if (item.type === 'file') {
      const encodedPath = itemPath
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/')
      previewUrl = item.url || `${apiBasePath}/${encodedPath}`
      if (itemType === 'image' && !item.name.toLowerCase().endsWith('.gif')) {
        previewUrl += previewSize
      }
    }
    html += `<div class="file-item ${item.type}" data-type="${itemType}" data-path="${itemPath}">`
    if (itemType === 'directory') {
      html += `<div class="file-icon ${itemType}">${icons[itemType]}</div>`
    } else if (previewUrl) {
      if (itemType === 'video') {
        html += `<div class="video-preview-container">
          <video 
            class="file-preview video loading" 
            data-src="${previewUrl}"
            preload="none"
            onmouseover="if(this.src) { this.play(); this.muted=false; }" 
            onmouseout="if(this.src) { this.pause(); this.currentTime=0; this.muted=true; }"
            draggable="false"
          ></video>
        </div>`
      } else if (itemType === 'image') {
        html += `<div class="preview-container">
          <img class="file-preview loading" data-src="${previewUrl}" alt="${item.name}" draggable="false">
        </div>`
      } else {
        html += `<div class="file-icon ${itemType}">${icons[itemType]}</div>`
      }
    } else {
      html += `<div class="file-icon ${itemType}">${icons[itemType]}</div>`
    }
    html += `<div class="file-details">
      <div class="file-name">${item.name}</div>
      <div class="file-meta">
        <span>${formatDate(item.modified)}</span><br>
        <span>${formatSize(item.size)}</span>
      </div>
    </div>
    </div>`
  }
  fileList.innerHTML = html
  setupSortButtons()
  setupFileClickHandlers()
  if (shouldUseGridView) {
    setupLazyLoading()
  }
}
setupImagePopupEvents()
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
document.addEventListener('DOMContentLoaded', async () => {
  const apiBase = await apiHost()
  apiBasePath = `${apiBase}/files`
  getSortFromQuery()
  const frontendBasePathEscaped = escapeRegExp(frontendBasePath)
  const initialPath = window.location.pathname.replace(
    new RegExp(`^${frontendBasePathEscaped}`),
    ''
  )
  loadDirectory(initialPath)
})
document.addEventListener('click', handleDirectoryClick)
