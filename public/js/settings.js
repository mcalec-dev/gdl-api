import { requestJson } from './helpers/api.js'
import {
  getCompatibleTranscodePair,
  getSupportedTranscodeFormats,
} from './helpers/media.js'
import { readJsonCookie, writeJsonCookie } from './helpers/storage.js'
import { handleError } from './helpers/ui.js'
import { getAppUrl } from './helpers/url.js'

/**
 * @typedef {{bg: string, color: string}} ThemeSettings
 */

/**
 * @typedef {{enabled: boolean, limit: number}} PaginationSettings
 */

/**
 * @typedef {{min: number, default: number, max: number}} ImageScaleSettings
 */

/**
 * @typedef {{enabled: boolean, codec: string}} TranscodeSettings
 */

/**
 * @typedef {{theme: ThemeSettings, oneko: boolean, serverSort: boolean, pagination: PaginationSettings, lang: string, imageScale: ImageScaleSettings, containerWidth: number, imageKernel: string, bytesBits: boolean, transcode: {video: TranscodeSettings, audio: TranscodeSettings}}} Settings
 */

/** @type {Settings} */
const FALLBACK_DEFAULTS = {
  theme: { bg: 'auto', color: 'bg' },
  oneko: false,
  serverSort: true,
  pagination: { enabled: true, limit: 100 },
  lang: 'en',
  imageScale: { min: 50, default: 100, max: 200 },
  containerWidth: 65,
  imageKernel: 'lanczos3',
  bytesBits: false,
  transcode: {
    video: { enabled: true, codec: 'h264' },
    audio: { enabled: true, codec: 'aac' },
  },
}

/**
 * Determines whether a value is an object-shaped settings payload.
 *
 * @param {unknown} value Candidate value.
 * @returns {value is Record<string, unknown>} Whether the value is a record.
 */
function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/**
 * Copies settings so consumers cannot mutate the defaults by reference.
 *
 * @param {Settings} value Settings to copy.
 * @returns {Settings} Independent settings copy.
 */
function cloneSettings(value) {
  return {
    ...value,
    theme: { ...value.theme },
    pagination: { ...value.pagination },
    imageScale: { ...value.imageScale },
    transcode: {
      video: { ...value.transcode.video },
      audio: { ...value.transcode.audio },
    },
  }
}

/**
 * Selects a safe finite number from a settings payload.
 *
 * @param {unknown} value Candidate numeric value.
 * @param {number} fallback Default value.
 * @param {number} min Minimum accepted value.
 * @param {number} max Maximum accepted value.
 * @returns {number} A bounded numeric setting.
 */
function getNumber(value, fallback, min, max) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

/**
 * Builds complete, validated settings from an unknown source.
 *
 * @param {unknown} source API or cookie value.
 * @param {Settings} [fallback=FALLBACK_DEFAULTS] Defaults to merge against.
 * @returns {Settings} Complete settings object.
 */
