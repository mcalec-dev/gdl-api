/**
 * Copies text to the system clipboard when the browser supports it.
 *
 * @param {unknown} value Text to copy.
 * @returns {Promise<boolean>} Whether copying succeeded.
 */
export async function copyText(value) {
  if (typeof value !== 'string' || !value || !navigator.clipboard?.writeText) {
    return false
  }

  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

/**
 * Downloads an image and copies it to the system clipboard.
 *
 * @param {string} url Image URL.
 * @returns {Promise<boolean>} Whether copying succeeded.
 */
export async function copyImage(url) {
  if (
    !url ||
    !navigator.clipboard?.write ||
    typeof ClipboardItem === 'undefined'
  ) {
    return false
  }

  try {
    const response = await fetch(url)
    if (!response.ok) return false

    const blob = await response.blob()
    if (!blob.type) return false

    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    return true
  } catch {
    return false
  }
}
