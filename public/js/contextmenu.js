// @ts-ignore
import * as utils from '../min/index.min.js'

/** @typedef {{clientX: number, clientY: number}} ContextMenuPoint */
/** @typedef {{label?: string, icon?: string, divider?: boolean, submenu?: ContextMenuItem[], handler?: () => void | Promise<void>}} ContextMenuItem */
/** @typedef {{icon?: string, label?: string}} ContextMenuHeader */
/** @typedef {{header?: ContextMenuHeader, items: ContextMenuItem[]}} ContextMenuData */
/** @typedef {{nav?: {next?: string, link?: string, download?: string, copy?: string}, [key: string]: string | {next?: string, link?: string, download?: string, copy?: string} | undefined}} ContextIcons */
/** @typedef {HTMLDivElement & {_currentMenuData?: ContextMenuData, _originalPosition?: {left: number, top: number}}} ContextMenuElement */
/** @typedef {{lock: () => void, unlock: () => void}} ScrollModule */

/** @type {ScrollModule} */
let scroll = {
  lock: () => {},
  unlock: () => {},
}
let _scrollLoaded = false

async function loadScrollModule() {
  if (_scrollLoaded) return
  _scrollLoaded = true
  try {
    const module =
      // @ts-ignore
      await import('https://utils.mcalec.dev/scroll.js/scroll.min.js')
    scroll = module?.default ?? module
  } catch (error) {
    console.warn(
      'Unable to load scroll module; proceeding without scroll locking.',
      error,
    )
  }
}

function ensureScrollModule() {
  void loadScrollModule()
}

/** @type {ContextMenuElement | null} */
let contextMenu = null
/** @type {((event: PointerEvent) => void) | null} */
let _contextOutsideHandler = null
/** @type {ContextIcons | null} */
let icons = null
let frontendBasePath = ''
let apiBasePath = ''
let _lastTouchContextMenuAt = 0

const TOUCH_HOLD_DELAY = 500
const TOUCH_MOVE_TOLERANCE = 10

/**
 * @param {ContextIcons} i
 */
export function setContextIcons(i) {
  icons = i
}

/**
 * @param {string} frontend
 * @param {string} api
 */
export function setContextBasePaths(frontend, api) {
  frontendBasePath = frontend
  apiBasePath = api
}

export function createContextMenu() {
  if (contextMenu) return
  contextMenu = /** @type {ContextMenuElement | null} */ (
    document.getElementById('context-menu-container')
  )
  if (!contextMenu) {
    contextMenu = document.createElement('div')
    contextMenu.id = 'context-menu-container'
    document.body.appendChild(contextMenu)
  }
  contextMenu.hidden = true
}

function hideContextMenu() {
  scroll.unlock()
  if (!contextMenu) return
  contextMenu.style.display = 'none'
  contextMenu.hidden = true
  document.querySelectorAll('.submenu-container').forEach((el) => el.remove())
  if (_contextOutsideHandler) {
    document.removeEventListener('pointerdown', _contextOutsideHandler, true)
    _contextOutsideHandler = null
  }
}

/**
 * @param {EventTarget | null} target
 * @param {string} selector
 * @returns {HTMLElement | null}
 */
function closestHtmlElement(target, selector) {
  return target instanceof HTMLElement ? target.closest(selector) : null
}

/**
 * @param {string} selector
 * @param {(itemElem: HTMLElement, point: ContextMenuPoint) => ContextMenuData | null | undefined} menuItemsCallback
 */
