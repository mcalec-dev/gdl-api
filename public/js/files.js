import * as utils from './index.js'
import { initViewer, setupFileClickHandlers } from './viewer.js'
import {
  createContextMenu,
  setContextBasePaths,
  setContextIcons,
  setupFileItemContextMenu,
} from './contextmenu.js'
import { IMAGE_KERNEL, MIN_IMAGE_SCALE, PAGINATION } from './settings.js'
import { getMediaKind, getMediaKindFromMime } from './helpers/media.js'
import { readJsonCookie, writeJsonCookie } from './helpers/storage.js'

/** @typedef {'name' | 'modified' | 'type' | 'size' | 'created'} SortField */
/** @typedef {'asc' | 'desc' | 'none'} SortDirection */
/** @typedef {'directory' | 'image' | 'video' | 'audio' | 'text' | 'other'} FileKind */
/** @typedef {{name: string, type: 'file' | 'directory', size: number | null, modified: string | number | null, created: string | number | null, mime: string | null, url: string | null, uuid: string | null, hash: string | null}} FileEntry */
/** @typedef {{path: string, contents: FileEntry[], totalCount?: number}} DirectoryData */
/** @typedef {{directory: string, image: string, video: string, audio: string, text: string, other: string, back: string, sort: Record<SortDirection, string>, nav: Record<string, string>}} FileIcons */
/** @typedef {{sort: SortField, direction: SortDirection}} SortState */

const FILE_LIST_SELECTOR = '#file-list'
const SORT_FIELDS = /** @type {SortField[]} */ ([
  'name',
  'modified',
  'type',
  'size',
  'created',
])
const toolbarButtonClass =
  'flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-white backdrop-blur-md transition'

/** @type {DirectoryData | null} */
let currentDirectoryData = null
/** @type {AbortController | null} */
let currentFetchController = null
/** @type {SortState} */
let currentSort = { sort: 'name', direction: 'none' }
let currentSearch = ''
/** @type {FileIcons} */
let icons = {
  directory: '',
  image: '',
  video: '',
  audio: '',
  text: '',
  other: '',
  back: '',
  sort: { asc: '', desc: '', none: '' },
  nav: { next: '', prev: '', link: '', copy: '', download: '', refresh: '' },
}
let initialized = false

/** Returns the listing container when it exists on the current page. @returns {HTMLElement | null} Listing container. */
function getFileList() {
  const fileList = document.querySelector(FILE_LIST_SELECTOR)
  return fileList instanceof HTMLElement ? fileList : null
}

/** @param {unknown} value Candidate value. @returns {string | null} Normalized string. */
function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** @param {FileEntry} entry Listing entry. @returns {FileKind} Renderable file kind. */
function getEntryKind(entry) {
  if (entry.type === 'directory') return 'directory'
  const fromMime = getMediaKindFromMime(entry.mime)
  return fromMime === 'other' ? getMediaKind(entry.name) : fromMime
}

/** @param {string} path Relative directory path. @returns {string} URI-safe path without surrounding slashes. */
function encodePath(path) {
  return path.split('/').filter(Boolean).map(encodeURIComponent).join('/')
}

/** @param {string} value Candidate path. @returns {string} Relative normalized path. */
function normalizePath(value) {
  return value
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/')
}

/** @param {string} path Relative directory path. @returns {string} Application-relative directory URL. */
function getDirectoryUrl(path) {
  const suffix = encodePath(path)
  return utils.getAppUrl(`/files${suffix ? `/${suffix}` : ''}`)
}

/** @param {string} path Relative entry path. @returns {string} Absolute API media URL. */
function getFileUrl(path) {
  return `${window.location.origin}${utils.getAppUrl(`/api/files/${encodePath(path)}`)}`
}

/** @param {unknown} value Candidate value. @param {string} key Property name. @returns {unknown} Property value or undefined. */
function getRecordValue(value, key) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)[key]
    : undefined
}

