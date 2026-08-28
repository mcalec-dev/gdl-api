// @ts-ignore
import * as helpers from './helpers/format.min.js'

export const formatSize = () => helpers.formatSize()
export const formatMilliseconds = () => helpers.formatMs()

/**
 * @param {string|number|Date} timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(
    Intl.DateTimeFormat().resolvedOptions().locale,
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }
  )
}

/**
 * @async
 * @returns {Promise<string|undefined>}
 */
export async function getName() {
  let name
  try {
    const host = document.location.origin + (window.BASE_PATH || '') + '/api'
    if (!host) throw new Error('No API host available')
    const res = await fetch(host)
    if (res && typeof res.json === 'function') {
      const data = await res.json()
      name = data && data.name
    } else if (res && res.name) {
      name = res.name
    }
  } catch (error) {
    console.error('Failed to fetch name:', error)
    name = undefined
  }
  return name
}

/**
 * @async
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function parseEmojis(text) {
  return text.replace(/:([a-zA-Z0-9_+-]+):/g, async (match, key) => {
    const icons = await getIcons()
    return icons[key] || match
  })
}

/**
 * @async
 * @returns {Promise<Object>}
 */
export async function getIcons() {
  return await fetch('/icons.json')
    .then((response) => response.json())
    .catch((error) => {
      handleError(error)
      return {}
    })
}

/** @param {string|Error|undefined} error */
export function handleError(error) {
  console.log('An error occurred:', error)
  return console.error(error)
}

/**
 * @param {string} message
 * @param {boolean} isError
 */
export function statusMessage(message, isError = false) {
  const statusMessageElement = document.getElementById('statusMessage')
  if (statusMessageElement) {
    statusMessageElement.textContent = message
    statusMessageElement.style.display = 'block'
    statusMessageElement.style.color = isError ? 'red' : 'black'
  }
}

/**
 * @param {string|URL} url
 * @param {Record<string, any>|Array<{key: string, value: any}>|undefined} params
 * @returns {string|null}
 */
export function constructURL(url, params = {}) {
  if (!url) return null
  try {
    const baseUrl = new URL(url)
    if (!params || Object.keys(params).length === 0) {
      return baseUrl.toString()
    }
    Object.entries(params).forEach(([key, value]) => {
      if (key == null || key === '') return
      let finalValue
      if (Array.isArray(value)) {
        finalValue = value
          .filter((item) => item != null)
          .map((item) => String(item).trim())
          .filter((item) => item !== '')
          .join(',')
      } else {
        finalValue = value ?? ''
      }
      baseUrl.searchParams.set(key, finalValue)
    })
    return baseUrl.toString()
  } catch (error) {
    handleError(error)
    return null
  }
}

/**
 * @param {string} uuid
 * @param {string|undefined} type
 * @returns {Object|null}
 */
export function getByUUID(uuid, type = 'file') {
  if (!uuid || !type) return null
  /** @enum {string} */
  const types = ['file', 'directory']
  if (!types.includes(type)) {
    handleError('Invalid type parameter: ' + type)
    return null
  }
  return fetch(`/api/uuid/${uuid}/${type}`)
    .then((response) => {
      if (!response.ok) {
        handleError('Failed to fetch info: ' + response.statusText)
        return null
      }
      return response.json()
    })
    .catch((error) => {
      handleError(error)
      return null
    })
}

/**
 * @param {string} url
 * @returns {Promise<boolean|null>}
 */
export async function copyImage(url) {
  if (!url) {
    handleError('No URL provided for copying image')
    return null
  }
  if (!navigator.clipboard?.write) {
    handleError('Clipboard API not supported in this browser')
    return null
  }
  try {
    const res = await fetch(url)
    if (!res.ok) {
      handleError('Failed to fetch image: ' + res.statusText)
      return null
    }
    const blob = await res.blob()
    const type = blob.type
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })])
    return true
  } catch (error) {
    handleError(error)
    return null
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeIdentifier(value) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim()
  if (!normalized || normalized === 'null' || normalized === 'undefined') {
    return ''
  }
  return normalized
}

/**
 * @param {string} pUUID
 * @param {string} fUUID
 * @returns {Promise<Object>}
 */