export function setupContextMenu(selector, menuItemsCallback) {
  if (!contextMenu) createContextMenu()
  document.addEventListener('contextmenu', (e) => {
    if (Date.now() - _lastTouchContextMenuAt < TOUCH_HOLD_DELAY) {
      e.preventDefault()
      return
    }
    const itemElem = closestHtmlElement(e.target, selector)
    if (itemElem) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      showGenericContextMenu(e, itemElem, menuItemsCallback)
    } else {
      hideContextMenu()
    }
  })
  /** @type {ReturnType<typeof setTimeout> | null} */
  let touchTimer = null
  /** @type {{clientX: number, clientY: number} | null} */
  let touchStart = null
  /** @type {HTMLElement | null} */
  let touchItem = null
  const clearTouchHold = () => {
    if (touchTimer) {
      clearTimeout(touchTimer)
      touchTimer = null
    }
    touchStart = null
    touchItem = null
  }
  document.addEventListener(
    'touchstart',
    /** @param {TouchEvent} e */
    (e) => {
      const itemElem = closestHtmlElement(e.target, selector)
      if (!itemElem || e.touches.length === 0) return
      const touch = e.touches[0]
      if (e.touches.length >= 2) {
        e.preventDefault()
        clearTouchHold()
        _lastTouchContextMenuAt = Date.now()
        showGenericContextMenu(
          { clientX: touch.clientX, clientY: touch.clientY },
          itemElem,
          menuItemsCallback,
        )
        return
      }
      clearTouchHold()
      touchItem = itemElem
      touchStart = { clientX: touch.clientX, clientY: touch.clientY }
      touchTimer = setTimeout(() => {
        if (!touchItem || !touchStart) return
        _lastTouchContextMenuAt = Date.now()
        showGenericContextMenu(
          { clientX: touchStart.clientX, clientY: touchStart.clientY },
          touchItem,
          menuItemsCallback,
        )
        touchTimer = null
      }, TOUCH_HOLD_DELAY)
    },
    { passive: false },
  )
  document.addEventListener(
    'touchmove',
    /** @param {TouchEvent} e */
    (e) => {
      if (!touchStart || e.touches.length === 0) return
      const touch = e.touches[0]
      if (
        Math.abs(touch.clientX - touchStart.clientX) > TOUCH_MOVE_TOLERANCE ||
        Math.abs(touch.clientY - touchStart.clientY) > TOUCH_MOVE_TOLERANCE
      ) {
        clearTouchHold()
      }
    },
    { passive: true },
  )
  document.addEventListener('touchend', clearTouchHold)
  document.addEventListener('touchcancel', clearTouchHold)
}
/**
 * @private
 * @param {{clientX: number, clientY: number}} e
 * @param {Element} itemElem
 * @param {Function} menuItemsCallback
 */
function showGenericContextMenu(e, itemElem, menuItemsCallback) {
  ensureScrollModule()
  scroll.lock()
  if (!contextMenu) createContextMenu()
  if (!contextMenu) return
  const menu = contextMenu
  menu.innerHTML = ''
  const menuData = menuItemsCallback(itemElem, e)
  if (!menuData || !menuData.items) return
  menu._currentMenuData = menuData
  renderContextMenu(menuData, menu)
  positionContextMenu(e, menu)
  menu._originalPosition = {
    left: parseInt(menu.style.left),
    top: parseInt(menu.style.top),
  }
  setupContextMenuHandlers()
  if (_contextOutsideHandler) {
    document.removeEventListener('pointerdown', _contextOutsideHandler, true)
    _contextOutsideHandler = null
  }
  /** @param {PointerEvent} ev */
  const outsideHandler = (ev) => {
    if (
      !menu.contains(ev.target instanceof HTMLElement ? ev.target : null) &&
      !closestHtmlElement(ev.target, '.submenu-container')
    ) {
      ev.preventDefault()
      ev.stopPropagation()
      hideContextMenu()
      document.removeEventListener('pointerdown', outsideHandler, true)
      _contextOutsideHandler = null
    }
  }
  _contextOutsideHandler = outsideHandler
  document.addEventListener('pointerdown', outsideHandler, true)
}
/**
 * @private
 * @param {ContextMenuData} menuData
 * @param {ContextMenuElement} container
 */
