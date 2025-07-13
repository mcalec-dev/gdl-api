document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput')
  const searchButton = document.getElementById('searchButton')
  const loading = document.getElementById('loading')
  const results = document.getElementById('results')
  const noResults = document.getElementById('noResults')
  const searchInfo = document.getElementById('searchInfo')
  const API_URL = '/gdl/api/search'
  async function performSearch(query) {
    if (query.length < 3) {
      results.style.display = 'none'
      searchInfo.style.display = 'none'
      noResults.style.display = 'block'
      noResults.textContent = 'Please enter at least 3 characters'
      return
    }
    loading.style.display = 'block'
    results.style.display = 'none'
    searchInfo.style.display = 'none'
    noResults.style.display = 'none'
    results.innerHTML = ''
    try {
      const newUrl = new URL(window.location)
      newUrl.searchParams.set('q', query)
      window.history.pushState({}, '', newUrl)
      const response = await fetch(`${API_URL}?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      loading.style.display = 'none'
      if (data.results?.length > 0) {
        searchInfo.style.display = 'block'
        searchInfo.textContent = `Found ${data.count} results for "${data.query}"`
        results.style.display = 'grid'
        const fragment = document.createDocumentFragment()
        data.results.forEach((result) => {
          const card = document.createElement('div')
          card.className = 'result-card'
          card.innerHTML = `
            <div class="image-container">
              <img src="${result.url}?x=50" 
                alt="${result.name}" 
                class="thumbnail loading" 
                loading="lazy"
              >
            </div>
            <div class="info-container">
              <h3>${result.name}</h3>
              <p class="type">Type: ${result.type}</p>
              <p class="collection">Collection: ${result.collection}</p>
              <a href="${result.url}" class="view-link" target="_blank">View ${result.type}</a>
            </div>
          `
          fragment.appendChild(card)
        })
        results.appendChild(fragment)
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const img = entry.target
                if (img.classList.contains('loading')) {
                  img.addEventListener('load', () => {
                    img.classList.remove('loading')
                  })
                  observer.unobserve(img)
                }
              }
            })
          },
          {
            rootMargin: '50px 0px',
            threshold: 0.1,
          }
        )
        document.querySelectorAll('.thumbnail.loading').forEach((img) => {
          observer.observe(img)
        })
      } else {
        searchInfo.style.display = 'none'
        noResults.style.display = 'block'
        noResults.textContent = 'No results found'
      }
    } catch {
      loading.style.display = 'none'
      searchInfo.style.display = 'none'
      noResults.style.display = 'block'
      noResults.textContent = 'Search failed. Please try again.'
    }
  }
  searchButton.addEventListener('click', () => {
    const query = searchInput.value.trim()
    if (query) performSearch(query)
  })
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim()
      if (query) performSearch(query)
    }
  })
  const urlParams = new URLSearchParams(window.location.search)
  const initialQuery = urlParams.get('q')
  if (initialQuery) {
    searchInput.value = initialQuery
    performSearch(initialQuery)
  }
})
