document.addEventListener('DOMContentLoaded', async () => {
  const fileList = document.getElementById('fileList');
  const breadcrumb = document.getElementById('breadcrumb');
  const basePath = '/gdl/files';
  const apiBasePath = '/gdl/api';
  const icons = {
    directory: '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
    image: '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-.55 0-1 .45-1 1v14c0 1.1.9 2 2 2h14c1.1 0-2-.9-2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
    video: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>',
    audio: '<svg viewBox="0 0 24 24"><path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/></svg>',
    document: '<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
    other: '<svg viewBox="0 0 24 24"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>'
  };
  function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return 'audio';
    if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) return 'document';
    return 'other';
  }
  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
  }
  function updateBreadcrumb(path) {
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
  function getPreviewElement(item) {
    const itemType = getFileType(item.name);
    
    if (itemType === 'image') {
        const container = document.createElement('div');
        container.className = 'preview-container';

        const img = document.createElement('img');
        img.className = 'file-preview loading';
        
        // Use 25% size for thumbnails to reduce bandwidth
        const imageUrl = `${apiBasePath}/files${currentPath}/${item.name}?x=25%`;
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
        img.setAttribute('data-src', imageUrl);
        
        // Store original URL for full-size viewing
        img.setAttribute('data-fullsize', `${apiBasePath}/files${currentPath}/${item.name}`);
        
        img.alt = item.name;
        container.appendChild(img);

        // Add click handler to show full-size image
        container.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const fullUrl = img.getAttribute('data-fullsize');
            if (fullUrl) {
                window.open(fullUrl, '_blank');
            }
        });

        return container;
    }
    
    if (itemType === 'video') {
        const container = document.createElement('div');
        container.className = 'preview-container';

        const video = document.createElement('video');
        video.className = 'file-preview loading';
        video.muted = true;
        video.preload = 'metadata';
        
        const videoUrl = `${apiBasePath}/files${currentPath}/${item.name}`;
        video.src = videoUrl;
        
        // Store original URL
        video.setAttribute('data-fullsize', videoUrl);
        
        // Add hover events for play/pause
        container.addEventListener('mouseenter', () => {
            video.play().catch(err => console.log('Video autoplay failed:', err));
        });
        
        container.addEventListener('mouseleave', () => {
            video.pause();
            video.currentTime = 0;
        });

        // Click to open in new tab
        container.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const fullUrl = video.getAttribute('data-fullsize');
            if (fullUrl) {
                window.open(fullUrl, '_blank');
            }
        });

        container.appendChild(video);
        return container;
    }

    return null;
  }
  async function loadDirectory(path = '') {
    fileList.innerHTML = '<div class="loading">Loading...</div>';
    updateBreadcrumb(path);

    try {
      let response;
      let data;

      if (!path) {
        response = await fetch(`${apiBasePath}/collections`);
      } else {
        response = await fetch(`${apiBasePath}/collections${path}`);
      }

      // Handle error responses
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403) {
          fileList.innerHTML = `
            <div class="error">
              Access Denied<br>
              <small>${errorData.message || 'This content is not accessible'}</small>
            </div>`;
        } else {
          fileList.innerHTML = `
            <div class="error">
              Error loading directory contents<br>
              <small>${errorData.error || 'Unknown error occurred'}</small>
            </div>`;
        }
        return;
      }

      if (!path) {
          // Load collections for home page
          response = await fetch(`${apiBasePath}/collections`);
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Unknown error'}`);
          }
          data = await response.json();
          
          if (!data.collections) {
              data.collections = [];
          }
      } else {
          // Load directory contents
          response = await fetch(`${apiBasePath}/collections${path}`);
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || 'Unknown error'}`);
          }
          data = await response.json();
          
          if (!data.items) {
              data.items = [];
          }
      }

      // Check if we're in a directory with files
      const items = path ? data.items : data.collections;
      const shouldUseGridView = path && items && items.some(item => item.type === 'file');
      fileList.classList.toggle('grid-view', shouldUseGridView);

      let html = '';

      if (!path) {
          html += `
              <div class="welcome-message">
                  <h2>Gallery-DL Collections</h2>
                  <p>Select a collection to browse its contents:</p>
              </div>
          `;
      } else {
          const parentPath = path.split('/').slice(0, -1).join('/');
          html += `
              <div class="file-item directory" onclick="window.location.href='${basePath}${parentPath}'">
                  <div class="file-icon directory">${icons.directory}</div>
                  <div class="file-details">
                      <a href="${basePath}${parentPath}" class="file-name" onclick="event.stopPropagation()">..</a>
                      <div class="file-meta">Parent Directory</div>
                  </div>
              </div>
          `;
      }
      const sortedItems = items.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'directory' ? -1 : 1;
      });
      sortedItems.forEach(item => {
          const itemType = item.type === 'directory' ? 'directory' : getFileType(item.name);
          const itemPath = item.type === 'directory' ? 
              `${basePath}${path}/${item.name}` : 
              `${apiBasePath}/files${path}/${item.name}`.replace(/\/+/g, '/'); // Add this replace
          const previewElement = item.type === 'file' ? getPreviewElement(item) : null;
          html += `
              <div class="file-item ${item.type} ${itemType}" 
                   onclick="${item.type === 'directory' ? 
                      `window.location.href='${itemPath}'` : 
                      `window.open('${itemPath}', '_blank')`}">
                  ${previewElement ? previewElement.outerHTML : `
                      <div class="file-icon ${itemType}">${icons[itemType]}</div>
                  `}
                  <div class="file-details">
                      <a href="${itemPath}" 
                         class="file-name" 
                         ${item.type === 'file' ? 'target="_blank"' : ''} 
                         onclick="event.stopPropagation()">${item.name}</a>
                      <div class="file-meta">
                          ${item.isCollection ? 'Collection' : 
                            (item.type === 'directory' ? 'Directory' : 
                            `File • ${formatSize(item.size || 0)}`)}
                      </div>
                  </div>
              </div>
          `;
      });
      fileList.innerHTML = html;

      // Setup lazy loading if we're showing files in grid view
      if (shouldUseGridView) {
          setupLazyLoading();
      }

    } catch (error) {
      console.error('Error loading directory:', error);
      fileList.innerHTML = `
        <div class="error">
          Error loading directory contents<br>
          <small>${error.message}</small>
        </div>`;
    }
  }
  const currentPath = window.location.pathname.replace(basePath, '');
  loadDirectory(currentPath);
});

function setupLazyLoading() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const imageUrl = img.getAttribute('data-src');
                
                if (imageUrl) {
                    const tempImage = new Image();
                    tempImage.onload = () => {
                        img.src = imageUrl;
                        img.classList.remove('loading');
                    };
                    tempImage.src = imageUrl;
                    observer.unobserve(img);
                }
            }
        });
    }, {
        rootMargin: '50px 0px',
        threshold: 0.1
    });

    document.querySelectorAll('.file-preview[data-src]').forEach(img => {
        observer.observe(img);
    });
}

// Add click handler for full-size image viewing
document.addEventListener('click', (e) => {
    if (e.target.matches('.file-preview') && e.target.dataset.fullsize) {
        window.open(e.target.dataset.fullsize, '_blank');
    }
});