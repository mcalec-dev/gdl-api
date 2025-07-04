import { formatSize, formatDate, apiHost } from '../min/index.min.js';
let frontendBasePath = '/gdl/files';
let apiBasePath = '';
const fileList = document.getElementById('fileList');
const breadcrumb = document.getElementById('breadcrumb');
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const icons = {
  directory: '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
  image: '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-.55 0-1 .45-1 1v14c0 1.1.89 2 2 2h14c1.1 0-2-.9-2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
  video: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 1.1.89 2 2 2H18c1.1 0-2-.9-2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>',
  other: '<svg viewBox="0 0 24 24"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>'
};
let currentDirectoryData = null;
let currentImageIndex = 0;
let currentImageList = [];
let currentSort = 'name';
let currentSortDir = 'none';
let currentFetchController = null;
let imageLoadControllers = new Map();
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
  let breadcrumbHtml = `<a href="${frontendBasePath}/">Home</a>`;
  parts.forEach((part, index) => {
    currentPath += `/${part}`;
    if (index < parts.length - 1) {
      breadcrumbHtml += `<span>/</span><a href="${frontendBasePath}${currentPath}/">${part}</a>`;
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
async function loadDirectory(path = '', callback) {
  try {
    // Abort any ongoing fetch request
    if (currentFetchController) {
      currentFetchController.abort();
    }
    // Cancel ongoing image loads
    cancelImageLoads();

    currentFetchController = new AbortController();
    const { signal } = currentFetchController;

    // Clean and normalize path        
    path = path ? decodeURIComponent(path) : '';
    if (path) {
      const frontendBasePathEscaped = escapeRegExp(frontendBasePath);
      path = path
        .replace(new RegExp(`^${frontendBasePathEscaped}/?`), '')
        .replace(/\/+/g, '/')
        .replace(/^\/|\/$/g, '');
    }
    
    // Show loading indicator without affecting layout
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading';
    loadingIndicator.innerHTML = '<span>Loading...</span>';
    fileList.appendChild(loadingIndicator);

    updateBreadcrumb(path);
    const apiPath = path ? `/${path}/` : '';
    if (!currentDirectoryData || currentDirectoryData.path !== path) {
      const response = await fetch(`${apiBasePath}${apiPath}`, { signal });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unknown error occurred');
      }
      currentDirectoryData = { path, contents: data.contents };
    }
    
    // Remove loading indicator before rendering new contents
    fileList.removeChild(loadingIndicator);

    // Check if in a collection or root
    const isRoot = !path;
    const shouldUseGridView = !isRoot && currentDirectoryData.contents.some(item => item.type === 'file');
    fileList.classList.toggle('grid-view', shouldUseGridView);

    // Render directory contents
    renderDirectory(currentDirectoryData.contents, path);
    if (callback) {
      callback();
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      fileList.innerHTML = `
        <div class="error">
            Error loading directory contents<br>
            <small>${error.message}</small>
        </div>`;
    }
  }
}
function setupFileClickHandlers() {
  const fileList = document.getElementById('fileList');
  fileList.addEventListener('click', event => {
    const media = event.target.closest('.file-item[data-type="image"], .file-item[data-type="video"]');
    if (media) {
      event.preventDefault();
      // Create a list of media items with minimal info, avoiding immediate loading
      currentImageList = Array.from(fileList.querySelectorAll('.file-item[data-type="image"], .file-item[data-type="video"]'))
        .map(media => {
          const preview = media.querySelector('img, video');
          const mediaPath = media.dataset.path;
          const encodedPath = mediaPath.split('/').map(part => encodeURIComponent(part)).join('/');
          return {
            name: mediaPath.split('/').pop(),
            path: mediaPath,
            type: getFileType(mediaPath),
            // Store info needed to construct URL when needed
            encodedPath,
            previewSrc: preview?.dataset.src?.split('?')[0] || null
          };
        });
      currentImageIndex = currentImageList.findIndex(item => item.path === media.dataset.path);
      showImagePopup(currentImageIndex);
    }
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
  const frontendBasePathEscaped = escapeRegExp(frontendBasePath);
  const currentPath = location === frontendBasePath || location === `${frontendBasePath}/` ?
    '' :
    location
      .replace(new RegExp(`^${frontendBasePathEscaped}/?`), '')
      .replace(/\/+/g, '/')
      .replace(/^\/|\/$/g, '');
  loadDirectory(currentPath);
});
// Initial load
const initialLocation = window.location.pathname;
const frontendBasePathEscaped = escapeRegExp(frontendBasePath);
const currentPath = initialLocation === frontendBasePath || initialLocation === `${frontendBasePath}/` ?
  '' :
  initialLocation
    .replace(new RegExp(`^${frontendBasePathEscaped}/?`), '')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
loadDirectory(currentPath);

function setupLazyLoading() {
  // Disconnect any existing observers
  if (window.lazyLoadObserver) {
    window.lazyLoadObserver.disconnect();
  }

  window.lazyLoadObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const element = entry.target;
        if (entry.isIntersecting) {
        // Only load if not already loaded
        if (element.classList.contains('loading') && element.dataset.src && !element.src) {
          const controller = new AbortController();
          imageLoadControllers.set(element, controller);
          
          if (element.tagName.toLowerCase() === 'video') {
            // For videos, load metadata first
            element.preload = 'metadata';
            element.src = element.dataset.src;
            element.muted = true;
            element.classList.remove('loading');
            imageLoadControllers.delete(element);
          } else {
            // For images
            element.src = element.dataset.src;
            element.onload = () => {
              element.classList.remove('loading');
              imageLoadControllers.delete(element);
            };
            element.onerror = () => {
              console.error('Failed to load:', element.dataset.src);
              element.classList.remove('loading');
              element.classList.add('error');
              imageLoadControllers.delete(element);
            };
          }
        }
      } else {
        // When element leaves viewport
        if (!element.classList.contains('zoomed')) { // Don't unload zoomed images
          if (element.tagName.toLowerCase() === 'video') {
            element.pause();
            element.currentTime = 0;
            element.removeAttribute('src');
            element.preload = 'none';
            element.load(); // Force browser to reset video
          } else {
            element.removeAttribute('src');
          }
          element.classList.add('loading');
        }
      }
    });
  }, {
    rootMargin: '50px 0px', // Load items just before they enter the viewport
    threshold: 0.1
  });

  // Start observing all preview elements
  document.querySelectorAll('.file-preview').forEach(element => {
    window.lazyLoadObserver.observe(element);
  });
}

