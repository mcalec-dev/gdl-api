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
const paginationInput = document.getElementById('pagination-items-select')
const containerWidthInput = document.getElementById('container-width-input')
const bytesBitsToggle = document.getElementById('bytes-bits-toggle')
const resetSettingsButton = document.getElementById('reset-settings-button')
const imageKernelSelect = document.getElementById('image-kernel-select')
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
  containerWidth: 65,
  imageKernel: 'lanczos3',
  bytesBits: false,
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
function loadSettings() {
  const saved = getCookie('settings')
  if (!saved) return { ...defaults }
  try {
    const parsed = JSON.parse(saved)
    return {
      theme: { ...defaults.theme, ...parsed.theme },
      oneko: typeof parsed.oneko === 'boolean' ? parsed.oneko : defaults.oneko,
      serverSort:
        typeof parsed.serverSort === 'boolean'
          ? parsed.serverSort
          : defaults.serverSort,
      pagination: { ...defaults.pagination, ...parsed.pagination },
      lang: parsed.lang || defaults.lang,
      imageScale: { ...defaults.imageScale, ...parsed.imageScale },
      containerWidth:
        typeof parsed.containerWidth === 'number'
          ? parsed.containerWidth
          : defaults.containerWidth,
      bytesBits:
        typeof parsed.bytesBits === 'boolean'
          ? parsed.bytesBits
          : defaults.bytesBits,
      imageKernel:
        typeof parsed.imageKernel === 'string'
          ? parsed.imageKernel
          : defaults.imageKernel,
    }
  } catch (e) {
    console.error('Failed to parse settings:', e)
    return { ...defaults }
  }
}
function saveSettings(settings) {
  try {
    const json = JSON.stringify(settings)
    setCookie('settings', encodeURIComponent(json))
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}
const settings = loadSettings()
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
export let CONTAINER_WIDTH = settings.containerWidth
export let BYTES_BITS = settings.bytesBits
export let IMAGE_KERNEL = settings.imageKernel
function setExportVals(min, def, max) {
  MIN_IMAGE_SCALE = min
  IMAGE_SCALE = def
  MAX_IMAGE_SCALE = max
  return { MIN_IMAGE_SCALE, IMAGE_SCALE, MAX_IMAGE_SCALE }
}
function setContainerWidth(width) {
  CONTAINER_WIDTH = width
  const container = document.getElementById('container')
  if (container) {
    const classArray = Array.from(container.classList)
    const newClassArray = classArray.filter(
      (cls) => !cls.match(/^md:max-w-\[\d+%\]$/)
    )
    newClassArray.push(`md:max-w-[${width}%]`)
    container.className = newClassArray.join(' ')
  }
  return CONTAINER_WIDTH
}
function resetAllSettings() {
  const defaultSettings = { ...defaults }
  Object.keys(defaultSettings).forEach((key) => {
    settings[key] = defaultSettings[key]
  })
  saveSettings(settings)
  window.location.reload()
}
async function updateSettings() {
  onekoToggle.addEventListener('change', async (e) => {
    settings.oneko = e.target.checked
    saveSettings(settings)
    toggleOneko(settings.oneko)
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
      settings.serverSort = e.target.checked
      SERVER_SIDE_SORT = settings.serverSort
      saveSettings(settings)
    })
  }
  if (paginationToggle) {
    paginationToggle.checked = settings.pagination.enabled
    paginationToggle.addEventListener('change', (e) => {
      settings.pagination.enabled = e.target.checked
      PAGINATION.enabled = settings.pagination.enabled
      saveSettings(settings)
    })
  }
  if (paginationInput) {
    paginationInput.value = String(settings.pagination.limit)
    paginationInput.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10)
      settings.pagination.limit = isNaN(v) ? defaults.pagination.limit : v
      PAGINATION.limit = settings.pagination.limit
      saveSettings(settings)
    })
    paginationInput.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10)
      settings.pagination.limit = isNaN(v) ? defaults.pagination.limit : v
      PAGINATION.limit = settings.pagination.limit
      saveSettings(settings)
    })
  }
  if (imageKernelSelect) {
    imageKernelSelect.value = settings.imageKernel
    imageKernelSelect.addEventListener('change', (e) => {
      settings.imageKernel = e.target.value
      IMAGE_KERNEL = settings.imageKernel
      saveSettings(settings)
    })
  }
  try {
    const minVal = parseInt(settings.imageScale.min, 10)
    const defaultVal = parseInt(settings.imageScale.default, 10)
    const maxVal = parseInt(settings.imageScale.max, 10)
    setExportVals(minVal, defaultVal, maxVal)
    if (imageScaleMinInput) {
      imageScaleMinInput.value = String(minVal)
      const applyMin = (val) => {
        settings.imageScale.min = isNaN(val) ? defaults.imageScale.min : val
        saveSettings(settings)
        if (imageScaleDefaultInput)
          imageScaleDefaultInput.min = String(settings.imageScale.min)
        if (imageScaleMaxInput)
          imageScaleMaxInput.min = String(settings.imageScale.min)
        setExportVals(
          settings.imageScale.min,
          settings.imageScale.default,
          settings.imageScale.max
        )
      }
      imageScaleMinInput.addEventListener('change', (ev) => {
        const v = parseInt(ev.target.value, 10)
        applyMin(v)
      })
      imageScaleMinInput.addEventListener('input', (ev) => {
        const v = parseInt(ev.target.value, 10)
        if (!isNaN(v)) applyMin(v)
      })
    }
    if (imageScaleDefaultInput) {
      imageScaleDefaultInput.value = String(defaultVal)
      imageScaleDefaultInput.min = String(minVal)
      imageScaleDefaultInput.max = String(maxVal)
      imageScaleDefaultInput.addEventListener('change', (ev) => {
        const v = parseInt(ev.target.value, 10)
        settings.imageScale.default = isNaN(v) ? defaults.imageScale.default : v
        saveSettings(settings)
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
      const applyMax = (val) => {
        settings.imageScale.max = isNaN(val) ? defaults.imageScale.max : val
        saveSettings(settings)
        if (imageScaleDefaultInput)
          imageScaleDefaultInput.max = String(settings.imageScale.max)
        if (imageScaleMinInput)
          imageScaleMinInput.max = String(settings.imageScale.max)
        setExportVals(
          settings.imageScale.min,
          settings.imageScale.default,
          settings.imageScale.max
        )
      }
      imageScaleMaxInput.addEventListener('change', (ev) => {
        const v = parseInt(ev.target.value, 10)
        applyMax(v)
      })
      imageScaleMaxInput.addEventListener('input', (ev) => {
        const v = parseInt(ev.target.value, 10)
        if (!isNaN(v)) applyMax(v)
      })
    }
  } catch {
    window.IMAGE_SCALE = defaults.imageScale.default
  }
  if (containerWidthInput) {
    containerWidthInput.value = String(settings.containerWidth)
    setContainerWidth(settings.containerWidth)
    containerWidthInput.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10)
      settings.containerWidth = isNaN(v) ? defaults.containerWidth : v
      setContainerWidth(settings.containerWidth)
      saveSettings(settings)
    })
  }
  if (bytesBitsToggle) {
    bytesBitsToggle.checked = settings.bytesBits
    bytesBitsToggle.addEventListener('change', (e) => {
      settings.bytesBits = e.target.checked
      BYTES_BITS = settings.bytesBits
      saveSettings(settings)
    })
  }
  if (resetSettingsButton) {
    resetSettingsButton.addEventListener('click', () => {
      if (confirm('Reset all settings to defaults?')) {
        resetAllSettings()
      }
    })
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