function normalizeSettings(source, fallback = FALLBACK_DEFAULTS) {
  const candidate = isRecord(source) ? source : {}
  const theme = isRecord(candidate.theme) ? candidate.theme : {}
  const pagination = isRecord(candidate.pagination) ? candidate.pagination : {}
  const imageScale = isRecord(candidate.imageScale) ? candidate.imageScale : {}
  const transcode = isRecord(candidate.transcode) ? candidate.transcode : {}
  const video = isRecord(transcode.video) ? transcode.video : {}
  const audio = isRecord(transcode.audio) ? transcode.audio : {}

  const min = getNumber(imageScale.min, fallback.imageScale.min, 10, 400)
  const max = getNumber(imageScale.max, fallback.imageScale.max, min, 800)
  const defaultScale = getNumber(
    imageScale.default,
    fallback.imageScale.default,
    min,
    max
  )

  return {
    theme: {
      bg: typeof theme.bg === 'string' ? theme.bg : fallback.theme.bg,
      color:
        typeof theme.color === 'string' ? theme.color : fallback.theme.color,
    },
    oneko:
      typeof candidate.oneko === 'boolean' ? candidate.oneko : fallback.oneko,
    serverSort:
      typeof candidate.serverSort === 'boolean'
        ? candidate.serverSort
        : fallback.serverSort,
    pagination: {
      enabled:
        typeof pagination.enabled === 'boolean'
          ? pagination.enabled
          : fallback.pagination.enabled,
      limit: getNumber(pagination.limit, fallback.pagination.limit, 1, 1000),
    },
    lang: typeof candidate.lang === 'string' ? candidate.lang : fallback.lang,
    imageScale: { min, default: defaultScale, max },
    containerWidth: getNumber(
      candidate.containerWidth,
      fallback.containerWidth,
      50,
      100
    ),
    imageKernel:
      typeof candidate.imageKernel === 'string'
        ? candidate.imageKernel
        : fallback.imageKernel,
    bytesBits:
      typeof candidate.bytesBits === 'boolean'
        ? candidate.bytesBits
        : fallback.bytesBits,
    transcode: {
      video: {
        enabled:
          typeof video.enabled === 'boolean'
            ? video.enabled
            : fallback.transcode.video.enabled,
        codec:
          typeof video.codec === 'string'
            ? video.codec
            : fallback.transcode.video.codec,
      },
      audio: {
        enabled:
          typeof audio.enabled === 'boolean'
            ? audio.enabled
            : fallback.transcode.audio.enabled,
        codec:
          typeof audio.codec === 'string'
            ? audio.codec
            : fallback.transcode.audio.codec,
      },
    },
  }
}

/** @type {Settings} */
export let defaults = cloneSettings(FALLBACK_DEFAULTS)

/**
 * Loads the defaults shipped with the application.
 *
 * @returns {Promise<Settings>} Active defaults, with fallback values on failure.
 */
export async function loadDefaultSettings() {
  try {
    const payload = await requestJson(getAppUrl('/json/default.json'), {
      credentials: 'same-origin',
    })
    defaults = normalizeSettings(payload, FALLBACK_DEFAULTS)
  } catch (error) {
    handleError(error, 'Could not load default settings')
  }
  return defaults
}

/**
 * Reads persisted settings without allowing invalid cookies to break a page.
 *
 * @returns {Settings} Complete validated settings.
 */
function loadSettings() {
  return normalizeSettings(readJsonCookie('settings', null), defaults)
}

/**
 * Persists the current settings object.
 *
 * @returns {boolean} Whether storage succeeded.
 */
function saveSettings() {
  return writeJsonCookie('settings', settings)
}

/** @type {Settings} */
export const settings = loadSettings()

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
export let TRANSCODE_VIDEO_CODEC = settings.transcode.video.codec
export let TRANSCODE_VIDEO_ENABLED = settings.transcode.video.enabled
export let TRANSCODE_AUDIO_CODEC = settings.transcode.audio.codec
export let TRANSCODE_AUDIO_ENABLED = settings.transcode.audio.enabled

/**
 * Synchronizes exported compatibility values with the settings object.
 *
 * @returns {void}
 */
function applyRuntimeSettings() {
  MIN_IMAGE_SCALE = settings.imageScale.min
  IMAGE_SCALE = settings.imageScale.default
  MAX_IMAGE_SCALE = settings.imageScale.max
  SERVER_SIDE_SORT = settings.serverSort
  PAGINATION.enabled = settings.pagination.enabled
  PAGINATION.limit = settings.pagination.limit
  CONTAINER_WIDTH = settings.containerWidth
  BYTES_BITS = settings.bytesBits
  IMAGE_KERNEL = settings.imageKernel
  TRANSCODE_VIDEO_CODEC = settings.transcode.video.codec
  TRANSCODE_VIDEO_ENABLED = settings.transcode.video.enabled
  TRANSCODE_AUDIO_CODEC = settings.transcode.audio.codec
  TRANSCODE_AUDIO_ENABLED = settings.transcode.audio.enabled
}

/**
 * Updates image-scale exports while keeping their ordering valid.
 *
 * @param {number} min Minimum scale.
 * @param {number} defaultScale Default scale.
 * @param {number} max Maximum scale.
 * @returns {{MIN_IMAGE_SCALE: number, IMAGE_SCALE: number, MAX_IMAGE_SCALE: number}} Current scale values.
 */
