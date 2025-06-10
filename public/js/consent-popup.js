document.addEventListener('DOMContentLoaded', () => {
  function setTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }
  setTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setTheme);
  function createAndShowPopup() {
    const overlay = document.createElement('div');
    overlay.className = 'consent-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(5px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
    `;
    const popup = document.createElement('div');
    popup.className = 'consent-popup';
    popup.innerHTML = `
      <h2>Content Warning</h2>
      <p>This site may contain suggestive content and media that some users may find uncomfortable.</p>
      <div class="consent-buttons">
        <button id="leaveButton">Leave Site</button>
        <button id="acceptButton">Okay</button>
      </div>
    `;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    document.getElementById('leaveButton').onclick = () => { 
      window.history.back();
    };
    document.getElementById('acceptButton').onclick = () => {
      setCookie('content-warning-accepted', 'true', 365);
      overlay.remove();
      document.body.style.overflow = 'auto';
    };
  }
  function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
  }
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }
  if (!getCookie('content-warning-accepted')) { 
    createAndShowPopup();
  }
});