// Cancel all ongoing image loads
function cancelImageLoads() {
  imageLoadControllers.forEach((controller, element) => {
    controller.abort();
    element.src = ''; // Clear the src to stop loading
    if (element.tagName.toLowerCase() === 'video') {
      element.load(); // Reset video element
    }
    element.classList.add('loading'); // Reset to loading state
  });
  imageLoadControllers.clear();
}

function handleDirectoryClick(event) {
  // Ensure the click originated from a directory item
  const target = event.target.closest('.file-item.directory');
  if (!target) return;

  event.preventDefault();
  const itemPath = target.dataset.path;
  if (!itemPath) return;
  
  // Construct the new URL (always with trailing slash)
  let newPath = `${frontendBasePath}/${itemPath}`.replace(/\/+/g, '/');
  if (!newPath.endsWith('/')) newPath += '/';
  // Clean the path before loading
  const cleanPath = itemPath.replace(new RegExp(`^${frontendBasePath}/?`), '');

  // Preserve current sort params
  const url = new URL(window.location.href);
  const params = url.search;
  // Update state and load the directory
  history.pushState({ path: cleanPath }, '', newPath + params);
  loadDirectory(cleanPath);
  // Scroll to top after state change
  window.scrollTo(0, 0);
}
function getMediaUrl(item) {
  return item.previewSrc || `${apiBasePath}/${item.encodedPath}`;
}

