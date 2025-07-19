document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('dashboard-content')
  const loadingDiv = document.getElementById('loading')
  const errorDiv = document.getElementById('error')
  fetch(`/api/auth/dashboard`, { credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) {
        content.innerHTML = `<div class="text-center text-red-400">You are not logged in.</div>`
        return
      }
      const data = await res.json()
      const githubLinked =
        data.oauth && data.oauth.github && data.oauth.github.id
      const discordLinked =
        data.oauth && data.oauth.discord && data.oauth.discord.id
      content.innerHTML = `
        <div class="flex flex-col items-center gap-2">
          <div class="text-lg font-semibold">${data.message}</div>
          <div class="text-gray-300 text-sm">Username: <code class="bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded">${data.username}</code></div>
          <div class="text-gray-300 text-sm">Email: <code class="bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded">${data.email}</code></div>
          <div class="text-gray-300 text-sm">Roles: <code class="bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded">${data.roles.join(', ')}</code></div>
          <div class="text-gray-300 text-sm">ID: <code class="bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded">${data.id}</code></div>
          <div class="text-gray-300 text-sm">UUID: <code class="bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded">${data.uuid}</code></div>
          <div class="text-gray-300 text-sm">Created: <code class="bg-[#1f1f1f] text-gray-400 px-1 py-1 rounded">${data.created ? new Date(data.created).toLocaleString() : ''}</code></div>
        </div>
        <div class="mt-6">
          <div class="flex flex-col sm:flex-row gap-3 mt-4">
            <button id="link-github" class="px-4 py-3 rounded bg-[#24292f] text-white font-semibold flex-1 flex items-center justify-center gap-2">
              <img src="/img/github.svg" alt="GitHub" class="h-5 w-5">${githubLinked ? 'Unlink GitHub' : 'Link GitHub'}
            </button>
            <button id="link-discord" class="px-4 py-3 rounded bg-[#5865F2] text-white font-semibold flex-1 flex items-center justify-center gap-2">
              <img src="/img/discord.svg" alt="Discord" class="invert h-5 w-5">${discordLinked ? 'Unlink Discord' : 'Link Discord'}
            </button>
          </div>
          <div class="mt-4 text-gray-400 text-xs mb-1">OAuth Info:</div>
          <pre class="bg-gray-900/60 rounded p-3 text-xs text-gray-200 overflow-x-auto">${JSON.stringify(data.oauth, null, 2)}</pre>
        </div>
        <div class="mt-12 flex justify-center">
          <button id="logout" class="px-12 py-3 rounded bg-red-600 text-white font-semibold flex items-center justify-center">Logout</button>
        </div>
      `
      document
        .getElementById('link-github')
        .addEventListener('click', async () => {
          if (githubLinked) {
            await fetch('/gdl/api/auth/unlink/github', {
              method: 'POST',
              credentials: 'include',
            })
            window.location.reload()
          } else {
            window.location.href = '/gdl/api/auth/link/github'
          }
        })
      document
        .getElementById('link-discord')
        .addEventListener('click', async () => {
          if (discordLinked) {
            await fetch('/gdl/api/auth/unlink/discord', {
              method: 'POST',
              credentials: 'include',
            })
            window.location.reload()
          } else {
            window.location.href = '/gdl/api/auth/link/discord'
          }
        })
      const logoutBtn = document.getElementById('logout')
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          try {
            await fetch('/api/auth/logout', {
              method: 'GET',
              credentials: 'include',
            })
          } catch (error) {
            console.error('Failed to log out:', error)
          }
          window.location.href = '/'
        })
      }
    })
    .catch((error) => {
      console.error('Failed to load dashboard:', error)
      errorDiv.style.display = 'block'
      errorDiv.textContent = 'Failed to load dashboard.'
    })
  loadingDiv.style.display = 'none'
})
