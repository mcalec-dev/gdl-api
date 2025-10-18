'use strict'
const settingsButton = document.getElementById('settings-button')
const settingsContainer = document.getElementById('settings-container')
const closeSettings = document.getElementById('close-settings')
const onekoToggle = document.getElementById('oneko-toggle')
const defaults = {
  theme: {
    bg: 'auto',
  },
  oneko: false,
  lang: 'en',
}
const settings = {
  theme: {
    bg: getCookie('bg') || defaults.theme.bg,
  },
  oneko: getCookie('oneko') === 'true' || defaults.oneko,
  lang: getCookie('lang') || defaults.lang,
}
function setCookie(name, value, days = 365) {
  const d = new Date()
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000)
  const expires = 'expires=' + d.toUTCString()
  document.cookie = `${name}=${value};${expires};path=/`
}
function getCookie(name) {
  const cname = name + '='
  const decodedCookie = decodeURIComponent(document.cookie)
  const ca = decodedCookie.split(';')
  for (let c of ca) {
    c = c.trim()
    if (c.indexOf(cname) === 0) {
      return c.substring(cname.length, c.length)
    }
  }
  return ''
}
function toggleOneko(toggle) {
  const onekoEl = document.getElementById('oneko')
  const onekoScript = document.getElementById('oneko-script')
  if (toggle) {
    if (onekoScript) return
    if (!onekoScript) {
      const script = document.createElement('script')
      script.id = 'oneko-script'
      script.src = 'https://sleepie.uk/oneko.js'
      script.async = true
      document.body.appendChild(script)
    }
  }
  if (!toggle) {
    if (!onekoScript) return
    if (onekoScript) {
      document.body.removeChild(onekoScript)
      document.body.removeChild(onekoEl)
    }
  }
}
async function updateSettings() {
  onekoToggle.addEventListener('change', async (e) => {
    if (e.target.checked) {
      settings.oneko = true
      setCookie('oneko', 'true')
      toggleOneko(true)
    }
    if (!e.target.checked) {
      settings.oneko = false
      setCookie('oneko', 'false')
      toggleOneko(false)
    }
  })
  if (settings.oneko) {
    onekoToggle.checked = true
    toggleOneko(true)
  } else {
    onekoToggle.checked = false
    toggleOneko(false)
  }
}
document.addEventListener('DOMContentLoaded', async () => {
  await updateSettings()
  settingsButton.addEventListener('click', async () => {
    settingsContainer.hidden = !settingsContainer.hidden
    settingsButton.hidden = !settingsButton.hidden
  })
  closeSettings.addEventListener('click', async () => {
    settingsContainer.hidden = !settingsContainer.hidden
    settingsButton.hidden = !settingsButton.hidden
  })
})
