'use strict'
import * as utils from '../min/index.min.js'
document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('dashboard-content')
  const loadingDiv = document.getElementById('loading')
  const errorDiv = document.getElementById('error')
  fetch(utils.getAppUrl('/api/user/dashboard'), { credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) {
        return
      }
      const data = await res.json()
      const githubLinked =
        data.oauth && data.oauth.github && data.oauth.github.id
      const discordLinked =
        data.oauth && data.oauth.discord && data.oauth.discord.id
      content.innerHTML = `
        <div class="flex flex-col items-center gap-2 text-clip">
          <div class="text-[hsl(${data.color.hue},100%,${data.color.lightness}%)] text-lg font-semibold">${'Welcome' + (data.username ? ` ${data.username}!` : ' to dashboard!')}</div>
          <div class="text-gray-300 text-sm">Username: <code class="bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded select-all">${data.username}</code></div>
          <div class="text-gray-300 text-sm">Email: <code class="bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded select-all">${data.email}</code></div>
          <div class="text-gray-300 text-sm">Roles: <code class="bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded">${data.roles.join(', ')}</code></div>
          <div class="text-gray-300 text-sm">Created: <code class="bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded">${new Date(data.created).toLocaleString()}</code></div>
          <div class="text-gray-300 text-sm">Modified: <code class="bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded">${new Date(data.modified).toLocaleString()}</code></div>
          <div class="text-gray-300 text-sm">UUID: <code class="bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded select-all">${data.uuid}</code></div>
        </div>
        <div class="mt-6">
          <div class="flex flex-row w-full items-center justify-center gap-2 mt-4">
            <button id="link-discord" class="flex w-fit px-4 py-2 rounded bg-[#5865F2] text-white font-medium items-center justify-center align-middle gap-2">
              <img src="/svg/discord.svg" alt="Discord" class="invert h-5 w-5" />
              ${discordLinked ? 'Unlink Discord' : 'Link Discord'}
            </button>
            <button id="link-github" class="flex w-fit px-4 py-2 rounded bg-[#24292f] text-white font-medium items-center justify-center align-middle gap-2">
              <img src="/svg/github.svg" alt="GitHub" class="h-5 w-5" />
              ${githubLinked ? 'Unlink GitHub' : 'Link GitHub'}
            </button>
          </div>
          <div class="mt-4 w-full md:max-w-full sm:max-w-full overflow-auto">
            <span class="mt-4 text-gray-400 text-xs mb-1">OAuth Providers:</span>
            <div class="flex md:flex-row flex-col w-full gap-4 overflow-auto text-clip">
              ${(() => {
                let html = ''
                if (!discordLinked && !githubLinked) {
                  html = `<div class="text-gray-400">No oauth providers found.</div>`
                } else {
                  Object.entries(data.oauth).forEach(([name, provider]) => {
                    html += `
                        <div class="rounded-lg w-full border border-gray-700 bg-gray-900/60 p-4 shadow-md text-xs text-gray-200 overflow-x-auto">
                          <div class="flex gap-2 mb-1 whitespace-nowrap">
                            <span class="font-semibold text-gray-300">Provider:</span>
                            <span>${name}</span>
                          </div>
                          <div class="flex gap-2 mb-1 whitespace-nowrap">
                            <span class="font-semibold text-gray-300">Username:</span>
                            <span>${provider.username}</span>
                          </div>
                          <div class="flex gap-2 mb-1 whitespace-nowrap">
                            <span class="font-semibold text-gray-300">Email:</span>
                            <span>${provider.email}</span>
                          </div>
                          <div class="flex gap-2 mb-1 whitespace-nowrap">
                            <span class="font-semibold text-gray-300">Avatar:</span>
                            <span>${provider.avatar}</span>
                          </div>
                          <div class="flex gap-2 mb-1 whitespace-nowrap">
                            <span class="font-semibold text-gray-300">ID:</span>
                            <span>${provider.id}</span>
                          </div>
                        </div>
                      `
                  })
                }
                return html
              })()}
            </div>
            <span class="mt-4 text-gray-400 text-xs mb-1">Current Sessions:</span>
            <div class="flex flex-col w-full gap-4 overflow-auto text-clip">
              ${(() => {
                let html = ''
                if (Array.isArray(data.sessions) && data.sessions.length > 0) {
                  data.sessions.forEach((session) => {
                    html += `
                      <div class="rounded-lg w-full border border-gray-700 bg-gray-900/60 p-4 shadow-md text-xs text-gray-200 overflow-x-auto">
                        <div class="flex gap-2 mb-1 whitespace-nowrap">
                          <span class="font-semibold text-gray-300">First Seen:</span>
                          <span>${session.created ? new Date(session.created).toLocaleString() : 'N/A'}</span>
                        </div>
                        <div class="flex gap-2 mb-1 whitespace-nowrap">
                          <span class="font-semibold text-gray-300">Last Seen:</span>
                          <span>${session.modified ? new Date(session.modified).toLocaleString() : 'N/A'}</span>
                        </div>
                        <div class="flex gap-2 mb-1 whitespace-nowrap">
                          <span class="font-semibold text-gray-300">Expires:</span>
                          <span>${session.expires ? new Date(session.expires).toLocaleString() : 'N/A'}</span>
                        </div>
                        <div class="flex gap-2 mb-1 whitespace-nowrap">
                          <span class="font-semibold text-gray-300">IP:</span>
                          <span>${session.ip}</span>
                        </div>
                        <div class="flex gap-2 mb-1 whitespace-nowrap">
                          <span class="font-semibold text-gray-300">User Agent:</span>
                          <span>${session.useragent}</span>
                        </div>
                        <div class="flex gap-2 whitespace-nowrap">
                          <span class="font-semibold text-gray-300">UUID:</span>
                          <span>${session.uuid}</span>
                        </div>
                        <div class="flex gap-2 mt-2">
                          <button type="button" data-revoke-session="${session.uuid}" class="px-2 py-1 bg-red-600 text-white rounded items-center text-center">
                            Delete
                          </button>
                        </div>
                      </div>
                    `
                  })
                } else {
                  html =
                    '<div class="text-gray-400">No active sessions found.</div>'
                }
                return html
              })()}
            </div>
          </div>
        </div>
        <div class="mt-12 flex justify-center">
          <button id="logout" class="px-12 py-3 rounded bg-red-600 text-white font-semibold flex items-center justify-center">Logout</button>
        </div>
      `

      content.addEventListener('click', (event) => {
        const target = /** @type {HTMLElement | null} */ (event.target)
        const button = target?.closest('[data-revoke-session]')
        if (!button || !content.contains(button)) {
          return
        }
        const sessionUuid = button.getAttribute('data-revoke-session')
        if (!sessionUuid) {
          return
        }
        void deleteSession(sessionUuid)
      })
      document
        .getElementById('link-github')
        .addEventListener('click', async () => {
          if (githubLinked) {
            await fetch(utils.getAppUrl('/api/auth/provider/unlink/github'), {
              method: 'GET',
              credentials: 'include',
            })
            window.location.reload()
          } else {
            window.location.href = utils.getAppUrl(
              '/api/auth/provider/link/github'
            )
          }
        })
      document
        .getElementById('link-discord')
        .addEventListener('click', async () => {
          if (discordLinked) {
            await fetch(utils.getAppUrl('/api/auth/provider/unlink/discord'), {
              method: 'GET',
              credentials: 'include',
            })
            window.location.reload()
          } else {
            window.location.href = utils.getAppUrl(
              '/api/auth/provider/link/discord'
            )
          }
        })
      const logoutBtn = document.getElementById('logout')
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          try {
            await fetch(utils.getAppUrl('/api/auth/logout'), {
              method: 'POST',
              credentials: 'include',
            })
          } catch (error) {
            utils.handleError(error)
            console.error('Failed to log out:', error)
          }
          window.location.href = utils.getAppUrl('/')
        })
      }
    })
    .catch((error) => {
      utils.handleError(error)
      errorDiv.style.display = 'block'
      errorDiv.textContent = error
    })
  async function deleteSession(uuid) {
    if (!uuid) return
    try {
      const res = await fetch(
        utils.getAppUrl(`/api/user/session/${encodeURIComponent(uuid)}`),
        {
          method: 'DELETE',
          credentials: 'same-origin',
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        if (res.status === 404) {
          throw new Error(
            'This session no longer exists. Refresh the dashboard to update the list.'
          )
        }
        throw new Error(
          data?.message || `Failed to delete session (HTTP ${res.status})`
        )
      }
      window.location.reload()
    } catch (error) {
      utils.handleError(error)
      if (errorDiv) {
        errorDiv.textContent =
          error instanceof Error ? error.message : String(error)
        errorDiv.style.display = 'block'
        errorDiv.hidden = false
      }
    }
  }
  window.deleteSession = deleteSession
  loadingDiv.style.display = 'none'
})
