import * as utils from './index.js'

/** @typedef {{id?: string, username?: string, email?: string, avatar?: string}} OAuthProvider */
/** @typedef {{uuid?: string, created?: string | number, modified?: string | number, expires?: string | number, ip?: string, useragent?: string}} UserSession */
/** @typedef {{username?: string, email?: string, roles?: string[], created?: string | number, modified?: string | number, uuid?: string, oauth?: Record<string, OAuthProvider>, sessions?: UserSession[]}} DashboardData */

/**
 * Checks whether an unknown API value is a non-array object.
 *
 * @param {unknown} value Candidate value.
 * @returns {value is Record<string, unknown>} Whether value is a record.
 */
function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/**
 * Creates an HTML element with optional class names and plain text.
 *
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag Element tag.
 * @param {string} [className=''] CSS class names.
 * @param {string} [text=''] Plain text content.
 * @returns {HTMLElementTagNameMap[K]} Created element.
 */
function element(tag, className = '', text = '') {
  const created = document.createElement(tag)
  created.className = className
  created.textContent = text
  return created
}

/**
 * Creates a metadata row for a dashboard user property.
 *
 * @param {string} label Visible label.
 * @param {unknown} value Display value.
 * @returns {HTMLDivElement} Metadata row.
 */
function createMetadataRow(label, value) {
  const row = element('div', 'text-gray-300 text-sm')
  row.append(`${label}: `)
  const code = element(
    'code',
    'bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded select-all',
    utils.toDisplayText(value, '—')
  )
  row.appendChild(code)
  return row
}

/**
 * Creates a card of OAuth provider metadata.
 *
 * @param {string} name Provider name.
 * @param {OAuthProvider} provider Provider payload.
 * @returns {HTMLDivElement} Provider card.
 */
function createProviderCard(name, provider) {
  const card = element(
    'div',
    'rounded-lg w-full border border-gray-700 bg-gray-900/60 p-4 shadow-md text-xs text-gray-200 overflow-x-auto'
  )
  /** @type {Array<[string, unknown]>} */
  const metadata = [
    ['Provider', name],
    ['Username', provider.username],
    ['Email', provider.email],
    ['Avatar', provider.avatar],
    ['ID', provider.id],
  ]
  for (const [label, value] of metadata) {
    const row = element('div', 'flex gap-2 mb-1 whitespace-nowrap')
    row.appendChild(element('span', 'font-semibold text-gray-300', label + ':'))
    row.appendChild(element('span', '', utils.toDisplayText(value, '—')))
    card.appendChild(row)
  }
  return card
}

/**
 * Creates a session card and its delegated revoke control.
 *
 * @param {UserSession} session Session payload.
 * @returns {HTMLDivElement} Session card.
 */
function createSessionCard(session) {
  const card = element(
    'div',
    'rounded-lg w-full border border-gray-700 bg-gray-900/60 p-4 shadow-md text-xs text-gray-200 overflow-x-auto'
  )
  for (const [label, value] of [
    ['First Seen', utils.formatDate(session.created)],
    ['Last Seen', utils.formatDate(session.modified)],
    ['Expires', utils.formatDate(session.expires)],
    ['IP', session.ip],
    ['User Agent', session.useragent],
    ['UUID', session.uuid],
  ]) {
    const row = element('div', 'flex gap-2 mb-1 whitespace-nowrap')
    row.appendChild(element('span', 'font-semibold text-gray-300', label + ':'))
    row.appendChild(element('span', '', utils.toDisplayText(value, '—')))
    card.appendChild(row)
  }
  const uuid = utils.normalizeIdentifier(session.uuid)
  if (uuid) {
    const actions = element('div', 'flex gap-2 mt-2')
    const revoke = element(
      'button',
      'px-2 py-1 bg-red-600 text-white rounded items-center text-center',
      'Delete'
    )
    revoke.type = 'button'
    revoke.dataset.revokeSession = uuid
    actions.appendChild(revoke)
    card.appendChild(actions)
  }
  return card
}

/**
 * Sends the user to an OAuth provider link or unlinks the current provider.
 *
 * @param {'github' | 'discord'} provider Provider identifier.
 * @param {boolean} linked Whether the provider is linked.
 * @returns {Promise<void>} Resolves after navigation or unlinking.
 */
async function toggleProvider(provider, linked) {
  if (!linked) {
    window.location.href = utils.getAppUrl(
      `/api/auth/provider/link/${provider}`
    )
    return
  }
  await utils.requestJson(
    utils.getAppUrl(`/api/auth/provider/unlink/${provider}`),
    {
      method: 'GET',
      credentials: 'include',
    }
  )
  window.location.reload()
}

/**
 * Revokes a user session and refreshes the dashboard.
 *
 * @param {string} uuid Session UUID.
 * @returns {Promise<void>} Resolves after revocation.
 */
async function deleteSession(uuid) {
  await utils.requestJson(
    utils.getAppUrl(`/api/user/session/${encodeURIComponent(uuid)}`),
    { method: 'DELETE', credentials: 'same-origin' }
  )
  window.location.reload()
}

/**
 * Renders all dashboard data using DOM text assignment for API-provided values.
 *
 * @param {HTMLElement} content Dashboard content container.
 * @param {DashboardData} data Parsed dashboard response.
 * @returns {void}
 */
