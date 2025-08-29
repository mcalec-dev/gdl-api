const settingsButton = document.getElementById('settings-button')
const settingsContainer = document.getElementById('settings-container')
const backgroundColors = ['auto', 'dark', 'light', 'true-dark', 'true-light']
const settings = {
  theme: {
    bg_color: getCookie('bg_color') || 'dark',
  },
  language: 'en',
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
function applyBackground(bgColor) {
  const bgImg = document.getElementById('bg-img')
  const body = document.body
  const constStyles = 'object-cover w-full h-full'
  settings.theme.bg_color = bgColor
  setCookie('bg_color', bgColor)
  switch (bgColor) {
    case 'dark':
      bgImg.className = `${constStyles} invert opacity-25`
      body.classList.add('text-white')
      body.classList.replace('bg-gray-600', 'bg-black')
      break
    case 'light':
      bgImg.className = `${constStyles} opacity-50`
      body.classList.add('text-black')
      body.classList.replace('bg-black', 'bg-gray-600')
      break
    case 'true-dark':
      bgImg.className = `${constStyles} invert`
      body.classList.add('text-white')
      body.classList.replace('bg-gray-600', 'bg-black')
      break
    case 'true-light':
      bgImg.className = `${constStyles}`
      body.classList.add('text-black')
      body.classList.replace('bg-black', 'bg-gray-600')
      break
    case 'auto':
    default:
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        bgImg.className = `${constStyles} invert opacity-25`
        body.classList.add('text-white')
        body.classList.replace('bg-gray-600', 'bg-black')
      } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        bgImg.className = `${constStyles} opacity-50`
        body.classList.add('text-black')
        body.classList.replace('bg-black', 'bg-gray-600')
      } else {
        bgImg.className = `${constStyles} invert opacity-25`
        body.classList.add('text-white')
        body.classList.replace('bg-gray-600', 'bg-black')
      }
      break
  }
}
function updateSettings() {
  const bgColorSelect = document.getElementById('bg_color')
  bgColorSelect.innerHTML = ''
  backgroundColors.forEach((color) => {
    bgColorSelect.innerHTML += `
      <option value="${color}" ${color === settings.theme.bg_color ? 'selected' : ''}>${color}</option>
    `
  })
  bgColorSelect.addEventListener('change', (e) => {
    applyBackground(e.target.value)
  })
}
document.addEventListener('DOMContentLoaded', async () => {
  updateSettings()
  applyBackground(settings.theme.bg_color)
  settingsButton.addEventListener('click', async () => {
    settingsContainer.classList.toggle('hidden')
  })
})