export async function addToPool(pUUID, fUUID) {
  const normalizedPoolUuid = normalizeIdentifier(pUUID)
  const normalizedFileUuid = normalizeIdentifier(fUUID)
  if (!normalizedPoolUuid || !normalizedFileUuid) {
    throw new Error('Pool UUID and file UUID are required to add to pool')
  }
  const response = await fetch(
    `/api/pool/${encodeURIComponent(normalizedPoolUuid)}/files`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files: [normalizedFileUuid] }),
    }
  )
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.message || 'Failed to add file to pool'
    throw new Error(message)
  }
  return payload || { message: 'Added to pool' }
}

/**
 * Fetches pools for pool selection UI.
 * @returns {Promise<Array<{ uuid: string, name: string }>>}
 */
export async function fetchPools() {
  const response = await fetch('/api/pool?limit=200')
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.message || 'Failed to load pools'
    handleError(message)
    return []
  }
  const results = Array.isArray(payload?.results)
    ? payload.results
    : Array.isArray(payload)
      ? payload
      : []
  return results.filter((pool) => pool && pool.uuid && pool.name)
}

/**
 * @param {string} poolName
 * @param {string} fileUuid
 * @returns {Promise<Object>}
 */
export async function createPoolAndAdd(poolName, fileUuid) {
  const normalizedPoolName = typeof poolName === 'string' ? poolName.trim() : ''
  const normalizedFileUuid = normalizeIdentifier(fileUuid)
  if (!normalizedPoolName || !normalizedFileUuid) {
    throw new Error('Pool name and file UUID are required')
  }
  const response = await fetch('/api/pool', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: normalizedPoolName,
      files: [normalizedFileUuid],
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.message || 'Failed to create pool'
    throw new Error(message)
  }
  return payload || { message: 'Pool created' }
}

/**
 * Opens a modal that lets the user add a file to an existing pool or create a new one.
 * @param {string} fileUuid
 * @returns {Promise<void>}
 */
