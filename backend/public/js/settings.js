'use strict'
const settingsButton = document.getElementById('settings-button')
const settingsContainer = document.getElementById('settings-container')
const closeSettings = document.getElementById('close-settings')
const onekoToggle = document.getElementById('oneko-toggle')
const serverSortToggle = document.getElementById('server-sort-toggle')
const imageScaleMinInput = document.getElementById('image-scale-min-input')
const imageScaleDefaultInput = document.getElementById(
  'image-scale-default-input'
)
const imageScaleMaxInput = document.getElementById('image-scale-max-input')
const paginationToggle = document.getElementById('pagination-toggle')
const paginationInput = document.getElementById('pagination-input')
const defaults = {
  theme: {
    bg: 'auto',
    color: 'match-bg',
  },
  oneko: false,
  serverSort: true,
  pagination: {
    enabled: true,
    limit: 100,
  },
  lang: 'en',
  imageScale: {
    max: 200,
    default: 100,
    min: 50,
  },
}
const settings = {
  theme: {
    bg: getCookie('theme-bg') || defaults.theme.bg,
    color: getCookie('theme-color') || defaults.theme.color,
  },
  oneko: getCookie('oneko') === 'true' || defaults.oneko,
  serverSort: getCookie('server-sort') || defaults.serverSort,
  pagination: {
    enabled: getCookie('pagination-enabled') || defaults.pagination.enabled,
    limit: parseInt(getCookie('pagination'), 10) || defaults.pagination.limit,
  },
  lang: getCookie('lang') || defaults.lang,
  imageScale: {
    max: parseInt(getCookie('image-scale-max'), 10) || defaults.imageScale.max,
    default:
      parseInt(getCookie('image-scale-default'), 10) ||
      defaults.imageScale.default,
    min: parseInt(getCookie('image-scale-min'), 10) || defaults.imageScale.min,
  },
}
function setCookie(name, value, expires = '') {
  let date = new Date()
  if (!expires) {
    date.setTime(date.getTime() + 1 * 365 * 24 * 60 * 60 * 1000) // 1 year
  }
  if (expires) {
    date.setTime(date.getTime() + expires * 1000)
  }
  let exp = 'expires=' + date.toUTCString()
  document.cookie = `${name}=${value};${exp};path=/`
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
export let MIN_IMAGE_SCALE = settings.imageScale.min
export let IMAGE_SCALE = settings.imageScale.default
export let MAX_IMAGE_SCALE = settings.imageScale.max
export let SERVER_SIDE_SORT = settings.serverSort
export let PAGINATION = {
  enabled: settings.pagination.enabled,
  limit: settings.pagination.limit,
}
function setExportVals(min, def, max) {
  MIN_IMAGE_SCALE = min
  IMAGE_SCALE = def
  MAX_IMAGE_SCALE = max
  return { MIN_IMAGE_SCALE, IMAGE_SCALE, MAX_IMAGE_SCALE }
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
  if (serverSortToggle) {
    serverSortToggle.checked = settings.serverSort
    serverSortToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        settings.serverSort = true
        SERVER_SIDE_SORT = true
        setCookie('server-sort', 'true')
      } else {
        settings.serverSort = false
        SERVER_SIDE_SORT = false
        setCookie('server-sort', 'false')
      }
    })
  }
  if (paginationToggle) {
    paginationToggle.checked = settings.pagination.enabled
    paginationToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        settings.pagination.enabled = true
        PAGINATION.enabled = true
        setCookie('pagination-enabled', 'true')
      } else {
        settings.pagination.enabled = false
        PAGINATION.enabled = false
        setCookie('pagination-enabled', 'false')
      }
    })
  }
  if (paginationInput) {
    paginationInput.value = String(settings.pagination.limit)
    paginationInput.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10)
      settings.pagination.limit = isNaN(v) ? defaults.pagination.limit : v
      PAGINATION.limit = settings.pagination.limit
      setCookie('pagination', String(settings.pagination.limit))
    })
  }
  try {
    const minVal = parseInt(settings.imageScale.min, 10)
    const defaultVal = parseInt(settings.imageScale.default, 10)
    const maxVal = parseInt(settings.imageScale.max, 10)
    setExportVals(minVal, defaultVal, maxVal)
    if (imageScaleMinInput) {
      imageScaleMinInput.value = String(minVal)
      imageScaleMinInput.addEventListener('change', (ev) => {
        const v = parseInt(ev.target.value, 10)
        settings.imageScale.min = isNaN(v) ? defaults.imageScale.min : v
        setCookie('image-scale-min', String(settings.imageScale.min))
        if (imageScaleDefaultInput)
          imageScaleDefaultInput.min = String(settings.imageScale.min)
        if (imageScaleMaxInput)
          imageScaleMaxInput.min = String(settings.imageScale.min)
        setExportVals(
          settings.imageScale.min,
          settings.imageScale.default,
          settings.imageScale.max
        )
      })
    }
    if (imageScaleDefaultInput) {
      imageScaleDefaultInput.value = String(defaultVal)
      imageScaleDefaultInput.min = String(minVal)
      imageScaleDefaultInput.max = String(maxVal)
      imageScaleDefaultInput.addEventListener('change', (ev) => {
        const v = parseInt(ev.target.value, 10)
        settings.imageScale.default = isNaN(v) ? defaults.imageScale.default : v
        setCookie('image-scale-default', String(settings.imageScale.default))
        setExportVals(
          settings.imageScale.min,
          settings.imageScale.default,
          settings.imageScale.max
        )
      })
      imageScaleDefaultInput.addEventListener('input', (ev) => {
        const v = parseInt(ev.target.value, 10)
        if (!isNaN(v)) {
          setExportVals(settings.imageScale.min, v, settings.imageScale.max)
        }
      })
    }
    if (imageScaleMaxInput) {
      imageScaleMaxInput.value = String(maxVal)
      imageScaleMaxInput.addEventListener('change', (ev) => {
        const v = parseInt(ev.target.value, 10)
        settings.imageScale.max = isNaN(v) ? defaults.imageScale.max : v
        setCookie('image-scale-max', String(settings.imageScale.max))
        if (imageScaleDefaultInput)
          imageScaleDefaultInput.max = String(settings.imageScale.max)
        if (imageScaleMinInput)
          imageScaleMinInput.max = String(settings.imageScale.max)
        setExportVals(
          settings.imageScale.min,
          settings.imageScale.default,
          settings.imageScale.max
        )
      })
    }
  } catch {
    window.IMAGE_SCALE = defaults.imageScale.default
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
export { setExportVals, defaults, settings }