export function setExportVals(min, defaultScale, max) {
  settings.imageScale = normalizeSettings(
    { imageScale: { min, default: defaultScale, max } },
    settings
  ).imageScale
  applyRuntimeSettings()
  return { MIN_IMAGE_SCALE, IMAGE_SCALE, MAX_IMAGE_SCALE }
}

let containerWidthListenerBound = false

/**
 * Applies the selected maximum content width to the main page container.
 *
 * @param {number} width Maximum width percentage.
 * @returns {number} Applied width.
 */
function setContainerWidth(width) {
  settings.containerWidth = getNumber(width, defaults.containerWidth, 50, 100)
  CONTAINER_WIDTH = settings.containerWidth
  const container = document.getElementById('container')
  if (!(container instanceof HTMLElement)) return CONTAINER_WIDTH

  /** @returns {void} */
  const applyWidth = () => {
    const isDesktop = window.matchMedia('(min-width: 48rem)').matches
    container.style.maxWidth = isDesktop ? `${CONTAINER_WIDTH}%` : ''
  }
  applyWidth()

  if (!containerWidthListenerBound) {
    window.addEventListener('resize', applyWidth)
    containerWidthListenerBound = true
  }
  return CONTAINER_WIDTH
}

/**
 * Toggles the optional Oneko script without removing unrelated DOM nodes.
 *
 * @param {boolean} enabled Whether Oneko should be active.
 * @returns {void}
 */
function toggleOneko(enabled) {
  const script = document.getElementById('oneko-script')
  if (enabled && !script) {
    const nextScript = document.createElement('script')
    nextScript.id = 'oneko-script'
    nextScript.src = 'https://sleepie.uk/oneko.js'
    nextScript.async = true
    document.body.appendChild(nextScript)
    return
  }
  if (!enabled) {
    script?.remove()
    document.getElementById('oneko')?.remove()
  }
}

/**
 * Resets persisted settings and reloads the page to reinitialize dependent modules.
 *
 * @returns {void}
 */
function resetAllSettings() {
  Object.assign(settings, cloneSettings(defaults))
  applyRuntimeSettings()
  saveSettings()
  window.location.reload()
}

/**
 * Fills a transcode selector with actual browser-playable options.
 *
 * @param {HTMLSelectElement | null} select Select element.
 * @param {'video' | 'audio'} kind Transcode media kind.
 * @param {string} preferredValue Persisted selector value.
 * @returns {Promise<string>} Selected supported value, or an empty string.
 */
async function populateSupportedCodecs(select, kind, preferredValue) {
  if (!select) return ''

  const formats = await getSupportedTranscodeFormats(kind)
  select.replaceChildren()

  if (formats.length === 0) {
    const unavailable = document.createElement('option')
    unavailable.value = ''
    unavailable.textContent = 'No supported playback format'
    select.appendChild(unavailable)
    select.disabled = true
    return ''
  }

  for (const format of formats) {
    const option = document.createElement('option')
    option.value = format.value
    option.textContent = format.label
    option.dataset.category = format.category
    select.appendChild(option)
  }

  const selected = formats.some((format) => format.value === preferredValue)
    ? preferredValue
    : formats[0].value
  select.value = selected
  select.disabled = false
  return selected
}

/**
 * Reads a numeric input, clamps it through settings normalization, and saves the result.
 *
 * @param {HTMLInputElement} input Input element.
 * @param {'min' | 'default' | 'max'} key Image scale property.
 * @returns {void}
 */
function bindImageScaleInput(input, key) {
  /** Updates this image-scale setting and persists the normalized values. @returns {void} */
  const apply = () => {
    const nextScale = { ...settings.imageScale, [key]: Number(input.value) }
    settings.imageScale = normalizeSettings(
      { imageScale: nextScale },
      settings
    ).imageScale
    applyRuntimeSettings()
    saveSettings()
  }
  input.addEventListener('change', apply)
  input.addEventListener('input', apply)
}

