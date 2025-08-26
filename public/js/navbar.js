import { getName } from '/js/min/index.min.js'
document.addEventListener('DOMContentLoaded', async function () {
  const navbarTitle = document.getElementById('navbar-title')
  const heading = document.getElementById('title')
  let name
  try {
    name = await getName()
  } catch (error) {
    console.error('Failed to fetch name:', error)
    name = 'title'
  }
  if (!name) {
    navbarTitle.textContent = 'title - undefined'
    return console.warn('Site name is undefined or empty')
  }
  if (!heading) {
    navbarTitle.textContent = `${name} - undefined`
    return console.warn('Heading element is undefined or empty')
  }
  if (name) {
    navbarTitle.textContent = `${name} - ${heading.textContent}`
    document.title = `${name} - ${heading.textContent}`
  }
  const mobileMenuButton = document.getElementById('mobile-menu-button')
  const mobileMenu = document.getElementById('mobile-navbar-menu')
  mobileMenuButton.addEventListener('click', function (e) {
    e.stopPropagation()
    mobileMenu.classList.toggle('hidden')
  })
  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', function () {
      mobileMenu.classList.add('hidden')
    })
  })
  document.addEventListener('click', function (event) {
    const isClickInsideNav =
      mobileMenu.contains(event.target) ||
      mobileMenuButton.contains(event.target)
    if (!isClickInsideNav && !mobileMenu.classList.contains('hidden')) {
      mobileMenu.classList.add('hidden')
    }
  })
  const loginRegisterButtons = document.querySelectorAll('#login-register')
  let checkAuthStatus = null
  try {
    const res = await fetch('/api/auth/check')
    checkAuthStatus = await res.json()
  } catch (error) {
    console.error('Failed to fetch auth status:', error)
    checkAuthStatus = null
  }
  const isLoggedIn = checkAuthStatus && checkAuthStatus.authenticated === true
  if (loginRegisterButtons && loginRegisterButtons.length > 0) {
    loginRegisterButtons.forEach((btn) => {
      if (btn) {
        if (isLoggedIn) {
          btn.textContent = 'Dashboard'
          btn.href = '/dashboard'
        } else {
          btn.textContent = 'Login / Register'
          btn.href = '/login'
        }
      }
    })
  }
})
