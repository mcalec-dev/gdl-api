import { parseEmojis } from '../min/index.min.js'
document.addEventListener('DOMContentLoaded', () => {
  // Announcements
  fetch('/api/user/announcements/')
    .then((res) => res.json())
    .then((announcements) => {
      renderAnnouncement(announcements[0])
    })
  async function renderAnnouncement(announcement) {
    const container = document.getElementById('announcements-container')
    if (!container) return
    if (!announcement) {
      container.style.display = 'none'
      return
    }
    container.style.display = ''
    document.getElementById('announcement-title').innerHTML = announcement.title
    document.getElementById('announcement-message').innerHTML =
      await parseEmojis(announcement.message)
    // Optionally set icon/color based on severity
    const icon = document.getElementById('severity-icon')
    if (icon) {
      icon.className = ''
      if (announcement.severity === 'info') icon.textContent = 'ℹ️'
      if (announcement.severity === 'success') icon.textContent = '✅'
      if (announcement.severity === 'warning') icon.textContent = '⚠️'
      if (announcement.severity === 'error') icon.textContent = '⛔'
    }
  }
})
