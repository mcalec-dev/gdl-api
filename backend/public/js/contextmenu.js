'use strict'
import * as utils from '../min/index.min.js'
let contextMenu = null
let _contextOutsideHandler = null
let _prevBodyOverflow = null
let icons = null
let frontendBasePath = ''
let apiBasePath = ''
export function setContextIcons(i) {
  icons = i
}
export function setContextBasePaths(frontend, api) {
  frontendBasePath = frontend
  apiBasePath = api
}
export function lockScroll() {
  try {
    _prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } catch {
    try {
      document.body.style.removeProperty('overflow')
    } catch {
      utils.handleError('Unable to lock scroll')
    }
  }
}
export function unlockScroll() {
  try {
    if (_prevBodyOverflow === null || _prevBodyOverflow === undefined) {
      document.body.style.removeProperty('overflow')
    } else {
      document.body.style.overflow = _prevBodyOverflow
    }
    _prevBodyOverflow = null
  } catch {
    try {
      document.body.style.removeProperty('overflow')
    } catch {
      utils.handleError('Unable to unlock scroll')
    }
  }
}
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
export function showContextMenu(e, itemElem) {
  lockScroll()
  if (!contextMenu) createContextMenu()
  contextMenu.innerHTML = ''
  const fileType = itemElem.dataset.fileType
  const itemPath = itemElem.dataset.path
  const encodedPath = itemPath.split('/').map(encodeURIComponent).join('/')
  const fileUrl = `${apiBasePath}/${encodedPath}`
  const dirUrl = `${frontendBasePath}/${itemPath}`
  contextMenu.innerHTML = `
    <div class="border-b border-white/20 px-2 py-2 mb-2 flex items-center gap-1 align-middle">
      <span class="w-4 h-4 mr-1">${icons?.[fileType] || ''}</span>
      <span class="truncate">${itemPath.split('/').pop()}</span>
    </div>
  `
  const menuItems = []
  menuItems.push({
    label: 'Copy URL',
    icon: icons?.nav?.copy || '',
    handler: () => {
      navigator.clipboard.writeText(fileUrl)
    },
  })
  if (fileType === 'directory') {
    menuItems.push({
      label: 'Open in New Tab',
      icon: icons?.nav?.link || '',
      handler: () => {
        window.open(dirUrl, '_blank')
      },
    })
  }
  if (fileType === 'image' || fileType === 'video' || fileType === 'audio') {
    menuItems.push({
      label: 'Open in New Tab',
      icon: icons?.nav?.link || '',
      handler: () => {
        window.open(fileUrl, '_blank')
      },
    })
    if (fileType === 'image') {
      menuItems.push({
        label: 'Copy Image',
        icon: icons?.nav?.copy || '',
        handler: async () => {
          try {
            const req = await fetch(fileUrl)
            const blob = await req.blob()
            const type = blob.type || 'image/png'
            await navigator.clipboard.write([
              new window.ClipboardItem({ [type]: blob }),
            ])
          } catch {
            utils.handleError('Failed to copy image.')
          }
        },
      })
    }
    menuItems.push({
      label: 'Download',
      icon: icons?.nav?.download || '',
      handler: () => {
        const a = document.createElement('a')
        a.href = `/api/download/?url="${encodeURIComponent(fileUrl)}"`
        a.download = ''
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      },
    })
  }
  const menuContainer = document.createElement('div')
  menuContainer.className = 'menu-items flex flex-col gap-1'
  menuItems.forEach(({ label, icon }, index) => {
    const item = document.createElement('div')
    item.className =
      'px-2 py-1 rounded-lg cursor-pointer flex items-center gap-2 menu-item'
    item.dataset.index = index.toString()
    item.innerHTML = `
      <span class="w-3.5 h-3.5 stroke-white stroke-2">${icon}</span>
      <span>${label}</span>
    `
    menuContainer.appendChild(item)
  })
  contextMenu.appendChild(menuContainer)
  menuContainer.addEventListener('click', (ev) => {
    const menuItem = ev.target.closest('.menu-item')
    if (!menuItem) return
    ev.preventDefault()
    ev.stopPropagation()
    ev.stopImmediatePropagation()
    const index = parseInt(menuItem.dataset.index)
    if (!isNaN(index) && menuItems[index]) {
      hideContextMenu()
      menuItems[index].handler()
    }
  })
  menuContainer.addEventListener('mouseover', (ev) => {
    const menuItem = ev.target.closest('.menu-item')
    if (menuItem) {
      menuItem.style.background = 'rgba(255,255,255,0.08)'
    }
  })
  menuContainer.addEventListener('mouseout', (ev) => {
    const menuItem = ev.target.closest('.menu-item')
    if (menuItem) {
      menuItem.style.background = 'none'
    }
  })
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
  if (_contextOutsideHandler) {
    document.removeEventListener('pointerdown', _contextOutsideHandler, true)
    _contextOutsideHandler = null
  }
  _contextOutsideHandler = function outsideHandler(ev) {
    if (!contextMenu.contains(ev.target)) {
      ev.preventDefault()
      ev.stopPropagation()
      hideContextMenu()
      document.removeEventListener('pointerdown', _contextOutsideHandler, true)
      _contextOutsideHandler = null
    }
  }
  document.addEventListener('pointerdown', _contextOutsideHandler, true)
}
export function hideContextMenu() {
  unlockScroll()
  if (!contextMenu) return
  contextMenu.style.display = 'none'
  contextMenu.hidden = true
  if (_contextOutsideHandler) {
    document.removeEventListener('pointerdown', _contextOutsideHandler, true)
    _contextOutsideHandler = null
  }
}
export function setupFileItemContextMenu() {
  if (!contextMenu) createContextMenu()
  document.addEventListener('contextmenu', (e) => {
    e.stopPropagation()
    e.stopImmediatePropagation()
    const itemElem = e.target.closest('.file-item[data-file-type]')
    if (itemElem && itemElem.dataset.fileType) {
      e.preventDefault()
      showContextMenu(e, itemElem)
    } else {
      hideContextMenu()
    }
  })
}
