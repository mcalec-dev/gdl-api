import * as utils from './index.js'

/**
 * Initializes the shared navbar without allowing a missing page heading or
 * unavailable site-name response to stop menu and authentication behavior.
 *
 * @returns {Promise<void>} Resolves after title and session state load.
 */
async function init() {
  const navbarTitle = document.getElementById('navbar-title')
  const heading = document.getElementById('title')
  let name
  try {
    name = await utils.getName()
  } catch (error) {
    utils.handleError(error)
    console.error('Failed to fetch name:', error)
    name = 'gdl-api'
  }
  const siteName = utils.toDisplayText(name, 'gdl-api')
  const headingText = utils.toDisplayText(heading?.textContent)
  const pageTitle = headingText ? `${siteName} - ${headingText}` : siteName
  document.title = pageTitle
  if (navbarTitle) navbarTitle.textContent = pageTitle
  const mobileMenuButton = document.getElementById('mobile-menu-button')
  const mobileMenu = document.getElementById('mobile-navbar-menu')
  if (
    mobileMenuButton instanceof HTMLButtonElement &&
    mobileMenu instanceof HTMLElement
  ) {
    mobileMenuButton.addEventListener('click', function (e) {
      e.stopPropagation()
      mobileMenu.hidden = !mobileMenu.hidden
      mobileMenuButton.setAttribute('aria-expanded', String(!mobileMenu.hidden))
    })
    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', function () {
        mobileMenu.hidden = true
        mobileMenuButton.setAttribute('aria-expanded', 'false')
      })
    })
    document.addEventListener('click', function (event) {
      const target = event.target
      const isClickInsideNav =
        target instanceof Node &&
        (mobileMenu.contains(target) || mobileMenuButton.contains(target))
      if (!isClickInsideNav && !mobileMenu.hidden) {
        mobileMenu.hidden = true
        mobileMenuButton.setAttribute('aria-expanded', 'false')
      }
    })
  }
  const loginRegisterButtons = document.querySelectorAll(
    '#login-register, #mobile-login-register'
  )
  let isLoggedIn = false
  try {
    isLoggedIn = await utils.isAuthenticated()
  } catch (error) {
    utils.handleError(error, 'Failed to fetch auth status')
  }
  if (loginRegisterButtons && loginRegisterButtons.length > 0) {
    loginRegisterButtons.forEach((btn) => {
      if (btn instanceof HTMLAnchorElement) {
        if (isLoggedIn) {
          btn.textContent = 'Dashboard'
          btn.href = utils.getAppUrl('/dashboard/')
        } else {
          btn.textContent = 'Login / Register'
          btn.href = utils.getAppUrl('/login/')
        }
      }
    })
  }
}

document.addEventListener('DOMContentLoaded', init)