/** @param {unknown} value API item. @returns {FileEntry | null} Normalized entry, or null when invalid. */
function normalizeEntry(value) {
  const name = optionalString(getRecordValue(value, 'name'))
  const type = getRecordValue(value, 'type')
  if (!name || (type !== 'file' && type !== 'directory')) return null
  const size = getRecordValue(value, 'size')
  const modified = getRecordValue(value, 'modified')
  const created = getRecordValue(value, 'created')
  return {
    name,
    type,
    size: typeof size === 'number' && Number.isFinite(size) ? size : null,
    modified:
      typeof modified === 'string' || typeof modified === 'number'
        ? modified
        : null,
    created:
      typeof created === 'string' || typeof created === 'number'
        ? created
        : null,
    mime: optionalString(getRecordValue(value, 'mime')),
    url: optionalString(getRecordValue(value, 'url')),
    uuid: optionalString(getRecordValue(value, 'uuid')),
    hash: optionalString(getRecordValue(value, 'hash')),
  }
}

/** @param {unknown} payload API response body. @returns {FileEntry[]} Safe listing entries. */
function normalizeListing(payload) {
  const contents = getRecordValue(payload, 'contents')
  const files = getRecordValue(payload, 'files')
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(contents)
      ? contents
      : Array.isArray(files)
        ? files
        : []
  return items.map(normalizeEntry).filter((entry) => entry !== null)
}

/** @param {string} tag Element tag name. @param {string} text Text content. @param {string} [className=''] CSS classes. @returns {HTMLElement} Created element. */
function createTextElement(tag, text, className = '') {
  const element = document.createElement(tag)
  element.textContent = text
  if (className) element.className = className
  return element
}

/** @param {HTMLElement} element Icon wrapper. @param {string} icon Trusted application icon SVG. @returns {void} */
function appendIcon(element, icon) {
  if (!icon) return
  element.insertAdjacentHTML('beforeend', icon)
  const svg = element.lastElementChild
  if (svg?.tagName.toLowerCase() === 'svg')
    svg.classList.add('h-4', 'w-4', 'shrink-0')
}

/** @param {FileEntry} entry Listing entry. @param {string} itemPath Relative entry path. @param {FileKind} kind Entry kind. @returns {string | null} Preview URL, or null. */
function getPreviewUrl(entry, itemPath, kind) {
  if (!['image', 'video', 'audio'].includes(kind)) return null
  let source = entry.url || getFileUrl(itemPath)
  try {
    const candidate = new URL(source, window.location.origin)
    if (candidate.origin !== window.location.origin) return null
    source = candidate.toString()
  } catch {
    return null
  }
  if (kind !== 'image') return source
  const parameters = /** @type {Record<string, string | number>} */ ({})
  if (typeof MIN_IMAGE_SCALE === 'number') parameters.scale = MIN_IMAGE_SCALE
  if (typeof IMAGE_KERNEL === 'string') parameters.kernel = IMAGE_KERNEL
  return utils.constructURL(source, parameters) || source
}

/** @param {FileEntry} entry Listing entry. @param {string} directory Current directory. @param {boolean} directoryOnly Whether the page has no files. @returns {HTMLDivElement} File-list card. */
function createFileCard(entry, directory, directoryOnly) {
  const itemPath = normalizePath(
    directory ? `${directory}/${entry.name}` : entry.name
  )
  const kind = getEntryKind(entry)
  const card = document.createElement('div')
  card.className = directoryOnly
    ? 'file-item group flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-white/20 bg-black/80 p-4 text-white select-none'
    : 'file-item group relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-black/80 text-white select-none'
  card.dataset.fileType = kind
  card.dataset.type = kind
  card.dataset.path = itemPath
  card.dataset.name = entry.name
  card.dataset.size = String(entry.size || 0)
  card.dataset.modified = entry.modified === null ? '' : String(entry.modified)
  if (entry.uuid) card.dataset.uuid = entry.uuid
  if (entry.hash) card.dataset.hash = entry.hash
  const icon = document.createElement('span')
  icon.className =
    'file-icon pointer-events-none flex h-8 w-8 flex-shrink-0 items-center justify-center'
  appendIcon(icon, icons[kind] || icons.other)

  if (kind === 'directory') {
    const details = document.createElement('div')
    details.className = 'min-w-0 flex-1'
    details.append(
      createTextElement(
        'div',
        entry.name,
        'overflow-hidden text-ellipsis text-nowrap'
      ),
      createTextElement(
        'div',
        utils.formatDate(entry.modified) || '',
        'text-sm text-gray-300'
      ),
      createTextElement(
        'div',
        utils.formatSize(entry.size) || '',
        'text-sm text-gray-300'
      )
    )
    card.append(icon, details)
    return card
  }

  const previewUrl = getPreviewUrl(entry, itemPath, kind)
  if (previewUrl && kind === 'image') {
    const image = document.createElement('img')
    image.className = 'file-preview h-full w-full object-contain'
    image.src = previewUrl
    image.alt = entry.name
    image.loading = 'lazy'
    image.draggable = false
    card.append(image)
  } else if (previewUrl && kind === 'video') {
    const video = document.createElement('video')
    video.className = 'file-preview h-full w-full object-contain'
    video.preload = 'metadata'
    video.muted = true
    video.src = previewUrl
    video.addEventListener('mouseenter', playPreview)
    video.addEventListener('mouseleave', resetPreview)
    card.append(video)
  } else if (previewUrl && kind === 'audio') {
    const audio = document.createElement('audio')
    audio.className = 'file-preview w-full'
    audio.controls = true
    audio.preload = 'metadata'
    audio.src = previewUrl
    card.append(icon, audio)
  } else {
    card.append(icon)
  }
  const details = document.createElement('div')
  details.className =
    'file-details absolute inset-x-0 bottom-0 z-10 bg-black/85 p-2 transition-opacity md:opacity-0 md:group-hover:opacity-100'
  details.append(
    createTextElement(
      'div',
      entry.name,
      'overflow-hidden text-ellipsis text-nowrap'
    ),
    createTextElement(
      'div',
      utils.formatDate(entry.modified) || '',
      'text-sm text-gray-300'
    ),
    createTextElement(
      'div',
      utils.formatSize(entry.size) || '',
      'text-sm text-gray-300'
    )
  )
  card.append(details)
  return card
}