function renderDashboard(content, data) {
  content.replaceChildren()
  /** @type {Record<string, OAuthProvider>} */
  const providers = data.oauth || {}
  const githubLinked = Boolean(providers.github?.id)
  const discordLinked = Boolean(providers.discord?.id)

  const summary = element('div', 'flex flex-col items-center gap-2 text-clip')
  summary.appendChild(
    element(
      'div',
      'text-lg font-semibold',
      data.username ? `Welcome ${data.username}!` : 'Welcome to dashboard!'
    )
  )
  /** @type {Array<[string, unknown]>} */
  const summaryMetadata = [
    ['Username', data.username],
    ['Email', data.email],
    ['Roles', Array.isArray(data.roles) ? data.roles.join(', ') : ''],
    ['Created', utils.formatDate(data.created)],
    ['Modified', utils.formatDate(data.modified)],
    ['UUID', data.uuid],
  ]
  for (const [label, value] of summaryMetadata) {
    summary.appendChild(createMetadataRow(label, value))
  }
  content.appendChild(summary)

  const details = element('div', 'mt-6')
  const providerActions = element(
    'div',
    'flex flex-row w-full items-center justify-center gap-2 mt-4'
  )
  /** @type {Array<['github' | 'discord', boolean, string]>} */
  const providerActionsData = [
    ['discord', discordLinked, 'bg-[#5865F2]'],
    ['github', githubLinked, 'bg-[#24292f]'],
  ]
  for (const [provider, linked, color] of providerActionsData) {
    const button = element(
      'button',
      `flex w-fit px-4 py-2 rounded ${color} text-white font-medium items-center justify-center align-middle gap-2`,
      `${linked ? 'Unlink' : 'Link'} ${provider[0].toUpperCase()}${provider.slice(1)}`
    )
    button.type = 'button'
    button.addEventListener('click', () => {
      void toggleProvider(provider, linked).catch((error) => {
        utils.handleError(error, 'Provider update failed')
      })
    })
    providerActions.appendChild(button)
  }
  details.appendChild(providerActions)

  const providerSection = element(
    'div',
    'mt-4 w-full md:max-w-full sm:max-w-full overflow-auto'
  )
  providerSection.appendChild(
    element('span', 'mt-4 text-gray-400 text-xs mb-1', 'OAuth Providers:')
  )
  const providerList = element(
    'div',
    'flex md:flex-row flex-col w-full gap-4 overflow-auto text-clip'
  )
  const entries = Object.entries(providers)
  if (entries.length) {
    for (const [name, provider] of entries)
      providerList.appendChild(createProviderCard(name, provider))
  } else {
    providerList.appendChild(
      element('div', 'text-gray-400', 'No OAuth providers found.')
    )
  }
  providerSection.appendChild(providerList)

  providerSection.appendChild(
    element('span', 'mt-4 text-gray-400 text-xs mb-1', 'Current Sessions:')
  )
  const sessionsList = element(
    'div',
    'flex flex-col w-full gap-4 overflow-auto text-clip'
  )
  const sessions = Array.isArray(data.sessions) ? data.sessions : []
  if (sessions.length) {
    for (const session of sessions)
      sessionsList.appendChild(createSessionCard(session))
  } else {
    sessionsList.appendChild(
      element('div', 'text-gray-400', 'No active sessions found.')
    )
  }
  providerSection.appendChild(sessionsList)
  details.appendChild(providerSection)
  content.appendChild(details)

  const logoutArea = element('div', 'mt-12 flex justify-center')
  const logout = element(
    'button',
    'px-12 py-3 rounded bg-red-600 text-white font-semibold',
    'Logout'
  )
  logout.type = 'button'
  logout.addEventListener('click', () => {
    void utils
      .requestJson(utils.getAppUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      })
      .catch((error) => utils.handleError(error, 'Logout failed'))
      .finally(() => {
        window.location.href = utils.getAppUrl('/')
      })
  })
  logoutArea.appendChild(logout)
  content.appendChild(logoutArea)
}

/**
 * Displays a dashboard error without exposing an unknown value as text.
 *
 * @param {HTMLElement | null} errorElement Error element.
 * @param {unknown} error Error-like value.
 * @returns {void}
 */
function showError(errorElement, error) {
  if (!errorElement) return
  errorElement.textContent = utils.getErrorMessage(
    error,
    'Unable to load dashboard'
  )
  errorElement.hidden = false
}

/**
 * Initializes dashboard loading and delegated session deletion.
 *
 * @returns {Promise<void>} Resolves after the initial dashboard request.
 */
async function initDashboard() {
  const content = document.getElementById('dashboard-content')
  const loading = document.getElementById('loading')
  const errorElement = document.getElementById('error')
  if (!(content instanceof HTMLElement)) return
  content.addEventListener('click', (event) => {
    const target = event.target
    const button =
      target instanceof HTMLElement
        ? target.closest('[data-revoke-session]')
        : null
    const uuid =
      button instanceof HTMLElement
        ? utils.normalizeIdentifier(button.dataset.revokeSession)
        : ''
    if (!uuid) return
    void deleteSession(uuid).catch((error) => showError(errorElement, error))
  })
  try {
    const payload = await utils.requestJson(
      utils.getAppUrl('/api/user/dashboard'),
      { credentials: 'include' }
    )
    if (!isRecord(payload)) throw new Error('Invalid dashboard response')
    const data = /** @type {DashboardData} */ (payload)
    renderDashboard(content, data)
  } catch (error) {
    utils.handleError(error, 'Dashboard request failed')
    showError(errorElement, error)
  } finally {
    if (loading) loading.hidden = true
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void initDashboard()
})
