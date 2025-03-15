async function loadStats() {
  try {
    const response = await fetch('/gdl/api/stats');
    const data = await response.json();
    document.getElementById('total-items').textContent = data.stats.totalItems.toLocaleString();
    document.getElementById('total-size').textContent = data.stats.humanReadableSize;
    document.getElementById('total-files').textContent = data.stats.totalFiles.toLocaleString();
    document.getElementById('total-dirs').textContent = data.stats.totalDirectories.toLocaleString();
    const fileTypesContainer = document.getElementById('file-types');
    fileTypesContainer.innerHTML = '';
    Object.entries(data.stats.fileTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        const div = document.createElement('div');
        div.className = 'file-type';
        div.textContent = `${type}: ${count.toLocaleString()}`;
        fileTypesContainer.appendChild(div);
      });
    document.getElementById('total-collections').textContent = data.stats.summary.totalCollections.toLocaleString();
    document.getElementById('avg-files').textContent = data.stats.summary.averageFilesPerCollection;
    document.getElementById('common-type').textContent = data.stats.summary.mostCommonFileType;
    const collectionsContainer = document.getElementById('collections');
    collectionsContainer.innerHTML = '';
    const totalSize = Object.values(data.stats.collections).reduce((acc, col) => acc + col.size, 0);
    Object.entries(data.stats.collections)
      .sort((a, b) => b[1].size - a[1].size)
      .forEach(([name, stats]) => {
        const percentage = (stats.size / totalSize * 100).toFixed(1);
        const div = document.createElement('div');
        div.className = 'collection-card';
        div.innerHTML = `
          <strong>${name}</strong>
          <div class="stat-label">Size: ${stats.humanReadableSize}</div>
          <div class="stat-label">Files: ${stats.files.toLocaleString()}</div>
          <div class="stat-label">Directories: ${stats.directories.toLocaleString()}</div>
          <div class="stat-label">Total Items: ${stats.totalItems.toLocaleString()}</div>
          <div class="stat-label">${percentage}% of total size</div>
          <div class="progress-bar">
            <div class="progress-value" style="width: ${percentage}%"></div>
          </div>
        `;
        collectionsContainer.appendChild(div);
      });
    document.getElementById('refresh-time').textContent = `Last updated: ${new Date(data.timestamp).toLocaleString()}`;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('stats-content').style.display = 'block';
  } catch (error) {
    console.error('Error loading stats:', error);
    document.getElementById('loading').textContent = 'Error loading statistics. Please try again later.';
  }
}
loadStats();
setInterval(loadStats, 300000);