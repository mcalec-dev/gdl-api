'use strict'
function setConsentCookie(value) {
  document.cookie = `site_consent=${value}; path=/; max-age=31536000; samesite=strict`
}
function getConsentCookie() {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith('site_consent='))
    ?.split('=')[1]
}
function showConsentModal() {
  document.getElementById('consent-modal').classList.remove('hidden')
}
function hideConsentModal() {
  document.getElementById('consent-modal').classList.add('hidden')
}
document.addEventListener('DOMContentLoaded', () => {
  const consent = getConsentCookie()
  const overlay = document.getElementById('consent-overlay')
  const infoBtn = document.getElementById('consent-info-btn')
  const modal = document.getElementById('consent-modal')
  const closeBtn = document.getElementById('close-consent-modal')
  const acceptBtn = document.getElementById('consent-accept')
  const declineBtn = document.getElementById('consent-decline')
  const consentContainer = document.getElementById('consent-container')
  function blockPageInteraction() {
    overlay.style.pointerEvents = 'auto'
    modal.style.pointerEvents = 'auto'
    document.body.style.pointerEvents = ''
  }
  function allowPageInteraction() {
    overlay.style.pointerEvents = 'none'
    modal.style.pointerEvents = 'none'
    document.body.style.pointerEvents = ''
  }
  if (!consent) {
    overlay.style.display = 'flex'
    showConsentModal()
    blockPageInteraction()
  } else {
    overlay.style.display = 'flex'
    modal.classList.add('hidden')
    allowPageInteraction()
  }
  infoBtn.addEventListener('click', () => {
    showConsentModal()
    blockPageInteraction()
  })
  closeBtn.addEventListener('click', () => {
    hideConsentModal()
    allowPageInteraction()
  })
  acceptBtn.addEventListener('click', () => {
    setConsentCookie('accepted')
    hideConsentModal()
    allowPageInteraction()
  })
  declineBtn.addEventListener('click', () => {
    setConsentCookie('declined')
    hideConsentModal()
    allowPageInteraction()
    alert('You declined consent. Some features may be unavailable.')
  })
  if (consentContainer && modal) {
    consentContainer.addEventListener('click', function (e) {
      if (e.target === consentContainer) {
        hideConsentModal()
        allowPageInteraction()
      }
    })
  }
})
