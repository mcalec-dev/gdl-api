import * as utils from './index.js'

/** @typedef {'info' | 'warning' | 'error'} AnnouncementSeverity */
/** @typedef {{uuid: string, title: string, message: string, severity: AnnouncementSeverity, author?: string, created?: string | number, modified?: string | number}} Announcement */

/**
 * Validates an announcement severity received from an API or form control.
 *
 * @param {unknown} value Candidate severity.
 * @returns {AnnouncementSeverity} Valid severity with an info fallback.
 */
function normalizeSeverity(value) {
  return ['info', 'warning', 'error'].includes(String(value))
    ? /** @type {AnnouncementSeverity} */ (value)
    : 'info'
}

/**
 * Displays an admin-page error without leaking an unknown object as text.
 *
 * @param {unknown} error Error-like value.
 * @returns {void}
 */
function showError(error) {
  const errorElement = document.getElementById('error')
  if (!errorElement) return
  errorElement.textContent = utils.getErrorMessage(error, 'Admin action failed')
  errorElement.hidden = false
  errorElement.style.display = 'block'
}

/**
 * Clears the visible admin-page error.
 *
 * @returns {void}
 */
function clearError() {
  const errorElement = document.getElementById('error')
  if (!errorElement) return
  errorElement.textContent = ''
  errorElement.hidden = true
  errorElement.style.display = 'none'
}

/**
 * Changes the visible loading state.
 *
 * @param {boolean} loading Whether work is in progress.
 * @returns {void}
 */
function setLoading(loading) {
  const loadingElement = document.getElementById('loading')
  if (loadingElement) loadingElement.hidden = !loading
}

/**
 * Extracts announcements from the admin endpoint response.
 *
 * @param {unknown} payload API response.
 * @returns {Announcement[]} Valid announcement records.
 */
function getAnnouncements(payload) {
  if (!payload || typeof payload !== 'object' || !('announcements' in payload))
    return []
  const candidates = payload.announcements
  if (!Array.isArray(candidates)) return []
  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return []
    const uuid = utils.normalizeIdentifier(candidate.uuid)
    if (!uuid) return []
    return [
      {
        uuid,
        title: utils.toDisplayText(candidate.title),
        message: utils.toDisplayText(candidate.message),
        severity: normalizeSeverity(candidate.severity),
        author: utils.toDisplayText(candidate.author),
        created:
          typeof candidate.created === 'string' ||
          typeof candidate.created === 'number'
            ? candidate.created
            : undefined,
        modified:
          typeof candidate.modified === 'string' ||
          typeof candidate.modified === 'number'
            ? candidate.modified
            : undefined,
      },
    ]
  })
}

/**
 * Performs a write operation for one announcement.
 *
 * @param {string} url Admin announcement endpoint.
 * @param {'POST' | 'PUT' | 'DELETE'} method HTTP method.
 * @param {Record<string, unknown> | undefined} [body] Optional JSON payload.
 * @returns {Promise<unknown>} Parsed API response.
 */
