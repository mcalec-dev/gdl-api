'use strict'
import * as utils from '../min/index.min.js'
import scroll from 'https://cdn.mcalec.dev/scroll.js/scroll.min.js'
let contextMenu = null
let _contextOutsideHandler = null
let icons = null
let frontendBasePath = ''
let apiBasePath = ''
/**
 * Sets the icon object used throughout the context menu
 * @param {Object} i - Icon object containing SVG icons for various menu items
 */
export function setContextIcons(i) {
  icons = i
}
/**
 * Sets the base paths for frontend and API URLs used in context menu handlers
 * @param {string} frontend - Base path for frontend URLs
 * @param {string} api - Base path for API URLs
 */
export function setContextBasePaths(frontend, api) {
  frontendBasePath = frontend
  apiBasePath = api
}
/**
 * Creates the context menu container element if it doesn't already exist
 * Appends it to the document body and hides it by default
 */
export function createContextMenu() {
  if (contextMenu) return
  contextMenu = document.getElementById('context-menu-container')
  if (!contextMenu) {
    contextMenu = document.createElement('div')
    contextMenu.id = 'context-menu-container'
    document.body.appendChild(contextMenu)
  }
  contextMenu.hidden = true
}
/**
 * Hides the context menu, restores scrolling, and cleans up event handlers
 * Also removes any open submenu containers and resets the outside click handler
 */
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
 * Sets up context menu event listeners for elements matching the selector
 * @param {string} selector - CSS selector for elements that should show context menu
 * @param {Function} menuItemsCallback - Callback function that returns menu structure
 *                                       Called with (itemElem, event) parameters
 *                                       Should return {header: {icon, label}, items: Array}
 */
export function setupContextMenu(selector, menuItemsCallback) {
  if (!contextMenu) createContextMenu()
  document.addEventListener('contextmenu', (e) => {
    const itemElem = e.target.closest(selector)
    if (itemElem) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      showGenericContextMenu(e, itemElem, menuItemsCallback)
    } else {
      hideContextMenu()
    }
  })
}
/**
 * Displays the context menu at the mouse position
 * Renders menu structure, positions it, sets up handlers, and registers outside-click detection
 * @private
 * @param {MouseEvent} e - The context menu event
 * @param {Element} itemElem - The element that triggered the context menu
 * @param {Function} menuItemsCallback - Callback to generate menu structure
 */
function showGenericContextMenu(e, itemElem, menuItemsCallback) {
  scroll.lock()
  if (!contextMenu) createContextMenu()
  contextMenu.innerHTML = ''
  const menuData = menuItemsCallback(itemElem, e)
  if (!menuData || !menuData.items) return
  contextMenu._currentMenuData = menuData
  renderContextMenu(menuData, contextMenu)
  positionContextMenu(e, contextMenu)
  contextMenu._originalPosition = {
    left: parseInt(contextMenu.style.left),
    top: parseInt(contextMenu.style.top),
  }
  setupContextMenuHandlers()
  if (_contextOutsideHandler) {
    document.removeEventListener('pointerdown', _contextOutsideHandler, true)
    _contextOutsideHandler = null
  }
  _contextOutsideHandler = function outsideHandler(ev) {
    if (
      !contextMenu.contains(ev.target) &&
      !ev.target.closest('.submenu-container')
    ) {
      ev.preventDefault()
      ev.stopPropagation()
      hideContextMenu()
      document.removeEventListener('pointerdown', _contextOutsideHandler, true)
      _contextOutsideHandler = null
    }
  }
  document.addEventListener('pointerdown', _contextOutsideHandler, true)
}
/**
 * Renders the context menu structure into the container
 * Handles menu items, dividers, and nested submenus with proper styling
 * @private
 * @param {Object} menuData - Menu structure containing header and items
 * @param {Element} container - DOM element to render menu into
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
 * Positions the context menu based on mouse coordinates
 * Adjusts position to keep menu within viewport bounds
 * @private
 * @param {MouseEvent} e - The context menu event with clientX/clientY coordinates
 * @param {Element} contextMenu - The menu container element to position
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
/**
 * Repositions the context menu if expanded submenus would push it off-screen
 * Ensures the menu stays within viewport bounds when submenus are shown
 * @private
 */
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
/**
 * Attaches click, hover, and interaction handlers to the context menu
 * Handles both regular menu items and submenu toggle functionality
 * @private
 */
