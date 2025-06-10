document.addEventListener('DOMContentLoaded', function () {
  const API_URL = '/gdl/api/stats';

  async function updateStats() {
    const loading = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const content = document.getElementById('stats-content');

    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();

      // Main stats updates
      document.getElementById('total-directories').textContent =
        data.collections.totalDirectories.toLocaleString();
      document.getElementById('total-files').textContent =
        data.collections.totalFiles.toLocaleString();
      document.getElementById('total-size').textContent =
        formatBytes(data.collections.totalSize);
      document.getElementById('average-file-size').textContent =
        formatBytes(data.collections.averageFileSize);

      // Update file types
      updateFileTypes(data.collections.fileTypes);

      // Update collection details
      updateCollectionDetails(data.collections.details);

      // Update memory stats
      updateMemoryStats(data.api.memory);

      // Update system stats
      updateSystemStats(data);

      document.getElementById('refresh-time').textContent =
        `Last updated: ${new Date(data.api.timestamp).toLocaleString()}`;

      loading.style.display = 'none';
      errorEl.style.display = 'none';
      content.style.display = 'block';
    } catch (error) {
      loading.style.display = 'none';
      errorEl.style.display = 'block';
      errorEl.textContent = `Failed to load stats: ${error.message}`;
    }
  }

  function updateFileTypes(fileTypes) {
    const container = document.getElementById('file-types');
    if (!container) return;
    container.innerHTML = '';
    if (!fileTypes) return;

    Object.entries(fileTypes)
      .sort(([, a], [, b]) => b.count - a.count)
      .forEach(([type, info]) => {
        const el = document.createElement('div');
        el.className = 'file-type';
        el.innerHTML = `
                    <span>${type}</span>
                    <span>${info.count.toLocaleString()} (${formatBytes(info.size)})</span>
                `;
        container.appendChild(el);
      });
  }

  function updateCollectionDetails(details) {
    const container = document.getElementById('collection-details');
    if (!container) return;
    container.innerHTML = '';
    if (!details) return;

    Object.entries(details)
      .sort(([, a], [, b]) => b.files - a.files)
      .forEach(([name, info]) => {
        const el = document.createElement('div');
        el.className = 'collection-item';
        el.innerHTML = `
                    <span>${name}</span>
                    <span>${info.files.toLocaleString()} files (${formatBytes(info.size)})</span>
                `;
        container.appendChild(el);
      });
  }

  function updateMemoryStats(memory) {
    const container = document.getElementById('memory-stats');
    if (!container) return;
    container.innerHTML = '';
    if (!memory) return;
    const memoryItems = [{
        label: 'Heap Used',
        value: formatBytes(memory.heapUsed)
      },
      {
        label: 'RSS',
        value: formatBytes(memory.rss)
      },
      {
        label: 'External',
        value: formatBytes(memory.external)
      },
      {
        label: 'Array Buffers',
        value: formatBytes(memory.arrayBuffers)
      }
    ];

    memoryItems.forEach(item => {
      const el = document.createElement('div');
      el.className = 'memory-item';
      el.innerHTML = `
                  <span>${item.label}</span>
                  <span>${item.value}</span>
              `;
      container.appendChild(el);
    });
  }

  function updateSystemStats(data) {
    const container = document.getElementById('directory-list');
    if (!container) return;
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
          `;
  }

  function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    const finalFileSize = `${Math.round(size * 100 / 100)} ${units[unitIndex]}`;
    return `${finalFileSize}`;
  }

  function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || '< 1m';
  }

  // Initial load
  updateStats();

  // Refresh every 5 minutes
  setInterval(updateStats, 300000);
});