function requestAnnouncement(url, method, body) {
  return utils.requestJson(utils.getAppUrl(url), {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Creates a labelled announcement property row.
 *
 * @param {string} label Display label.
 * @param {unknown} value Display value.
 * @returns {HTMLDivElement} Property row.
 */
function propertyRow(label, value) {
  const row = document.createElement('div')
  row.className = 'flex flex-wrap gap-1 mb-1 items-center'
  const name = document.createElement('span')
  name.className = 'font-semibold text-gray-300 text-center'
  name.textContent = `${label}:`
  const content = document.createElement('span')
  content.textContent = utils.toDisplayText(value, '—')
  row.append(name, content)
  return row
}

/**
 * Renders one announcement in display mode.
 *
 * @param {Announcement} announcement Announcement to render.
 * @returns {HTMLLIElement} Announcement list item.
 */
function createAnnouncementItem(announcement) {
  const item = document.createElement('li')
  item.className =
    'rounded-lg border border-gray-700 p-4 shadow-md text-xs text-gray-200'
  item.dataset.uuid = announcement.uuid
  item.append(
    propertyRow('Title', announcement.title),
    propertyRow('Message', announcement.message),
    propertyRow('Severity', announcement.severity),
    propertyRow('Created By', announcement.author),
    propertyRow('Created At', utils.formatDate(announcement.created)),
    propertyRow('Modified At', utils.formatDate(announcement.modified)),
    propertyRow('UUID', announcement.uuid)
  )
  const actions = document.createElement('div')
  actions.className = 'flex gap-2 mt-2'
  const edit = document.createElement('button')
  edit.type = 'button'
  edit.className =
    'px-2 py-1 bg-blue-700 text-white rounded items-center text-center'
  edit.textContent = 'Edit'
  edit.addEventListener('click', () => renderEditor(item, announcement))
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className =
    'px-2 py-1 bg-red-600 text-white rounded items-center text-center'
  remove.textContent = 'Delete'
  remove.addEventListener('click', () => {
    void deleteAnnouncement(announcement.uuid)
  })
  actions.append(edit, remove)
  item.appendChild(actions)
  return item
}

/**
 * Replaces one announcement card with its inline editor.
 *
 * @param {HTMLLIElement} item Existing announcement element.
 * @param {Announcement} announcement Source announcement.
 * @returns {void}
 */
function renderEditor(item, announcement) {
  item.replaceChildren()
  const title = document.createElement('input')
  title.type = 'text'
  title.value = announcement.title
  title.className =
    'flex w-full px-2 py-1 text-xs bg-[#1f1f1f] text-white border border-white/20 rounded'
  const message = document.createElement('textarea')
  message.value = announcement.message
  message.rows = 2
  message.className =
    'flex w-full px-2 py-1 text-xs bg-[#1f1f1f] text-white border border-white/20 rounded'
  const severity = document.createElement('select')
  severity.className =
    'flex px-2 py-1 text-xs bg-[#1f1f1f] text-white border border-white/20 rounded'
  for (const optionValue of /** @type {AnnouncementSeverity[]} */ ([
    'info',
    'warning',
    'error',
  ])) {
    const option = document.createElement('option')
    option.value = optionValue
    option.textContent = optionValue[0].toUpperCase() + optionValue.slice(1)
    option.selected = optionValue === announcement.severity
    severity.appendChild(option)
  }
  const actions = document.createElement('div')
  actions.className = 'flex gap-2 mt-2'
  const save = document.createElement('button')
  save.type = 'button'
  save.className =
    'px-2 py-1 bg-green-600 text-white rounded items-center text-center'
  save.textContent = 'Save'
  save.addEventListener('click', () => {
    void saveAnnouncement(
      announcement.uuid,
      title.value,
      message.value,
      normalizeSeverity(severity.value)
    )
  })
  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className =
    'px-2 py-1 bg-gray-600 text-white rounded items-center text-center'
  cancel.textContent = 'Cancel'
  cancel.addEventListener('click', () => {
    item.replaceWith(createAnnouncementItem(announcement))
  })
  actions.append(save, cancel)
  item.append(title, message, severity, actions)
}

/**
 * Fetches and renders all current announcements.
 *
 * @returns {Promise<void>} Resolves after list rendering.
 */
async function loadAnnouncements() {
  const list = document.getElementById('announcement-list')
  if (!(list instanceof HTMLElement)) return
  try {
    const payload = await utils.requestJson(
      utils.getAppUrl('/api/admin/announcements'),
      { credentials: 'same-origin' }
    )
    list.replaceChildren(
      ...getAnnouncements(payload).map(createAnnouncementItem)
    )
  } catch (error) {
    showError(error)
  }
}

/**
 * Saves an edited announcement.
 *
 * @param {string} uuid Announcement UUID.
 * @param {string} title New title.
 * @param {string} message New message.
 * @param {AnnouncementSeverity} severity New severity.
 * @returns {Promise<void>} Resolves after refreshing the list.
 */
async function saveAnnouncement(uuid, title, message, severity) {
  try {
    await requestAnnouncement(
      `/api/admin/announcements/${encodeURIComponent(uuid)}`,
      'PUT',
      { title, message, severity }
    )
    await loadAnnouncements()
    await refreshNavbarAnnouncements()
  } catch (error) {
    showError(error)
  }
}

/**
 * Deletes an announcement.
 *
 * @param {string} uuid Announcement UUID.
 * @returns {Promise<void>} Resolves after refreshing the list.
 */
async function deleteAnnouncement(uuid) {
  try {
    await requestAnnouncement(
      `/api/admin/announcements/${encodeURIComponent(uuid)}`,
      'DELETE'
    )
    await loadAnnouncements()
    await refreshNavbarAnnouncements()
  } catch (error) {
    showError(error)
  }
}

/**
 * Refreshes the navbar announcement when that optional module is present.
 *
 * @returns {Promise<void>} Resolves after the optional refresh.
 */
async function refreshNavbarAnnouncements() {
  const callback =
    /** @type {Window & {fetchAnnouncements?: () => Promise<void>}} */ (window)
      .fetchAnnouncements
  if (callback) await callback()
}

/**
 * Renders overview statistics returned by the admin endpoint.
 *
 * @param {unknown} payload Admin API response.
 * @returns {void}
 */
function renderOverview(payload) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('stats' in payload) ||
    !payload.stats ||
    typeof payload.stats !== 'object'
  )
    return
  const stats = /** @type {Record<string, unknown>} */ (payload.stats)
  /** @param {string} id @param {unknown} value @returns {void} */
  const set = (id, value) => {
    const target = document.getElementById(id)
    if (target) target.textContent = utils.toDisplayText(value)
  }
  set('stat-uptime', utils.formatMilliseconds(stats.uptime))
  set('stat-loggedin', stats.loggedInUsers)
  set(
    'stat-toptags',
    Array.isArray(stats.topTags) ? stats.topTags.join(', ') : ''
  )
  set('stat-storage', utils.formatSize(stats.storage))
  set('stat-flags', stats.flags)
}

/**
 * Initializes admin controls and loads initial data.
 *
 * @returns {Promise<void>} Resolves after initial requests finish.
 */
async function initAdmin() {
  const form = document.getElementById('announcement-form')
  const title = document.getElementById('announcement-title-input')
  const message = document.getElementById('announcement-message-input')
  const severity = document.getElementById('announcement-severity-input')
  if (
    form instanceof HTMLFormElement &&
    title instanceof HTMLInputElement &&
    message instanceof HTMLTextAreaElement &&
    severity instanceof HTMLSelectElement
  ) {
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      void (async () => {
        clearError()
        try {
          await requestAnnouncement('/api/admin/announcements', 'POST', {
            title: title.value.trim(),
            message: message.value.trim(),
            severity: normalizeSeverity(severity.value),
          })
          form.reset()
          await loadAnnouncements()
          await refreshNavbarAnnouncements()
        } catch (error) {
          showError(error)
        }
      })()
    })
  }
  setLoading(true)
  try {
    const payload = await utils.requestJson(utils.getAppUrl('/api/admin'), {
      credentials: 'same-origin',
    })
    renderOverview(payload)
    await loadAnnouncements()
  } catch (error) {
    showError(error)
  } finally {
    setLoading(false)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void initAdmin()
})
