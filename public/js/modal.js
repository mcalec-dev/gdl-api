import scroll from 'https://utils.mcalec.dev/scroll.js/scroll.min.js'
export function createModal(id, title, content) {
  if (document.getElementById(id)) {
    console.warn(`Modal with ID "${id}" already exists. Skipping creation.`)
    return
  }
  const modal = document.createElement('div')
  modal.id = id
  modal.classList.add('modal')
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close" onclick="closeModal('${id}')">&times;</span>
      <h2>${title}</h2>
      <p>${content}</p>
    </div>
  `
  document.body.appendChild(modal)
}
export function closeModal(id) {
  const modal = document.getElementById(id)
  if (modal) {
    modal.style.display = 'none'
    scroll.unlock()
  } else {
    console.error(`Modal with ID "${id}" not found.`)
  }
}
export function openModal(id) {
  const modal = document.getElementById(id)
  if (modal) {
    modal.style.display = 'block'
    scroll.lock()
  } else {
    console.error(`Modal with ID "${id}" not found.`)
  }
}
export default {}
