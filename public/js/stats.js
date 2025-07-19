import { formatSize } from '../min/index.min.js'
document.addEventListener('DOMContentLoaded', function () {
  const API_URL = '/gdl/api/stats'
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
      setText('total-size', formatSize(data.collections.totalSize))
      setText('average-file-size', formatSize(data.collections.averageFileSize))
      setText('largest-file-size', formatSize(data.collections.largestFileSize))
      setText(
        'smallest-file-size',
        formatSize(data.collections.smallestFileSize)
      )
      setText('total-collections', data.collections.total)
      updateFileTypes(data.collections.fileTypes)
      updateCollectionDetails(data.collections.details)
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
      loading.style.display = 'none'
      errorEl.style.display = 'block'
      errorEl.textContent = `Failed to load stats: ${error.message}`
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
  function updateFileTypes(fileTypes) {
    const container = document.getElementById('file-types')
    if (!container) return
    container.innerHTML = ''
    if (!fileTypes) return
    Object.entries(fileTypes).forEach(([type, info]) => {
      const tr = document.createElement('tr')
      tr.classList =
        'hover:bg-[#232329] transition file-type border-b border-[#232329]'
      tr.innerHTML = `
        <td class="px-2 py-2 font-mono text-white border border-[#232329]">${type}</td>
        <td class="px-2 py-2 font-mono border border-[#232329]">${(info.count ?? 0).toLocaleString()}</td>
        <td class="px-2 py-2 font-mono border border-[#232329]">${formatSize(info.size ?? 0)}</td>
      `
      container.appendChild(tr)
    })
  }
  function updateCollectionDetails(details) {
    const container = document.getElementById('collection-details')
    if (!container) return
    container.innerHTML = ''
    if (!details) return
    Object.entries(details)
      .sort(([, a], [, b]) => (b.files ?? 0) - (a.files ?? 0))
      .forEach(([name, info]) => {
        const tr = document.createElement('tr')
        tr.classList =
          'hover:bg-[#232329] transition collection-item border-b border-[#404040]'
        tr.innerHTML = `
          <td class="px-2 py-2 font-mono text-white border border-[#404040]">${name}</td>
          <td class="px-2 py-2 font-mono border border-[#404040]">${(info.files ?? 0).toLocaleString()}</td>
          <td class="px-2 py-2 font-mono border border-[#404040]">${formatSize(info.size ?? 0)}</td>
          <td class="px-2 py-2 text-xs text-gray-400 border border-[#404040]">${info.lastModified ? new Date(info.lastModified).toLocaleString() : ''}</td>
          <td class="px-2 py-2 text-xs text-gray-400 border border-[#404040]">${info.largestFileSize ? formatSize(info.largestFileSize) : ''}</td>
          <td class="px-2 py-2 text-xs text-gray-400 border border-[#404040]">${info.smallestFileSize ? formatSize(info.smallestFileSize) : ''}</td>
        `
        container.appendChild(tr)
      })
  }
  function updateMemoryStats(memory) {
    const container = document.getElementById('memory-stats')
    if (!container) return
    container.innerHTML = ''
    if (!memory) return
    const memoryItems = [
      {
        label: 'Heap Used',
        value: formatSize(memory.heapUsed ?? memory.formatted?.heapUsed ?? 0),
      },
      {
        label: 'RSS',
        value: formatSize(memory.rss ?? memory.formatted?.rss ?? 0),
      },
      {
        label: 'External',
        value: formatSize(memory.external ?? 0),
      },
      {
        label: 'Array Buffers',
        value: formatSize(memory.arrayBuffers ?? 0),
      },
    ]
    memoryItems.forEach((item) => {
      const el = document.createElement('div')
      el.classList =
        'flex justify-between px-2 py-1 rounded hover:bg-[#232329] transition memory-item'
      el.innerHTML = `
        <span>${item.label}</span>
        <span>${item.value}</span>
      `
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
  setInterval(updateStats, 300000)
})
