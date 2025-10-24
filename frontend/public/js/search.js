'use strict'
import * as utils from './index.js'
import { MIN_IMAGE_SCALE } from '../settings.js'
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput')
  const searchButton = document.getElementById('searchButton')
  const loading = document.getElementById('loading')
  const results = document.getElementById('results')
  const noResults = document.getElementById('noResults')
  const searchInfo = document.getElementById('searchInfo')
  const searchTypeButtons = document.querySelectorAll(
    'input[name="searchType"]'
  )
  const API_URL = '/api/search'
  const imageScale = `?x=${MIN_IMAGE_SCALE}`
  function getSearchType() {
    return document.querySelector('input[name="searchType"]:checked').value
  }
  function formattedUrl(url, type) {
    if (type === 'file') {
      return url
    } else if (type === 'directory') {
      return url.replace(/\/api\//, '/')
    }
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
      const response = await fetch(searchUrl).catch((error) => {
        utils.handleError(error)
        loading.style.display = 'none'
        searchInfo.style.display = 'none'
        noResults.style.display = 'block'
        noResults.textContent = error.message
      })
      const data = await response.json()
      loading.style.display = 'none'
      if (data.results?.length > 0) {
        searchInfo.style.display = 'block'
        const searchType = getSearchType()
        const typeLabel =
          searchType === 'files'
            ? 'files'
            : searchType === 'directories'
              ? 'directories'
              : 'items'
        searchInfo.textContent = `Found ${data.count} ${typeLabel} matching "${data.query}"`
        results.style.display = 'grid'
        const fragment = document.createDocumentFragment()
        data.results.forEach((result) => {
          const card = document.createElement('div')
          card.classList = `bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden backdrop-blur-sm transition-colors h-fit`
          const isVideo =
            result.type === 'file' && /\.(mp4|webm|mkv)$/i.test(result.name)
          card.innerHTML =
            result.type === 'directory'
              ? `
            <div id="result-item directory" class="p-4 space-y-3">
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
                  <svg class="w-4 h-4 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  ${result.type}
                </p>
                <p class="text-gray-400 text-sm flex items-center gap-2">
                  <svg class="w-4 h-4 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  ${result.collection}
                </p>
                <p class="text-gray-400 text-sm flex items-center gap-2">
                  <svg class="w-4 h-4 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  ${result.author || 'Unknown'}
                </p>
              </div>
              <div class="pt-3 flex justify-end">
                <a href="${formattedUrl(result.url, result.type)}" 
                  class="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded select-none" 
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                  View ${result.type}
                </a>
              </div>
            </div>
            `
              : `
            <div id="result-item file" class="aspect-square w-full overflow-hidden bg-gray-900/50">
              ${
                isVideo
                  ? `<video src="${result.url}" controls preload="metadata" class="w-full h-full object-contain select-none" style="max-height:100%;"></video>`
                  : `<img src="${result.url}${imageScale}" alt="${result.name}" class="w-full h-full object-contain pointer-events-none select-none loading" loading="lazy">`
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
                  <svg class="w-4 h-4 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  ${result.type}
                </p>
                <p class="text-gray-400 text-sm flex items-center gap-2">
                  <svg class="w-4 h-4 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  ${result.collection}
                </p>
                <p class="text-gray-400 text-sm flex items-center gap-2">
                  <svg class="w-4 h-4 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  ${result.author || 'Unknown'}
                </p>
              </div>
              <div class="pt-3 flex justify-end">
                <a href="${formattedUrl(result.url, result.type)}" 
                  class="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded" 
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                  View ${result.type}
                </a>
              </div>
            </div>
            `
          fragment.appendChild(card)
        })
        results.appendChild(fragment)
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const img = entry.target
                if (img.classList.contains('loading')) {
                  img.addEventListener('load', () => {
                    img.classList.remove('loading')
                  })
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
        document.querySelectorAll('.thumbnail.loading').forEach((img) => {
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
})
