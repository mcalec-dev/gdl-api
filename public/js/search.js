document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.getElementById('searchButton');
  const loading = document.getElementById('loading');
  const results = document.getElementById('results');
  const noResults = document.getElementById('noResults');
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  async function performSearch(query) {
    if (query.length < 3) {
      results.style.display = 'none';
      noResults.style.display = 'block';
      noResults.textContent = 'Please enter at least 3 characters';
      return;
    }
    loading.style.display = 'block';
    results.style.display = 'none';
    noResults.style.display = 'none';
    results.innerHTML = '';
    try {
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('q', query);
      window.history.pushState({}, '', newUrl);
      const response = await fetch(`/gdl/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      loading.style.display = 'none';
      if (data.results && data.results.length > 0) {
        results.style.display = 'grid';
        const fragment = document.createDocumentFragment();
        data.results.forEach(result => {
          const card = document.createElement('div');
          card.className = 'result-card';
          const filePath = `/gdl/api/files/${result.path}`;
          const displayPath = result.path.split('/').slice(0, -1).join('/');
          card.innerHTML = `
            <h3>${result.name}</h3>
            <p>Type: ${result.type}</p>
            <p>Path: ${displayPath}</p>
            <a href="${filePath}" target="_blank">View File</a>
            <div class="score">Relevance: ${(result.score * 100).toFixed(1)}%</div>
          `;
          fragment.appendChild(card);
        });
        results.appendChild(fragment);
      } else {
        noResults.style.display = 'block';
        noResults.textContent = 'No results found';
      }
    } catch (error) {
      console.error('Search error:', error);
      loading.textContent = 'Search failed. Please try again.';
    }
  }
  const debouncedSearch = debounce((query) => performSearch(query), 300);
  searchButton.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) {
      performSearch(query);
    }
  });
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        performSearch(query);
      }
    }
  });
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q');
  if (initialQuery) {
    searchInput.value = initialQuery;
    performSearch(initialQuery);
  }
});