document.addEventListener('DOMContentLoaded', async () => {
    // Simple debug function that logs only when debug mode is enabled
    const debug = (...args) => {
        if (localStorage.getItem('debug') === 'true') {
            console.log('[Files]', ...args);
        }
    };

    const fileList = document.getElementById('fileList');
    const breadcrumb = document.getElementById('breadcrumb');
    const basePath = '/gdl/files';
    const apiBasePath = '/gdl/api/files';

    const icons = {
        directory: '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
        image: '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-.55 0-1 .45-1 1v14c0 1.1.9 2 2 2h14c1.1 0-2-.9-2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
        video: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>',
        other: '<svg viewBox="0 0 24 24"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>'
    };

    let currentSort = 'name';
    let currentSortDir = 'asc';
    const SORT_STATES = {
        name: 'none',
        size: 'none',
        type: 'none'
    };

    function getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
        if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
        return 'other';
    }

    function formatSize(bytes) {
        if (bytes === 0 || !bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    function updateBreadcrumb(path) {
        // Remove leading and trailing slashes and split
        const parts = path.split('/').filter(Boolean);
        let currentPath = '';
        let breadcrumbHtml = `<a href="${basePath}">Home</a>`;
        
        parts.forEach((part, index) => {
            currentPath += `/${part}`;
            if (index < parts.length - 1) {
                breadcrumbHtml += `<span>/</span><a href="${basePath}${currentPath}">${part}</a>`;
            } else {
                breadcrumbHtml += `<span>/</span><span>${part}</span>`;
            }
        });
        
        breadcrumb.innerHTML = breadcrumbHtml;
    }

    async function loadDirectory(path = '') {
        try {
            debug('Loading directory:', path);

            // Clean and normalize path
            path = path
                .replace(/^\/?(gdl\/)?(api\/)?files\/?/i, '')  // Remove API prefixes
                .replace(/\/+/g, '/') // Convert multiple slashes to single
                .replace(/^\/|\/$/g, ''); // Remove leading/trailing slashes

            debug('Normalized path:', path);
            fileList.innerHTML = '<div class="loading">Loading...</div>';
            updateBreadcrumb(path);

            const apiPath = path ? `/${path}` : '';
            const response = await fetch(`${apiBasePath}${apiPath}`);
            const data = await response.json();

            if (!response.ok) {
                debug('API error:', data);
                fileList.innerHTML = `
                    <div class="error">
                        Error loading directory contents<br>
                        <small>${data.error || 'Unknown error occurred'}</small>
                    </div>`;
                return;
            }

            debug('API response:', data);
            
            // Check if we're in a collection or root
            const isRoot = !path;
            const shouldUseGridView = !isRoot && data.contents.some(item => item.type === 'file');
            fileList.classList.toggle('grid-view', shouldUseGridView);

            function getSortIcon(state) {
                if (state === 'none') return '⇅';
                if (state === 'asc') return '↑';
                if (state === 'desc') return '↓';
            }

            function sortContents(contents, sortBy, direction) {
                return [...contents].sort((a, b) => {
                    // Always keep directories first
                    if (a.type !== b.type) {
                        return a.type === 'directory' ? -1 : 1;
                    }

                    let comparison = 0;
                    switch (sortBy) {
                        case 'name':
                            comparison = a.name.localeCompare(b.name);
                            break;
                        case 'size':
                            comparison = (a.size || 0) - (b.size || 0);
                            break;
                        case 'type':
                            comparison = path.extname(a.name).localeCompare(path.extname(b.name));
                            break;
                    }
                    return direction === 'asc' ? comparison : -comparison;
                });
            }

            let html = '';
            
            // Add sort toolbar outside the grid/list container
            html += `
                <div class="sort-toolbar">
                    <button class="sort-button" data-sort="name">
                        Name ${getSortIcon(SORT_STATES.name)}
                    </button>
                    <button class="sort-button" data-sort="size">
                        Size ${getSortIcon(SORT_STATES.size)}
                    </button>
                    <button class="sort-button" data-sort="type">
                        Type ${getSortIcon(SORT_STATES.type)}
                    </button>
                </div>
                <div class="file-list ${shouldUseGridView ? 'grid-view' : ''}">`;
            
            // Add sorted contents
            const sortedContents = sortContents(data.contents, currentSort, currentSortDir);
            sortedContents.forEach(item => {
                const itemType = item.type === 'directory' ? 'directory' : getFileType(item.name);
                const itemPath = item.path.replace(/^\/+|\/+$/g, '');
                const previewUrl = item.type === 'file' ? 
                    `${item.url || `/gdl/api/files/${itemPath}`}${itemType === 'image' ? '?x=25' : ''}` : null;
                
                html += `
                    <div class="file-item ${item.type}" data-path="${itemPath}">
                        ${previewUrl ? `
                            ${itemType === 'video' || (itemType === 'image' && item.name.toLowerCase().endsWith('.gif')) ? `
                                <div class="${itemType === 'video' ? 'video-preview-container' : 'gif-preview-container'}">
                                    ${itemType === 'video' ? `
                                        <video 
                                            class="file-preview video" 
                                            src="${previewUrl}" 
                                            preload="metadata"
                                            onmouseover="this.play(); this.muted=false;" 
                                            onmouseout="this.pause(); this.currentTime=0; this.muted=true;"
                                        ></video>
                                    ` : `
                                        <img 
                                            class="file-preview gif" 
                                            src="${previewUrl}" 
                                            alt="${item.name}"
                                            onmouseover="this.src=this.src.split('?')[0]"
                                            onmouseout="this.src=this.src.split('?')[0] + '?x=25'"
                                        >
                                    `}
                                </div>
                            ` : `
                                <div class="preview-container">
                                    <img class="file-preview loading" data-src="${previewUrl}" alt="${item.name}">
                                </div>
                            `}
                        ` : `
                            <div class="file-icon ${itemType}">${icons[itemType]}</div>
                        `}
                        <div class="file-details">
                            <div class="file-name">${item.name}</div>
                            <div class="file-meta">
                                ${item.type === 'file' ? formatSize(item.size) : 'Directory'}
                            </div>
                        </div>
                    </div>`;
            });
            
            html += '</div>'; // Close file-list div
            fileList.innerHTML = html;
            
            // Add event listeners after rendering
            document.querySelectorAll('.sort-button').forEach(button => {
                button.addEventListener('click', (e) => {
                    const sortBy = button.dataset.sort;
                    
                    // Reset other sort states
                    Object.keys(SORT_STATES).forEach(key => {
                        if (key !== sortBy) SORT_STATES[key] = 'none';
                    });
                    
                    // Update sort state
                    SORT_STATES[sortBy] = SORT_STATES[sortBy] === 'none' ? 'asc' : 
                                        SORT_STATES[sortBy] === 'asc' ? 'desc' : 'none';
                    
                    // Update active state on buttons
                    document.querySelectorAll('.sort-button').forEach(btn => {
                        btn.setAttribute('data-active', btn === button && SORT_STATES[sortBy] !== 'none');
                    });
                    
                    // Resort and rerender
                    loadDirectory(path);
                });
            });

            // Update click handlers
            fileList.querySelectorAll('.file-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const itemPath = item.dataset.path;
                    if (item.classList.contains('directory')) {
                        e.preventDefault();
                        const navPath = `${basePath}/${itemPath}`
                            .replace(/\/+/g, '/');
                        window.history.pushState(null, '', navPath);
                        loadDirectory(itemPath);
                    } else {
                        // Use the original file URL without scaling parameters
                        const originalUrl = item.querySelector('.file-preview')?.src?.split('?')[0] || 
                                          `/gdl/api/files/${itemPath}`;
                        window.open(originalUrl, '_blank');
                    }
                });
            });

            if (shouldUseGridView) {
                setupLazyLoading();
            }

        } catch (error) {
            debug('Error loading directory:', error);
            fileList.innerHTML = `
                <div class="error">
                    Error loading directory contents<br>
                    <small>${error.message}</small>
                </div>`;
        }
    }

    // Add debug toggle to window object for console access
    window.toggleDebug = () => {
        const current = localStorage.getItem('debug') === 'true';
        localStorage.setItem('debug', (!current).toString());
        console.log('Debug mode:', !current);
    };

    // Handle browser navigation
    window.addEventListener('popstate', () => {
        const currentPath = window.location.pathname
            .replace(new RegExp(`^${basePath}/?`), '')
            .replace(/\/+/g, '/')
            .replace(/^\/|\/$/g, '');
        debug('Navigation to:', currentPath);
        loadDirectory(currentPath);
    });

    // Initial load
    const currentPath = window.location.pathname
        .replace(new RegExp(`^${basePath}/?`), '')
        .replace(/\/+/g, '/')
        .replace(/^\/|\/$/g, '');
    debug('Initial load:', currentPath);
    loadDirectory(currentPath);
});

