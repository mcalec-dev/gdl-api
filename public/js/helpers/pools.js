import { requestJson } from './api.js'
import { escapeHtml, normalizeIdentifier, toDisplayText } from './strings.js'
import { getErrorMessage, handleError, statusMessage } from './ui.js'
import { getAppUrl } from './url.js'

/**
 * @typedef {{uuid: string, name: string}} PoolOption
 */

/**
 * Checks whether a value is an object-shaped response payload.
 *
 * @param {unknown} value Candidate response value.
 * @returns {value is Record<string, unknown>} Whether value is a record.
 */
function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/**
 * Retrieves selectable pools for the add-to-pool UI.
 *
 * @returns {Promise<PoolOption[]>} Pools with valid UUIDs and names.
 */
export async function fetchPools() {
  const payload = await requestJson(getAppUrl('/api/pool?limit=200'), {
    credentials: 'same-origin',
  })
  const candidates = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.results)
      ? payload.results
      : []

  return candidates.flatMap((pool) => {
    if (!isRecord(pool)) return []
    const uuid = normalizeIdentifier(pool.uuid)
    const name = toDisplayText(pool.name)
    return uuid && name ? [{ uuid, name }] : []
  })
}

/**
 * Adds a file to an existing pool.
 *
 * @param {unknown} poolUuid Pool UUID.
 * @param {unknown} fileUuid File UUID.
 * @returns {Promise<unknown>} API response payload.
 * @throws {Error} When either identifier is invalid or the request fails.
 */
export async function addToPool(poolUuid, fileUuid) {
  const normalizedPoolUuid = normalizeIdentifier(poolUuid)
  const normalizedFileUuid = normalizeIdentifier(fileUuid)
  if (!normalizedPoolUuid || !normalizedFileUuid) {
    throw new Error(
      'Pool UUID and file UUID are required to add a file to a pool'
    )
  }

  return requestJson(
    getAppUrl(`/api/pool/${encodeURIComponent(normalizedPoolUuid)}/files`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ files: [normalizedFileUuid] }),
    }
  )
}

/**
 * Creates a pool and adds one file to it.
 *
 * @param {unknown} poolName New pool name.
 * @param {unknown} fileUuid File UUID.
 * @returns {Promise<unknown>} API response payload.
 * @throws {Error} When the input is invalid or the request fails.
 */
export async function createPoolAndAdd(poolName, fileUuid) {
  const normalizedPoolName = toDisplayText(poolName)
  const normalizedFileUuid = normalizeIdentifier(fileUuid)
  if (!normalizedPoolName || !normalizedFileUuid) {
    throw new Error('Pool name and file UUID are required')
  }

  return requestJson(getAppUrl('/api/pool'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      name: normalizedPoolName,
      files: [normalizedFileUuid],
    }),
  })
}

/**
 * Opens a self-contained dialog for adding a file to an existing or new pool.
 *
 * @param {unknown} fileUuid File UUID.
 * @returns {Promise<void>} Resolves after the dialog is initialized.
 * @throws {Error} When the file UUID is invalid.
 */
