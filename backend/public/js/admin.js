'use strict'
import * as utils from './min/index.min.js'
document.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading')
  const announcementForm = document.getElementById('announcement-form')
  const announcementList = document.getElementById('announcement-list')
  async function loadAnnouncements() {
    fetch('/api/admin/announcements')
      .then((res) => res.json())
      .then((announcements) => {
        if (!Array.isArray(announcements) || announcements.length === 0) {
          announcementList.innerHTML = ''
          return
        }
        announcementList.innerHTML = `
          <div class="mt-4 w-full md:max-w-full sm:max-w-full">
            <div class="flex flex-col gap-4 mt-2 center">
              ${(() => {
                let html = ''
                announcements.forEach((announcement) => {
                  html += `
                    <div id="announcement-${announcement.uuid}" class="rounded-lg border border-gray-700 p-4 shadow-md text-xs text-gray-200">
                      <div class="flex flex-wrap gap-1 mb-1 items-center">
                        <span class="font-semibold text-gray-300 text-center">Title:</span>
                        <span id="announcement-title">${announcement.title}</span>
                      </div>
                      <div class="flex flex-wrap gap-1 mb-1 items-center">
                        <span class="font-semibold text-gray-300 text-center">Message:</span>
                        <span id="announcement-message">${announcement.message}</span>
                      </div>
                      <div class="flex flex-wrap gap-1 mb-1 items-center">
                        <span class="font-semibold text-gray-300 text-center">Severity:</span>
                        <span id="announcement-severity">${announcement.severity}</span>
                      </div>
                      <div class="flex flex-wrap gap-1 mb-1 items-center">
                        <span class="font-semibold text-gray-300">Created By:</span>
                        <span class="select-all">${announcement.author}</span>
                      </div>
                      <div class="flex flex-wrap gap-1 mb-1 items-center">
                        <span class="font-semibold text-gray-300">Created At:</span>
                        <span>${new Date(announcement.created).toLocaleString()}</span>
                      </div>
                      <div class="flex flex-wrap gap-1 mb-1 items-center">
                        <span class="font-semibold text-gray-300">Modified At:</span>
                        <span>${new Date(announcement.modified).toLocaleString()}</span>
                      </div>
                      <div class="flex flex-wrap gap-1 mb-1 items-center">
                        <span class="font-semibold text-gray-300">UUID:</span>
                        <span><code class="bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded select-all">${announcement.uuid}</code></span>
                      </div>
                      <div class="flex gap-2 mt-2">
                        <button id="edit-btn" class="px-2 py-1 bg-blue-700 text-white rounded items-center text-center" onclick="editAnnouncement('${announcement.uuid}', ${JSON.stringify(announcement).replace(/"/g, '&quot;')})">Edit</button>
                        <button id="delete-btn" class="px-2 py-1 bg-red-600 text-white rounded items-center text-center" onclick="deleteAnnouncement('${announcement.uuid}')">Delete</button>
                      </div>
                    </div>
                  `
                })
                return html
              })()}
            </div>
          </div>
        `
      })
      .catch((error) => {
        utils.handleError(error)
        loading.style.display = 'none'
        error.style.display = ''
        error.textContent = error.message
      })
  }
  announcementForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const title = document.getElementById('announcement-title-input').value
    const message = document.getElementById('announcement-message-input').value
    const severity = document.getElementById(
      'announcement-severity-input'
    ).value
    fetch('/api/admin/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, message, severity }),
    })
      .then((res) => res.json())
      .then(async () => {
        loadAnnouncements()
        await announcementForm.reset()
        await window.fetchAnnouncements()
      })
      .catch((error) => {
        utils.handleError(error)
        loading.style.display = 'none'
        error.style.display = ''
        error.textContent = error.message
      })
  })
  function editAnnouncement(uuid, announcement) {
    const announcementDiv = document.getElementById(`announcement-${uuid}`)
    const { title, message, severity } = announcement
    const titleEl = announcementDiv.querySelector('#announcement-title')
    const messageEl = announcementDiv.querySelector('#announcement-message')
    const severityEl = announcementDiv.querySelector('#announcement-severity')
    const deleteBtn = announcementDiv.querySelector('#delete-btn')
    const editBtn = announcementDiv.querySelector('#edit-btn')
    titleEl.innerHTML = `<input type="text" id="edit-title-input-${uuid}" class="flex w-full px-2 py-1 text-xs bg-[#1f1f1f] text-white border border-white/20 rounded" value="${title}"></input>`
    messageEl.innerHTML = `<textarea id="edit-message-input-${uuid}" class="flex w-full px-2 py-1 text-xs bg-[#1f1f1f] text-white border border-white/20 rounded" rows="2" value="${message}">${message}</textarea>`
    severityEl.innerHTML = `
      <select id="edit-severity-input-${uuid}" class="flex px-2 py-1 text-xs bg-[#1f1f1f] text-white border border-white/20 rounded">
        <option value="info" ${severity === 'info' ? 'selected' : ''}>Info</option>
        <option value="warning" ${severity === 'warning' ? 'selected' : ''}>Warning</option>
        <option value="error" ${severity === 'error' ? 'selected' : ''}>Error</option>
      </select>
    `
    deleteBtn.textContent = 'Cancel'
    deleteBtn.classList =
      'px-2 py-1 bg-gray-600 text-white rounded items-center text-center'
    deleteBtn.onclick = () => cancelEdit(uuid, title, message, severity)
    editBtn.textContent = 'Save'
    editBtn.classList =
      'px-2 py-1 bg-green-600 text-white rounded items-center text-center'
    editBtn.onclick = () => saveAnnouncement(uuid)
  }
  async function saveAnnouncement(uuid) {
    const announcementDiv = document.getElementById(`announcement-${uuid}`)
    const title = announcementDiv.querySelector(
      `#edit-title-input-${uuid}`
    ).value
    const message = announcementDiv.querySelector(
      `#edit-message-input-${uuid}`
    ).value
    const severity = announcementDiv.querySelector(
      `#edit-severity-input-${uuid}`
    ).value
    fetch(`/api/admin/announcements/${uuid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, message, severity }),
    })
      .then((res) => res.json())
      .then(async () => {
        loadAnnouncements()
        await window.fetchAnnouncements()
      })
      .catch((error) => {
        utils.handleError(error)
        loading.style.display = 'none'
        error.style.display = ''
        error.textContent = error.message
      })
  }
  function cancelEdit(uuid, originalTitle, originalMessage, originalSeverity) {
    const announcementDiv = document.getElementById(`announcement-${uuid}`)
    announcementDiv.querySelector('#announcement-title').textContent =
      originalTitle
    announcementDiv.querySelector('#announcement-message').textContent =
      originalMessage
    announcementDiv.querySelector('#announcement-severity').textContent =
      originalSeverity
    const deleteBtn = announcementDiv.querySelector('#delete-btn')
    const editBtn = announcementDiv.querySelector('#edit-btn')
    deleteBtn.textContent = 'Delete'
    deleteBtn.classList =
      'px-2 py-1 bg-red-600 text-white rounded items-center text-center'
    deleteBtn.onclick = () => deleteAnnouncement(uuid)
    editBtn.textContent = 'Edit'
    editBtn.classList =
      'px-2 py-1 bg-blue-700 text-white rounded items-center text-center'
    editBtn.onclick = () =>
      editAnnouncement(uuid, {
        title: originalTitle,
        message: originalMessage,
        severity: originalSeverity,
      })
  }
  async function deleteAnnouncement(id) {
    fetch(`/api/admin/announcements/${id}`, {
      method: 'DELETE',
    })
      .then((res) => res.json())
      .then(async () => {
        loadAnnouncements()
        await window.fetchAnnouncements()
      })
      .catch((error) => {
        utils.handleError(error)
        loading.style.display = 'none'
        error.style.display = ''
        error.textContent = error.message
      })
  }
  window.editAnnouncement = editAnnouncement
  window.deleteAnnouncement = deleteAnnouncement
  fetch('/api/admin')
    .then((res) => res.json())
    .then((data) => {
      loading.style.display = 'none'
      if (data.stats) {
        document.getElementById('stat-uptime').textContent =
          utils.formatMilliseconds(data.stats.uptime)
        document.getElementById('stat-loggedin').textContent =
          data.stats.loggedInUsers
        document.getElementById('stat-toptags').textContent =
          data.stats.topTags.join(', ')
        document.getElementById('stat-flags').textContent = data.stats.flags
      }
    })
    .catch((error) => {
      utils.handleError(error)
      loading.style.display = 'none'
      error.style.display = ''
      error.textContent = error.message
    })
  loadAnnouncements()
})