/** @param {Event} event Mouse-enter event. @returns {void} */
function playPreview(event) {
  const video = event.currentTarget
  if (!(video instanceof HTMLVideoElement)) return
  void video.play().catch(() => {})
}

/** @param {Event} event Mouse-leave event. @returns {void} */
function resetPreview(event) {
  const video = event.currentTarget
  if (!(video instanceof HTMLVideoElement)) return
  video.pause()
  video.currentTime = 0
}

/** @param {FileEntry} entry Listing entry. @param {SortField} field Sort field. @returns {string | number} Comparable value. */
function getSortValue(entry, field) {
  if (field === 'size') return entry.size || 0
  if (field === 'modified')
    return entry.modified ? new Date(entry.modified).getTime() : 0
  if (field === 'created')
    return entry.created ? new Date(entry.created).getTime() : 0
  if (field === 'type') return entry.name.split('.').pop()?.toLowerCase() || ''
  return entry.name
}

/** @param {FileEntry[]} entries Listing entries. @returns {FileEntry[]} Sorted copy. */
function sortEntries(entries) {
  const { sort, direction } = currentSort
  return [...entries].sort((left, right) => {
    if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
    const leftValue = getSortValue(left, sort)
    const rightValue = getSortValue(right, sort)
    const comparison =
      typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), undefined, {
            numeric: true,
          })
    return direction === 'desc' ? -comparison : comparison
  })
}

/** @param {string} message Status text. @param {boolean} [isError=false] Whether it is a failure. @returns {void} */
function renderStatus(message, isError = false) {
  const fileList = getFileList()
  if (!fileList) return
  fileList.replaceChildren(
    createTextElement(
      'div',
      message,
      isError ? 'error text-red-200' : 'loading text-white'
    )
  )
}

/** Renders toolbar controls for the active listing. @returns {void} */
function renderToolbar() {
  const toolbar = document.getElementById('sort-toolbar')
  if (!(toolbar instanceof HTMLElement)) return
  toolbar.replaceChildren()
  toolbar.classList.remove('invisible')
  const search = document.createElement('input')
  search.id = 'file-search'
  search.type = 'search'
  search.placeholder = 'Filter'
  search.setAttribute('aria-label', 'Filter')
  search.value = currentSearch
  search.className =
    'rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white placeholder:text-gray-400 focus:border-white/50 focus:outline-none'
  search.addEventListener('input', () => {
    currentSearch = search.value.trim().toLocaleLowerCase()
    applySearchFilter()
  })
  const sortControls = document.createElement('div')
  sortControls.id = 'sort-controls'
  toolbar.append(sortControls, search)
  if (currentDirectoryData?.path) {
    const back = document.createElement('button')
    back.type = 'button'
    back.className = toolbarButtonClass
    back.append(createTextElement('span', 'Back'))
    appendIcon(back, icons.back)
    back.addEventListener('click', goToParentDirectory)
    sortControls.append(back)
  }
  for (const field of SORT_FIELDS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = toolbarButtonClass
    button.dataset.sort = field
    button.append(
      createTextElement('span', field[0].toUpperCase() + field.slice(1))
    )
    appendIcon(
      button,
      icons.sort[currentSort.sort === field ? currentSort.direction : 'none']
    )
    button.addEventListener('click', selectSort)
    sortControls.append(button)
  }
  const refresh = document.createElement('button')
  refresh.type = 'button'
  refresh.id = 'file-refresh'
  refresh.className = toolbarButtonClass
  refresh.title = 'Refresh directory'
  refresh.setAttribute('aria-label', 'Refresh directory')
  appendIcon(refresh, icons.nav.refresh)
  refresh.addEventListener('click', refreshDirectory)
  toolbar.append(refresh)
}