// Preload an image without displaying it
function preloadMedia(item) {
  if (!item || item.type === 'video') return; // Only preload images
  const preloadImg = document.createElement('img');
  preloadImg.src = getMediaUrl(item);
}

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

  // Hide both media elements initially
  popupImage.style.display = 'none';
  popupVideo.style.display = 'none';
  // Load and show the appropriate media element
  const url = getMediaUrl(item);
  if (item.type === 'video') {
    popupVideo.src = url;
    popupVideo.style.display = 'block';
  } else {
    popupImage.src = url;
    popupImage.style.display = 'block';
  }

  imageTitle.textContent = item.name;
  imageCounter.textContent = `${index + 1} / ${currentImageList.length}`;

  // Update navigation buttons
  prevButton.disabled = index === 0;
  nextButton.disabled = index === currentImageList.length - 1;
  
  // Show popup if not already visible
  popupViewer.style.display = 'flex';
  currentImageIndex = index;

  // Preload adjacent images
  if (index > 0) {
    preloadMedia(currentImageList[index - 1]);
  }
  if (index < currentImageList.length - 1) {
    preloadMedia(currentImageList[index + 1]);
  }
}

function setupImagePopupEvents() {
  const popupViewer = document.getElementById('popup-viewer');
  const closeButton = document.getElementById('close-popup');
  const newTabButton = document.getElementById('open-new-tab');
  const prevButton = document.getElementById('prev-image');
  const nextButton = document.getElementById('next-image');
  const popupImage = document.getElementById('popup-image');
  const popupVideo = document.getElementById('popup-video');
  let isZoomed = false;

  function closePopup() {
    if (!popupVideo.paused) {
      popupVideo.pause();
    }
    // Reset zoom state before closing
    if (isZoomed) {
      handleZoom(0, 0);
    }
    popupImage.src = ''; // Reset image URL
    popupVideo.src = ''; // Reset video URL
    popupViewer.style.display = 'none';
  }

  // Open image in new tab
  newTabButton.addEventListener('click', () => {
    const item = currentImageList[currentImageIndex];
    window.open(item.url, '_blank');
  });

  // Close popup
  closeButton.addEventListener('click', closePopup);
  
  // Close on background click
  popupViewer.addEventListener('click', (e) => {
    if (e.target === popupViewer) {
      closePopup();
    }
  });
  
  // Navigation
  prevButton.addEventListener('click', () => {
    if (currentImageIndex > 0) {
      // Reset zoom state before navigating
      if (isZoomed) {
        handleZoom(0, 0);
      }
      showImagePopup(currentImageIndex - 1);
    }
  });
  
  nextButton.addEventListener('click', () => {
    if (currentImageIndex < currentImageList.length - 1) {
      // Reset zoom state before navigating
      if (isZoomed) {
        handleZoom(0, 0);
      }
      showImagePopup(currentImageIndex + 1);
    }
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (popupViewer.style.display === 'flex') {
      switch(e.key) {
        case 'Escape':
          closePopup();
          break;
        case 'ArrowLeft':
          if (currentImageIndex > 0) {
            // Reset zoom state before navigating
            if (isZoomed) {
              handleZoom(0, 0);
            }
            showImagePopup(currentImageIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (currentImageIndex < currentImageList.length - 1) {
            // Reset zoom state before navigating
            if (isZoomed) {
              handleZoom(0, 0);
            }
            showImagePopup(currentImageIndex + 1);
          }
          break;
      }
    }
  });
  
  function handleZoom(x, y) {
    if (isZoomed) {
      popupImage.classList.remove('zoomed');
      popupImage.style.transform = 'none';
      popupImage.style.cursor = 'zoom-in';
      popupImage.style.maxHeight = '';
      popupImage.style.maxWidth = '';
      popupImage.style.height = '';
      popupImage.style.width = '';
      popupImage.style.objectFit = '';
      isZoomed = false;
      // Remove mousemove listener when unzoomed
      popupImage.removeEventListener('mousemove', handleMouseMove);
    } else {
      // Set dimensions to fill viewport
      popupImage.style.maxHeight = '95vh';
      popupImage.style.maxWidth = '95vw';
      popupImage.style.height = '95vh';
      popupImage.style.width = '95vw';
      popupImage.style.objectFit = 'contain';
      
      // Get dimensions after setting max size
      const rect = popupImage.getBoundingClientRect();
      
      // Calculate relative position of click within the viewport-sized image
      const relativeX = (x - rect.left) / rect.width;
      const relativeY = (y - rect.top) / rect.height;
      
      // Apply zoom centered on click position
      popupImage.classList.add('zoomed');
      updateZoomPosition(relativeX, relativeY);
      popupImage.style.cursor = 'zoom-out';
      isZoomed = true;
      
      // Add mousemove listener when zoomed
      popupImage.addEventListener('mousemove', handleMouseMove);
    }
  }

  function handleMouseMove(e) {
    if (!isZoomed) return;
    
    const rect = popupImage.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const relativeY = (e.clientY - rect.top) / rect.height;
    updateZoomPosition(relativeX, relativeY);
  }

  function updateZoomPosition(relativeX, relativeY) {
    // Ensure the relative positions are within bounds
    const boundedX = Math.max(0, Math.min(1, relativeX));
    const boundedY = Math.max(0, Math.min(1, relativeY));
    
    popupImage.style.transformOrigin = `${boundedX * 100}% ${boundedY * 100}%`;
    popupImage.style.transform = 'scale(2)';
  }

  // Mouse events for zoom
  popupImage.addEventListener('click', (e) => {
    handleZoom(e.clientX, e.clientY);
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

      // Update URL query params
      const url = new URL(window.location.href);
      // Remove all sort params first
      ['name','size','type','modified'].forEach(param => url.searchParams.delete(param));
      if (SORT_STATES[sortBy] !== 'none') {
        url.searchParams.set(sortBy, SORT_STATES[sortBy]);
      }
      // Always ensure trailing slash for directory URLs
      let pathname = url.pathname;
      if (!pathname.endsWith('/')) pathname += '/';
      window.history.replaceState({}, '', pathname + url.search);

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
    let previewUrl = null;
    if (item.type === 'file') {
      // Ensure proper URL encoding of the path
      const encodedPath = itemPath.split('/').map(part => encodeURIComponent(part)).join('/');
      previewUrl = item.url || `${apiBasePath}/${encodedPath}`;
      // Only add ?x=50 for non-gif images
      if (itemType === 'image' && !item.name.toLowerCase().endsWith('.gif')) {
        previewUrl += '?x=50';
      }
      // For gifs, leave previewUrl as is (no ?x=50) so they autoplay
    }

    html += `<div class="file-item ${item.type}" data-type="${itemType}" data-path="${itemPath}">`;
    if (itemType === 'directory') {
      html += `<div class="file-icon ${itemType}">${icons[itemType]}</div>`;
    } else if (previewUrl) {
      if (itemType === 'video') {
        html += `<div class="video-preview-container">
          <video 
            class="file-preview video loading" 
            data-src="${previewUrl}"
            preload="none"
            onmouseover="if(this.src) { this.play(); this.muted=false; }" 
            onmouseout="if(this.src) { this.pause(); this.currentTime=0; this.muted=true; }"
            draggable="false"
          ></video>
        </div>`;
      } else if (itemType === 'image') {
        html += `<div class="preview-container">
          <img class="file-preview loading" data-src="${previewUrl}" alt="${item.name}" draggable="false">
        </div>`;
      } else {
        html += `<div class="file-icon ${itemType}">${icons[itemType]}</div>`;
      }
    } else {
      html += `<div class="file-icon ${itemType}">${icons[itemType]}</div>`;
    }
    html += `<div class="file-details">
      <div class="file-name">${item.name}</div>
      <div class="file-meta">
        <span>${formatDate(item.modified)}</span><br>
        <span>${formatSize(item.size)}</span>
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
// Only call loadDirectory once on initial load
function getSortFromQuery() {
  const params = new URLSearchParams(window.location.search);
  let found = false;
  ['name','size','type','modified'].forEach(param => {
    const dir = params.get(param);
    if (dir === 'asc' || dir === 'desc') {
      currentSort = param;
      currentSortDir = dir;
      Object.keys(SORT_STATES).forEach(key => SORT_STATES[key] = 'none');
      SORT_STATES[param] = dir;
      found = true;
    }
  });
  if (!found) {
    currentSort = 'name';
    currentSortDir = 'none';
    Object.keys(SORT_STATES).forEach(key => SORT_STATES[key] = 'none');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const apiBase = await apiHost();
  apiBasePath = `${apiBase}/files`;
  getSortFromQuery();
  // Use regex-safe frontendBasePath for replace
  const frontendBasePathEscaped = escapeRegExp(frontendBasePath);
  const initialPath = window.location.pathname.replace(new RegExp(`^${frontendBasePathEscaped}`), '');
  loadDirectory(initialPath);
});
document.addEventListener('click', handleDirectoryClick);