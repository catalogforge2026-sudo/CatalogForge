/**
 * Prices Sync - Public Catalog
 * Syncs prices from Firebase to the public catalog view
 */

(function() {
  'use strict';

  const FIREBASE_CONFIG = window.FIREBASE_CONFIG;
  const CATALOG_KEY = window.CATALOG_KEY;
  const FEATURES = window.FEATURES || {};

  // Skip if prices feature not enabled or no Firebase config
  if (!FEATURES.prices || !FIREBASE_CONFIG || !CATALOG_KEY) {
    return;
  }

  let db = null;

  // Initialize Firebase and load prices
  async function init() {
    try {
      // Check if Firebase is already initialized
      if (typeof firebase === 'undefined') {
        console.log('⏭️ Firebase SDK not loaded, skipping price sync');
        return;
      }

      // Initialize Firebase if not already done
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }

      db = firebase.firestore();
      await loadAndApplyPrices();
    } catch (error) {
      console.error('Error initializing price sync:', error);
    }
  }

  async function loadAndApplyPrices() {
    if (!db) return;

    console.log('💰 Loading prices from Firebase...');

    try {
      const snapshot = await db.collection('precios')
        .doc(CATALOG_KEY)
        .collection('items')
        .get();

      if (snapshot.empty) {
        console.log('📋 No price overrides found');
        return;
      }

      console.log(`✅ Found ${snapshot.size} price overrides`);

      snapshot.forEach(doc => {
        const itemId = doc.id;
        const data = doc.data();
        applyPriceToDOM(itemId, data.price);
      });

    } catch (error) {
      console.error('Error loading prices:', error);
    }
  }

  function applyPriceToDOM(itemId, newPrice) {
    // Find all price elements for this item
    // Common selectors used in catalog templates
    const selectors = [
      `[data-item-id="${itemId}"] .item-price`,
      `[data-item-id="${itemId}"] .price`,
      `[data-product-id="${itemId}"] .item-price`,
      `[data-product-id="${itemId}"] .price`,
      `.item-card[data-id="${itemId}"] .item-price`,
      `.item-card[data-id="${itemId}"] .price`,
      `.product-card[data-id="${itemId}"] .price`,
      `#item-${itemId} .price`,
      `#product-${itemId} .price`
    ];

    let found = false;

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const formattedPrice = formatPrice(newPrice);
        
        // Check if element has currency symbol
        const currentText = el.textContent;
        if (currentText.includes('$')) {
          el.textContent = `$${formattedPrice}`;
        } else {
          el.textContent = formattedPrice;
        }
        
        // Add visual indicator that price was updated
        el.classList.add('price-synced');
        found = true;
      });
    });

    if (found) {
      console.log(`💵 Updated price for item ${itemId}: $${formatPrice(newPrice)}`);
    }
  }

  function formatPrice(price) {
    if (price == null) return '0';
    return Number(price).toLocaleString('es-AR', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2 
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay to ensure Firebase SDK is loaded
    setTimeout(init, 100);
  }

})();
