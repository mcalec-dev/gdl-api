import * as utils from './index.js'
import { getMediaKind } from './helpers/media.js'
import { MIN_IMAGE_SCALE } from './settings.js'

/** @typedef {'all' | 'file' | 'directory' | 'uuid' | 'hash'} SearchType */
/** @typedef {{name?: string, type?: 'file' | 'directory', collection?: string, author?: string, url?: string, relevancy?: number}} SearchResult */
/** @typedef {{query?: string, count?: number, results?: SearchResult[]}} SearchResponse */

const API_URL = '/api/search'

/**
 * Returns a valid search type from an optional radio-input value.
 *
 * @param {unknown} value Candidate type.
 * @returns {SearchType} Valid type with an all-results fallback.
 */
function normalizeSearchType(value) {
  return ['all', 'file', 'directory', 'uuid', 'hash'].includes(String(value))
    ? /** @type {SearchType} */ (value)
    : 'all'
}

/**
 * Converts a backend file API URL to its user-facing files route.
 *
 * @param {unknown} value Candidate result URL.
 * @returns {string} Safe URL for opening the result.
 */
function formattedUrl(value) {
  const text = utils.toDisplayText(value)
  if (!text) return ''
  try {
    const url = new URL(text, window.location.origin)
    const apiRoot = utils.getAppUrl('/api/files')
    const browserRoot = utils.getAppUrl('/files')
    const normalizedPath = url.pathname
    if (
      normalizedPath === apiRoot ||
      normalizedPath.startsWith(`${apiRoot}/`)
    ) {
      const relativePath =
        normalizedPath === apiRoot ? '' : normalizedPath.slice(apiRoot.length)
      const browserPath = `${browserRoot}${relativePath || ''}`
      url.pathname = browserPath
      return url.toString()
    }
    return url.toString()
  } catch {
    return ''
  }
}

/**
 * Creates an element with class names and text content.
 *
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag HTML tag.
 * @param {string} [className=''] CSS classes.
 * @param {string} [text=''] Plain text content.
 * @returns {HTMLElementTagNameMap[K]} New element.
 */
function element(tag, className = '', text = '') {
  const created = document.createElement(tag)
  created.className = className
  created.textContent = text
  return created
}

/**
 * Creates a metadata paragraph in a search card.
 *
 * @param {string} label Metadata label.
 * @param {unknown} value Metadata value.
 * @returns {HTMLParagraphElement} Metadata paragraph.
 */
function metadata(label, value) {
  return element(
    'p',
    'text-gray-400 text-sm flex items-center gap-2',
    `${label}: ${utils.toDisplayText(value, 'Unknown')}`
  )
}

/**
 * Creates a result card without interpolating server values into HTML.
 *
 * @param {SearchResult} result Search result.
 * @returns {HTMLDivElement} Rendered result card.
 */
function createResultCard(result) {
  const card = element(
    'div',
    'bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden backdrop-blur-sm transition-colors h-fit'
  )
  const name = utils.toDisplayText(result.name, 'Untitled')
  const type = result.type === 'directory' ? 'directory' : 'file'
  const rawUrl = utils.toDisplayText(result.url)
  const destination = formattedUrl(rawUrl)
  const relevancy = Math.max(0, Math.min(100, Number(result.relevancy) || 0))

  if (type === 'file' && rawUrl) {
    const preview = element(
      'div',
      'aspect-square w-full overflow-hidden bg-gray-900/50'
    )
    const kind = getMediaKind(name)
    if (kind === 'video') {
      const video = document.createElement('video')
      video.src = rawUrl
      video.controls = true
      video.preload = 'metadata'
      video.className = 'w-full h-full object-contain select-none'
      preview.appendChild(video)
    } else if (kind === 'audio') {
      const audio = document.createElement('audio')
      audio.src = rawUrl
      audio.controls = true
      audio.preload = 'metadata'
      audio.className = 'w-full h-full object-contain select-none'
      preview.appendChild(audio)
    } else if (kind === 'image') {
      const image = document.createElement('img')
      image.src =
        utils.constructURL(rawUrl, { scale: MIN_IMAGE_SCALE }) || rawUrl
      image.alt = name
      image.loading = 'lazy'
      image.className =
        'w-full h-full object-contain pointer-events-none select-none'
      preview.appendChild(image)
    } else {
      const fallback = element(
        'div',
        'flex h-full w-full items-center justify-center bg-gray-950 text-2xl font-semibold text-gray-300'
      )
      const label = (name.split('.').pop() || 'file').slice(0, 4).toUpperCase()
      fallback.textContent = label || 'FILE'
      preview.appendChild(fallback)
    }
    card.appendChild(preview)
  }

  const details = element('div', 'p-4 space-y-3')
  details.appendChild(
    element('h3', 'text-white font-light text-lg truncate flex-1', name)
  )
  details.appendChild(
    element(
      'span',
      'text-xs px-2 py-1 rounded-2xl bg-blue-500/20 text-blue-200',
      `Score: ${Math.round(relevancy)} / 100`
    )
  )
  const metadataGroup = element('div', 'space-y-1.5')
  metadataGroup.append(
    metadata('Type', type),
    metadata('Collection', result.collection),
    metadata('Author', result.author)
  )
  details.appendChild(metadataGroup)
  if (destination) {
    const action = element('div', 'pt-3 flex justify-end')
    const link = element(
      'a',
      'inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded',
      `View ${type}`
    )
    link.href = destination
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    action.appendChild(link)
    details.appendChild(action)
  }
  card.appendChild(details)
  return card
}