function setupContextMenuHandlers() {
  const menuItemsContainer = contextMenu.querySelector('.menu-items')
  if (!menuItemsContainer) return
  menuItemsContainer.addEventListener('click', (ev) => {
    const menuItem = ev.target.closest('.menu-item:not(.submenu-item)')
    if (!menuItem) {
      const submenuItem = ev.target.closest('.submenu-item')
      if (submenuItem) {
        ev.preventDefault()
        ev.stopPropagation()
        ev.stopImmediatePropagation()
        const parentIndex = parseInt(submenuItem.dataset.parentIndex)
        const subIndex = parseInt(submenuItem.dataset.subIndex)
        const allItems = contextMenu._currentMenuData.items
        const submenu = allItems[parentIndex].submenu
        if (!isNaN(subIndex) && submenu && submenu[subIndex]) {
          hideContextMenu()
          submenu[subIndex].handler()
        }
      }
      return
    }
    ev.preventDefault()
    ev.stopPropagation()
    ev.stopImmediatePropagation()
    const index = parseInt(menuItem.dataset.index)
    const hasSubmenu = menuItem.dataset.hasSubmenu === 'true'
    if (hasSubmenu) {
      toggleSubmenu(menuItem, index)
    } else {
      const allItems = contextMenu._currentMenuData.items
      if (!isNaN(index) && allItems[index]) {
        hideContextMenu()
        allItems[index].handler()
      }
    }
  })
  menuItemsContainer.addEventListener('mouseover', (ev) => {
    const menuItem = ev.target.closest('.menu-item')
    if (menuItem) {
      menuItem.style.background = 'rgba(255,255,255,0.08)'
    }
  })
  menuItemsContainer.addEventListener('mouseout', (ev) => {
    const menuItem = ev.target.closest('.menu-item')
    if (menuItem) {
      menuItem.style.background = 'none'
    }
  })
}
/**
 * Toggles the visibility of a submenu and handles menu repositioning
 * Closes any other open submenus and updates chevron rotation state
 * Restores original menu position when the last submenu is closed
 * @private
 * @param {Element} menuItem - The menu item with the submenu
 * @param {number} parentIndex - Index of the parent menu item
 */
function toggleSubmenu(menuItem, parentIndex) {
  const submenuWrapper = contextMenu.querySelector(
    `.submenu-wrapper[data-parent-index="${parentIndex}"]`
  )
  if (!submenuWrapper) return
  const isHidden = submenuWrapper.classList.contains('hidden')
  contextMenu
    .querySelectorAll('.submenu-wrapper:not(.hidden)')
    .forEach((wrapper) => {
      if (wrapper !== submenuWrapper) {
        wrapper.classList.add('hidden')
        const parentIdx = parseInt(wrapper.dataset.parentIndex)
        const chevron = contextMenu.querySelector(
          `.menu-item[data-index="${parentIdx}"] [data-chevron]`
        )
        if (chevron) {
          chevron.style.transform = 'rotate(0deg)'
        }
      }
    })
  if (isHidden) {
    submenuWrapper.classList.remove('hidden')
    const chevron = menuItem.querySelector('[data-chevron]')
    if (chevron) {
      chevron.style.transform = 'rotate(90deg)'
    }
    repositionContextMenuIfNeeded()
  } else {
    submenuWrapper.classList.add('hidden')
    const chevron = menuItem.querySelector('[data-chevron]')
    if (chevron) {
      chevron.style.transform = 'rotate(0deg)'
    }
    if (contextMenu._originalPosition) {
      contextMenu.style.left = contextMenu._originalPosition.left + 'px'
      contextMenu.style.top = contextMenu._originalPosition.top + 'px'
    }
  }
}
/**
 * Sets up context menu for file/directory items with file-specific actions
 * Provides options like Copy URL, Open in New Tab, Download, Copy Image, and Copy submenu
 * Submenu includes options to copy Hash and UUID
 * Requires file items to have data attributes: file-type, path, uuid, hash
 * @requires setContextIcons, setContextBasePaths to be called first
 */
export function setupFileItemContextMenu() {
  if (!contextMenu) createContextMenu()
  setupContextMenu('.file-item[data-file-type]', (itemElem) => {
    const fileType = itemElem.dataset.fileType
    const itemPath = itemElem.dataset.path
    const encodedPath = itemPath.split('/').map(encodeURIComponent).join('/')
    const fileUrl = `${apiBasePath}/${encodedPath}`
    const dirUrl = `${frontendBasePath}/${itemPath}`
    const menuItems = []
    menuItems.push({
      label: 'Copy URL',
      icon: icons?.nav?.copy || '',
      handler: () => {
        try {
          navigator.clipboard.writeText(fileUrl)
        } catch (error) {
          utils.handleError(error)
        }
      },
    })
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
      if (fileType === 'image') {
        menuItems.push({
          label: 'Copy Image',
          icon: icons?.nav?.copy || '',
          handler: async () => {
            if (!fileUrl) return
            try {
              await utils.copyImage(fileUrl)
            } catch (error) {
              utils.handleError(error)
            }
          },
        })
      }
      menuItems.push({
        label: 'Download',
        icon: icons?.nav?.download || '',
        handler: () => {
          const uuid = itemElem.dataset.uuid
          if (!uuid) return
          try {
            const a = document.createElement('a')
            a.href = `/api/download/?uuid=${uuid}`
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
        divider: true,
      })
      menuItems.push({
        label: 'Copy',
        icon: icons?.nav?.copy || '',
        submenu: [
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
        icon: icons?.[fileType] || '',
        label: itemPath.split('/').pop(),
      },
      items: menuItems,
    }
  })
}
