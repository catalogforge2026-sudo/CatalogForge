/**
 * Dynamic Prices - Firebase Price Sync for Public Catalog
 * Loads updated prices from Firebase and updates the DOM
 * Maintains original styling by only updating the text content
 */

(function() {
  'use strict';

  if (!window.PRICES_ENABLED || !window.FIREBASE_CONFIG) {
    console.log('⚠️ Dynamic prices not enabled');
    return;
  }

  const FIREBASE_CONFIG = window.FIREBASE_CONFIG;
  const CATALOG_KEY = window.CATALOG_KEY;

  let db = null;

  // Initialize Firebase
  function initFirebase() {
    try {
      // Check if Firebase is already initialized (by appointments.js)
      if (firebase.apps.length === 0) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      db = firebase.firestore();
      console.log('✅ Firebase initialized for prices');
      return true;
    } catch (error) {
      console.error('Error initializing Firebase for prices:', error);
      return false;
    }
  }

  // Load prices from Firebase and update DOM
  async function loadAndApplyPrices() {
    if (!db || !CATALOG_KEY) {
      console.log('⚠️ Missing db or CATALOG_KEY for prices');
      return;
    }

    try {
      const snapshot = await db.collection('precios')
        .doc(CATALOG_KEY)
        .collection('items')
        .get();

      if (snapshot.empty) {
        console.log('📊 No custom prices found in Firebase');
        return;
      }

      console.log('📊 Found', snapshot.size, 'custom prices');

      snapshot.forEach(doc => {
        const itemId = doc.id;
        const data = doc.data();
        
        if (data.price !== undefined) {
          updatePriceInDOM(itemId, data.price);
        }
      });

      console.log('✅ Prices updated from Firebase');
    } catch (error) {
      console.error('Error loading prices from Firebase:', error);
    }
  }

  // Update price in DOM for a specific item
  function updatePriceInDOM(itemId, newPrice) {
    // Format price using the same format as existing prices
    const formattedPrice = formatPrice(newPrice);
    
    // Find all elements with this item ID
    const itemElements = document.querySelectorAll(`[data-item-id="${itemId}"]`);
    
    itemElements.forEach(element => {
      // Update data attributes
      element.dataset.itemPrice = newPrice;
      element.dataset.itemPriceText = formattedPrice;
      
      // Try to find the specific price-amount span first (preserves structure)
      let priceEl = element.querySelector('.price-amount');
      
      // Fallback to other price selectors
      if (!priceEl) {
        priceEl = element.querySelector('.item-price');
      }
      if (!priceEl) {
        priceEl = element.querySelector('.card-price');
      }
      if (!priceEl) {
        priceEl = element.querySelector('.price');
      }
      
      if (priceEl) {
        // Only update the text content, preserving the element and its styles
        priceEl.textContent = formattedPrice;
      }
    });

    // Item rows (list layout) - for sections with image
    const itemRows = document.querySelectorAll(`.item-row[data-item-id="${itemId}"]`);
    itemRows.forEach(row => {
      row.dataset.itemPrice = newPrice;
      row.dataset.itemPriceText = formattedPrice;
      
      const priceEl = row.querySelector('.item-price');
      if (priceEl) {
        priceEl.textContent = formattedPrice;
      }
    });

    // Also update in CATALOG_DATA if it exists (for cart functionality)
    if (window.CATALOG_DATA && window.CATALOG_DATA.sections) {
      window.CATALOG_DATA.sections.forEach(section => {
        if (section.items) {
          section.items.forEach(item => {
            if (String(item.id) === String(itemId)) {
              item.priceRaw = newPrice;
              item.price = formattedPrice;
            }
          });
        }
      });
    }
  }

  // Format price matching the catalog's existing format
  function formatPrice(price) {
    if (price === null || price === undefined || price === '') {
      return '';
    }
    
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) {
      return price;
    }

    // Try to detect the format from existing prices in the page
    const existingPriceEl = document.querySelector('.price-amount, .item-price, .card-price');
    let format = '$ {price}'; // Default format
    
    if (existingPriceEl) {
      const text = existingPriceEl.textContent.trim();
      // Detect currency symbol and position
      if (text.match(/^\$\s*[\d.,]+/)) {
        format = '$ {price}';
      } else if (text.match(/^€\s*[\d.,]+/)) {
        format = '€ {price}';
      } else if (text.match(/^[\d.,]+\s*€/)) {
        format = '{price} €';
      } else if (text.match(/^£\s*[\d.,]+/)) {
        format = '£ {price}';
      }
    }

    // Format the number using locale
    let formattedNumber;
    if (numPrice % 1 === 0) {
      // Integer - no decimals
      formattedNumber = numPrice.toLocaleString('es-AR');
    } else {
      // Has decimals
      formattedNumber = numPrice.toLocaleString('es-AR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    }

    return format.replace('{price}', formattedNumber);
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    if (initFirebase()) {
      // Small delay to ensure DOM is fully rendered
      setTimeout(loadAndApplyPrices, 100);
    }
  });

})();