function setupLazyLoading() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.classList.remove('loading');
                    observer.unobserve(img);
                }
            }
        });
    }, {
        rootMargin: '50px 0px',
        threshold: 0.1
    });

    document.querySelectorAll('img.file-preview.loading').forEach(img => {
        observer.observe(img);
    });
}

// Update the URL generation function
function generateBrowseUrl(path) {
    // Remove any potential duplicate base paths
    path = path.replace(/^\/gdl\/files\/gdl\/files/, '/gdl/files');
    path = path.replace(/^\/gdl\/files\//, '');
    
    // Construct proper URL
    return `/gdl/files/${path}`;
}

// Update the click handler for directory navigation
function handleDirectoryClick(event) {
    const element = event.target.closest('[data-path]');
    if (!element) return;
    
    const path = element.dataset.path;
    const url = generateBrowseUrl(path);
    window.location.href = url;
}

// Update the history state when loading new content
function updateBrowserHistory(path) {
    const url = generateBrowseUrl(path);
    history.pushState({ path }, '', url);
}

function renderDirectoryItem(item) {
    const itemPath = item.path.replace(/^\/+/, ''); // Remove leading slashes
    return `
        <div class="item directory" data-path="${itemPath}">
            <span class="icon">📁</span>
            <span class="name">${item.name}</span>
        </div>
    `;
}