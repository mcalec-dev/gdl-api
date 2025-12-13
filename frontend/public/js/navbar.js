'use strict'
import * as utils from "/js/index.js";
document.addEventListener('DOMContentLoaded', async () => {
  const navbarTitle = document.getElementById('navbar-title')
  const heading = document.getElementById('title')
  let name
  try {
    name = await utils.getName()
  } catch (error) {
    utils.handleError(error)
    console.error('Failed to fetch name:', error)
    name = 'title'
  }
  if (!name) {
    document.title = 'title - undefined'
    navbarTitle.textContent = 'title - undefined'
    return console.warn('Site name is undefined or empty')
  }
  if (!heading) {
    document.title = name
    navbarTitle.textContent = name
    return console.warn('Heading element is undefined or empty')
  }
  if (name) {
    document.title = `${name} - ${heading.textContent}`
    navbarTitle.textContent = `${name} - ${heading.textContent}`
  }
  const mobileMenuButton = document.getElementById('mobile-menu-button')
  const mobileMenu = document.getElementById('mobile-navbar-menu')
  mobileMenuButton.addEventListener('click', function (e) {
    e.stopPropagation()
    mobileMenu.hidden = !mobileMenu.hidden;
  })
  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', function () {
      mobileMenu.hidden = true;
    })
  })
  document.addEventListener('click', function (event) {
    const isClickInsideNav =
      mobileMenu.contains(event.target) ||
      mobileMenuButton.contains(event.target)
    if (!isClickInsideNav && !mobileMenu.hidden) {
      mobileMenu.hidden = true;
    }
  })
  const loginRegisterButtons = document.querySelectorAll('#login-register')
  let checkAuthStatus = null
  try {
    const req = await fetch('/api/auth/check')
    checkAuthStatus = await req.json()
  } catch (error) {
    utils.handleError(error)
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
