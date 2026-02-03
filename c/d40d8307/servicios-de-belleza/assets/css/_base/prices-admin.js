/**
 * Prices Admin Panel
 * Firebase-powered price management for catalogs
 */

(function() {
  'use strict';

  const FIREBASE_CONFIG = window.FIREBASE_CONFIG;
  const CATALOG_KEY = window.CATALOG_KEY;
  const ITEMS = window.ITEMS || [];
  const SECTIONS = window.SECTIONS || [];
  const FEATURES = window.FEATURES || {};

  // Skip if prices feature not enabled
  if (!FEATURES.prices) {
    console.log('⏭️ Prices feature not enabled, skipping prices-admin.js');
    return;
  }

  let db = null;
  let pricesCache = new Map(); // itemId -> { price, updatedAt }
  let filteredItems = [...ITEMS];

  // DOM Elements
  const pricesList = document.getElementById('prices-list');
  const priceSearch = document.getElementById('price-search');
  const sectionFilter = document.getElementById('price-section-filter');
  const syncBtn = document.getElementById('sync-prices-btn');
  const priceModal = document.getElementById('price-modal');
  const priceForm = document.getElementById('price-form');

  // Initialize
  function init() {
    console.log('💰 Initializing Prices Admin');
    console.log('📦 Items loaded:', ITEMS.length);
    console.log('📂 Sections loaded:', SECTIONS.length);

    // Wait for Firebase to be initialized by admin.js
    waitForFirebase().then(() => {
      db = firebase.firestore();
      setupEventListeners();
      populateSectionFilter();
      loadPricesFromFirebase();
    });
  }

  function waitForFirebase() {
    return new Promise((resolve) => {
      const check = () => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Search
    if (priceSearch) {
      priceSearch.addEventListener('input', debounce(filterItems, 300));
    }

    // Section filter
    if (sectionFilter) {
      sectionFilter.addEventListener('change', filterItems);
    }

    // Sync button
    if (syncBtn) {
      syncBtn.addEventListener('click', syncPrices);
    }

    // Modal
    if (priceModal) {
      priceModal.querySelector('.modal-close')?.addEventListener('click', closeModal);
      priceModal.querySelector('.modal-cancel')?.addEventListener('click', closeModal);
      priceModal.addEventListener('click', (e) => {
        if (e.target === priceModal) closeModal();
      });
    }

    // Form
    if (priceForm) {
      priceForm.addEventListener('submit', handlePriceSubmit);
      
      // Reset checkbox behavior
      const resetCheckbox = document.getElementById('price-reset');
      const newPriceInput = document.getElementById('price-new');
      if (resetCheckbox && newPriceInput) {
        resetCheckbox.addEventListener('change', (e) => {
          newPriceInput.disabled = e.target.checked;
          if (e.target.checked) {
            const originalPrice = document.getElementById('price-original').value;
            newPriceInput.value = originalPrice.replace(/[^0-9.]/g, '');
          }
        });
      }
    }
  }

  function switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabId}`);
    });

    // Load data for the tab
    if (tabId === 'prices') {
      renderPricesList();
    }
  }

  function populateSectionFilter() {
    if (!sectionFilter) return;
    
    SECTIONS.forEach(section => {
      const option = document.createElement('option');
      option.value = section.id;
      option.textContent = section.name;
      sectionFilter.appendChild(option);
    });
  }

  async function loadPricesFromFirebase() {
    if (!db || !CATALOG_KEY) return;

    console.log('📥 Loading prices from Firebase...');

    try {
      const snapshot = await db.collection('precios')
        .doc(CATALOG_KEY)
        .collection('items')
        .get();

      pricesCache.clear();
      snapshot.forEach(doc => {
        pricesCache.set(doc.id, doc.data());
      });

      console.log('✅ Loaded', pricesCache.size, 'price overrides from Firebase');
      updateStats();
      renderPricesList();
    } catch (error) {
      console.error('Error loading prices:', error);
    }
  }

  function filterItems() {
    const searchTerm = priceSearch?.value.toLowerCase() || '';
    const sectionId = sectionFilter?.value || '';

    filteredItems = ITEMS.filter(item => {
      const matchesSearch = !searchTerm || 
        item.name.toLowerCase().includes(searchTerm) ||
        (item.description && item.description.toLowerCase().includes(searchTerm));
      
      const matchesSection = !sectionId || item.section_id == sectionId;

      return matchesSearch && matchesSection;
    });

    renderPricesList();
  }

  function renderPricesList() {
    if (!pricesList) return;

    if (filteredItems.length === 0) {
      pricesList.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <p>No se encontraron productos</p>
        </div>
      `;
      updatePricesCount(0);
      return;
    }

    let html = '';
    filteredItems.forEach(item => {
      const override = pricesCache.get(String(item.id));
      const currentPrice = override ? override.price : item.price;
      const hasOverride = !!override;
      const section = SECTIONS.find(s => s.id == item.section_id);

      html += `
        <div class="price-item ${hasOverride ? 'has-override' : ''}" data-id="${item.id}">
          <div class="price-item-left">
            ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}" class="price-item-image">` : '<div class="price-item-image placeholder"></div>'}
            <div class="price-item-details">
              <span class="price-item-name">${item.name}</span>
              <span class="price-item-section">${section?.name || 'Sin sección'}</span>
            </div>
          </div>
          <div class="price-item-right">
            <div class="price-values">
              ${hasOverride ? `<span class="price-original">$${formatPrice(item.price)}</span>` : ''}
              <span class="price-current ${hasOverride ? 'modified' : ''}">$${formatPrice(currentPrice)}</span>
            </div>
            <button class="btn-edit-price" data-id="${item.id}" title="Editar precio">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    });

    pricesList.innerHTML = html;
    updatePricesCount(filteredItems.length);

    // Add click handlers
    pricesList.querySelectorAll('.btn-edit-price').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
  }

  function openEditModal(itemId) {
    const item = ITEMS.find(i => i.id == itemId);
    if (!item) return;

    const override = pricesCache.get(String(itemId));
    const section = SECTIONS.find(s => s.id == item.section_id);

    document.getElementById('price-item-id').value = itemId;
    document.getElementById('price-item-name').textContent = item.name;
    document.getElementById('price-item-section').textContent = section?.name || 'Sin sección';
    document.getElementById('price-original').value = `$${formatPrice(item.price)}`;
    document.getElementById('price-new').value = override ? override.price : item.price;
    document.getElementById('price-new').disabled = false;
    document.getElementById('price-reset').checked = false;

    const imgEl = document.getElementById('price-item-image');
    if (item.image_url) {
      imgEl.src = item.image_url;
      imgEl.style.display = 'block';
    } else {
      imgEl.style.display = 'none';
    }

    priceModal.style.display = 'flex';
  }

  function closeModal() {
    if (priceModal) {
      priceModal.style.display = 'none';
    }
  }

  async function handlePriceSubmit(e) {
    e.preventDefault();

    const itemId = document.getElementById('price-item-id').value;
    const newPrice = parseFloat(document.getElementById('price-new').value);
    const resetPrice = document.getElementById('price-reset').checked;
    const item = ITEMS.find(i => i.id == itemId);

    if (!item || !db) return;

    const submitBtn = priceForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';

    try {
      const itemRef = db.collection('precios')
        .doc(CATALOG_KEY)
        .collection('items')
        .doc(String(itemId));

      if (resetPrice) {
        // Delete the override
        await itemRef.delete();
        pricesCache.delete(String(itemId));
        console.log('✅ Price reset to original for item:', itemId);
      } else {
        // Save new price
        const priceData = {
          price: newPrice,
          originalPrice: item.price,
          itemName: item.name,
          updatedAt: new Date().toISOString()
        };
        await itemRef.set(priceData);
        pricesCache.set(String(itemId), priceData);
        console.log('✅ Price updated for item:', itemId, 'to', newPrice);
      }

      closeModal();
      updateStats();
      renderPricesList();

    } catch (error) {
      console.error('Error saving price:', error);
      alert('Error al guardar el precio: ' + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar Precio';
    }
  }

  async function syncPrices() {
    if (!syncBtn) return;

    syncBtn.disabled = true;
    syncBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      Sincronizando...
    `;

    try {
      await loadPricesFromFirebase();
      alert('✅ Precios sincronizados correctamente');
    } catch (error) {
      console.error('Sync error:', error);
      alert('Error al sincronizar: ' + error.message);
    } finally {
      syncBtn.disabled = false;
      syncBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        Sincronizar
      `;
    }
  }

  function updateStats() {
    const totalItems = document.getElementById('stat-total-items');
    const modifiedPrices = document.getElementById('stat-modified-prices');
    const lastUpdate = document.getElementById('stat-last-update');

    if (totalItems) totalItems.textContent = ITEMS.length;
    if (modifiedPrices) modifiedPrices.textContent = pricesCache.size;

    if (lastUpdate && pricesCache.size > 0) {
      let latest = null;
      pricesCache.forEach(data => {
        if (data.updatedAt && (!latest || data.updatedAt > latest)) {
          latest = data.updatedAt;
        }
      });
      if (latest) {
        const date = new Date(latest);
        lastUpdate.textContent = date.toLocaleDateString('es-AR', { 
          day: '2-digit', 
          month: 'short' 
        });
      }
    }
  }

  function updatePricesCount(count) {
    const countEl = document.getElementById('prices-count');
    if (countEl) {
      countEl.textContent = `${count} item${count !== 1 ? 's' : ''}`;
    }
  }

  function formatPrice(price) {
    if (price == null) return '0';
    return Number(price).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

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

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
