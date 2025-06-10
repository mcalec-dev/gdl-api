const fileList = document.getElementById('fileList');
const breadcrumb = document.getElementById('breadcrumb');
const basePath = '/gdl/files';
const apiBasePath = '/gdl/api/files';
const icons = {
  directory: '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
  image: '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-.55 0-1 .45-1 1v14c0 1.1.9 2 2 2h14c1.1 0-2-.9-2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
  video: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 1.1.9 2 2 2h12c1.1 0-2-.9-2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
  other: '<svg viewBox="0 0 24 24"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>'
};
let currentDirectoryData = null;
let currentImageIndex = 0;
let currentImageList = [];
let currentSort = 'name';
let currentSortDir = 'none';
const SORT_STATES = {
  name: 'none',
  size: 'none',
  type: 'none',
  modified: 'none'
};

function getFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  return 'other';
}

function formatSize(bytes) {
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

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZone: 'UTC'
  };
  return date.toLocaleString('en-US', options);
}
function getSortIcon(state) {
  switch (state) {
    case 'asc':
      return '↑';
    case 'desc':
      return '↓';
    default:
      return '↕';
  }
}
function updateBreadcrumb(path) {
  // Remove leading and trailing slashes and split
  const parts = path.split('/').filter(Boolean);
  let currentPath = '';
  let breadcrumbHtml = `<a href="${basePath}/">Home</a>`;
  parts.forEach((part, index) => {
    currentPath += `/${part}`;
    if (index < parts.length - 1) {
      breadcrumbHtml += `<span>/</span><a href="${basePath}${currentPath}/">${part}</a>`;
    } else {
      breadcrumbHtml += `<span>/</span><span>${part}</span><span>/</span>`;
    }
  });
  breadcrumb.innerHTML = breadcrumbHtml;
}
function renderSortToolbar() {
    const sortToolbarHtml = `
    <button class="sort-button" data-sort="name">
      <span>Name</span>
      <span class="sort-icon">${getSortIcon(SORT_STATES.name)}</span>
    </button>
    <button class="sort-button" data-sort="size">
      <span>Size</span>
      <span class="sort-icon">${getSortIcon(SORT_STATES.size)}</span>
    </button>
    <button class="sort-button" data-sort="type">
      <span>Type</span>
      <span class="sort-icon">${getSortIcon(SORT_STATES.type)}</span>
    </button>
    <button class="sort-button" data-sort="modified">
      <span>Modified</span>
      <span class="sort-icon">${getSortIcon(SORT_STATES.modified)}</span>
    </button>
  `;
  document.querySelector('.sort-toolbar').innerHTML = sortToolbarHtml;
}
function sortContents(contents, sortBy, direction) {
  if (direction === 'none') {
    // Default sort order (ascending)
    return [...contents].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, {
        numeric: true
      });
    });
  }
  return [...contents].sort((a, b) => {
    // Always keep directories first
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, undefined, {
          numeric: true
        });
        break;
      case 'size':
        comparison = (a.size || 0) - (b.size || 0);
        break;
      case 'type': {
        const extA = a.name.split('.').pop() || '';
        const extB = b.name.split('.').pop() || '';
        comparison = extA.localeCompare(extB);
        break;
      }
      case 'modified':
        comparison = (new Date(a.modified || 0)) - (new Date(b.modified || 0));
        break;
    }
    return direction === 'asc' ? comparison : -comparison;
  });
}
async function loadDirectory(path = '') {
  try {
    // Clean and normalize path        
    path = path ? decodeURIComponent(path) : '';
    if (path) {
      path = path
        .replace(new RegExp(`^${basePath}/?`), '')
        .replace(/\/+/g, '/')
        .replace(/^\/|\/$/g, '');
    }
    fileList.innerHTML = '<div class="loading"><span>Loading...</span></div>';
    updateBreadcrumb(path);
    const apiPath = path ? `/${path}/` : '';
    if (!currentDirectoryData || currentDirectoryData.path !== path) {
      const response = await fetch(`${apiBasePath}${apiPath}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unknown error occurred');
      }
      currentDirectoryData = { path, contents: data.contents };
    }
    // Check if in a collection or root
    const isRoot = !path;
    const shouldUseGridView = !isRoot && currentDirectoryData.contents.some(item => item.type === 'file');
    fileList.classList.toggle('grid-view', shouldUseGridView);

    function getSortIcon(state) {
      switch (state) {
        case 'asc':
          return '↑';
        case 'desc':
          return '↓';
        default:
          return '↕';
      }
    }
    let html = '';
    // Render the sort toolbar separately
    const sortToolbarHtml = `
            <button class="sort-button" data-sort="name">
                <span>Name</span>
                <span class="sort-icon">${getSortIcon(SORT_STATES.name)}</span>
            </button>
            <button class="sort-button" data-sort="size">
                <span>Size</span>
                <span class="sort-icon">${getSortIcon(SORT_STATES.size)}</span>
            </button>
            <button class="sort-button" data-sort="type">
                <span>Type</span>
                <span class="sort-icon">${getSortIcon(SORT_STATES.type)}</span>
            </button>
            <button class="sort-button" data-sort="modified">
                <span>Modified</span>
                <span class="sort-icon">${getSortIcon(SORT_STATES.modified)}</span>
            </button>
        `;
    // Update the sort-toolbar content
    document.querySelector('.sort-toolbar').innerHTML = sortToolbarHtml; // Add sorted contents
    const sortedContents = sortContents(currentDirectoryData.contents, currentSort, currentSortDir);
    sortedContents.forEach(item => {
      const itemType = item.type === 'directory' ? 'directory' : getFileType(item.name);
      // Construct path from parent path and item name
      const itemPath = path ? `${path}/${item.name}` : item.name;
      let previewUrl = item.type === 'file' ? `${item.url || `/gdl/api/files/${itemPath}`}` : null;
      // Conditionally append '?x=50' only for images (excluding GIFs)
      if (previewUrl && itemType === 'image' && !item.name.toLowerCase().endsWith('.gif')) {
        previewUrl += '?x=50';
      }
      html += `
                <div class="file-item ${item.type}" data-path="${itemPath}">
                    ${previewUrl ? `
                        ${itemType === 'video' ? `
                            <div class="video-preview-container">
                                <video 
                                    class="file-preview video" 
                                    src="${previewUrl}" 
                                    preload="metadata"
                                    onmouseover="this.play(); this.muted=false;" 
                                    onmouseout="this.pause(); this.currentTime=0; this.muted=true;"
                                ></video>
                            </div>
                        ` : itemType === 'image' ? `
                            <div class="preview-container">
                                <img class="file-preview loading" data-src="${previewUrl}" alt="${item.name}">
                            </div>
                        ` : `
                            <div class="file-icon ${itemType}">${icons[itemType]}</div>
                        `}
                    ` : `
                        <div class="file-icon ${itemType}">${icons[itemType]}</div>
                    `}
                    <div class="file-details">
                        <div class="file-name">${item.name}</div>
                        <div class="file-meta">
                            <span>${formatDate(item.modified) }</span><br>
                            <span>${item.type === 'file' ? formatSize(item.size) : 'Directory'}</span>
                        </div>
                    </div>
                </div>`;
    });
    fileList.innerHTML = html;
    // Add event listeners for sort buttons
    document.querySelectorAll('.sort-button').forEach(button => {
      button.addEventListener('click', () => {
        const sortBy = button.dataset.sort;
        // Update sort states
        Object.keys(SORT_STATES).forEach(key => {
          if (key !== sortBy) SORT_STATES[key] = 'none';
        });
        // Cycle through sort states
        if (SORT_STATES[sortBy] === 'none') {
          SORT_STATES[sortBy] = 'desc'; // Start with descending order
        } else if (SORT_STATES[sortBy] === 'desc') {
          SORT_STATES[sortBy] = 'asc'; // Then go to ascending order
        } else {
          SORT_STATES[sortBy] = 'none'; // Reset to default (none)
        }
        // Update active state and icons
        document.querySelectorAll('.sort-button').forEach(btn => {
          const isActive = btn.dataset.sort === sortBy && SORT_STATES[sortBy] !== 'none';
          btn.setAttribute('data-active', isActive);
          const btnIcon = btn.querySelector('.sort-icon');
          btnIcon.textContent = getSortIcon(SORT_STATES[btn.dataset.sort]);
        });
        currentSort = sortBy;
        currentSortDir = SORT_STATES[sortBy];
        // Store current path before reloading
        const currentPath = window.location.pathname
          .replace(new RegExp(`^${basePath}/?`), '')
          .replace(/\/+/g, '/')
          .replace(/^\/|\/$/g, '');
        loadDirectory(currentPath);
      });
    });
    // Update click handlers
    fileList.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const itemPath = item.dataset.path;
        if (item.classList.contains('directory')) {
          e.preventDefault();
          // Use generateBrowseUrl to avoid path duplication
          const navPath = generateBrowseUrl(itemPath);
          window.history.pushState({
            path: `${itemPath}/`,
            sortBy: currentSort,
            sortDir: currentSortDir
          }, '', navPath);
          loadDirectory(itemPath);
        }
      });
    });
    // Add event listener for image click
    document.querySelectorAll('.file-item.file').forEach((item) => {
      const fileType = getFileType(item.dataset.path);
      if (fileType === 'image' || fileType === 'video') {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        
          // Build media list from current directory
          const allMedia = Array.from(document.querySelectorAll('.file-item.file')).filter(el => 
            ['image', 'video'].includes(getFileType(el.dataset.path))
          );
        
          currentImageList = allMedia.map(media => {
            const itemPath = media.dataset.path;
            const originalUrl = media.querySelector('.file-preview')?.src?.split('?')[0] || `/gdl/api/files/${itemPath}`;
            return {
              url: originalUrl,
              name: itemPath.split('/').pop(),
              path: itemPath,
              type: getFileType(itemPath)
            };
          });
        
          currentImageIndex = allMedia.findIndex(media => media === item);
          showImagePopup(currentImageIndex);
        });
      }
    });
    if (shouldUseGridView) {
      setupLazyLoading();
    }
    renderDirectory(currentDirectoryData.contents, path);
  } catch (error) {
    fileList.innerHTML = `
        <div class="error">
            Error loading directory contents<br>
            <small>${error.message}</small>
        </div>`;
  }
}
function setupFileClickHandlers() {
  fileList.querySelectorAll('.file-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const itemPath = item.dataset.path;
      if (item.classList.contains('directory')) {
        e.preventDefault();
        const navPath = generateBrowseUrl(itemPath);
        window.history.pushState({ path: `${itemPath}/`, sortBy: currentSort, sortDir: currentSortDir }, '', navPath);
        loadDirectory(itemPath);
      } else if (item.classList.contains('file')) {
        const fileType = getFileType(itemPath);
        if (fileType === 'image' || fileType === 'video') {
          e.preventDefault();
          e.stopPropagation();
          
          const allMedia = Array.from(document.querySelectorAll('.file-item.file')).filter(el => 
            ['image', 'video'].includes(getFileType(el.dataset.path))
          );
          
          currentImageList = allMedia.map(media => {
            const mediaPath = media.dataset.path;
            const originalUrl = media.querySelector('.file-preview')?.src?.split('?')[0] || `/gdl/api/files/${mediaPath}`;
            return {
              url: originalUrl,
              name: mediaPath.split('/').pop(),
              path: mediaPath,
              type: getFileType(mediaPath)
            };
          });
          
          currentImageIndex = allMedia.findIndex(media => media === item);
          showImagePopup(currentImageIndex);
        }
      }
    });
  });
}
// Handle browser navigation
window.addEventListener('popstate', (event) => {
  const state = event.state || {};
  if (state.sortBy) {
    currentSort = state.sortBy;
    currentSortDir = state.sortDir;
  }
  const location = window.location.pathname;
  const currentPath = location === basePath || location === `${basePath}/` ?
    '' :
    location
      .replace(new RegExp(`^${basePath}/?`), '')
      .replace(/\/+/g, '/')
      .replace(/^\/|\/$/g, '');
  loadDirectory(currentPath);
});
// Initial load
const initialLocation = window.location.pathname;
const currentPath = initialLocation === basePath || initialLocation === `${basePath}/` ?
  '' :
  initialLocation
    .replace(new RegExp(`^${basePath}/?`), '')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
loadDirectory(currentPath);

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

function generateBrowseUrl(path) {
  // Construct proper URL
  return path ? `${basePath}/${path}/` : basePath;
}

function handleDirectoryClick(event) {
  event.preventDefault();
  const target = event.target.closest('a');
  if (!target) return;
  const newPath = target.getAttribute('href');
  if (!newPath) return;
  // Clean the path before loading
  const cleanPath = newPath.replace(new RegExp(`^${basePath}/?`), '');
  loadDirectory(cleanPath);
  history.pushState({
    path: cleanPath
  }, '', newPath);
}
// Handle popstate events (browser back/forward)
window.addEventListener('popstate', (event) => {
  const path = event.state?.path || '';
  loadDirectory(path);
});
function showImagePopup(index) {
  if (index < 0 || index >= currentImageList.length) return;
  
  const item = currentImageList[index];
  const popupViewer = document.getElementById('popup-viewer');
  const popupImage = document.getElementById('popup-image');
  const popupVideo = document.getElementById('popup-video');
  const imageTitle = document.getElementById('image-title');
  const imageCounter = document.getElementById('image-counter');
  const prevButton = document.getElementById('prev-image');
  const nextButton = document.getElementById('next-image');

  // Hide both video and image elements initially
  popupImage.style.display = 'none';
  popupVideo.style.display = 'none';

  if (item.type === 'video') {
    popupVideo.src = item.url;
    popupVideo.style.display = 'block';
  } else {
    popupImage.src = item.url;
    popupImage.style.display = 'block';
  }
  
  imageTitle.textContent = item.name;
  imageCounter.textContent = `${index + 1} / ${currentImageList.length}`;
  
  // Update navigation buttons
  prevButton.disabled = index === 0;
  nextButton.disabled = index === currentImageList.length - 1;
  
  popupViewer.style.display = 'flex';
  currentImageIndex = index;
}

function setupImagePopupEvents() {
  const popupViewer = document.getElementById('popup-viewer');
  const closeButton = document.getElementById('close-popup');
  const prevButton = document.getElementById('prev-image');
  const nextButton = document.getElementById('next-image');
  
  // Close popup
  closeButton.addEventListener('click', () => {
    const popupVideo = document.getElementById('popup-video');
    if (!popupVideo.paused) {
      popupVideo.pause();
    }
    popupViewer.style.display = 'none';
  });
  
  // Close on background click
  popupViewer.addEventListener('click', (e) => {
    if (e.target === popupViewer) {
      popupViewer.style.display = 'none';
    }
  });
  
  // Navigation
  prevButton.addEventListener('click', () => {
    if (currentImageIndex > 0) {
      showImagePopup(currentImageIndex - 1);
    }
  });
  
  nextButton.addEventListener('click', () => {
    if (currentImageIndex < currentImageList.length - 1) {
      showImagePopup(currentImageIndex + 1);
    }
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (popupViewer.style.display === 'flex') {
      const popupVideo = document.getElementById('popup-video');
      switch(e.key) {
        case 'Escape':
          if (!popupVideo.paused) {
            popupVideo.pause();
          }
          popupViewer.style.display = 'none';
          break;
        case 'ArrowLeft':
          if (currentImageIndex > 0) {
            showImagePopup(currentImageIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (currentImageIndex < currentImageList.length - 1) {
            showImagePopup(currentImageIndex + 1);
          }
          break;
      }
    }
  });
}
function setupSortButtons() {
  document.querySelectorAll('.sort-button').forEach(button => {
    button.addEventListener('click', () => {
      const sortBy = button.dataset.sort;
      // Update sort states
      Object.keys(SORT_STATES).forEach(key => {
        if (key !== sortBy) SORT_STATES[key] = 'none';
      });
      // Cycle through sort states
      if (SORT_STATES[sortBy] === 'none') {
        SORT_STATES[sortBy] = 'desc';
      } else if (SORT_STATES[sortBy] === 'desc') {
        SORT_STATES[sortBy] = 'asc';
      } else {
        SORT_STATES[sortBy] = 'none';
      }
      currentSort = sortBy;
      currentSortDir = SORT_STATES[sortBy];

      // Re-render the directory with the new sort
      renderDirectory(currentDirectoryData.contents, currentDirectoryData.path);
    });
  });
}
function renderDirectory(contents, path) {
  const isRoot = !path;
  const shouldUseGridView = !isRoot && contents.some(item => item.type === 'file');
  fileList.classList.toggle('grid-view', shouldUseGridView);

  // Sort the contents
  const sortedContents = sortContents(contents, currentSort, currentSortDir);

  // Render the sort toolbar
  renderSortToolbar();

  // Render the file list
  let html = '';
  sortedContents.forEach(item => {
    const itemType = item.type === 'directory' ? 'directory' : getFileType(item.name);
    const itemPath = path ? `${path}/${item.name}` : item.name;
    let previewUrl = item.type === 'file' ? `${item.url || `/gdl/api/files/${itemPath}`}` : null;
    if (previewUrl && itemType === 'image' && !item.name.toLowerCase().endsWith('.gif')) {
      previewUrl += '?x=50';
    }
    
    html += `
      <div class="file-item ${item.type}" data-path="${itemPath}">
        ${previewUrl ? `
          ${itemType === 'video' ? `
            <div class="video-preview-container">
              <video 
                class="file-preview video" 
                src="${previewUrl}" 
                preload="metadata"
                onmouseover="this.play(); this.muted=false;" 
                onmouseout="this.pause(); this.currentTime=0; this.muted=true;"
              ></video>
            </div>
          ` : itemType === 'image' ? `
            <div class="preview-container">
              <img class="file-preview loading" data-src="${previewUrl}" alt="${item.name}">
            </div>
          ` : `
            <div class="file-icon ${itemType}">${icons[itemType]}</div>
          `}
        ` : `
          <div class="file-icon ${itemType}">${icons[itemType]}</div>
        `}
        <div class="file-details">
          <div class="file-name">${item.name}</div>
          <div class="file-meta">
            <span>${formatDate(item.modified)}</span><br>
            <span>${item.type === 'file' ? formatSize(item.size) : 'Directory'}</span>
          </div>
        </div>
      </div>`;
  });
  fileList.innerHTML = html;

  // Add event listeners for sort buttons
  setupSortButtons();

  // Update click handlers for files and directories
  setupFileClickHandlers();

  if (shouldUseGridView) {
    setupLazyLoading();
  }
}
// Initialize popup events
setupImagePopupEvents();
// Initialize
const initialPath = window.location.pathname.replace(basePath, '');
loadDirectory(initialPath);
document.addEventListener('click', handleDirectoryClick);