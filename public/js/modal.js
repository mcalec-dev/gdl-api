import { lockScroll, unlockScroll } from './helpers/scroll.js'

/**
 * Creates a basic modal from plain text. Dynamic content is assigned with
 * `textContent` so API values cannot become executable markup.
 *
 * @param {string} id Modal element identifier.
 * @param {string} title Visible modal title.
 * @param {string} content Visible modal body.
 * @returns {void}
 */
export function createModal(id, title, content) {
  if (document.getElementById(id)) {
    console.warn(`Modal with ID "${id}" already exists. Skipping creation.`)
    return
  }
  const modal = document.createElement('div')
  modal.id = id
  modal.classList.add('modal')
  const modalContent = document.createElement('div')
  modalContent.className = 'modal-content'
  const closeButton = document.createElement('button')
  closeButton.className = 'close'
  closeButton.type = 'button'
  closeButton.setAttribute('aria-label', 'Close dialog')
  closeButton.textContent = '×'
  closeButton.addEventListener('click', () => closeModal(id))
  const heading = document.createElement('h2')
  heading.textContent = title
  const body = document.createElement('p')
  body.textContent = content
  modalContent.append(closeButton, heading, body)
  modal.appendChild(modalContent)
  document.body.appendChild(modal)
}

/**
 * Closes an existing modal and restores background scrolling.
 *
 * @param {string} id Modal element identifier.
 * @returns {void}
 */
export function closeModal(id) {
  const modal = document.getElementById(id)
  if (modal) {
    modal.style.display = 'none'
    unlockScroll()
  } else {
    console.error(`Modal with ID "${id}" not found.`)
  }
}

/**
 * Opens an existing modal and prevents background scrolling.
 *
 * @param {string} id Modal element identifier.
 * @returns {void}
 */
export function openModal(id) {
  const modal = document.getElementById(id)
  if (modal) {
    modal.style.display = 'block'
    lockScroll()
  } else {
    console.error(`Modal with ID "${id}" not found.`)
  }
}
export default {}