export async function openAddToPoolModal(fileUuid) {
  const normalizedFileUuid = normalizeIdentifier(fileUuid)
  if (!normalizedFileUuid) {
    throw new Error('Invalid file UUID')
  }
  const existingBackdrop = document.getElementById('add-to-pool-backdrop')
  if (existingBackdrop) existingBackdrop.remove()
  const backdrop = document.createElement('div')
  backdrop.id = 'add-to-pool-backdrop'
  backdrop.setAttribute('role', 'dialog')
  backdrop.setAttribute('aria-modal', 'true')
  backdrop.style.position = 'fixed'
  backdrop.style.inset = '0'
  backdrop.style.background = 'rgba(0, 0, 0, 0.65)'
  backdrop.style.display = 'flex'
  backdrop.style.alignItems = 'center'
  backdrop.style.justifyContent = 'center'
  backdrop.style.zIndex = '9999'
  const modal = document.createElement('div')
  modal.style.width = 'min(560px, 92vw)'
  modal.style.maxHeight = '88vh'
  modal.style.overflow = 'auto'
  modal.style.borderRadius = '14px'
  modal.style.padding = '16px'
  modal.style.border = '1px solid rgba(255,255,255,.2)'
  modal.style.background = 'rgba(14, 14, 16, 0.95)'
  modal.style.color = '#fff'
  modal.style.boxShadow = '0 12px 36px rgba(0,0,0,.45)'
  const closeModal = () => {
    document.removeEventListener('keydown', onEsc)
    backdrop.remove()
  }
  const onEsc = (event) => {
    if (event.key === 'Escape') closeModal()
  }
  document.addEventListener('keydown', onEsc)
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal()
  })
  modal.innerHTML = `
    <h3 style="margin:0 0 10px 0;font-size:1.1rem;font-weight:700;">Add To Pool</h3>
    <p style="margin:0 0 12px 0;opacity:.85;">Choose an existing pool or create a new one for this file.</p>
    <div id="add-to-pool-content">Loading pools...</div>
  `
  backdrop.appendChild(modal)
  document.body.appendChild(backdrop)
  const content = modal.querySelector('#add-to-pool-content')
  if (!content) return
  try {
    const pools = await fetchPools()
    const poolOptions = pools
      .map(
        (pool) =>
          `<option value="${escapeHtml(pool.uuid)}">${escapeHtml(pool.name)}</option>`
      )
      .join('')
    content.innerHTML = `
      <form id="add-to-pool-form" style="display:flex;flex-direction:column;gap:10px;">
        <label style="display:flex;flex-direction:column;gap:6px;">
          <span style="font-size:.9rem;opacity:.9;">Existing pool</span>
          <select id="pool-select" style="padding:8px;border-radius:8px;background:#1f1f25;border:1px solid #3a3a44;color:#fff;">
            <option value="">Create new pool</option>
            ${poolOptions}
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:6px;">
          <span style="font-size:.9rem;opacity:.9;">New pool name</span>
          <input id="new-pool-name" type="text" placeholder="Favorites" style="padding:8px;border-radius:8px;background:#1f1f25;border:1px solid #3a3a44;color:#fff;" />
        </label>
        <div id="add-to-pool-error" style="color:#ff9a9a;min-height:1.1em;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" id="pool-cancel" style="padding:8px 12px;border-radius:8px;border:1px solid #4a4a55;background:#24242b;color:#fff;cursor:pointer;">Cancel</button>
          <button type="submit" id="pool-submit" style="padding:8px 12px;border-radius:8px;border:1px solid #2f6f4a;background:#1f8a55;color:#fff;cursor:pointer;">Add</button>
        </div>
      </form>
    `
    const form = modal.querySelector('#add-to-pool-form')
    const cancelButton = modal.querySelector('#pool-cancel')
    const poolSelect = modal.querySelector('#pool-select')
    const newPoolNameInput = modal.querySelector('#new-pool-name')
    const submitButton = modal.querySelector('#pool-submit')
    const errorElement = modal.querySelector('#add-to-pool-error')
    if (
      !form ||
      !cancelButton ||
      !poolSelect ||
      !newPoolNameInput ||
      !submitButton ||
      !errorElement
    ) {
      throw new Error('Failed to initialize pool modal')
    }
    cancelButton.addEventListener('click', closeModal)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      try {
        submitButton.disabled = true
        submitButton.textContent = 'Saving...'
        if (errorElement) errorElement.textContent = ''
        const selectedPoolUuid = String(poolSelect.value || '').trim()
        const newPoolName = String(newPoolNameInput.value || '').trim()
        if (selectedPoolUuid) {
          await addToPool(selectedPoolUuid, normalizedFileUuid)
          statusMessage('Added file to pool successfully')
        } else {
          if (!newPoolName) {
            throw new Error(
              'Provide a new pool name or select an existing pool'
            )
          }
          await createPoolAndAdd(newPoolName, normalizedFileUuid)
          statusMessage('Created pool and added file successfully')
        }
        closeModal()
      } catch (error) {
        if (errorElement) {
          errorElement.textContent =
            typeof error?.message === 'string'
              ? error.message
              : 'Failed to add to pool'
        }
        handleError(error)
      } finally {
        submitButton.disabled = false
        submitButton.textContent = 'Add'
      }
    })
  } catch (error) {
    content.innerHTML = `
      <div style="color:#ff9a9a;margin-bottom:10px;">Failed to load pools.</div>
      <div style="display:flex;justify-content:flex-end;">
        <button id="pool-close-error" type="button" style="padding:8px 12px;border-radius:8px;border:1px solid #4a4a55;background:#24242b;color:#fff;cursor:pointer;">Close</button>
      </div>
    `
    const closeError = content.querySelector('#pool-close-error')
    if (closeError) closeError.addEventListener('click', closeModal)
    handleError(error)
  }
}

export function escapeHtml(text) {
  if (typeof text !== 'string') return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export default {
  formatSize,
  formatMilliseconds,
  formatDate,
  getName,
  parseEmojis,
  getIcons,
  handleError,
  statusMessage,
  constructURL,
  getByUUID,
  copyImage,
  addToPool,
  fetchPools,
  createPoolAndAdd,
  openAddToPoolModal,
  escapeHtml,
}