function renderContextMenu(menuData, container) {
  container.innerHTML = ''
  if (menuData.header) {
    const { icon, label } = menuData.header
    container.innerHTML = `
      <div class="border-b border-white/20 px-2 py-2 mb-1 flex items-center gap-2 align-middle">
        <span class="w-5 h-5">${icon || ''}</span>
        <span class="truncate">${label}</span>
      </div>
    `
  }
  const menuItems = menuData.items
  const menuItemsContainer = document.createElement('div')
  menuItemsContainer.className = 'menu-items flex flex-col gap-1'
  menuItems.forEach(({ label, icon, divider, submenu }, index) => {
    if (divider) {
      const dividerEl = document.createElement('div')
      dividerEl.className = 'border-t border-white/20 my-1'
      menuItemsContainer.appendChild(dividerEl)
      return
    }
    const item = document.createElement('div')
    item.className =
      'px-2 py-1 rounded-lg cursor-pointer flex items-center gap-2 menu-item justify-between'
    item.dataset.index = index.toString()
    item.dataset.hasSubmenu = submenu ? 'true' : 'false'
    const leftContent = document.createElement('div')
    leftContent.className = 'flex items-center gap-2'
    leftContent.innerHTML = `
      <span class="w-3.5 h-3.5 stroke-white stroke-2">${icon}</span>
      <span>${label}</span>
    `
    item.appendChild(leftContent)
    if (submenu) {
      const chevron = document.createElement('span')
      chevron.className = 'w-4 h-4 stroke-white stroke-2 ml-auto'
      chevron.dataset.chevron = 'true'
      chevron.innerHTML = `
        <span>${icons?.nav?.next}</span>
      `
      item.appendChild(chevron)
    }
    menuItemsContainer.appendChild(item)
    if (submenu) {
      const submenuWrapper = document.createElement('div')
      submenuWrapper.className =
        'submenu-wrapper hidden flex flex-col gap-1 pl-4 py-1'
      submenuWrapper.dataset.parentIndex = index.toString()
      submenu.forEach(({ label, icon, divider: subDivider }, subIndex) => {
        if (subDivider) {
          const dividerEl = document.createElement('div')
          dividerEl.className = 'border-t border-white/20 my-1'
          submenuWrapper.appendChild(dividerEl)
          return
        }
        const subItem = document.createElement('div')
        subItem.className =
          'px-2 py-1 rounded-lg cursor-pointer flex items-center gap-2 menu-item submenu-item whitespace-nowrap'
        subItem.dataset.parentIndex = index.toString()
        subItem.dataset.subIndex = subIndex.toString()
        subItem.innerHTML = `
          <span class="w-3.5 h-3.5 stroke-white stroke-2">${icon}</span>
          <span>${label}</span>
        `
        submenuWrapper.appendChild(subItem)
      })
      menuItemsContainer.appendChild(submenuWrapper)
    }
  })

  container.appendChild(menuItemsContainer)
}
/**
 * @private
 * @param {{clientX: number, clientY: number}} e
 * @param {ContextMenuElement} contextMenu
 */
