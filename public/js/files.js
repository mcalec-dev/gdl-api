document.addEventListener('DOMContentLoaded', async () => {
  const fileList = document.getElementById('fileList');
  const breadcrumb = document.getElementById('breadcrumb');
  const basePath = '/gdl/files';
  const apiBasePath = '/gdl/api';

  // File type icons (SVG)
  const icons = {
    directory: '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
    image: '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0-2-.9-2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
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

  async function loadDirectory(path = '') {
    fileList.innerHTML = '<div class="loading">Loading...</div>';
    updateBreadcrumb(path);

    try {
      let data;
      if (!path) {
        // Load collections for home page
        const response = await fetch(`${apiBasePath}/collections`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const collectionsData = await response.json();
        data = {
          items: collectionsData.collections.map(collection => ({
            name: collection.name,
            type: 'directory',
            isCollection: true
          }))
        };
      } else {
        // Load directory contents
        const response = await fetch(`${apiBasePath}/collections${path}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        data = await response.json();
      }

      let html = '';
      
      // Add parent directory link if not at root
      if (path) {
        const parentPath = path.split('/').slice(0, -1).join('/');
        html += `
          <div class="file-item directory">
            <div class="file-icon directory">${icons.directory}</div>
            <div class="file-details">
              <a href="${basePath}${parentPath}" class="file-name">..</a>
              <div class="file-meta">Parent Directory</div>
            </div>
          </div>
        `;
      } else {
        // Add welcome message for home page
        html += `
          <div class="welcome-message">
            <h2>Gallery-DL Collections</h2>
            <p>Select a collection to browse its contents:</p>
          </div>
        `;
      }

      // Sort items: directories first, then files
      const sortedItems = data.items.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });

      sortedItems.forEach(item => {
        const itemType = item.type === 'directory' ? 'directory' : getFileType(item.name);
        const itemPath = item.type === 'directory' ? 
          `${basePath}${path}/${item.name}` : 
          `${apiBasePath}/files${path}/${item.name}`;

        html += `
          <div class="file-item ${item.type}" 
               onclick="${item.type === 'directory' ? 
                  `window.location.href='${itemPath}'` : 
                  `window.open('${itemPath}', '_blank')`}">
            <div class="file-icon ${itemType}">${icons[itemType]}</div>
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
    } catch (error) {
      console.error('Error loading directory:', error);
      fileList.innerHTML = '<div class="error">Error loading directory contents</div>';
    }
  }

  // Get the current path from URL
  const currentPath = window.location.pathname.replace(basePath, '');
  loadDirectory(currentPath);
});