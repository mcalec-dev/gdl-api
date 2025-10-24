'use strict'
import * as utils from './index.js'
async function fetchAnnouncements() {
  fetch('/api/user/announcements/')
    .then((res) => res.json())
    .then((announcements) => {
      renderAnnouncement(announcements[0])
    })
  async function renderAnnouncement(announcement) {
    const container = document.getElementById('announcements-container')
    if (!announcement) {
      container.hidden = true
      return
    }
    if (announcement.severity) {
      if (announcement.severity === 'info')
        container.classList.add('bg-blue-600')
      if (announcement.severity === 'success')
        container.classList.add('bg-green-600')
      if (announcement.severity === 'warning')
        container.classList.add('bg-yellow-600')
      if (announcement.severity === 'error')
        container.classList.add('bg-red-600')
    }
    container.hidden = false
    document.getElementById('announcement-title').innerHTML = announcement.title
    document.getElementById('announcement-message').innerHTML =
      await utils.parseEmojis(announcement.message)
  }
}
window.fetchAnnouncements = fetchAnnouncements
document.addEventListener(
  'DOMContentLoaded',
  async () => await fetchAnnouncements()
)
