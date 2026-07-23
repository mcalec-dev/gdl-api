'use strict'
import * as utils from '../min/index.min.js'
import { MIN_IMAGE_SCALE } from '../min/settings.min.js'

const API_URL = '/api/search'

const searchInput = document.getElementById('searchInput')
const searchButton = document.getElementById('searchButton')
const loading = document.getElementById('loading')
const results = document.getElementById('results')
const noResults = document.getElementById('noResults')
const searchInfo = document.getElementById('searchInfo')
const searchTypeButtons = document.querySelectorAll('input[name="searchType"]')
let observer = null

let icons = {}
async function loadIcons() {
  try {
    const i = await utils.getIcons()
    icons = i
  } catch (e) {
    icons = {}
  }
}

function getSearchType() {
  const type = document.querySelector('input[name="searchType"]:checked').value
  return type === 'Hash' ? 'hash' : type
}
function formattedUrl(url, type) {
  try {
    const u = new URL(url, window.location.origin)
    if (u.pathname.includes('/api/files')) {
      return `${u.origin}${u.pathname.replace(/^\/api\/files\//, '/files/')}${u.search}${u.hash}`
    }
    return u.toString()
  } catch (err) {
    return url
  }
}

function setupObserver() {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target
          if (img.classList.contains('loading')) {
            img.addEventListener('load', () => img.classList.remove('loading'))
            observer.unobserve(img)
          }
        }
      })
    },
    {
      rootMargin: '50px 0px',
      threshold: 0.1,
    }
  )
}

