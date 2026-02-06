import * as utils from '../min/index.min.js'
let _scrollLockCount = 0
let _prevBodyOverflow = null
/**
 * Manages scroll locking on the document body with reference counting.
 *
 * @namespace scroll
 * @example
 * // Toggle scroll lock
 * scroll(); // locks if unlocked, unlocks if locked
 * scroll.toggle(); // same as above
 *
 * @example
 * // Lock scroll explicitly
 * scroll.lock();
 * scroll('lock');
 * scroll(false);
 *
 * @example
 * // Unlock scroll explicitly
 * scroll.unlock();
 * scroll('unlock');
 * scroll(true);
 *
 * @example
 * // Check current state
 * const isLocked = scroll.isLocked(); // true if scroll is currently locked
 * const count = scroll.getCount(); // get current lock count
 *
 * @example
 * // Reference counting - useful for nested components
 * scroll.lock(); // count: 1, body overflow: hidden
 * scroll.lock(); // count: 2, body overflow: hidden
 * scroll.unlock(); // count: 1, body still overflow: hidden
 * scroll.unlock(); // count: 0, body overflow restored
 */
/**
 * Main scroll control function. Toggles scroll lock by default.
 *
 * @param {boolean|string} [action='toggle'] - Control action:
 *   - 'toggle': Toggle current state (default)
 *   - 'lock'|'on'|'1'|false: Lock scrolling
 *   - 'unlock'|'off'|'0'|true: Unlock scrolling
 * @returns {boolean} True if scroll is now enabled (unlocked), false if disabled (locked)
 * @throws {Error} Logs error via handleError if operation fails
 */
export function scroll(action = 'toggle') {
  try {
    let shouldEnable
    if (typeof action === 'boolean') {
      shouldEnable = action
    } else if (typeof action === 'string') {
      shouldEnable = action === 'unlock' || action === 'off' || action === '0'
    } else {
      shouldEnable = _scrollLockCount > 0
    }
    if (shouldEnable) {
      if (_scrollLockCount > 0) {
        _scrollLockCount--
        if (_scrollLockCount === 0) {
          if (_prevBodyOverflow === null || _prevBodyOverflow === undefined) {
            document.body.style.removeProperty('overflow')
          } else {
            document.body.style.overflow = _prevBodyOverflow
          }
          _prevBodyOverflow = null
        }
      }
      return true
    } else {
      if (_scrollLockCount === 0) {
        _prevBodyOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      }
      _scrollLockCount++
      return false
    }
  } catch (error) {
    utils.handleError(error)
    return _scrollLockCount === 0
  }
}
/**
 * Lock scrolling (disable scroll).
 * Increments the lock count and sets body overflow to hidden.
 *
 * @function
 * @memberof scroll
 * @returns {boolean} False (scroll is now disabled)
 */
scroll.lock = function () {
  return scroll('lock')
}
/**
 * Unlock scrolling (enable scroll).
 * Decrements the lock count and restores body overflow when count reaches 0.
 *
 * @function
 * @memberof scroll
 * @returns {boolean} True (scroll is now enabled)
 */
scroll.unlock = function () {
  return scroll('unlock')
}
/**
 * Toggle scroll lock state.
 *
 * @function
 * @memberof scroll
 * @returns {boolean} True if scroll is now enabled, false if now disabled
 */
scroll.toggle = function () {
  return scroll('toggle')
}
/**
 * Enable scrolling (alias for unlock).
 *
 * @function
 * @memberof scroll
 * @returns {boolean} True (scroll is now enabled)
 */
scroll.enable = function () {
  return scroll.unlock()
}
/**
 * Disable scrolling (alias for lock).
 *
 * @function
 * @memberof scroll
 * @returns {boolean} False (scroll is now disabled)
 */
scroll.disable = function () {
  return scroll.lock()
}
/**
 * Check if scroll is currently locked.
 *
 * @function
 * @memberof scroll
 * @returns {boolean} True if scroll is locked (disabled), false otherwise
 */
scroll.isLocked = function () {
  return _scrollLockCount > 0
}
/**
 * Get the current lock count.
 * Useful for debugging or understanding nested lock states.
 *
 * @function
 * @memberof scroll
 * @returns {number} Current lock count (0 = unlocked, >0 = locked)
 */
scroll.getCount = function () {
  return _scrollLockCount
}
export default scroll
