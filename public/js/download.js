document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('downloadForm');
  const urlInput = document.getElementById('urlInput');
  const statusMessage = document.getElementById('statusMessage');
  let previewDiv = document.getElementById('preview');
  if (!previewDiv) {
    previewDiv = document.createElement('div');
    previewDiv.id = 'preview';
    // Insert preview after the container div
    const container = form.closest('.container');
    if (container && container.parentNode) {
      container.parentNode.insertBefore(previewDiv, container.nextSibling);
    } else {
      // fallback: append to body
      document.body.appendChild(previewDiv);
    }
  }
  function clearPreview() {
    previewDiv.innerHTML = '';
    previewDiv.classList.remove('error', 'has-preview');
    previewDiv.style.display = 'none';
  }
  function showPreview(url) {
    clearPreview();
    if (!url) return;
    previewDiv.style.display = 'inline-block';
    previewDiv.classList.add('has-preview');
    // --- Structure exactly like randomizer ---
    // <div class="image-container [has-image]">
    //   <img|video ...>
    //   <div class="image-info"></div>
    // </div>
    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-container';
    const ext = url.split('.').pop().toLowerCase();
    const apiUrl = `/gdl/api/download?q=${encodeURIComponent(url)}`;
    let mediaElement;
    let isMedia = false;
    if (["jpg","jpeg","png","gif","webp","bmp","svg"].includes(ext)) {
      mediaElement = document.createElement('img');
      mediaElement.src = apiUrl;
      mediaElement.alt = 'Preview';
      isMedia = true;
      mediaElement.addEventListener('error', () => {
        imageContainer.innerHTML = '<div class="error">Could not load image preview.</div>';
      });
    } else if (["mp4","webm","mov","ogg"].includes(ext)) {
      mediaElement = document.createElement('video');
      mediaElement.src = apiUrl;
      mediaElement.controls = true;
      isMedia = true;
      mediaElement.addEventListener('error', () => {
        imageContainer.innerHTML = '<div class="error">Could not load video preview.</div>';
      });
    }
    if (isMedia) {
      imageContainer.appendChild(mediaElement);
      imageContainer.classList.add('has-image');
      imageContainer.onclick = () => window.open(url, '_blank');
    } else {
      imageContainer.innerHTML = '<div class="file-info">No preview available for this file type.</div>';
    }
    // Always add .image-info for structure, but leave empty for downloader
    const imageInfo = document.createElement('div');
    imageInfo.className = 'image-info';
    imageContainer.appendChild(imageInfo);
    previewDiv.appendChild(imageContainer);
  }
  urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    if (url.length > 5 && url.startsWith('http')) {
      showPreview(url);
    } else {
      clearPreview();
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusMessage.textContent = '';
    const url = urlInput.value.trim();
    if (!url) {
      statusMessage.textContent = 'Please enter a URL.';
      return;
    }
    try {
      statusMessage.textContent = 'Downloading...';
      statusMessage.style.display = 'block';
      const a = document.createElement('a');
      a.href = `/gdl/api/download?q=${encodeURIComponent(url)}`;
      a.download = '';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        statusMessage.textContent = '';
        statusMessage.style.display = 'none';
      }, 1200);
    } catch (err) {
      statusMessage.textContent = 'Failed to start download.';
      statusMessage.style.display = 'block';
      console.error('Download error:', err);
    }
  });
});
