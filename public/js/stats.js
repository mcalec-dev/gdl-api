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
      document.getElementById('total-directories').textContent =
        data.collections.totalDirectories.toLocaleString()
      document.getElementById('total-files').textContent =
        data.collections.totalFiles.toLocaleString()
      document.getElementById('total-size').textContent = formatSize(
        data.collections.totalSize
      )
      document.getElementById('average-file-size').textContent = formatSize(
        data.collections.averageFileSize
      )
      updateFileTypes(data.collections.fileTypes)
      updateCollectionDetails(data.collections.details)
      updateMemoryStats(data.api.memory)
      updateSystemStats(data)
      document.getElementById('refresh-time').textContent =
        `Last updated: ${new Date(data.api.timestamp).toLocaleString()}`
      loading.style.display = 'none'
      errorEl.style.display = 'none'
      content.style.display = 'block'
    } catch (error) {
      loading.style.display = 'none'
      errorEl.style.display = 'block'
      errorEl.textContent = `Failed to load stats: ${error.message}`
    }
  }
  function updateFileTypes(fileTypes) {
    const container = document.getElementById('file-types')
    if (!container) return
    container.innerHTML = ''
    if (!fileTypes) return
    Object.entries(fileTypes)
      .sort(([, a], [, b]) => b.count - a.count)
      .forEach(([type, info]) => {
        const el = document.createElement('div')
        el.className = 'file-type'
        el.innerHTML = `
          <span>${type}</span>
          <span>${info.count.toLocaleString()} (${formatSize(info.size)})</span>
        `
        container.appendChild(el)
      })
  }
  function updateCollectionDetails(details) {
    const container = document.getElementById('collection-details')
    if (!container) return
    container.innerHTML = ''
    if (!details) return
    Object.entries(details)
      .sort(([, a], [, b]) => b.files - a.files)
      .forEach(([name, info]) => {
        const el = document.createElement('div')
        el.className = 'collection-item'
        el.innerHTML = `
          <span>${name}</span>
          <span>${info.files.toLocaleString()} files (${formatSize(info.size)})</span>
        `
        container.appendChild(el)
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
        value: formatSize(memory.heapUsed),
      },
      {
        label: 'RSS',
        value: formatSize(memory.rss),
      },
      {
        label: 'External',
        value: formatSize(memory.external),
      },
      {
        label: 'Array Buffers',
        value: formatSize(memory.arrayBuffers),
      },
    ]
    memoryItems.forEach((item) => {
      const el = document.createElement('div')
      el.className = 'memory-item'
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
      <div class="directory-item">
        <span>API Version</span>
        <span>${data.api.version || 'Unknown'}</span>
      </div>
      <div class="directory-item">
        <span>Node Version</span>
        <span>${data.api.node}</span>
      </div>
      <div class="directory-item">
        <span>Uptime</span>
        <span>${formatUptime(data.api.uptime)}</span>
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
