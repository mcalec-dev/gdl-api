'use strict'
import * as utils from '../min/index.min.js'
document.addEventListener('DOMContentLoaded', function () {
  const API_URL = '/api/stats'
  let fileTypesData = {}
  let collectionDetailsData = {}
  let fileTypesSortConfig = { column: 'count', direction: 'desc' }
  let collectionSortConfig = { column: 'files', direction: 'desc' }
  async function updateStats() {
    const loading = document.getElementById('loading')
    const errorEl = document.getElementById('error')
    const content = document.getElementById('stats-content')
    try {
      const response = await fetch(API_URL)
      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`)
      const data = await response.json()
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
      fileTypesData = data.collections.fileTypes
      collectionDetailsData = data.collections.details
      renderFileTypes()
      renderCollectionDetails()
      updateMemoryStats(data.api.memory)
      updateSystemStats(data)
      setText(
        'refresh-time',
        `Last updated: ${new Date(data.api.timestamp).toLocaleString()}`
      )
      loading.style.display = 'none'
      errorEl.style.display = 'none'
      content.style.display = 'block'
    } catch (error) {
      utils.handleError(error)
      loading.style.display = 'none'
      errorEl.style.display = 'block'
      errorEl.textContent = error.message
    }
  }
  function setText(id, value) {
    const el = document.getElementById(id)
    if (el)
      el.textContent =
        value !== undefined && value !== null
          ? value.toLocaleString
            ? value.toLocaleString()
            : value
          : ''
  }
  function renderFileTypes() {
    const container = document.getElementById('file-types')
    if (!container) return
    if (!fileTypesData || Object.keys(fileTypesData).length === 0) {
      container.innerHTML = ''
      return
    }
    let sortedEntries = Object.entries(fileTypesData)
    const { column, direction } = fileTypesSortConfig
    sortedEntries.sort(([keyA, a], [keyB, b]) => {
      let aVal, bVal
      if (column === 'type') {
        aVal = keyA.toLowerCase()
        bVal = keyB.toLowerCase()
      } else if (column === 'count') {
        aVal = a.count ?? 0
        bVal = b.count ?? 0
      } else if (column === 'size') {
        aVal = a.size ?? 0
        bVal = b.size ?? 0
      }
      if (typeof aVal === 'string') {
        return direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      return direction === 'asc' ? aVal - bVal : bVal - aVal
    })
    container.innerHTML = ''
    const totalSize = Object.values(fileTypesData).reduce(
      (sum, info) => sum + (info.size ?? 0),
      0
    )
    sortedEntries.forEach(([type, info]) => {
      const tr = document.createElement('tr')
      tr.classList =
        'hover:bg-[#232329] transition file-type border-b border-[#232329]'
      const percentage =
        totalSize > 0 ? (((info.size ?? 0) / totalSize) * 100).toFixed(1) : 0
      tr.innerHTML = `
        <td class="px-2 py-2 font-mono text-white border border-[#232329]">${type}</td>
        <td class="px-2 py-2 font-mono border border-[#232329]">${(info.count ?? 0).toLocaleString()}</td>
        <td class="px-2 py-2 border border-[#232329]">
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="font-mono">${utils.formatSize(info.size ?? 0)}</span>
              <span class="text-gray-400">${percentage}%</span>
            </div>
            <div class="w-full bg-[#232329] rounded-full h-2 overflow-hidden">
              <div class="bg-blue-500 h-full rounded-full" style="width: ${percentage}%"></div>
            </div>
          </div>
        </td>
      `
      container.appendChild(tr)
    })
  }
  function setFileTypesSort(column) {
    if (fileTypesSortConfig.column === column) {
      fileTypesSortConfig.direction =
        fileTypesSortConfig.direction === 'asc' ? 'desc' : 'asc'
    } else {
      fileTypesSortConfig.column = column
      fileTypesSortConfig.direction = 'desc'
    }
    renderFileTypes()
    updateFileTypesHeaders()
  }
  function updateFileTypesHeaders() {
    const headers = document.querySelectorAll('#file-types-table th.sortable')
    headers.forEach((header) => {
      const col = header.dataset.column
      header.classList.remove('text-blue-400')
      header.querySelector('.sort-indicator')?.remove()
      if (col === fileTypesSortConfig.column) {
        header.classList.add('text-blue-400')
        const indicator = document.createElement('span')
        indicator.className = 'sort-indicator ml-1'
        indicator.textContent =
          fileTypesSortConfig.direction === 'asc' ? '▲' : '▼'
        header.appendChild(indicator)
      }
    })
  }
  function renderCollectionDetails() {
    const container = document.getElementById('collection-details')
    if (!container) return
    if (
      !collectionDetailsData ||
      Object.keys(collectionDetailsData).length === 0
    ) {
      container.innerHTML = ''
      return
    }
    let sortedEntries = Object.entries(collectionDetailsData)
    const { column, direction } = collectionSortConfig
    sortedEntries.sort(([nameA, a], [nameB, b]) => {
      let aVal, bVal
      if (column === 'name') {
        aVal = nameA.toLowerCase()
        bVal = nameB.toLowerCase()
      } else if (column === 'files') {
        aVal = a.files ?? 0
        bVal = b.files ?? 0
      } else if (column === 'size') {
        aVal = a.size ?? 0
        bVal = b.size ?? 0
      } else if (column === 'lastModified') {
        aVal = new Date(a.lastModified ?? 0).getTime()
        bVal = new Date(b.lastModified ?? 0).getTime()
      } else if (column === 'largest') {
        aVal = a.largestFileSize ?? 0
        bVal = b.largestFileSize ?? 0
      } else if (column === 'smallest') {
        aVal = a.smallestFileSize ?? Number.MAX_VALUE
        bVal = b.smallestFileSize ?? Number.MAX_VALUE
      }
      if (typeof aVal === 'string') {
        return direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      return direction === 'asc' ? aVal - bVal : bVal - aVal
    })
    container.innerHTML = ''
    const totalSize = Object.values(collectionDetailsData).reduce(
      (sum, info) => sum + (info.size ?? 0),
      0
    )
    sortedEntries.forEach(([name, info]) => {
      const tr = document.createElement('tr')
      tr.classList =
        'hover:bg-[#232329] transition collection-item border-b border-[#404040]'
      const percentage =
        totalSize > 0 ? (((info.size ?? 0) / totalSize) * 100).toFixed(1) : 0
      tr.innerHTML = `
        <td class="px-2 py-2 font-mono text-white border border-[#404040]">${name}</td>
        <td class="px-2 py-2 font-mono border border-[#404040]">${(info.files ?? 0).toLocaleString()}</td>
        <td class="px-2 py-2 border border-[#404040]">
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs">
              <span class="font-mono">${utils.formatSize(info.size ?? 0)}</span>
              <span class="text-gray-400">${percentage}%</span>
            </div>
            <div class="w-full bg-[#232329] rounded-full h-2 overflow-hidden">
              <div class="bg-green-500 h-full rounded-full" style="width: ${percentage}%"></div>
            </div>
          </div>
        </td>
        <td class="px-2 py-2 text-xs text-gray-400 border border-[#404040]">${info.lastModified ? new Date(info.lastModified).toLocaleString() : ''}</td>
        <td class="px-2 py-2 text-xs text-gray-400 border border-[#404040]">${info.largestFileSize !== undefined ? utils.formatSize(info.largestFileSize) : ''}</td>
        <td class="px-2 py-2 text-xs text-gray-400 border border-[#404040]">${info.smallestFileSize !== undefined && info.smallestFileSize !== null ? utils.formatSize(info.smallestFileSize) : ''}</td>
      `
      container.appendChild(tr)
    })
  }
  function setCollectionSort(column) {
    if (collectionSortConfig.column === column) {
      collectionSortConfig.direction =
        collectionSortConfig.direction === 'asc' ? 'desc' : 'asc'
    } else {
      collectionSortConfig.column = column
      collectionSortConfig.direction = 'desc'
    }
    renderCollectionDetails()
    updateCollectionHeaders()
  }
  function updateCollectionHeaders() {
    const headers = document.querySelectorAll('#collection-table th.sortable')
    headers.forEach((header) => {
      const col = header.dataset.column
      header.classList.remove('text-green-400')
      header.querySelector('.sort-indicator')?.remove()
      if (col === collectionSortConfig.column) {
        header.classList.add('text-green-400')
        const indicator = document.createElement('span')
        indicator.className = 'sort-indicator ml-1'
        indicator.textContent =
          collectionSortConfig.direction === 'asc' ? '▲' : '▼'
        header.appendChild(indicator)
      }
    })
  }
  function updateMemoryStats(memory) {
    const container = document.getElementById('memory-stats')
    if (!container) return
    container.innerHTML = ''
    if (!memory) return
    const heapUsed = memory.heapUsed ?? memory.formatted?.heapUsed ?? 0
    const heapTotal = memory.heapTotal ?? 0
    const heapPercentage =
      heapTotal > 0 ? ((heapUsed / heapTotal) * 100).toFixed(1) : 0
    const memoryItems = [
      {
        label: 'Heap Used',
        value: utils.formatSize(heapUsed),
        percentage: heapPercentage,
        total: utils.formatSize(heapTotal),
      },
      {
        label: 'RSS',
        value: utils.formatSize(memory.rss ?? memory.formatted?.rss ?? 0),
      },
      {
        label: 'External',
        value: utils.formatSize(memory.external ?? 0),
      },
      {
        label: 'Array Buffers',
        value: utils.formatSize(memory.arrayBuffers ?? 0),
      },
    ]
    memoryItems.forEach((item) => {
      const el = document.createElement('div')
      el.classList =
        'flex flex-col gap-2 px-2 py-2 rounded hover:bg-[#232329] transition memory-item'
      let innerHTML = `<div class="flex justify-between"><span>${item.label}</span><span>${item.value}</span>`
      if (item.total) {
        innerHTML += ` / ${item.total}</div>`
      } else {
        innerHTML += `</div>`
      }
      if (item.percentage !== undefined) {
        innerHTML += `
          <div class="w-full bg-[#232329] rounded-full h-2 overflow-hidden">
            <div class="bg-purple-500 h-full rounded-full" style="width: ${item.percentage}%"></div>
          </div>
          <div class="text-xs text-gray-400 text-center">${item.percentage}%</div>
        `
      }
      el.innerHTML = innerHTML
      container.appendChild(el)
    })
  }
  function updateSystemStats(data) {
    const container = document.getElementById('directory-list')
    if (!container) return
    container.innerHTML = `
      <div class="flex justify-between px-2 py-1 rounded hover:bg-[#232329] transition directory-item">
        <span>API Version</span>
        <span class="font-mono">${data.api.version || 'Unknown'}</span>
      </div>
      <div class="flex justify-between px-2 py-1 rounded hover:bg-[#232329] transition directory-item">
        <span>Node Version</span>
        <span class="font-mono">${data.api.node}</span>
      </div>
      <div class="flex justify-between px-2 py-1 rounded hover:bg-[#232329] transition directory-item">
        <span>Uptime</span>
        <span class="font-mono">${formatUptime(data.api.uptime)}</span>
      </div>
    `
  }
  function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    return parts.join(' ') || '< 1m'
  }
  updateStats()
  setupHeaderHandlers()
  setInterval(() => {
    updateStats()
    setupHeaderHandlers()
  }, 300000)
  function setupHeaderHandlers() {
    const fileTypeHeaders = document.querySelectorAll(
      '#file-types-table th.sortable'
    )
    fileTypeHeaders.forEach((header) => {
      header.style.cursor = 'pointer'
      const newHeader = header.cloneNode(true)
      header.parentNode.replaceChild(newHeader, header)
    })
    document
      .querySelectorAll('#file-types-table th.sortable')
      .forEach((header) => {
        header.style.cursor = 'pointer'
        header.addEventListener('click', () => {
          setFileTypesSort(header.dataset.column)
        })
      })
    const collectionHeaders = document.querySelectorAll(
      '#collection-table th.sortable'
    )
    collectionHeaders.forEach((header) => {
      const newHeader = header.cloneNode(true)
      header.parentNode.replaceChild(newHeader, header)
    })
    document
      .querySelectorAll('#collection-table th.sortable')
      .forEach((header) => {
        header.style.cursor = 'pointer'
        header.addEventListener('click', () => {
          setCollectionSort(header.dataset.column)
        })
      })
    updateFileTypesHeaders()
    updateCollectionHeaders()
  }
})
