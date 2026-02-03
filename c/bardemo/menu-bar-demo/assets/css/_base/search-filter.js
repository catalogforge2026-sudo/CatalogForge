/* ============================================
   Search & Filter Functionality
   Works with any theme - uses data attributes
   ============================================ */

(function() {
  'use strict';

  // State
  let currentSearch = '';
  let currentFilter = 'all';
  let sections = [];
  let items = [];

  // DOM Elements
  let searchInput = null;
  let searchClear = null;
  let filterSelect = null;
  let resultsInfo = null;
  let noResultsEl = null;

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    // Get elements - support both header and body search/filter
    searchInput = document.querySelector('.header-search .search-input') || document.querySelector('.search-input');
    searchClear = document.querySelector('.header-search .search-clear') || document.querySelector('.search-clear');
    filterSelect = document.querySelector('#header-category-filter') || document.querySelector('.filter-select');
    resultsInfo = document.querySelector('.search-results-info');
    
    // Get all sections and items
    sections = Array.from(document.querySelectorAll('.catalog-section'));
    items = Array.from(document.querySelectorAll('.item-card'));

    // Create no results element
    createNoResultsElement();

    // Bind events - also bind to all search inputs (header and body)
    const allSearchInputs = document.querySelectorAll('.search-input');
    allSearchInputs.forEach(input => {
      input.addEventListener('input', handleSearch);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          clearSearch();
        }
      });
    });

    // Bind all clear buttons
    const allClearBtns = document.querySelectorAll('.search-clear');
    allClearBtns.forEach(btn => {
      btn.addEventListener('click', clearSearch);
    });

    // Filter select dropdown - bind all filter selects
    const allFilterSelects = document.querySelectorAll('.filter-select, #header-category-filter');
    allFilterSelects.forEach(select => {
      select.addEventListener('change', handleFilterChange);
    });
  }

  function createNoResultsElement() {
    noResultsEl = document.createElement('div');
    noResultsEl.className = 'no-results';
    noResultsEl.style.display = 'none';
    noResultsEl.innerHTML = `
      <div class="no-results-icon">🔍</div>
      <h3 class="no-results-title">No se encontraron resultados</h3>
      <p class="no-results-text">Intenta con otros términos de búsqueda</p>
      <button class="no-results-btn" onclick="window.searchFilter.clearAll()">Limpiar filtros</button>
    `;
    
    // Insert after search bar
    const searchBar = document.querySelector('.search-filter-bar');
    if (searchBar && searchBar.parentNode) {
      searchBar.parentNode.insertBefore(noResultsEl, searchBar.nextSibling);
    }
  }

  function handleSearch(e) {
    currentSearch = e.target.value.toLowerCase().trim();
    applyFilters();
  }

  function clearSearch() {
    if (searchInput) {
      searchInput.value = '';
      currentSearch = '';
      applyFilters();
      searchInput.focus();
    }
  }

  function handleFilterChange(e) {
    currentFilter = e.target.value;
    applyFilters();

    // Smooth scroll to section if filtering by specific category
    if (currentFilter !== 'all') {
      const targetSection = document.getElementById(currentFilter);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  function applyFilters() {
    let visibleItems = 0;
    let visibleSections = 0;
    const isSearching = currentSearch.length > 0;

    // First, handle section visibility based on filter
    sections.forEach(section => {
      const sectionId = section.id;
      const matchesFilter = currentFilter === 'all' || sectionId === currentFilter;
      
      if (matchesFilter) {
        section.classList.remove('hidden-by-filter');
      } else {
        section.classList.add('hidden-by-filter');
      }
    });

    // Then, handle item visibility based on search
    items.forEach(item => {
      const itemName = (item.dataset.itemName || '').toLowerCase();
      const itemDescription = (item.querySelector('.item-description')?.textContent || '').toLowerCase();
      const itemTags = (item.querySelector('.item-tags')?.textContent || '').toLowerCase();
      
      // Check if item matches search
      const matchesSearch = !currentSearch || 
        itemName.includes(currentSearch) || 
        itemDescription.includes(currentSearch) ||
        itemTags.includes(currentSearch);

      // Check if item's section matches filter
      const section = item.closest('.catalog-section');
      const sectionId = section?.id || '';
      const matchesFilter = currentFilter === 'all' || sectionId === currentFilter;

      if (matchesSearch && matchesFilter) {
        item.classList.remove('hidden-by-search', 'hidden-by-filter');
        visibleItems++;
        
        // Highlight search term in item name
        highlightSearchTerm(item);
      } else {
        if (!matchesSearch) {
          item.classList.add('hidden-by-search');
        }
        if (!matchesFilter) {
          item.classList.add('hidden-by-filter');
        }
        removeHighlight(item);
      }
    });

    // Hide sections that have no visible items when searching
    sections.forEach(section => {
      if (!section.classList.contains('hidden-by-filter')) {
        const sectionItems = section.querySelectorAll('.item-card:not(.hidden-by-search):not(.hidden-by-filter)');
        if (sectionItems.length > 0) {
          section.classList.remove('hidden-by-search');
          visibleSections++;
        } else if (isSearching) {
          // Hide section if searching and no items match
          section.classList.add('hidden-by-search');
        } else {
          section.classList.remove('hidden-by-search');
          visibleSections++;
        }
      }
    });

    // Also hide section nav when searching
    const sectionNav = document.querySelector('.section-nav');
    if (sectionNav) {
      if (isSearching) {
        sectionNav.classList.add('hidden-by-search');
      } else {
        sectionNav.classList.remove('hidden-by-search');
      }
    }

    // Update results info
    updateResultsInfo(visibleItems);

    // Show/hide no results message
    if (noResultsEl) {
      noResultsEl.style.display = visibleItems === 0 && (currentSearch || currentFilter !== 'all') ? 'block' : 'none';
    }
  }

  function highlightSearchTerm(item) {
    if (!currentSearch) {
      removeHighlight(item);
      return;
    }

    const nameEl = item.querySelector('.item-name');
    if (nameEl) {
      const originalText = nameEl.dataset.originalText || nameEl.textContent;
      nameEl.dataset.originalText = originalText;
      
      const regex = new RegExp(`(${escapeRegex(currentSearch)})`, 'gi');
      nameEl.innerHTML = originalText.replace(regex, '<span class="search-highlight">$1</span>');
    }
  }

  function removeHighlight(item) {
    const nameEl = item.querySelector('.item-name');
    if (nameEl && nameEl.dataset.originalText) {
      nameEl.textContent = nameEl.dataset.originalText;
    }
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function updateResultsInfo(count) {
    if (!resultsInfo) return;

    if (!currentSearch && currentFilter === 'all') {
      resultsInfo.style.display = 'none';
    } else {
      resultsInfo.style.display = 'block';
      
      let text = '';
      const filterName = filterSelect?.options[filterSelect.selectedIndex]?.text?.split(' (')[0] || currentFilter;
      
      if (currentSearch && currentFilter !== 'all') {
        text = `<strong>${count}</strong> resultado${count !== 1 ? 's' : ''} para "<strong>${currentSearch}</strong>" en ${filterName}`;
      } else if (currentSearch) {
        text = `<strong>${count}</strong> resultado${count !== 1 ? 's' : ''} para "<strong>${currentSearch}</strong>"`;
      } else if (currentFilter !== 'all') {
        text = `Mostrando <strong>${count}</strong> producto${count !== 1 ? 's' : ''} en ${filterName}`;
      }
      
      resultsInfo.innerHTML = text;
    }
  }

  function clearAll() {
    // Clear search
    if (searchInput) {
      searchInput.value = '';
      currentSearch = '';
    }
    
    // Reset filter to all
    currentFilter = 'all';
    if (filterSelect) {
      filterSelect.value = 'all';
    }
    
    applyFilters();
  }

  // Expose API for external use
  window.searchFilter = {
    clearSearch,
    clearAll,
    setFilter: (filter) => {
      if (filterSelect) {
        filterSelect.value = filter;
        currentFilter = filter;
        applyFilters();
      }
    },
    search: (term) => {
      if (searchInput) {
        searchInput.value = term;
        currentSearch = term.toLowerCase().trim();
        applyFilters();
      }
    }
  };

})();