/**
 * Binds the settings panel and synchronizes its values with the shared state.
 *
 * @returns {Promise<void>} Resolves after async codec capability checks finish.
 */
export async function updateSettings() {
  const settingsButton = document.getElementById('settings-button')
  const settingsContainer = document.getElementById('settings-container')
  const closeSettings = document.getElementById('close-settings')
  const onekoToggle = document.getElementById('oneko-toggle')
  const serverSortToggle = document.getElementById('server-sort-toggle')
  const paginationToggle = document.getElementById('pagination-toggle')
  const paginationInput = document.getElementById('pagination-items-select')
  const imageKernelSelect = document.getElementById('image-kernel-select')
  const imageScaleMinInput = document.getElementById('image-scale-min-input')
  const imageScaleDefaultInput = document.getElementById(
    'image-scale-default-input'
  )
  const imageScaleMaxInput = document.getElementById('image-scale-max-input')
  const containerWidthInput = document.getElementById('container-width-input')
  const bytesBitsToggle = document.getElementById('bytes-bits-toggle')
  const resetSettingsButton = document.getElementById('reset-settings-button')
  const transcodeVideoToggle = document.getElementById('transcode-video-toggle')
  const transcodeVideoCodecSelect = document.getElementById(
    'transcode-video-codec-select'
  )
  const transcodeAudioToggle = document.getElementById('transcode-audio-toggle')
  const transcodeAudioCodecSelect = document.getElementById(
    'transcode-audio-codec-select'
  )

  if (onekoToggle instanceof HTMLInputElement) {
    onekoToggle.checked = settings.oneko
    onekoToggle.addEventListener('change', () => {
      settings.oneko = onekoToggle.checked
      toggleOneko(settings.oneko)
      saveSettings()
    })
    toggleOneko(settings.oneko)
  }

  if (serverSortToggle instanceof HTMLInputElement) {
    serverSortToggle.checked = settings.serverSort
    serverSortToggle.addEventListener('change', () => {
      settings.serverSort = serverSortToggle.checked
      applyRuntimeSettings()
      saveSettings()
    })
  }

  if (paginationToggle instanceof HTMLInputElement) {
    paginationToggle.checked = settings.pagination.enabled
    paginationToggle.addEventListener('change', () => {
      settings.pagination.enabled = paginationToggle.checked
      applyRuntimeSettings()
      saveSettings()
    })
  }

  if (paginationInput instanceof HTMLSelectElement) {
    paginationInput.value = String(settings.pagination.limit)
    paginationInput.addEventListener('change', () => {
      settings.pagination.limit = getNumber(
        Number(paginationInput.value),
        defaults.pagination.limit,
        1,
        1000
      )
      applyRuntimeSettings()
      saveSettings()
    })
  }

  if (imageKernelSelect instanceof HTMLSelectElement) {
    imageKernelSelect.value = settings.imageKernel
    imageKernelSelect.addEventListener('change', () => {
      settings.imageKernel = imageKernelSelect.value || defaults.imageKernel
      applyRuntimeSettings()
      saveSettings()
    })
  }

  if (imageScaleMinInput instanceof HTMLInputElement) {
    imageScaleMinInput.value = String(settings.imageScale.min)
    bindImageScaleInput(imageScaleMinInput, 'min')
  }
  if (imageScaleDefaultInput instanceof HTMLInputElement) {
    imageScaleDefaultInput.value = String(settings.imageScale.default)
    bindImageScaleInput(imageScaleDefaultInput, 'default')
  }
  if (imageScaleMaxInput instanceof HTMLInputElement) {
    imageScaleMaxInput.value = String(settings.imageScale.max)
    bindImageScaleInput(imageScaleMaxInput, 'max')
  }

  if (containerWidthInput instanceof HTMLInputElement) {
    containerWidthInput.value = String(settings.containerWidth)
    setContainerWidth(settings.containerWidth)
    /** Applies and persists the selected content-width setting. @returns {void} */
    const apply = () => {
      setContainerWidth(Number(containerWidthInput.value))
      saveSettings()
    }
    containerWidthInput.addEventListener('change', apply)
    containerWidthInput.addEventListener('input', apply)
  }

  if (bytesBitsToggle instanceof HTMLInputElement) {
    bytesBitsToggle.checked = settings.bytesBits
    bytesBitsToggle.addEventListener('change', () => {
      settings.bytesBits = bytesBitsToggle.checked
      applyRuntimeSettings()
      saveSettings()
    })
  }

  if (resetSettingsButton instanceof HTMLButtonElement) {
    resetSettingsButton.addEventListener('click', () => {
      if (confirm('Reset all settings to defaults?')) resetAllSettings()
    })
  }

  const videoValue = await populateSupportedCodecs(
    transcodeVideoCodecSelect instanceof HTMLSelectElement
      ? transcodeVideoCodecSelect
      : null,
    'video',
    settings.transcode.video.codec
  )
  const audioValue = await populateSupportedCodecs(
    transcodeAudioCodecSelect instanceof HTMLSelectElement
      ? transcodeAudioCodecSelect
      : null,
    'audio',
    settings.transcode.audio.codec
  )
  const compatiblePair = getCompatibleTranscodePair(videoValue, audioValue)
  const safeVideoCodec =
    compatiblePair?.videoCodec || videoValue || defaults.transcode.video.codec
  const safeAudioCodec =
    compatiblePair?.audioCodec || audioValue || defaults.transcode.audio.codec
  settings.transcode.video.codec = safeVideoCodec
  settings.transcode.audio.codec = safeAudioCodec

  const reconcileTranscodeState = () => {
    const currentVideo =
      transcodeVideoCodecSelect instanceof HTMLSelectElement
        ? transcodeVideoCodecSelect.value
        : settings.transcode.video.codec
    const currentAudio =
      transcodeAudioCodecSelect instanceof HTMLSelectElement
        ? transcodeAudioCodecSelect.value
        : settings.transcode.audio.codec
    const nextPair = getCompatibleTranscodePair(currentVideo, currentAudio)
    const resolvedVideo = nextPair?.videoCodec || currentVideo || safeVideoCodec
    const resolvedAudio =
      nextPair?.audioCodec ||
      (getCompatibleTranscodePair(currentVideo, defaults.transcode.audio.codec)
        ?.audioCodec ??
        '')

    settings.transcode.video.codec = resolvedVideo
    settings.transcode.audio.codec = resolvedAudio

    if (transcodeVideoCodecSelect instanceof HTMLSelectElement) {
      transcodeVideoCodecSelect.value = resolvedVideo
    }
    if (transcodeAudioCodecSelect instanceof HTMLSelectElement) {
      const audioOptions = Array.from(
        transcodeAudioCodecSelect.options,
        (option) => option.value
      )
      const nextAudioValue = audioOptions.includes(resolvedAudio)
        ? resolvedAudio
        : audioOptions[0] || ''
      transcodeAudioCodecSelect.value = nextAudioValue
      settings.transcode.audio.codec = nextAudioValue
    }
    if (!settings.transcode.audio.codec) {
      settings.transcode.audio.enabled = false
    }
    applyRuntimeSettings()
    saveSettings()
  }

  reconcileTranscodeState()

  if (transcodeVideoToggle instanceof HTMLInputElement) {
    transcodeVideoToggle.disabled = !safeVideoCodec
    transcodeVideoToggle.checked = Boolean(
      safeVideoCodec && settings.transcode.video.enabled
    )
    settings.transcode.video.enabled = transcodeVideoToggle.checked
    transcodeVideoToggle.addEventListener('change', () => {
      settings.transcode.video.enabled = transcodeVideoToggle.checked
      applyRuntimeSettings()
      saveSettings()
    })
  }
  if (transcodeVideoCodecSelect instanceof HTMLSelectElement) {
    transcodeVideoCodecSelect.value = safeVideoCodec
    transcodeVideoCodecSelect.addEventListener('change', () => {
      const selectedVideoCodec = transcodeVideoCodecSelect.value
      const compatibleAudio = getCompatibleTranscodePair(
        selectedVideoCodec,
        settings.transcode.audio.codec
      )?.audioCodec
      const nextAudio =
        compatibleAudio ||
        getCompatibleTranscodePair(
          selectedVideoCodec,
          defaults.transcode.audio.codec
        )?.audioCodec ||
        ''
      settings.transcode.video.codec = selectedVideoCodec
      settings.transcode.audio.codec = nextAudio
      if (transcodeAudioCodecSelect instanceof HTMLSelectElement) {
        transcodeAudioCodecSelect.value = nextAudio || ''
      }
      if (!nextAudio) {
        settings.transcode.audio.enabled = false
        if (transcodeAudioToggle instanceof HTMLInputElement) {
          transcodeAudioToggle.checked = false
        }
      }
      reconcileTranscodeState()
      applyRuntimeSettings()
      saveSettings()
    })
  }

  if (transcodeAudioToggle instanceof HTMLInputElement) {
    transcodeAudioToggle.disabled = !safeAudioCodec
    transcodeAudioToggle.checked = Boolean(
      safeAudioCodec && settings.transcode.audio.enabled
    )
    settings.transcode.audio.enabled = transcodeAudioToggle.checked
    transcodeAudioToggle.addEventListener('change', () => {
      const selectedAudioCodec =
        transcodeAudioCodecSelect instanceof HTMLSelectElement
          ? transcodeAudioCodecSelect.value
          : settings.transcode.audio.codec
      const compatible = getCompatibleTranscodePair(
        settings.transcode.video.codec,
        selectedAudioCodec
      )
      if (!compatible && settings.transcode.video.codec) {
        const fallbackAudio =
          getCompatibleTranscodePair(
            settings.transcode.video.codec,
            defaults.transcode.audio.codec
          )?.audioCodec || ''
        settings.transcode.audio.codec = fallbackAudio
        if (transcodeAudioCodecSelect instanceof HTMLSelectElement) {
          transcodeAudioCodecSelect.value = fallbackAudio || ''
        }
        if (!fallbackAudio) {
          settings.transcode.audio.enabled = false
          transcodeAudioToggle.checked = false
        }
      }
      settings.transcode.audio.enabled = transcodeAudioToggle.checked
      applyRuntimeSettings()
      saveSettings()
    })
  }
  if (transcodeAudioCodecSelect instanceof HTMLSelectElement) {
    transcodeAudioCodecSelect.value = safeAudioCodec
    transcodeAudioCodecSelect.addEventListener('change', () => {
      const selectedAudioCodec = transcodeAudioCodecSelect.value
      const compatible = getCompatibleTranscodePair(
        settings.transcode.video.codec,
        selectedAudioCodec
      )
      const resolvedAudio = compatible?.audioCodec || selectedAudioCodec
      settings.transcode.audio.codec = resolvedAudio
      if (transcodeAudioToggle instanceof HTMLInputElement) {
        transcodeAudioToggle.disabled = !resolvedAudio
        transcodeAudioToggle.checked = Boolean(
          resolvedAudio && settings.transcode.audio.enabled
        )
      }
      if (!compatible) {
        settings.transcode.audio.enabled = false
      }
      applyRuntimeSettings()
      saveSettings()
    })
  }

  applyRuntimeSettings()
  saveSettings()

  if (
    settingsButton instanceof HTMLButtonElement &&
    settingsContainer instanceof HTMLElement
  ) {
    settingsButton.addEventListener('click', () => {
      settingsContainer.hidden = !settingsContainer.hidden
      settingsButton.hidden = settingsContainer.hidden === false
    })
  }
  if (
    closeSettings instanceof HTMLElement &&
    settingsContainer instanceof HTMLElement &&
    settingsButton instanceof HTMLButtonElement
  ) {
    closeSettings.addEventListener('click', () => {
      settingsContainer.hidden = true
      settingsButton.hidden = false
    })
  }
}

/**
 * Initializes settings after the settings partial is present in the DOM.
 *
 * @returns {Promise<void>} Resolves after controls are bound.
 */
async function initSettings() {
  await loadDefaultSettings()
  Object.assign(settings, loadSettings())
  applyRuntimeSettings()
  await updateSettings()
}

document.addEventListener('DOMContentLoaded', () => {
  void initSettings()
})