async function performSearch(query) {
  if (query.length < 3) {
    results.style.display = 'none'
    searchInfo.style.display = 'none'
    noResults.style.display = 'block'
    noResults.textContent = 'Please enter at least 3 characters'
    return
  }

  loading.style.display = 'block'
  results.style.display = 'none'
  searchInfo.style.display = 'none'
  noResults.style.display = 'none'
  results.innerHTML = ''

  try {
    const newUrl = new URL(window.location)
    newUrl.searchParams.set('q', query)
    const searchType = getSearchType()
    newUrl.searchParams.set('type', searchType)
    window.history.pushState({}, '', newUrl)

    const searchUrl = new URL(API_URL, window.location.origin)
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('type', searchType)
    let response
    try {
      response = await fetch(searchUrl)
    } catch (err) {
      utils.handleError(err)
      loading.style.display = 'none'
      searchInfo.style.display = 'none'
      noResults.style.display = 'block'
      noResults.textContent = err.message
      return
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      utils.handleError(new Error(`Search failed: ${response.status}`))
      loading.style.display = 'none'
      searchInfo.style.display = 'none'
      noResults.style.display = 'block'
      noResults.textContent = text || 'Search failed'
      return
    }
    const data = await response.json()
    loading.style.display = 'none'
    if (data.results?.length > 0) {
      searchInfo.style.display = 'block'
      const type = getSearchType()
      const typeLabel =
        type === 'file'
          ? 'files'
          : type === 'directory'
            ? 'directories'
            : type === 'uuid'
              ? 'files by UUID'
              : type === 'hash'
                ? 'files by hash'
                : 'items'
      searchInfo.textContent = `Found ${data.count} ${typeLabel} matching "${data.query}"`
      results.style.display = 'grid'
      const fragment = document.createDocumentFragment()
      data.results.forEach((result) => {
        const card = document.createElement('div')
        card.classList =
          'bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden backdrop-blur-sm transition-colors h-fit'
        const isVideo =
          result.type === 'file' && /\.(mp4|webm|mkv)$/i.test(result.name)
        if (result.type === 'directory') {
          card.innerHTML = `
              <div id="result-item directory" class="p-4 space-y-3">
                <div class="flex items-center gap-2 mb-1">
                  <span class="inline-flex h-5 w-5 items-center justify-center text-blue-400">
                    ${icons.search?.type || ''}
                  </span>
                  <h3 class="text-white font-light text-lg truncate flex-1" title="${result.name}">${result.name}</h3>
                </div>
                <span class="text-xs px-2 py-1 rounded-2xl ${
                  result.relevancy >= 80
                    ? 'bg-blue-500/20 text-blue-200'
                    : result.relevancy >= 60
                      ? 'bg-green-500/20 text-green-200'
                      : result.relevancy >= 40
                        ? 'bg-yellow-500/20 text-yellow-200'
                        : 'bg-gray-500/20 text-gray-200'
                }">
                  Score: ${Math.round(result.relevancy)} / 100
                </span>
                <div class="space-y-1.5">
                  <p class="text-gray-400 text-sm flex items-center gap-2">
                    <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center text-gray-400">${icons.search?.type || ''}</span>
                    ${result.type}
                  </p>
                  <p class="text-gray-400 text-sm flex items-center gap-2">
                    <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center text-gray-400">${icons.search?.collection || ''}</span>
                    ${result.collection}
                  </p>
                  <p class="text-gray-400 text-sm flex items-center gap-2">
                    <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center text-gray-400">${icons.search?.author || ''}</span>
                    ${result.author || 'Unknown'}
                  </p>
                </div>
                <div class="pt-3 flex justify-end">
                  <a href="${formattedUrl(result.url, result.type)}"
                    class="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded select-none"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center text-white/80">${icons.search?.external || ''}</span>
                    View ${result.type}
                  </a>
                </div>
              </div>
            `
        } else {
          card.innerHTML = `
              <div id="result-item file" class="aspect-square w-full overflow-hidden bg-gray-900/50">
                ${
                  isVideo
                    ? `<video src="${result.url}" controls preload="metadata" class="w-full h-full object-contain select-none" style="max-height:100%;"></video>`
                    : `<img src="${result.url}?scale=${MIN_IMAGE_SCALE}" alt="${result.name}" class="w-full h-full object-contain pointer-events-none select-none loading" loading="lazy">`
                }
              </div>
              <div class="p-4 space-y-3">
                <div class="flex items-start justify-between gap-2 mb-1">
                  <h3 class="text-white font-light text-lg truncate flex-1" title="${result.name}">${result.name}</h3>
                </div>
                <span class="text-xs px-2 py-1 rounded-2xl ${
                  result.relevancy >= 80
                    ? 'bg-blue-500/20 text-blue-200'
                    : result.relevancy >= 60
                      ? 'bg-green-500/20 text-green-200'
                      : result.relevancy >= 40
                        ? 'bg-yellow-500/20 text-yellow-200'
                        : 'bg-gray-500/20 text-gray-200'
                }">
                  Score: ${Math.round(result.relevancy)} / 100
                </span>
                <div class="space-y-1.5">
                  <p class="text-gray-400 text-sm flex items-center gap-2">
                    <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center text-gray-400">${icons.search?.type || ''}</span>
                    ${result.type}
                  </p>
                  <p class="text-gray-400 text-sm flex items-center gap-2">
                    <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center text-gray-400">${icons.search?.collection || ''}</span>
                    ${result.collection}
                  </p>
                  <p class="text-gray-400 text-sm flex items-center gap-2">
                    <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center text-gray-400">${icons.search?.author || ''}</span>
                    ${result.author || 'Unknown'}
                  </p>
                </div>
                <div class="pt-3 flex justify-end">
                  <a href="${formattedUrl(result.url, result.type)}"
                    class="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center text-white/80">${icons.search?.external || ''}</span>
                    View ${result.type}
                  </a>
                </div>
              </div>
            `
        }

        fragment.appendChild(card)
      })

      results.appendChild(fragment)

      document.querySelectorAll('img.loading').forEach((img) => {
        observer.observe(img)
      })
    } else {
      searchInfo.style.display = 'none'
      noResults.style.display = 'block'
      noResults.textContent = 'No results found'
    }
  } catch (error) {
    utils.handleError(error)
    loading.style.display = 'none'
    searchInfo.style.display = 'none'
    noResults.style.display = 'block'
    noResults.textContent = error.message
  }
}

async function init() {
  await loadIcons()
  setupObserver()

  searchButton.addEventListener('click', () => {
    const query = searchInput.value.trim()
    if (query) performSearch(query)
  })

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim()
      if (query) performSearch(query)
    }
  })

  searchTypeButtons.forEach((button) => {
    button.addEventListener('change', () => {
      const query = searchInput.value.trim()
      if (query) performSearch(query)
    })
  })

  const urlParams = new URLSearchParams(window.location.search)
  const initialQuery = urlParams.get('q')
  const initialType = urlParams.get('type')

  if (initialType) {
    const typeButton = document.querySelector(
      `input[name="searchType"][value="${initialType}"]`
    )
    if (typeButton) typeButton.checked = true
  }

  if (initialQuery) {
    searchInput.value = initialQuery
    performSearch(initialQuery)
  }
}

document.addEventListener('DOMContentLoaded', init)