function positionContextMenu(e, contextMenu) {
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight
  contextMenu.style.display = 'block'
  contextMenu.style.visibility = 'hidden'
  contextMenu.hidden = false
  const rect = contextMenu.getBoundingClientRect()
  const menuW = contextMenu.offsetWidth || rect.width
  const menuH = contextMenu.offsetHeight || rect.height
  let left = e.clientX
  let top = e.clientY
  if (left + menuW > viewportW) {
    left = Math.max(e.clientX - menuW)
  }
  if (top + menuH > viewportH) {
    top = Math.max(e.clientY - menuH)
  }
  contextMenu.style.visibility = 'visible'
  contextMenu.style.left = left + 'px'
  contextMenu.style.top = top + 'px'
}
/** @private */
function repositionContextMenuIfNeeded() {
  if (!contextMenu || contextMenu.hidden) return
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight
  const rect = contextMenu.getBoundingClientRect()
  const menuW = contextMenu.offsetWidth || rect.width
  const menuH = contextMenu.offsetHeight || rect.height
  let needsReposition = false
  let newLeft = parseInt(contextMenu.style.left)
  let newTop = parseInt(contextMenu.style.top)
  if (newLeft + menuW > viewportW) {
    newLeft = Math.max(0, viewportW - menuW - 10)
    needsReposition = true
  }
  if (newTop + menuH > viewportH) {
    newTop = Math.max(0, viewportH - menuH - 10)
    needsReposition = true
  }
  if (needsReposition) {
    contextMenu.style.left = newLeft + 'px'
    contextMenu.style.top = newTop + 'px'
  }
}
/** @private */
function setupContextMenuHandlers() {
  if (!contextMenu) return
  const menu = contextMenu
  const menuItemsContainer = /** @type {HTMLElement | null} */ (
    contextMenu.querySelector('.menu-items')
  )
  if (!menuItemsContainer) return
  menuItemsContainer.addEventListener('click', (ev) => {
    const menuItem = closestHtmlElement(
      ev.target,
      '.menu-item:not(.submenu-item)',
    )
    if (!menuItem) {
      const submenuItem = closestHtmlElement(ev.target, '.submenu-item')
      if (submenuItem) {
        ev.preventDefault()
        ev.stopPropagation()
        ev.stopImmediatePropagation()
        const parentIndex = parseInt(submenuItem.dataset.parentIndex || '')
        const subIndex = parseInt(submenuItem.dataset.subIndex || '')
        const menuData = menu._currentMenuData
        const allItems = menuData ? menuData.items : []
        const submenu = allItems[parentIndex].submenu
        if (!isNaN(subIndex) && submenu && submenu[subIndex]) {
          hideContextMenu()
          submenu[subIndex].handler?.()
        }
      }
      return
    }
    ev.preventDefault()
    ev.stopPropagation()
    ev.stopImmediatePropagation()
    const index = parseInt(menuItem.dataset.index || '')
    const hasSubmenu = menuItem.dataset.hasSubmenu === 'true'
    if (hasSubmenu) {
      toggleSubmenu(menuItem, index)
    } else {
      const menuData = menu._currentMenuData
      const allItems = menuData ? menuData.items : []
      if (!isNaN(index) && allItems[index]) {
        hideContextMenu()
        allItems[index].handler?.()
      }
    }
  })
  menuItemsContainer.addEventListener('mouseover', (ev) => {
    const menuItem = closestHtmlElement(ev.target, '.menu-item')
    if (menuItem) {
      menuItem.style.background = 'rgba(255,255,255,0.08)'
    }
  })
  menuItemsContainer.addEventListener('mouseout', (ev) => {
    const menuItem = closestHtmlElement(ev.target, '.menu-item')
    if (menuItem) {
      menuItem.style.background = 'none'
    }
  })
}
/**
 * @private
 * @param {Element} menuItem
 * @param {number} parentIndex
 */
