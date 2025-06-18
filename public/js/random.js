const loadImageBtn = document.getElementById('loadImageBtn');
const backImageBtn = document.getElementById('backImageBtn');
const forwardImageBtn = document.getElementById('forwardImageBtn');
const imageContainer = document.getElementById('imageContainer');
const loading = document.getElementById('loading');
const imageInfo = document.getElementById('imageInfo');
const API_URL = '/gdl/api/random';
const HISTORY_KEY = 'randomMediaHistory';
const HISTORY_LIMIT = 10;
let history = [];
let historyIndex = -1;
function loadHistory() {
  const h = JSON.parse(localStorage.getItem(HISTORY_KEY));
  if (Array.isArray(h)) {
    history = h;
    historyIndex = history.length - 1;
  }
}
function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}
function showMedia(data) {
  imageContainer.classList.remove('has-image');
  loading.textContent = 'Loading...';
  loading.style.display = 'block';
  loading.classList.remove('error');
  imageContainer.querySelectorAll('img, video').forEach(el => el.remove());
  const mediaUrl = data.url;
  const isVideo = data.file.toLowerCase().match(/\.(mp4|webm|mov)$/);
  const mediaElement = isVideo ? document.createElement('video') : document.createElement('img');
  mediaElement.className = 'media-element';
  if (isVideo) {
    mediaElement.controls = true;
    mediaElement.muted = false;
    mediaElement.loop = true;
    mediaElement.autoplay = false;
  }
  imageInfo.innerHTML = `
    <span id="image-author">${data.author}</span><span> on </span><span id="image-collection">${data.collection}</span><br>
    <span id="image-size">${formatFileSize(data.size)}</span>
  `;
  function formatFileSize(bytes) {
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
  const loadHandler = () => {
    loading.style.display = 'none';
    mediaElement.style.display = 'block';
    imageInfo.style.display = 'block';
    imageContainer.classList.add('has-image');
  };
  mediaElement.addEventListener(isVideo ? 'loadeddata' : 'load', loadHandler);
  mediaElement.addEventListener('error', handleMediaError);
  mediaElement.src = mediaUrl + '';
  imageContainer.appendChild(mediaElement);
  imageContainer.onclick = () => window.open(mediaUrl, '_blank');
}
async function loadRandomMedia() {
  try {
    imageContainer.classList.remove('has-image');
    loading.textContent = '<span>loading...</span>';
    loading.style.display = 'block';
    loading.classList.remove('error');
    imageContainer.querySelectorAll('img, video').forEach(el => el.remove());
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }
    history.push(data);
    if (history.length > HISTORY_LIMIT) {
      history.shift();
    }
    historyIndex = history.length - 1;
    saveHistory();
    showMedia(data);
  } catch (error) {
    debug('Error loading random media:', error);
    handleMediaError();
  }
}
function handleMediaError() {
  loading.textContent = 'Failed to load media. Try again.';
  loading.classList.add('error');
  imageInfo.style.display = 'none';
  imageContainer.classList.remove('has-image');
}
function showPreviousMedia() {
  if (historyIndex > 0) {
    historyIndex--;
    saveHistory();
    showMedia(history[historyIndex], true);
  }
}
function showNextMedia() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    saveHistory();
    showMedia(history[historyIndex], true);
  }
}
loadHistory();
loadImageBtn.addEventListener('click', loadRandomMedia);
backImageBtn.addEventListener('click', showPreviousMedia);
forwardImageBtn.addEventListener('click', showNextMedia);