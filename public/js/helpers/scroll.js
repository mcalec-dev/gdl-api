let lockCount = 0
let originalOverflow = ''

/**
 * Prevents page scrolling while an overlay is open.
 *
 * @returns {void}
 */
export function lockScroll() {
  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1
}

/**
 * Restores page scrolling after overlays close.
 *
 * @returns {void}
 */
export function unlockScroll() {
  if (lockCount === 0) return
  lockCount -= 1
  if (lockCount === 0) document.body.style.overflow = originalOverflow
}