/** Filters rendered file cards without changing the server-paginated listing. @returns {void} */
function applySearchFilter() {
  const fileList = getFileList()
  if (!fileList) return
  const cards = [...fileList.querySelectorAll('.file-item')]
  let visibleCount = 0
  for (const card of cards) {
    if (!(card instanceof HTMLElement)) continue
    const matches = (card.dataset.name || '')
      .toLocaleLowerCase()
      .includes(currentSearch)
    card.hidden = !matches
    if (matches) visibleCount += 1
  }
  let emptyMessage = fileList.querySelector('[data-search-empty]')
  if (currentSearch && cards.length > 0 && visibleCount === 0) {
    if (!emptyMessage) {
      emptyMessage = createTextElement(
        'div',
        'No matching files.',
        'text-white'
      )
      emptyMessage.setAttribute('data-search-empty', 'true')
      fileList.append(emptyMessage)
    }
  } else {
    emptyMessage?.remove()
  }
}

/** @param {Event} event Sort button click. @returns {void} */
function selectSort(event) {
  const button = event.currentTarget
  if (!(button instanceof HTMLButtonElement)) return
  const field = button.dataset.sort
  if (!field || !SORT_FIELDS.includes(/** @type {SortField} */ (field))) return
  const typedField = /** @type {SortField} */ (field)
  const next =
    currentSort.sort !== typedField || currentSort.direction === 'none'
      ? 'asc'
      : currentSort.direction === 'asc'
        ? 'desc'
        : 'none'
  currentSort = { sort: typedField, direction: next }
  writeJsonCookie('fileSortState', currentSort)
  void navigateTo(currentDirectoryData?.path || '', true)
}

/** Navigates to the parent of the current directory. @returns {void} */
function goToParentDirectory() {
  const parent = (currentDirectoryData?.path || '')
    .split('/')
    .slice(0, -1)
    .join('/')
  void navigateTo(parent, true)
}

/** Reloads the active directory while bypassing its listing cache. @returns {void} */
function refreshDirectory() {
  void loadDirectory(currentDirectoryData?.path || '', true)
}

/** @param {URLSearchParams} search Query parameters. @param {string} key Parameter name. @param {number} fallback Fallback value. @returns {number} Parsed positive integer. */
function getPositiveInteger(search, key, fallback) {
  const value = Number.parseInt(search.get(key) || '', 10)
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

/** @param {URL} url URL to update. @param {boolean} resetPage Whether to reset the page number. @returns {void} */
function applyListingQuery(url, resetPage) {
  if (resetPage) url.searchParams.set('page', '1')
  if (PAGINATION.enabled && PAGINATION.limit > 0)
    url.searchParams.set('limit', String(PAGINATION.limit))
  else url.searchParams.delete('limit')
  for (const field of SORT_FIELDS) url.searchParams.delete(field)
  if (currentSort.direction !== 'none')
    url.searchParams.set(currentSort.sort, currentSort.direction)
}

/** @param {string} path Target relative directory. @param {boolean} [resetPage=false] Whether to reset pagination. @returns {Promise<void>} Resolves after rendering. */
async function navigateTo(path, resetPage = false) {
  const url = new URL(window.location.href)
  url.pathname = getDirectoryUrl(path)
  applyListingQuery(url, resetPage)
  window.history.pushState({}, '', url.pathname + url.search)
  await loadDirectory(path)
}

/** @param {string} path Relative directory. @param {boolean} forceRefresh Whether to bypass server cache. @returns {URL} API listing URL. */
function createListingUrl(path, forceRefresh) {
  const url = new URL(getFileUrl(path))
  const pageUrl = new URL(window.location.href)
  pageUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value))
  applyListingQuery(url, false)
  if (forceRefresh) url.searchParams.set('cache', 'false')
  return url
}

