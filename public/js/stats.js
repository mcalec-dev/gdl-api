import * as utils from './index.js'

/** @typedef {{count?: number, size?: number}} FileTypeStats */
/** @typedef {{files?: number, size?: number, lastModified?: string | number, largestFileSize?: number, smallestFileSize?: number}} CollectionStats */
/** @typedef {{heapUsed?: number, heapTotal?: number, rss?: number, external?: number, arrayBuffers?: number, formatted?: {heapUsed?: number, rss?: number}}} MemoryStats */
/** @typedef {{collections: {totalDirectories?: number, totalFiles?: number, totalSize?: number, averageFileSize?: number, largestFileSize?: number, smallestFileSize?: number, total?: number, fileTypes?: Record<string, FileTypeStats>, details?: Record<string, CollectionStats>}, api: {memory?: MemoryStats, timestamp?: string | number, version?: string, node?: string, uptime?: number}}} StatsResponse */
/** @typedef {'type' | 'count' | 'size'} FileTypeColumn */
/** @typedef {'name' | 'files' | 'size' | 'lastModified' | 'largest' | 'smallest'} CollectionColumn */
/** @typedef {'asc' | 'desc'} SortDirection */

const API_URL = '/api/stats'
/** @type {Record<string, FileTypeStats>} */
let fileTypesData = {}
/** @type {Record<string, CollectionStats>} */
let collectionDetailsData = {}
/** @type {{column: FileTypeColumn, direction: SortDirection}} */
let fileTypesSortConfig = { column: 'count', direction: 'desc' }
/** @type {{column: CollectionColumn, direction: SortDirection}} */
let collectionSortConfig = { column: 'files', direction: 'desc' }

/**
 * Returns an object-like API value.
 *
 * @param {unknown} value Candidate value.
 * @returns {value is Record<string, unknown>} Whether value is a plain record.
 */
function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/**
 * Converts a value to a finite number with a safe fallback.
 *
 * @param {unknown} value Candidate value.
 * @param {number} [fallback=0] Fallback number.
 * @returns {number} Finite number.
 */
function toNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * Sets text on an optional page element without rendering absent values.
 *
 * @param {string} id Element identifier.
 * @param {unknown} value Display value.
 * @returns {void}
 */
function setText(id, value) {
  const element = document.getElementById(id)
  if (!element) return
  element.textContent = utils.toDisplayText(value)
}

/**
 * Writes the visible loading, error, and content states for the statistics page.
 *
 * @param {boolean} loading Whether loading is active.
 * @param {string} [errorMessage=''] Error message to display.
 * @returns {void}
 */
function setPageState(loading, errorMessage = '') {
  const loadingElement = document.getElementById('loading')
  const errorElement = document.getElementById('error')
  const contentElement = document.getElementById('stats-content')
  if (loadingElement) loadingElement.hidden = !loading
  if (errorElement) {
    errorElement.textContent = errorMessage
    errorElement.hidden = !errorMessage
  }
  if (contentElement) contentElement.hidden = loading || Boolean(errorMessage)
}

/**
 * Formats an uptime value expressed in seconds.
 *
 * @param {unknown} seconds Uptime value.
 * @returns {string} Human-readable uptime.
 */
