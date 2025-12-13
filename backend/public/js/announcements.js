'use strict'
import * as utils from '../min/index.min.js'
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
    const title = (await utils.parseEmojis(announcement.title))
      .trim()
      .replace(/\n/g, '<br />')
    document.getElementById('announcement-title').innerHTML = title
    const message = (await utils.parseEmojis(announcement.message))
      .trim()
      .replace(/\n/g, '<br />')
      .replace(/\s{2,}/g, ' ')
    document.getElementById('announcement-message').innerHTML = message
  }
}
window.fetchAnnouncements = fetchAnnouncements
document.addEventListener(
  'DOMContentLoaded',
  async () => await fetchAnnouncements()
)