/** @param {string} path Relative directory. @param {boolean} [forceRefresh=false] Whether to bypass server cache. @returns {Promise<void>} Resolves after rendering or a handled error. */
async function loadDirectory(path, forceRefresh = false) {
  if (!getFileList()) return
  const normalizedPath = normalizePath(path)
  currentFetchController?.abort()
  currentFetchController = new AbortController()
  renderStatus('Loading...')
  try {
    const response = await fetch(
      createListingUrl(normalizedPath, forceRefresh),
      {
        credentials: 'same-origin',
        signal: currentFetchController.signal,
      }
    )
    if (!response.ok)
      throw new Error(`Unable to load directory (HTTP ${response.status})`)
    const body = await response.json()
    const totalCount = Number.parseInt(
      response.headers.get('x-total-count') || '',
      10
    )
    const normalizedContents = normalizeListing(body)
    currentDirectoryData = {
      path: normalizedPath,
      contents: normalizedContents,
      totalCount: Number.isFinite(totalCount)
        ? totalCount
        : normalizedContents.length,
    }
    renderDirectory(currentDirectoryData.contents)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return
    utils.handleError(error, 'Directory listing failed')
    renderStatus(
      utils.getErrorMessage(error, 'Unable to load directory contents'),
      true
    )
  }
}

/** @param {FileEntry[]} contents Current directory contents. @returns {void} */
function renderDirectory(contents) {
  const fileList = getFileList()
  if (!fileList || !currentDirectoryData) return
  const directoryPath = currentDirectoryData.path
  const sorted = sortEntries(contents)
  const directoryOnly =
    sorted.length > 0 && sorted.every((entry) => entry.type === 'directory')
  fileList.className = directoryOnly
    ? 'flex flex-col items-start gap-4'
    : 'grid grid-flow-dense auto-rows-[200px] grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3'
  if (sorted.length === 0)
    fileList.replaceChildren(
      createTextElement('div', 'This directory is empty.', 'text-white')
    )
  else
    fileList.replaceChildren(
      ...sorted.map((entry) =>
        createFileCard(entry, directoryPath, directoryOnly)
      )
    )
  renderToolbar()
  applySearchFilter()
  void setupFileClickHandlers(FILE_LIST_SELECTOR)
  renderPagination(sorted.length)
}

/** @param {MouseEvent} event Listing click event. @returns {void} */
function handleDirectoryClick(event) {
  const target = event.target
  const card =
    target instanceof HTMLElement
      ? target.closest('.file-item[data-file-type="directory"]')
      : null
  if (!(card instanceof HTMLElement)) return
  const path = optionalString(card.dataset.path)
  if (!path) return
  event.preventDefault()
  void navigateTo(path, true)
}

/** @param {number} itemCount Entry count returned for the current page. @returns {void} */
function renderPagination(itemCount) {
  const controls = document.getElementById('pagination-controls')
  const previous = document.getElementById('pager-prev')
  const next = document.getElementById('pager-next')
  const label = document.getElementById('pager-current')
  if (
    !(controls instanceof HTMLElement) ||
    !(previous instanceof HTMLButtonElement) ||
    !(next instanceof HTMLButtonElement) ||
    !(label instanceof HTMLElement)
  )
    return
  if (!PAGINATION.enabled || PAGINATION.limit <= 0) {
    controls.hidden = true
    return
  }
  const page = getPositiveInteger(
    new URL(window.location.href).searchParams,
    'page',
    1
  )
  const totalCount =
    currentDirectoryData && Number.isFinite(currentDirectoryData.totalCount)
      ? /** @type {number} */ (currentDirectoryData.totalCount)
      : Math.max(itemCount, 0)
  const nextDisabled = totalCount <= page * PAGINATION.limit
  const previousDisabled = page <= 1
  controls.hidden = false
  label.textContent = `Page ${page}`
  previous.replaceChildren()
  next.replaceChildren()
  appendIcon(previous, icons.nav.prev)
  appendIcon(next, icons.nav.next)
  if (!previous.textContent && !previous.querySelector('svg'))
    previous.textContent = 'Previous'
  if (!next.textContent && !next.querySelector('svg')) next.textContent = 'Next'
  previous.disabled = previousDisabled
  next.disabled = nextDisabled
  previous.onclick = () => {
    if (!previousDisabled) void changePage(page - 1)
  }
  next.onclick = () => {
    if (!nextDisabled) void changePage(page + 1)
  }
}

