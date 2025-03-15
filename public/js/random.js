const loadImageBtn = document.getElementById('loadImageBtn');
const imageContainer = document.getElementById('imageContainer');
const loading = document.getElementById('loading');
const imageInfo = document.getElementById('imageInfo');
const API_URL = `/gdl/api/random`;
let currentUrl = '';
const imgElement = document.createElement('img');
imgElement.id = 'randomImage';
imgElement.style.display = 'none';
imgElement.alt = 'Random image';
const videoElement = document.createElement('video');
videoElement.id = 'randomVideo';
videoElement.style.display = 'none';
videoElement.controls = true;
videoElement.style.maxWidth = '100%';
videoElement.style.maxHeight = 'calc(90vh - 120px)';
async function loadRandomMedia() {
  imageContainer.classList.remove('has-image');
  loading.textContent = 'Loading...';
  loading.style.display = 'block';
  loading.classList.remove('error');
  imgElement.style.display = 'none';
  videoElement.style.display = 'none';
  imageInfo.style.display = 'none';
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    const mediaUrl = data.directUrl;
    currentUrl = mediaUrl;
    if (!mediaUrl) {
      throw new Error('No directUrl found in API response');
    }
    imageContainer.querySelectorAll('img, video').forEach(el => el.remove());
    const isVideo = mediaUrl.toLowerCase().endsWith('.mp4');
    if (isVideo) {
      videoElement.src = mediaUrl;
      imageContainer.appendChild(videoElement);
      videoElement.onloadeddata = function() {
        loading.style.display = 'none';
        videoElement.style.display = 'block';
        imageInfo.style.display = 'block';
        imageContainer.classList.add('has-image');
        const container = videoElement.parentElement;
        container.style.width = 'auto';
        container.style.height = 'auto';
        container.style.minWidth = '0';
        container.style.minHeight = '0';
      };
      videoElement.onerror = handleMediaError;
    } else {
      imgElement.src = mediaUrl;
      imageContainer.appendChild(imgElement);
      imgElement.onload = function() {
        loading.style.display = 'none';
        imgElement.style.display = 'block';
        imageInfo.style.display = 'block';
        imageContainer.classList.add('has-image');
        const container = imgElement.parentElement;
        container.style.width = 'auto';
        container.style.height = 'auto';
        container.style.minWidth = '0';
        container.style.minHeight = '0';
      };
      imgElement.onerror = handleMediaError;
    }
  } catch (error) {
    console.error('Error fetching random media:', error);
    handleMediaError();
  }
}
function handleMediaError() {
  loading.textContent = 'Failed to load media. Try again.';
  loading.classList.add('error');
  imageInfo.style.display = 'none';
  imageContainer.classList.remove('has-image');
}
imageContainer.addEventListener('click', () => {
  if (currentUrl) {
    window.open(currentUrl, '_blank');
  }
});
loadImageBtn.addEventListener('click', loadRandomMedia);