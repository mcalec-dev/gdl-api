import * as utils from './index.js'

/**
 * Renders escaped announcement text, then expands only known local icon
 * aliases. This preserves line breaks without exposing announcement content
 * to HTML injection.
 *
 * @param {unknown} value Announcement title or message.
 * @returns {Promise<string>} Safe HTML containing optional trusted icon markup.
 */
async function renderAnnouncementText(value) {
  const escaped = utils.escapeHtml(utils.toDisplayText(value))
  return (await utils.parseEmojis(escaped)).replace(/\n/g, '<br />')
}

/**
 * Loads and displays the newest user announcement when the navbar partial is
 * present on the page.
 *
 * @returns {Promise<void>} Resolves after the announcement has been rendered.
 */
async function fetchAnnouncements() {
  const container = document.getElementById('announcements-container')
  const titleElement = document.getElementById('announcement-title')
  const messageElement = document.getElementById('announcement-message')
  if (!container || !titleElement || !messageElement) return

  try {
    const payload = await utils.requestJson(
      utils.getAppUrl('/api/user/announcements/'),
      { credentials: 'same-origin' }
    )
    const announcements = Array.isArray(payload) ? payload : []
    const announcement = announcements[0]
    if (!announcement || typeof announcement !== 'object') {
      container.hidden = true
      return
    }

    const data = /** @type {Record<string, unknown>} */ (announcement)
    container.classList.remove(
      'bg-blue-600',
      'bg-green-600',
      'bg-yellow-600',
      'bg-red-600'
    )
    const severityClass = {
      info: 'bg-blue-600',
      success: 'bg-green-600',
      warning: 'bg-yellow-600',
      error: 'bg-red-600',
    }[utils.toDisplayText(data.severity)]
    if (severityClass) container.classList.add(severityClass)

    titleElement.innerHTML = await renderAnnouncementText(data.title)
    messageElement.innerHTML = await renderAnnouncementText(data.message)
    container.hidden = false
  } catch (error) {
    container.hidden = true
    utils.handleError(error, 'Unable to load announcements')
  }
}
;/** @type {Window & {fetchAnnouncements?: () => Promise<void>}} */ (
  window
).fetchAnnouncements = fetchAnnouncements
document.addEventListener(
  'DOMContentLoaded',
  async () => await fetchAnnouncements()
)