/** @param {number} page Target page. @returns {Promise<void>} Resolves after the new page loads. */
async function changePage(page) {
  const url = new URL(window.location.href)
  url.searchParams.set('page', String(Math.max(1, page)))
  applyListingQuery(url, false)
  window.history.replaceState({}, '', url.pathname + url.search)
  await loadDirectory(currentDirectoryData?.path || '')
}

/** Loads and narrows the icon catalog to the keys used by this page. @returns {Promise<void>} Resolves when icon loading completes. */
async function loadIcons() {
  const catalog = await utils.getIcons()
  /** @param {string} key Catalog group. @param {string} child Icon name. @returns {string} Icon markup. */
  const nested = (key, child) =>
    optionalString(getRecordValue(getRecordValue(catalog, key), child)) || ''
  icons = {
    directory: optionalString(getRecordValue(catalog, 'folder')) || '',
    image: nested('file', 'image'),
    video: nested('file', 'video'),
    audio: nested('file', 'audio'),
    text: nested('file', 'text'),
    other: nested('file', 'default'),
    back: nested('nav', 'back'),
    sort: {
      asc: nested('arrow', 'asc'),
      desc: nested('arrow', 'desc'),
      none: nested('arrow', 'default'),
    },
    nav: {
      next: nested('nav', 'next'),
      prev: nested('nav', 'prev'),
      link: nested('nav', 'link'),
      copy: nested('nav', 'copy'),
      download: nested('nav', 'download'),
      refresh: nested('arrow', 'refresh'),
    },
  }
}

/** Reads a valid persisted sort preference, then lets an explicit URL win. @returns {void} */
function loadSortState() {
  const saved = readJsonCookie(
    'fileSortState',
    /** @type {SortState} */ ({ sort: 'name', direction: 'none' })
  )
  if (
    SORT_FIELDS.includes(saved.sort) &&
    ['asc', 'desc', 'none'].includes(saved.direction)
  )
    currentSort = saved
  const url = new URL(window.location.href)
  for (const field of SORT_FIELDS) {
    const direction = url.searchParams.get(field)
    if (direction === 'asc' || direction === 'desc') {
      currentSort = { sort: field, direction }
      writeJsonCookie('fileSortState', currentSort)
      return
    }
  }
}

/** @returns {string} Initial relative directory path. */
function getInitialPath() {
  const filesBase = getDirectoryUrl('')
  const pathname = window.location.pathname
  const encodedPath = pathname.startsWith(filesBase)
    ? pathname.slice(filesBase.length)
    : ''
  const decodedPath = encodedPath
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .join('/')
  return normalizePath(decodedPath)
}

/** Initializes the files page once after its DOM has loaded. @returns {Promise<void>} Resolves after the first listing request completes. */
async function init() {
  if (initialized) return
  initialized = true
  if (!getFileList()) return
  try {
    await loadIcons()
    setContextIcons({
      directory: icons.directory,
      image: icons.image,
      video: icons.video,
      audio: icons.audio,
      text: icons.text,
      other: icons.other,
      nav: icons.nav,
    })
    setContextBasePaths(
      `${window.location.origin}${getDirectoryUrl('')}`,
      `${window.location.origin}${utils.getAppUrl('/api/files')}`
    )
    createContextMenu()
    setupFileItemContextMenu()
    await initViewer({ fileListSelector: FILE_LIST_SELECTOR })
    loadSortState()
    document.addEventListener('click', handleDirectoryClick)
    window.addEventListener('popstate', () => {
      void loadDirectory(getInitialPath())
    })
    const url = new URL(window.location.href)
    applyListingQuery(url, false)
    window.history.replaceState({}, '', url.pathname + url.search)
    await loadDirectory(getInitialPath())
  } catch (error) {
    utils.handleError(error, 'Files page initialization failed')
    renderStatus(
      utils.getErrorMessage(error, 'Unable to initialize file browser'),
      true
    )
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void init()
})
