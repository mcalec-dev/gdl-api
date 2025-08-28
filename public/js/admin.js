document.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading')
  const announcementForm = document.getElementById('announcement-form')
  const announcementList = document.getElementById('announcement-list')
  function loadAnnouncements() {
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
                    <div class="rounded-lg border border-gray-700 p-4 shadow-md text-xs text-gray-200">
                      <div class="flex flex-wrap gap-1 mb-1">
                        <span class="font-semibold text-gray-300">Title:</span>
                        <span>${announcement.title}</span>
                      </div>
                      <div class="flex flex-wrap gap-1 mb-1">
                        <span class="font-semibold text-gray-300">Message:</span>
                        <span>${announcement.message}</span>
                      </div>
                      <div class="flex flex-wrap gap-1 mb-1">
                        <span class="font-semibold text-gray-300">Severity:</span>
                        <span>${announcement.severity}</span>
                      </div>
                      <div class="flex flex-wrap gap-1 mb-1">
                        <span class="font-semibold text-gray-300">Created By:</span>
                        <span>${announcement.createdBy}</span>
                      </div>
                      <div class="flex flex-wrap gap-1 mb-1">
                        <span class="font-semibold text-gray-300">Created At:</span>
                        <span>${new Date(announcement.created).toLocaleString()}</span>
                      </div>
                      <div class="flex flex-wrap gap-1 mb-1">
                        <span class="font-semibold text-gray-300">UUID:</span>
                        <span>${announcement.uuid}</span>
                      </div>
                      <div class="flex gap-2 mt-2">
                        <button class="px-2 py-1 bg-blue-700 text-white rounded" onclick="editAnnouncement('${announcement._id}')">Edit</button>
                        <button class="px-2 py-1 bg-red-600 text-white rounded" onclick="deleteAnnouncement('${announcement._id}')">Delete</button>
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
        console.error('Failed to load announcements:', error)
      })
  }
  announcementForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const title = document.getElementById('announcement-title-input').value
    const message = document.getElementById('announcement-message-input').value
    const severity = document.getElementById(
      'announcement-severity-input'
    ).value
    fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, severity }),
    })
      .then((res) => res.json())
      .then(() => {
        loadAnnouncements()
        announcementForm.reset()
      })
      .catch((error) => {
        console.error('Failed to create announcement:', error)
      })
  })
  function deleteAnnouncement(id) {
    fetch(`/api/admin/announcements/${id}`, {
      method: 'DELETE',
    })
      .then((res) => res.json())
      .then(async () => {
        await loadAnnouncements()
      })
      .catch((error) => {
        console.error('Failed to delete announcement:', error)
      })
  }
  window.deleteAnnouncement = deleteAnnouncement
  fetch('/api/admin')
    .then((res) => res.json())
    .then((data) => {
      loading.style.display = 'none'
      if (data.stats) {
        document.getElementById('stat-uptime').textContent = data.stats.uptime
        document.getElementById('stat-loggedin').textContent =
          data.stats.loggedInUsers
        document.getElementById('stat-toptags').textContent =
          data.stats.topTags.join(', ')
        document.getElementById('stat-flags').textContent = data.stats.flags
      }
    })
    .catch((error) => {
      loading.style.display = 'none'
      error.style.display = ''
      error.textContent = 'Failed to load dashboard.'
    })
  loadAnnouncements()
})