export async function openAddToPoolModal(fileUuid) {
  const normalizedFileUuid = normalizeIdentifier(fileUuid)
  if (!normalizedFileUuid) throw new Error('A valid file UUID is required')

  document.getElementById('add-to-pool-backdrop')?.remove()

  const backdrop = document.createElement('div')
  backdrop.id = 'add-to-pool-backdrop'
  backdrop.setAttribute('role', 'dialog')
  backdrop.setAttribute('aria-modal', 'true')
  backdrop.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65)'

  const dialog = document.createElement('div')
  dialog.style.cssText =
    'width:min(560px,92vw);max-height:88vh;overflow:auto;border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:16px;background:rgba(14,14,16,.95);color:#fff;box-shadow:0 12px 36px rgba(0,0,0,.45)'
  dialog.innerHTML = `
    <h3 style="margin:0 0 10px;font-size:1.1rem;font-weight:700">Add to Pool</h3>
    <p style="margin:0 0 12px;opacity:.85">Choose an existing pool or create a new one for this file.</p>
    <div id="add-to-pool-content">Loading pools…</div>
  `

  backdrop.appendChild(dialog)
  document.body.appendChild(backdrop)

  /** @returns {void} */
  const close = () => {
    document.removeEventListener('keydown', onKeyDown)
    backdrop.remove()
  }
  /** @param {KeyboardEvent} event @returns {void} */
  const onKeyDown = (event) => {
    if (event.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKeyDown)
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close()
  })

  const content = dialog.querySelector('#add-to-pool-content')
  if (!(content instanceof HTMLElement)) return

  try {
    const pools = await fetchPools()
    const options = pools
      .map(
        (pool) =>
          `<option value="${escapeHtml(pool.uuid)}">${escapeHtml(pool.name)}</option>`
      )
      .join('')
    content.innerHTML = `
      <form id="add-to-pool-form" style="display:flex;flex-direction:column;gap:10px">
        <label style="display:flex;flex-direction:column;gap:6px">
          <span style="font-size:.9rem;opacity:.9">Existing pool</span>
          <select id="pool-select" style="padding:8px;border-radius:8px;background:#1f1f25;border:1px solid #3a3a44;color:#fff">
            <option value="">Create new pool</option>
            ${options}
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:6px">
          <span style="font-size:.9rem;opacity:.9">New pool name</span>
          <input id="new-pool-name" type="text" placeholder="Favorites" style="padding:8px;border-radius:8px;background:#1f1f25;border:1px solid #3a3a44;color:#fff" />
        </label>
        <div id="add-to-pool-error" style="color:#ff9a9a;min-height:1.1em"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" id="pool-cancel" style="padding:8px 12px;border-radius:8px;border:1px solid #4a4a55;background:#24242b;color:#fff;cursor:pointer">Cancel</button>
          <button type="submit" id="pool-submit" style="padding:8px 12px;border-radius:8px;border:1px solid #2f6f4a;background:#1f8a55;color:#fff;cursor:pointer">Add</button>
        </div>
      </form>
    `

    const form = content.querySelector('#add-to-pool-form')
    const poolSelect = content.querySelector('#pool-select')
    const newPoolName = content.querySelector('#new-pool-name')
    const cancelButton = content.querySelector('#pool-cancel')
    const submitButton = content.querySelector('#pool-submit')
    const errorElement = content.querySelector('#add-to-pool-error')
    if (
      !(form instanceof HTMLFormElement) ||
      !(poolSelect instanceof HTMLSelectElement) ||
      !(newPoolName instanceof HTMLInputElement) ||
      !(cancelButton instanceof HTMLButtonElement) ||
      !(submitButton instanceof HTMLButtonElement) ||
      !(errorElement instanceof HTMLElement)
    ) {
      throw new Error('The add-to-pool dialog could not be initialized')
    }

    cancelButton.addEventListener('click', close)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      submitButton.disabled = true
      submitButton.textContent = 'Saving…'
      errorElement.textContent = ''

      try {
        const selectedPoolUuid = normalizeIdentifier(poolSelect.value)
        if (selectedPoolUuid) {
          await addToPool(selectedPoolUuid, normalizedFileUuid)
          statusMessage('Added file to pool successfully')
        } else {
          await createPoolAndAdd(newPoolName.value, normalizedFileUuid)
          statusMessage('Created pool and added file successfully')
        }
        close()
      } catch (error) {
        errorElement.textContent = getErrorMessage(
          error,
          'Failed to add file to pool'
        )
        handleError(error, 'Add to pool failed')
      } finally {
        submitButton.disabled = false
        submitButton.textContent = 'Add'
      }
    })
  } catch (error) {
    content.textContent = getErrorMessage(error, 'Failed to load pools')
    handleError(error, 'Pool list failed to load')
  }
}
