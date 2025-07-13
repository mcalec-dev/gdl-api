document.addEventListener('DOMContentLoaded', () => {
  function setTheme() {
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }
  setTheme()
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', setTheme)
  function createAndShowPopup() {
    const existing = document.querySelector('.consent-overlay')
    if (existing) existing.remove()
    const overlay = document.createElement('div')
    overlay.className = 'consent-overlay'
    const popup = document.createElement('div')
    popup.className = 'consent-popup'
    popup.innerHTML = `
      <h2>Content Warning</h2>
      <p>This site may contain suggestive content and media that some users may find uncomfortable.</p>
      <div class="consent-buttons">
        <button id="leaveButton">Leave Site</button>
        <button id="acceptButton">Okay</button>
      </div>
    `
    overlay.appendChild(popup)
    document.body.appendChild(overlay)
    document.getElementById('leaveButton').onclick = () => {
      window.history.back()
    }
    document.getElementById('acceptButton').onclick = () => {
      setCookie('content-warning-accepted', 'true', 365)
      overlay.remove()
      document.body.style.overflow = 'auto'
    }
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) {
        overlay.remove()
        document.body.style.overflow = 'auto'
      }
    })
  }
  function createInfoButton() {
    const existingBtn = document.getElementById('consent-info-btn')
    if (existingBtn) existingBtn.remove()
    const btn = document.createElement('button')
    btn.id = 'consent-info-btn'
    btn.setAttribute('aria-label', 'Show content warning')
    btn.innerHTML = '<span class="consent-info-icon">ⓘ</span>'
    btn.onclick = () => {
      createAndShowPopup()
    }
    document.body.appendChild(btn)
  }
  function setCookie(name, value, days) {
    const date = new Date()
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
    document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`
  }
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return match ? match[2] : null
  }
  if (!getCookie('content-warning-accepted')) {
    createAndShowPopup()
  }
  createInfoButton()
})
