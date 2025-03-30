document.addEventListener('DOMContentLoaded', function() {
    const API_URL = '/gdl/api/stats';
    
    async function updateStats() {
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        const content = document.getElementById('stats-content');
        
        loading.style.display = 'block';
        error.style.display = 'none';
        content.style.display = 'none';

        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            
            const data = await response.json();

            // Update API stats
            document.getElementById('total-directories').textContent = 
                data.collections.totalDirectories.toLocaleString();
            document.getElementById('total-files').textContent = 
                data.collections.totalFiles.toLocaleString();
            document.getElementById('total-size').textContent = 
                data.collections.humanReadableSize;

            // Update file types
            const fileTypesContainer = document.getElementById('file-types');
            fileTypesContainer.innerHTML = '';
            
            Object.entries(data.collections.fileTypes)
                .sort(([,a], [,b]) => b.count - a.count)
                .forEach(([type, info]) => {
                    const typeEl = document.createElement('div');
                    typeEl.className = 'file-type';
                    typeEl.innerHTML = `
                        <span>${type}</span>
                        <span>${info.count.toLocaleString()} (${convertToHumanSize(info.size)})</span>
                    `;
                    fileTypesContainer.appendChild(typeEl);
                });

            // Update directory list with summary stats
            const dirListContainer = document.getElementById('directory-list');
            dirListContainer.innerHTML = `
                <div class="directory-item">
                    <span>Average Files per Collection</span>
                    <span>${data.collections.summary.averageFilesPerCollection}</span>
                </div>
                <div class="directory-item">
                    <span>Average File Size</span>
                    <span>${data.collections.summary.averageFileSizeFormatted}</span>
                </div>
                <div class="directory-item">
                    <span>Largest Collection</span>
                    <span>${data.collections.summary.largestCollection}</span>
                </div>
                <div class="directory-item">
                    <span>Newest Collection</span>
                    <span>${data.collections.summary.newestCollection}</span>
                </div>
            `;

            loading.style.display = 'none';
            content.style.display = 'block';

        } catch (error) {
            console.error('Error fetching stats:', error);
            loading.style.display = 'none';
            error.style.display = 'block';
            error.textContent = `Failed to load stats: ${error.message}`;
        }
    }

    function convertToHumanSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = Math.abs(bytes);
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    // Initial load
    updateStats();

    // Refresh every 5 minutes
    setInterval(updateStats, 300000);
});