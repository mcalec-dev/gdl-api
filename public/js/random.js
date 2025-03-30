const loadImageBtn = document.getElementById('loadImageBtn');
const imageContainer = document.getElementById('imageContainer');
const loading = document.getElementById('loading');
const imageInfo = document.getElementById('imageInfo');
const API_URL = '/gdl/api/random';

async function loadRandomMedia() {
    try {
        imageContainer.classList.remove('has-image');
        loading.textContent = 'Loading...';
        loading.style.display = 'block';
        loading.classList.remove('error');

        // Clear previous media
        imageContainer.querySelectorAll('img, video').forEach(el => el.remove());

        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        const data = await response.json();
        const mediaUrl = data.url;
        const isVideo = data.file.toLowerCase().match(/\.(mp4|webm|mov)$/);

        // Create media element
        const mediaElement = isVideo ? 
            document.createElement('video') : 
            document.createElement('img');

        mediaElement.className = 'media-element';
        
        if (isVideo) {
            mediaElement.controls = true;
            mediaElement.muted = false;
            mediaElement.loop = true;
            mediaElement.autoplay = false;
        }

        // Update info display
        imageInfo.innerHTML = `
            <span>Collection: ${data.collection}</span><br>
            <span>File: ${data.file}</span>
        `;

        // Set up load handlers
        const loadHandler = () => {
            loading.style.display = 'none';
            mediaElement.style.display = 'block';
            imageInfo.style.display = 'block';
            imageContainer.classList.add('has-image');
        };

        mediaElement.addEventListener(isVideo ? 'loadeddata' : 'load', loadHandler);
        mediaElement.addEventListener('error', handleMediaError);

        // Set source and append
        mediaElement.src = mediaUrl;
        imageContainer.appendChild(mediaElement);

        // Add click handler to open in new tab
        imageContainer.onclick = () => window.open(mediaUrl, '_blank');

    } catch (error) {
        console.error('Error loading random media:', error);
        handleMediaError();
    }
}

function handleMediaError() {
    loading.textContent = 'Failed to load media. Try again.';
    loading.classList.add('error');
    imageInfo.style.display = 'none';
    imageContainer.classList.remove('has-image');
}

loadImageBtn.addEventListener('click', loadRandomMedia);