/**
 * Returns a safe typed response from an unknown API payload.
 *
 * @param {unknown} payload API payload.
 * @returns {SearchResponse} Parsed response with safe defaults.
 */
function normalizeResponse(payload) {
  if (!payload || typeof payload !== 'object') return {}
  const data = /** @type {Record<string, unknown>} */ (payload)
  const candidates = Array.isArray(data.results) ? data.results : []
  return {
    query: utils.toDisplayText(data.query),
    count: typeof data.count === 'number' ? data.count : candidates.length,
    results: candidates.flatMap((candidate) => {
      if (!candidate || typeof candidate !== 'object') return []
      const result = /** @type {Record<string, unknown>} */ (candidate)
      return [
        {
          name: utils.toDisplayText(result.name),
          type: result.type === 'directory' ? 'directory' : 'file',
          collection: utils.toDisplayText(result.collection),
          author: utils.toDisplayText(result.author),
          url: utils.toDisplayText(result.url),
          relevancy:
            typeof result.relevancy === 'number' ? result.relevancy : 0,
        },
      ]
    }),
  }
}

/**
 * Initializes search controls and executes user searches.
 *
 * @returns {void}
 */
function initSearch() {
  const input = document.getElementById('searchInput')
  const button = document.getElementById('searchButton')
  const loading = document.getElementById('loading')
  const results = document.getElementById('results')
  const noResults = document.getElementById('noResults')
  const searchInfo = document.getElementById('searchInfo')
  if (
    !(input instanceof HTMLInputElement) ||
    !(button instanceof HTMLButtonElement) ||
    !loading ||
    !results ||
    !noResults ||
    !searchInfo
  )
    return

  /** @returns {SearchType} Current selected search type. */
  const getSearchType = () => {
    const selected = document.querySelector('input[name="searchType"]:checked')
    return selected instanceof HTMLInputElement
      ? normalizeSearchType(selected.value)
      : 'all'
  }
  /** @param {boolean} isLoading @returns {void} */
  const setLoading = (isLoading) => {
    loading.hidden = !isLoading
  }
  /** @param {string} message @returns {void} */
  const showNoResults = (message) => {
    noResults.textContent = message
    noResults.hidden = false
    results.hidden = true
    searchInfo.hidden = true
  }
  /** @param {string} query @returns {Promise<void>} */
  const performSearch = async (query) => {
    if (query.length < 3) {
      showNoResults('Please enter at least 3 characters')
      return
    }
    const type = getSearchType()
    setLoading(true)
    noResults.hidden = true
    results.replaceChildren()
    try {
      const pageUrl = new URL(window.location.href)
      pageUrl.searchParams.set('q', query)
      pageUrl.searchParams.set('type', type)
      window.history.pushState({}, '', pageUrl)
      const requestUrl = new URL(
        utils.getAppUrl(API_URL),
        window.location.origin
      )
      requestUrl.searchParams.set('q', query)
      requestUrl.searchParams.set('type', type)
      const data = normalizeResponse(
        await utils.requestJson(requestUrl, { credentials: 'same-origin' })
      )
      const items = data.results || []
      if (!items.length) {
        showNoResults('No results found')
        return
      }
      searchInfo.textContent = `Found ${data.count || items.length} ${type === 'all' ? 'items' : type + 's'} matching "${data.query || query}"`
      searchInfo.hidden = false
      results.hidden = false
      results.style.display = 'grid'
      results.append(...items.map(createResultCard))
    } catch (error) {
      utils.handleError(error, 'Search failed')
      showNoResults(utils.getErrorMessage(error, 'Search failed'))
    } finally {
      setLoading(false)
    }
  }
  button.addEventListener('click', () => void performSearch(input.value.trim()))
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void performSearch(input.value.trim())
    }
  })
  for (const control of document.querySelectorAll('input[name="searchType"]')) {
    if (!(control instanceof HTMLInputElement)) continue
    control.addEventListener('change', () => {
      if (input.value.trim()) void performSearch(input.value.trim())
    })
  }
  const params = new URLSearchParams(window.location.search)
  const requestedType = normalizeSearchType(params.get('type'))
  const matchingControl = document.querySelector(
    `input[name="searchType"][value="${requestedType}"]`
  )
  if (matchingControl instanceof HTMLInputElement)
    matchingControl.checked = true
  const query = params.get('q') || ''
  if (query) {
    input.value = query
    void performSearch(query)
  }
}

document.addEventListener('DOMContentLoaded', initSearch)
