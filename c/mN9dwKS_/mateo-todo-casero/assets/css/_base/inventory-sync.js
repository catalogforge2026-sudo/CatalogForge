/**
 * Inventory Sync - Public Catalog
 * Syncs stock from Firebase and hides out-of-stock items
 * VERSION: 2026-02-01-v2
 */

(function() {
  'use strict';

  console.log('📦 Inventory Sync script loaded');

  const FIREBASE_CONFIG = window.FIREBASE_CONFIG;
  const CATALOG_KEY = window.CATALOG_KEY;
  const FEATURES = window.FEATURES || {};
  const INVENTORY_CONFIG = window.INVENTORY_CONFIG || {
    enabled: false,
    showStockBadge: false,
    hideOutOfStock: true
  };

  console.log('📦 Inventory config:', {
    features: FEATURES,
    config: INVENTORY_CONFIG,
    hasFirebaseConfig: !!FIREBASE_CONFIG,
    catalogKey: CATALOG_KEY
  });

  // Skip if inventory feature not enabled
  if (!FEATURES.inventory || !INVENTORY_CONFIG.enabled || !FIREBASE_CONFIG || !CATALOG_KEY) {
    console.log('📦 Inventory sync skipped - missing requirements:', {
      hasFeature: !!FEATURES.inventory,
      isEnabled: !!INVENTORY_CONFIG.enabled,
      hasFirebaseConfig: !!FIREBASE_CONFIG,
      hasCatalogKey: !!CATALOG_KEY
    });
    return;
  }

  console.log('📦 Inventory sync enabled, initializing...');

  let db = null;
  let stockData = {}; // { itemId: { stock, reserved, available }, itemId_variantId: {...} }

  // Initialize Firebase and load inventory
  async function init() {
    try {
      if (typeof firebase === 'undefined') {
        console.log('⏭️ Firebase SDK not loaded, skipping inventory sync');
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }

      db = firebase.firestore();
      await loadInventory();
      applyInventoryToDOM();
      
      // Listen for real-time updates
      setupRealtimeListener();
    } catch (error) {
      console.error('Error initializing inventory sync:', error);
    }
  }

  async function loadInventory() {
    if (!db) return;

    console.log('📦 Loading inventory from Firebase...', { catalogKey: CATALOG_KEY });

    try {
      const snapshot = await db.collection('inventario')
        .doc(CATALOG_KEY)
        .collection('items')
        .get();

      if (snapshot.empty) {
        console.log('📋 No inventory data found in Firebase');
        return;
      }

      console.log(`✅ Found ${snapshot.size} inventory items in Firebase`);

      snapshot.forEach(doc => {
        const key = doc.id; // itemId or itemId_variantId
        const data = doc.data();
        stockData[key] = data;
        console.log(`📦 Loaded item ${key}:`, data);
      });

    } catch (error) {
      console.error('Error loading inventory:', error);
    }
  }

  function setupRealtimeListener() {
    if (!db) return;

    console.log('📦 Setting up realtime inventory listener...');

    db.collection('inventario')
      .doc(CATALOG_KEY)
      .collection('items')
      .onSnapshot(snapshot => {
        console.log('📦 Inventory snapshot received, changes:', snapshot.docChanges().length);
        
        snapshot.docChanges().forEach(change => {
          const key = change.doc.id;
          const data = change.doc.data();
          
          console.log(`📦 Change type: ${change.type}, key: ${key}, data:`, data);
          
          if (change.type === 'removed') {
            delete stockData[key];
          } else {
            stockData[key] = data;
          }
        });
        
        // Re-apply inventory to DOM after any change
        applyInventoryToDOM();
      }, error => {
        console.error('Inventory listener error:', error);
      });
  }

  function applyInventoryToDOM() {
    console.log('📦 Applying inventory to DOM, stockData:', stockData);
    
    // Process each item card
    const itemCards = document.querySelectorAll('[data-item-id], [data-product-id], .item-card[data-id], .product-card[data-id]');
    
    console.log(`📦 Found ${itemCards.length} item cards`);
    
    itemCards.forEach(card => {
      const itemId = card.dataset.itemId || card.dataset.productId || card.dataset.id;
      if (!itemId) return;

      const variantId = card.dataset.variantId;
      const key = variantId ? `${itemId}_${variantId}` : String(itemId);
      const inventory = stockData[key];

      console.log(`📦 Item ${itemId} (key: ${key}):`, inventory);

      if (inventory) {
        // Get available stock - this is the key field that considers reserved items
        // available = stock - reserved
        const available = inventory.available !== undefined ? inventory.available : 
                         (inventory.stock !== undefined ? inventory.stock : null);
        
        console.log(`📦 Item ${itemId} - stock: ${inventory.stock}, reserved: ${inventory.reserved}, available: ${available}, hideOutOfStock: ${INVENTORY_CONFIG.hideOutOfStock}`);
        
        if (available !== null) {
          // Hide if out of stock (available <= 0 means no stock left, including reserved)
          if (available <= 0 && INVENTORY_CONFIG.hideOutOfStock) {
            console.log(`📦 Hiding item ${itemId} - out of stock (available: ${available})`);
            hideItem(card);
            return;
          }

          // Show item if it was hidden but now has stock
          showItem(card);

          // Add/update stock badge if enabled
          if (INVENTORY_CONFIG.showStockBadge && available > 0) {
            updateStockBadge(card, available);
          } else {
            // Remove badge if stock badge is disabled
            const existingBadge = card.querySelector('.stock-badge');
            if (existingBadge && !INVENTORY_CONFIG.showStockBadge) {
              existingBadge.remove();
            }
          }

          // Update add-to-cart button based on availability
          if (available <= 0) {
            disableAddToCart(card);
          } else {
            enableAddToCart(card, available);
          }
        }
      }
    });

    // Hide empty sections after processing all items
    hideEmptySections();
  }

  function hideItem(card) {
    card.style.display = 'none';
    card.classList.add('out-of-stock-hidden');
  }

  function showItem(card) {
    if (card.classList.contains('out-of-stock-hidden')) {
      card.style.display = '';
      card.classList.remove('out-of-stock-hidden');
    }
  }

  function updateStockBadge(card, available) {
    let badge = card.querySelector('.stock-badge');
    
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'stock-badge';
      
      // Try to insert near the price or at the end
      const priceEl = card.querySelector('.item-price, .price');
      if (priceEl) {
        priceEl.parentNode.insertBefore(badge, priceEl.nextSibling);
      } else {
        card.appendChild(badge);
      }
    }

    // Update badge content
    if (available <= 3) {
      badge.className = 'stock-badge stock-low';
      badge.textContent = available === 1 ? '¡Último!' : `¡Quedan ${available}!`;
    } else {
      badge.className = 'stock-badge';
      badge.textContent = `Stock: ${available}`;
    }
  }

  function disableAddToCart(card) {
    const addBtn = card.querySelector('.add-to-cart-btn, .cart-add-btn, [data-add-cart]');
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.classList.add('out-of-stock');
      addBtn.title = 'Sin stock';
    }

    // Add out of stock label
    let label = card.querySelector('.out-of-stock-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'out-of-stock-label';
      label.textContent = 'Sin stock';
      card.appendChild(label);
    }
  }

  function enableAddToCart(card, available) {
    const addBtn = card.querySelector('.add-to-cart-btn, .cart-add-btn, [data-add-cart]');
    if (addBtn) {
      addBtn.disabled = false;
      addBtn.classList.remove('out-of-stock');
      addBtn.title = '';
      
      // Update button text to show urgency if low stock
      if (available && available <= 3) {
        const originalText = addBtn.dataset.originalText || addBtn.textContent;
        if (!addBtn.dataset.originalText) {
          addBtn.dataset.originalText = originalText;
        }
        const urgencyText = available === 1 ? '¡ÚLTIMO!' : `¡QUEDAN ${available}!`;
        // Keep the icon if present
        const icon = addBtn.querySelector('svg, i');
        if (icon) {
          addBtn.innerHTML = '';
          addBtn.appendChild(icon.cloneNode(true));
          addBtn.appendChild(document.createTextNode(` ${addBtn.dataset.originalText} `));
          const badge = document.createElement('span');
          badge.className = 'btn-stock-badge';
          badge.textContent = urgencyText;
          addBtn.appendChild(badge);
        } else {
          addBtn.textContent = `${originalText} ${urgencyText}`;
        }
        addBtn.classList.add('low-stock-warning');
      } else if (addBtn.dataset.originalText) {
        // Restore original text
        const icon = addBtn.querySelector('svg, i');
        if (icon) {
          addBtn.innerHTML = '';
          addBtn.appendChild(icon.cloneNode(true));
          addBtn.appendChild(document.createTextNode(` ${addBtn.dataset.originalText}`));
        } else {
          addBtn.textContent = addBtn.dataset.originalText;
        }
        addBtn.classList.remove('low-stock-warning');
      }
    }

    const label = card.querySelector('.out-of-stock-label');
    if (label) {
      label.remove();
    }
  }

  function hideEmptySections() {
    const sections = document.querySelectorAll('.section, .catalog-section, [data-section-id]');
    
    sections.forEach(section => {
      const visibleItems = section.querySelectorAll('.item-card:not(.out-of-stock-hidden), .product-card:not(.out-of-stock-hidden)');
      
      if (visibleItems.length === 0) {
        section.style.display = 'none';
        section.classList.add('empty-section-hidden');
      } else {
        section.style.display = '';
        section.classList.remove('empty-section-hidden');
      }
    });
  }

  // Expose functions for cart integration
  window.SCG_Inventory = {
    getStock: function(itemId, variantId) {
      const key = variantId ? `${itemId}_${variantId}` : String(itemId);
      return stockData[key] || null;
    },
    
    getAvailable: function(itemId, variantId) {
      const inv = this.getStock(itemId, variantId);
      if (!inv) return null;
      return inv.available ?? inv.stock ?? null;
    },
    
    isAvailable: function(itemId, variantId, quantity = 1) {
      const available = this.getAvailable(itemId, variantId);
      if (available === null) return true; // No stock control
      return available >= quantity;
    },
    
    // Called by cart when creating an order
    reserveStock: async function(items) {
      if (!db || !CATALOG_KEY) return false;
      
      const batch = db.batch();
      
      for (const item of items) {
        const key = item.variantId ? `${item.itemId}_${item.variantId}` : String(item.itemId);
        const ref = db.collection('inventario').doc(CATALOG_KEY).collection('items').doc(key);
        
        batch.update(ref, {
          reserved: firebase.firestore.FieldValue.increment(item.quantity),
          available: firebase.firestore.FieldValue.increment(-item.quantity),
          updatedAt: new Date().toISOString()
        });
      }
      
      try {
        await batch.commit();
        return true;
      } catch (error) {
        console.error('Error reserving stock:', error);
        return false;
      }
    },
    
    // Diagnostic function to check inventory status
    diagnose: async function(itemId) {
      if (!db || !CATALOG_KEY) {
        console.log('❌ Firebase not initialized');
        return;
      }
      
      const key = String(itemId);
      console.log(`🔍 Checking inventory for item ${key}...`);
      console.log(`🔍 Firebase path: inventario/${CATALOG_KEY}/items/${key}`);
      
      try {
        const doc = await db.collection('inventario').doc(CATALOG_KEY).collection('items').doc(key).get();
        
        if (doc.exists) {
          const data = doc.data();
          console.log(`✅ Document exists:`, data);
          console.log(`📊 Stock: ${data.stock}, Reserved: ${data.reserved}, Available: ${data.available}`);
          
          const expectedAvailable = (data.stock || 0) - (data.reserved || 0);
          if (data.available !== expectedAvailable) {
            console.warn(`⚠️ Available mismatch! Current: ${data.available}, Expected: ${expectedAvailable}`);
          }
        } else {
          console.log(`❌ Document does NOT exist for item ${key}`);
          console.log(`💡 The inventory may not have been initialized for this item`);
        }
      } catch (error) {
        console.error(`❌ Error checking inventory:`, error);
      }
    },
    
    // Get all inventory data
    getAllStock: function() {
      return stockData;
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

})();