function toggleSubmenu(menuItem, parentIndex) {
  if (!contextMenu) return
  const menu = contextMenu
  const submenuWrapper = /** @type {HTMLElement | null} */ (
    menu.querySelector(`.submenu-wrapper[data-parent-index="${parentIndex}"]`)
  )
  if (!submenuWrapper) return
  const isHidden = submenuWrapper.classList.contains('hidden')
  /** @type {NodeListOf<HTMLElement>} */
  const openSubmenus = menu.querySelectorAll('.submenu-wrapper:not(.hidden)')
  openSubmenus.forEach((wrapper) => {
    if (wrapper !== submenuWrapper) {
      wrapper.classList.add('hidden')
      const parentIdx = parseInt(wrapper.dataset.parentIndex || '')
      const chevron = /** @type {HTMLElement | null} */ (
        menu.querySelector(
          `.menu-item[data-index="${parentIdx}"] [data-chevron]`,
        )
      )
      if (chevron) {
        chevron.style.transform = 'rotate(0deg)'
      }
    }
  })
  if (isHidden) {
    submenuWrapper.classList.remove('hidden')
    const chevron = /** @type {HTMLElement | null} */ (
      menuItem.querySelector('[data-chevron]')
    )
    if (chevron) {
      chevron.style.transform = 'rotate(90deg)'
    }
    repositionContextMenuIfNeeded()
  } else {
    submenuWrapper.classList.add('hidden')
    const chevron = /** @type {HTMLElement | null} */ (
      menuItem.querySelector('[data-chevron]')
    )
    if (chevron) {
      chevron.style.transform = 'rotate(0deg)'
    }
    if (menu._originalPosition) {
      menu.style.left = menu._originalPosition.left + 'px'
      menu.style.top = menu._originalPosition.top + 'px'
    }
  }
}
/** @requires setContextIcons */
export function setupFileItemContextMenu() {
  if (!contextMenu) createContextMenu()
  setupContextMenu('.file-item[data-file-type]', (itemElem) => {
    const fileType = itemElem.dataset.fileType || ''
    const itemPath = itemElem.dataset.path || ''
    const encodedPath = itemPath.split('/').map(encodeURIComponent).join('/')
    const fileUrl = `${apiBasePath}/${encodedPath}`
    const dirUrl = `${frontendBasePath}/${itemPath}`
    const menuItems = []
    if (fileType === 'directory') {
      menuItems.push({
        label: 'Open in New Tab',
        icon: icons?.nav?.link || '',
        handler: () => {
          try {
            window.open(dirUrl, '_blank')
          } catch (error) {
            utils.handleError(error)
          }
        },
      })
    }
    if (fileType === 'image' || fileType === 'video' || fileType === 'audio') {
      menuItems.push({
        label: 'Open in New Tab',
        icon: icons?.nav?.link || '',
        handler: () => {
          if (!fileUrl) return
          try {
            window.open(fileUrl, '_blank')
          } catch (error) {
            utils.handleError(error)
          }
        },
      })
      menuItems.push({
        label: 'Download',
        icon: icons?.nav?.download || '',
        handler: () => {
          const uuid = itemElem.dataset.uuid
          if (!uuid) return
          try {
            const a = document.createElement('a')
            const basePath = /** @type {Window & {BASE_PATH?: string}} */ (
              window
            ).BASE_PATH
            a.href = `${basePath || ''}/api/download/?uuid=${uuid}`
            a.download = ''
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
          } catch (error) {
            utils.handleError(error)
          }
        },
      })
      menuItems.push({
        label: 'Add to Pool',
        icon: icons?.nav?.next || '',
        handler: async () => {
          const uuid = String(itemElem.dataset.uuid || '').trim()
          if (!uuid || uuid === 'null' || uuid === 'undefined') {
            const error = new Error(
              'This file is missing a UUID and cannot be added to a pool',
            )
            utils.statusMessage(error.message, true)
            utils.handleError(error)
            return
          }
          try {
            await utils.openAddToPoolModal(uuid)
          } catch (error) {
            utils.handleError(error)
          }
        },
      })
      menuItems.push({
        divider: true,
      })
      menuItems.push({
        label: 'Copy',
        icon: icons?.nav?.copy || '',
        submenu: [
          {
            label: 'URL',
            icon: icons?.nav?.copy || '',
            handler: () => {
              if (!fileUrl) return
              try {
                navigator.clipboard.writeText(fileUrl)
              } catch (error) {
                utils.handleError(error)
              }
            },
          },
          ...(fileType === 'image'
            ? [
                {
                  label: 'Image',
                  icon: icons?.nav?.copy || '',
                  handler: async () => {
                    if (!fileUrl) return
                    try {
                      await utils.copyImage(fileUrl)
                    } catch (error) {
                      utils.handleError(error)
                    }
                  },
                },
              ]
            : []),
          {
            label: 'Hash',
            icon: icons?.nav?.copy || '',
            handler: () => {
              const hash = itemElem.dataset.hash
              if (!hash) return
              try {
                navigator.clipboard.writeText(hash)
              } catch (error) {
                utils.handleError(error)
              }
            },
          },
          {
            label: 'UUID',
            icon: icons?.nav?.copy || '',
            handler: () => {
              const uuid = itemElem.dataset.uuid
              if (!uuid) return
              try {
                navigator.clipboard.writeText(uuid)
              } catch (error) {
                utils.handleError(error)
              }
            },
          },
        ],
      })
    }
    return {
      header: {
        icon: typeof icons?.[fileType] === 'string' ? icons[fileType] : '',
        label: itemPath.split('/').pop(),
      },
      items: menuItems,
    }
  })
}