function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(toNumber(seconds)))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}m`)
  return parts.join(' ') || '< 1m'
}

/**
 * Renders file type totals using safe text and controlled markup.
 *
 * @returns {void}
 */
function renderFileTypes() {
  const container = document.getElementById('file-types')
  if (!container) return
  container.replaceChildren()

  const entries = Object.entries(fileTypesData)
  if (!entries.length) return
  const { column, direction } = fileTypesSortConfig
  entries.sort(([nameA, infoA], [nameB, infoB]) => {
    const valueA =
      column === 'type'
        ? nameA.toLowerCase()
        : toNumber(infoA[column === 'count' ? 'count' : 'size'])
    const valueB =
      column === 'type'
        ? nameB.toLowerCase()
        : toNumber(infoB[column === 'count' ? 'count' : 'size'])
    const order =
      typeof valueA === 'string' && typeof valueB === 'string'
        ? valueA.localeCompare(valueB)
        : Number(valueA) - Number(valueB)
    return direction === 'asc' ? order : -order
  })
  const totalSize = entries.reduce(
    (total, [, info]) => total + toNumber(info.size),
    0
  )

  for (const [type, info] of entries) {
    const percentage = totalSize ? (toNumber(info.size) / totalSize) * 100 : 0
    const row = document.createElement('tr')
    row.className =
      'hover:bg-[#232329] transition file-type border-b border-[#232329]'
    row.innerHTML = `
      <td class="px-2 py-2 font-mono text-white border border-[#232329]">${utils.escapeHtml(type)}</td>
      <td class="px-2 py-2 font-mono border border-[#232329]">${toNumber(info.count).toLocaleString()}</td>
      <td class="px-2 py-2 border border-[#232329]">
        <div class="flex flex-col gap-1"><div class="flex justify-between text-xs"><span class="font-mono">${utils.formatSize(toNumber(info.size))}</span><span class="text-gray-400">${percentage.toFixed(1)}%</span></div><div class="w-full bg-[#232329] rounded-full h-2 overflow-hidden"><div class="bg-blue-500 h-full rounded-full" style="width:${percentage}%"></div></div></div>
      </td>`
    container.appendChild(row)
  }
}

/**
 * Renders collection-level totals.
 *
 * @returns {void}
 */
function renderCollectionDetails() {
  const container = document.getElementById('collection-details')
  if (!container) return
  container.replaceChildren()
  const entries = Object.entries(collectionDetailsData)
  if (!entries.length) return
  const { column, direction } = collectionSortConfig
  entries.sort(([nameA, infoA], [nameB, infoB]) => {
    /** @param {string} name @param {CollectionStats} info @returns {string | number} */
    const lookup = (name, info) => {
      if (column === 'name') return name.toLowerCase()
      if (column === 'files') return toNumber(info.files)
      if (column === 'size') return toNumber(info.size)
      if (column === 'lastModified')
        return new Date(info.lastModified || 0).getTime()
      if (column === 'largest') return toNumber(info.largestFileSize)
      return toNumber(info.smallestFileSize, Number.MAX_SAFE_INTEGER)
    }
    const valueA = lookup(nameA, infoA)
    const valueB = lookup(nameB, infoB)
    const order =
      typeof valueA === 'string'
        ? valueA.localeCompare(String(valueB))
        : valueA - Number(valueB)
    return direction === 'asc' ? order : -order
  })
  const totalSize = entries.reduce(
    (total, [, info]) => total + toNumber(info.size),
    0
  )
  for (const [name, info] of entries) {
    const percentage = totalSize ? (toNumber(info.size) / totalSize) * 100 : 0
    const row = document.createElement('tr')
    row.className =
      'hover:bg-[#232329] transition collection-item border-b border-[#404040]'
    row.innerHTML = `
      <td class="px-2 py-2 font-mono text-white border border-[#404040]">${utils.escapeHtml(name)}</td>
      <td class="px-2 py-2 font-mono border border-[#404040]">${toNumber(info.files).toLocaleString()}</td>
      <td class="px-2 py-2 border border-[#404040]"><div class="flex flex-col gap-1"><div class="flex justify-between text-xs"><span class="font-mono">${utils.formatSize(toNumber(info.size))}</span><span class="text-gray-400">${percentage.toFixed(1)}%</span></div><div class="w-full bg-[#232329] rounded-full h-2 overflow-hidden"><div class="bg-green-500 h-full rounded-full" style="width:${percentage}%"></div></div></div></td>
      <td class="px-2 py-2 text-xs text-gray-400 border border-[#404040]">${utils.escapeHtml(utils.formatDate(info.lastModified || ''))}</td>
      <td class="px-2 py-2 text-xs text-gray-400 border border-[#404040]">${utils.formatSize(toNumber(info.largestFileSize))}</td>
      <td class="px-2 py-2 text-xs text-gray-400 border border-[#404040]">${utils.formatSize(toNumber(info.smallestFileSize))}</td>`
    container.appendChild(row)
  }
}

/**
 * Renders process memory statistics.
 *
 * @param {MemoryStats | undefined} memory API memory payload.
 * @returns {void}
 */
function updateMemoryStats(memory) {
  const container = document.getElementById('memory-stats')
  if (!container) return
  container.replaceChildren()
  if (!memory) return
  const heapUsed = toNumber(memory.heapUsed ?? memory.formatted?.heapUsed)
  const heapTotal = toNumber(memory.heapTotal)
  const items = [
    [
      'Heap Used',
      utils.formatSize(heapUsed),
      heapTotal ? `${((heapUsed / heapTotal) * 100).toFixed(1)}%` : '',
    ],
    [
      'RSS',
      utils.formatSize(toNumber(memory.rss ?? memory.formatted?.rss)),
      '',
    ],
    ['External', utils.formatSize(toNumber(memory.external)), ''],
    ['Array Buffers', utils.formatSize(toNumber(memory.arrayBuffers)), ''],
  ]
  for (const [label, value, percentage] of items) {
    const item = document.createElement('div')
    item.className =
      'flex justify-between px-2 py-1 rounded hover:bg-[#232329] transition memory-item'
    item.textContent = `${label}: ${value}${percentage ? ` (${percentage})` : ''}`
    container.appendChild(item)
  }
}

/**
 * Renders API process metadata.
 *
 * @param {StatsResponse} data Parsed statistics response.
 * @returns {void}
 */
function updateSystemStats(data) {
  const container = document.getElementById('directory-list')
  if (!container) return
  container.replaceChildren()
  for (const [label, value] of [
    ['API Version', utils.toDisplayText(data.api.version, 'Unknown')],
    ['Node Version', utils.toDisplayText(data.api.node, 'Unknown')],
    ['Uptime', formatUptime(data.api.uptime)],
  ]) {
    const item = document.createElement('div')
    item.className =
      'flex justify-between px-2 py-1 rounded hover:bg-[#232329] transition directory-item'
    item.textContent = `${label}: ${value}`
    container.appendChild(item)
  }
}

/**
 * Binds table heading sorting controls.
 *
 * @returns {void}
 */
function bindSorting() {
  for (const header of document.querySelectorAll(
    '#file-types-table th.sortable'
  )) {
    if (!(header instanceof HTMLElement)) continue
    header.addEventListener('click', () => {
      const column = header.dataset.column
      if (!['type', 'count', 'size'].includes(String(column))) return
      fileTypesSortConfig = {
        column: /** @type {FileTypeColumn} */ (column),
        direction:
          fileTypesSortConfig.column === column &&
          fileTypesSortConfig.direction === 'desc'
            ? 'asc'
            : 'desc',
      }
      renderFileTypes()
    })
  }
  for (const header of document.querySelectorAll(
    '#collection-table th.sortable'
  )) {
    if (!(header instanceof HTMLElement)) continue
    header.addEventListener('click', () => {
      const column = header.dataset.column
      if (
        ![
          'name',
          'files',
          'size',
          'lastModified',
          'largest',
          'smallest',
        ].includes(String(column))
      )
        return
      collectionSortConfig = {
        column: /** @type {CollectionColumn} */ (column),
        direction:
          collectionSortConfig.column === column &&
          collectionSortConfig.direction === 'desc'
            ? 'asc'
            : 'desc',
      }
      renderCollectionDetails()
    })
  }
}

/**
 * Fetches and displays current statistics.
 *
 * @returns {Promise<void>} Resolves after the page state updates.
 */
async function updateStats() {
  setPageState(true)
  try {
    const payload = await utils.requestJson(utils.getAppUrl(API_URL), {
      credentials: 'same-origin',
    })
    if (
      !isRecord(payload) ||
      !isRecord(payload.collections) ||
      !isRecord(payload.api)
    ) {
      throw new Error('Invalid statistics response')
    }
    const data = /** @type {StatsResponse} */ (payload)
    fileTypesData = isRecord(data.collections.fileTypes)
      ? /** @type {Record<string, FileTypeStats>} */ (
          data.collections.fileTypes
        )
      : {}
    collectionDetailsData = isRecord(data.collections.details)
      ? /** @type {Record<string, CollectionStats>} */ (
          data.collections.details
        )
      : {}
    setText('total-directories', data.collections.totalDirectories)
    setText('total-files', data.collections.totalFiles)
    setText('total-size', utils.formatSize(data.collections.totalSize))
    setText(
      'average-file-size',
      utils.formatSize(data.collections.averageFileSize)
    )
    setText(
      'largest-file-size',
      utils.formatSize(data.collections.largestFileSize)
    )
    setText(
      'smallest-file-size',
      utils.formatSize(data.collections.smallestFileSize)
    )
    setText('total-collections', data.collections.total)
    setText(
      'refresh-time',
      data.api.timestamp
        ? `Last updated: ${utils.formatDate(data.api.timestamp)}`
        : ''
    )
    renderFileTypes()
    renderCollectionDetails()
    updateMemoryStats(data.api.memory)
    updateSystemStats(data)
    setPageState(false)
  } catch (error) {
    utils.handleError(error, 'Unable to load statistics')
    setPageState(
      false,
      utils.getErrorMessage(error, 'Unable to load statistics')
    )
  }
}

/**
 * Initializes the statistics page and its periodic refresh.
 *
 * @returns {void}
 */
function initStats() {
  bindSorting()
  void updateStats()
  window.setInterval(() => void updateStats(), 300000)
}

document.addEventListener('DOMContentLoaded', initStats)
