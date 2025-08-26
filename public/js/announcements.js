document.addEventListener('DOMContentLoaded', () => {
  // Announcements
  fetch('/api/admin/announcements/get')
    .then((res) => res.json())
    .then((announcements) => {
      renderAnnouncement(announcements[0])
    })
  function renderAnnouncement(announcement) {
    const container = document.getElementById('announcements-container')
    if (!container) return
    if (!announcement) {
      container.style.display = 'none'
      return
    }
    container.style.display = ''
    document.getElementById('announcement-severity').textContent =
      announcement.severity
    document.getElementById('announcement-message').textContent =
      announcement.message
    // Optionally set icon/color based on severity
    const icon = document.getElementById('severity-icon')
    if (icon) {
      icon.className = ''
      if (announcement.severity === 'info') icon.textContent = 'ℹ️'
      else if (announcement.severity === 'success') icon.textContent = '✅'
      else if (announcement.severity === 'warning') icon.textContent = '⚠️'
      else if (announcement.severity === 'error') icon.textContent = '⛔'
    }
  }
})
