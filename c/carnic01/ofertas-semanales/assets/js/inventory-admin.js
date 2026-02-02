/**
 * Inventory Admin - Order Management
 * Admin panel for managing orders and stock
 * VERSION: 2026-02-01-v2
 */

(function() {
  'use strict';

  const FIREBASE_CONFIG = window.FIREBASE_CONFIG;
  const CATALOG_KEY = window.CATALOG_KEY;
  const FEATURES = window.FEATURES || {};

  if (!FEATURES.inventory) {
    console.log('Inventory feature not enabled');
    return;
  }

  let db = null;
  let currentUser = null;
  let orders = [];
  let inventory = [];
  let localItems = window.ITEMS || [];
  let localSections = window.SECTIONS || [];
  let currentFilter = 'pending';
  let unsubscribeOrders = null;
  let unsubscribeInventory = null;

  const DEFAULT_STOCK = 1;

  async function init() {
    if (!FIREBASE_CONFIG || !CATALOG_KEY) {
      console.warn('Missing Firebase config or catalog key');
      return;
    }

    try {
      if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded');
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }

      db = firebase.firestore();

      firebase.auth().onAuthStateChanged(user => {
        currentUser = user;
        if (user) {
          setupRealtimeListeners();
        } else {
          cleanupListeners();
        }
      });

    } catch (error) {
      console.error('Error initializing inventory admin:', error);
    }
  }

  function setupRealtimeListeners() {
    // Show empty state immediately while waiting for Firebase
    renderOrders();
    renderInventory();
    
    db.collection('inventario').doc(CATALOG_KEY).set({
      catalogKey: CATALOG_KEY,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(err => console.warn('Could not create parent doc:', err));

    unsubscribeOrders = db.collection('inventario')
      .doc(CATALOG_KEY)
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        orders = [];
        snapshot.forEach(doc => {
          orders.push({ id: doc.id, ...doc.data() });
        });
        renderOrders();
        updateOrderCounts();
      }, error => {
        console.error('Error listening to orders:', error);
        orders = [];
        renderOrders();
      });

    unsubscribeInventory = db.collection('inventario')
      .doc(CATALOG_KEY)
      .collection('items')
      .onSnapshot(async snapshot => {
        inventory = [];
        snapshot.forEach(doc => {
          inventory.push({ key: doc.id, ...doc.data() });
        });
        
        if (inventory.length === 0 && localItems.length > 0) {
          console.log('No inventory data found, initializing...');
          await initializeDefaultInventory();
        } else {
          renderInventory();
        }
      }, error => {
        console.error('Error listening to inventory:', error);
        renderInventory();
      });
  }

  async function initializeDefaultInventory() {
    if (!db || !currentUser || localItems.length === 0) {
      renderInventory();
      return;
    }

    try {
      showToast('Inicializando inventario...', 'info');
      
      const batch = db.batch();
      
      for (const item of localItems) {
        const key = String(item.id);
        const section = localSections.find(s => s.id === item.section_id);
        const ref = db.collection('inventario').doc(CATALOG_KEY).collection('items').doc(key);
        
        batch.set(ref, {
          itemId: item.id,
          itemName: item.name,
          sectionName: section?.name || '',
          stock: DEFAULT_STOCK,
          available: DEFAULT_STOCK,
          reserved: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      await batch.commit();
      showToast('Inventario inicializado', 'success');
      
    } catch (error) {
      console.error('Error initializing inventory:', error);
      showToast('Error al inicializar inventario', 'error');
      renderInventory();
    }
  }

  function cleanupListeners() {
    if (unsubscribeOrders) unsubscribeOrders();
    if (unsubscribeInventory) unsubscribeInventory();
  }

  // ORDERS
  function renderOrders() {
    const container = document.getElementById('orders-list');
    if (!container) return;

    const filtered = orders.filter(o => {
      if (currentFilter === 'all') return true;
      return o.status === currentFilter;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="orders-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <h3>No hay pedidos ${getFilterLabel(currentFilter)}</h3>
          <p>Los nuevos pedidos apareceran aqui</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(order => renderOrderCard(order)).join('');

    container.querySelectorAll('.order-btn.confirm').forEach(btn => {
      btn.addEventListener('click', () => confirmOrder(btn.dataset.orderId));
    });
    container.querySelectorAll('.order-btn.cancel').forEach(btn => {
      btn.addEventListener('click', () => cancelOrder(btn.dataset.orderId));
    });
    container.querySelectorAll('.order-btn.whatsapp').forEach(btn => {
      btn.addEventListener('click', () => contactCustomer(btn.dataset.orderId));
    });
  }

  function getFilterLabel(filter) {
    const labels = {
      pending: 'pendientes',
      confirmed: 'confirmados',
      cancelled: 'cancelados',
      all: ''
    };
    return labels[filter] || '';
  }

  function renderOrderCard(order) {
    const statusColors = {
      pending: { bg: '#fef3c7', text: '#d97706', label: 'Pendiente' },
      confirmed: { bg: '#d1fae5', text: '#059669', label: 'Confirmado' },
      cancelled: { bg: '#fee2e2', text: '#dc2626', label: 'Cancelado' }
    };
    const status = statusColors[order.status] || statusColors.pending;
    const date = new Date(order.createdAt);
    const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    const itemsHtml = order.items.map(item => {
      // First try to get image from order item (new orders will have it)
      let itemImage = item.image || '';
      
      // Fallback: try to find item in localItems
      if (!itemImage && localItems.length > 0) {
        const baseItemId = String(item.itemId).split('_')[0];
        let localItem = localItems.find(i => String(i.id) === baseItemId);
        
        // If not found by ID, try to find by name (case insensitive)
        if (!localItem && item.name) {
          const searchName = item.name.toLowerCase().trim();
          localItem = localItems.find(i => 
            i.name?.toLowerCase().trim() === searchName ||
            i.name?.toLowerCase().includes(searchName) ||
            searchName.includes(i.name?.toLowerCase())
          );
        }
        
        itemImage = localItem?.image || '';
      }
      
      return `
        <div class="order-item">
          <div class="order-item-img-wrapper">
            ${itemImage 
              ? `<img class="order-item-img" src="${itemImage}" alt="${item.name}" />`
              : `<div class="order-item-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>`
            }
            ${item.quantity > 1 ? `<span class="order-item-qty-badge">${item.quantity}</span>` : ''}
          </div>
          <span class="order-item-name">${item.name}${item.variantName ? ` (${item.variantName})` : ''}</span>
          <span class="order-item-price">${item.priceText || ''}</span>
        </div>
      `;
    }).join('');

    const actionsHtml = order.status === 'pending' ? `
      <button class="order-btn confirm" data-order-id="${order.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        Confirmar
      </button>
      <button class="order-btn cancel" data-order-id="${order.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Cancelar
      </button>
    ` : '';

    return `
      <div class="order-card" data-order-id="${order.id}">
        <div class="order-header">
          <div class="order-id">#${order.id}</div>
          <div class="order-status" style="background:${status.bg};color:${status.text}">${status.label}</div>
        </div>
        <div class="order-customer">
          <div class="customer-name">${order.customer?.name || 'Sin nombre'}</div>
          <div class="customer-phone">${order.customer?.phone || ''}</div>
        </div>
        <div class="order-items">${itemsHtml}</div>
        <div class="order-footer">
          <div class="order-total">Total: $${(order.total || 0).toLocaleString('es-AR')}</div>
          <div class="order-date">${dateStr} ${timeStr}</div>
        </div>
        <div class="order-actions">
          ${actionsHtml}
          <button class="order-btn whatsapp" data-order-id="${order.id}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  function updateOrderCounts() {
    const pending = orders.filter(o => o.status === 'pending').length;
    const today = new Date().toISOString().split('T')[0];
    const confirmedToday = orders.filter(o => o.status === 'confirmed' && o.createdAt?.startsWith(today)).length;
    const salesToday = orders.filter(o => o.status === 'confirmed' && o.createdAt?.startsWith(today))
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const pendingEl = document.getElementById('stat-pending-orders');
    const confirmedEl = document.getElementById('stat-confirmed-orders');
    const salesEl = document.getElementById('stat-total-sales');
    const badgeEl = document.querySelector('.orders-tab-badge');

    if (pendingEl) pendingEl.textContent = pending;
    if (confirmedEl) confirmedEl.textContent = confirmedToday;
    if (salesEl) salesEl.textContent = '$' + salesToday.toLocaleString('es-AR');
    if (badgeEl) {
      badgeEl.textContent = pending;
      badgeEl.style.display = pending > 0 ? 'inline-flex' : 'none';
    }
  }

  function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.orders-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderOrders();
  }

  async function confirmOrder(orderId) {
    if (!db || !currentUser) return;
    if (!confirm('¿Confirmar este pedido? El stock reservado se descontará definitivamente.')) return;

    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      await db.runTransaction(async (transaction) => {
        const orderRef = db.collection('inventario').doc(CATALOG_KEY).collection('orders').doc(orderId);
        
        for (const item of order.items) {
          // Extract base item ID (remove customization suffixes)
          const baseItemId = String(item.itemId).split('_')[0];
          const itemKey = item.variantId ? `${baseItemId}_${item.variantId}` : baseItemId;
          const stockRef = db.collection('inventario').doc(CATALOG_KEY).collection('items').doc(itemKey);
          const stockDoc = await transaction.get(stockRef);
          
          if (stockDoc.exists) {
            const data = stockDoc.data();
            const newReserved = Math.max(0, (data.reserved || 0) - item.quantity);
            const newStock = Math.max(0, (data.stock || 0) - item.quantity);
            const newAvailable = newStock - newReserved;
            
            transaction.update(stockRef, {
              stock: newStock,
              reserved: newReserved,
              available: newAvailable,
              updatedAt: new Date().toISOString()
            });
          }
        }
        
        transaction.update(orderRef, {
          status: 'confirmed',
          confirmedAt: new Date().toISOString()
        });
      });

      showToast('Pedido confirmado', 'success');
    } catch (error) {
      console.error('Error confirming order:', error);
      showToast('Error al confirmar pedido', 'error');
    }
  }

  async function cancelOrder(orderId) {
    if (!db || !currentUser) return;
    if (!confirm('¿Cancelar este pedido? El stock reservado se liberará.')) return;

    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      await db.runTransaction(async (transaction) => {
        const orderRef = db.collection('inventario').doc(CATALOG_KEY).collection('orders').doc(orderId);
        
        for (const item of order.items) {
          // Extract base item ID (remove customization suffixes)
          const baseItemId = String(item.itemId).split('_')[0];
          const itemKey = item.variantId ? `${baseItemId}_${item.variantId}` : baseItemId;
          const stockRef = db.collection('inventario').doc(CATALOG_KEY).collection('items').doc(itemKey);
          const stockDoc = await transaction.get(stockRef);
          
          if (stockDoc.exists) {
            const data = stockDoc.data();
            const newReserved = Math.max(0, (data.reserved || 0) - item.quantity);
            const newAvailable = (data.stock || 0) - newReserved;
            
            transaction.update(stockRef, {
              reserved: newReserved,
              available: newAvailable,
              updatedAt: new Date().toISOString()
            });
          }
        }
        
        transaction.update(orderRef, {
          status: 'cancelled',
          cancelledAt: new Date().toISOString()
        });
      });

      showToast('Pedido cancelado', 'success');
    } catch (error) {
      console.error('Error cancelling order:', error);
      showToast('Error al cancelar pedido', 'error');
    }
  }

  function contactCustomer(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.customer?.phone) {
      showToast('No hay teléfono del cliente', 'error');
      return;
    }
    const phone = order.customer.phone.replace(/\D/g, '');
    const message = `Hola ${order.customer.name}, sobre tu pedido #${order.id}...`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  // INVENTORY
  function renderInventory() {
    const container = document.getElementById('inventory-list');
    if (!container) return;

    if (inventory.length === 0) {
      container.innerHTML = `
        <div class="inventory-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
          </svg>
          <h3>No hay productos en inventario</h3>
          <p>El inventario se inicializará automáticamente</p>
        </div>
      `;
      return;
    }

    const html = inventory.map(item => {
      const stockClass = item.available <= 0 ? 'out-of-stock' : item.available <= 3 ? 'low-stock' : '';
      
      // Find the local item to get the image
      // item.key can be "123" or "123_variant", item.itemId is the original item ID
      const itemId = item.itemId || String(item.key).split('_')[0];
      const localItem = localItems.find(i => String(i.id) === String(itemId));
      const itemImage = localItem?.image_url || localItem?.image || '';
      
      return `
        <div class="inventory-item ${stockClass}" data-key="${item.key}">
          <div class="inventory-item-left">
            ${itemImage 
              ? `<img src="${itemImage}" alt="${item.itemName}" class="inventory-item-image">`
              : `<div class="inventory-item-image placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>`
            }
            <div class="inventory-item-info">
              <div class="inventory-item-name">${item.itemName || 'Sin nombre'}</div>
              <div class="inventory-item-section">${item.sectionName || ''}</div>
            </div>
          </div>
          <div class="inventory-item-stock">
            <button class="stock-btn minus" data-key="${item.key}">−</button>
            <span class="stock-value">${item.stock || 0}</span>
            <button class="stock-btn plus" data-key="${item.key}">+</button>
          </div>
          <div class="inventory-item-status">
            <span class="available">Disp: ${item.available || 0}</span>
            ${item.reserved > 0 ? `<span class="reserved">Res: ${item.reserved}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;

    container.querySelectorAll('.stock-btn.plus').forEach(btn => {
      btn.addEventListener('click', () => updateStock(btn.dataset.key, 1));
    });
    container.querySelectorAll('.stock-btn.minus').forEach(btn => {
      btn.addEventListener('click', () => updateStock(btn.dataset.key, -1));
    });

    updateInventoryStats();
  }

  async function updateStock(key, delta) {
    if (!db || !currentUser) return;

    try {
      const ref = db.collection('inventario').doc(CATALOG_KEY).collection('items').doc(key);
      const doc = await ref.get();
      
      if (doc.exists) {
        const data = doc.data();
        const newStock = Math.max(0, (data.stock || 0) + delta);
        const newAvailable = newStock - (data.reserved || 0);
        
        await ref.update({
          stock: newStock,
          available: newAvailable,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      showToast('Error al actualizar stock', 'error');
    }
  }

  function updateInventoryStats() {
    const totalProducts = inventory.length;
    const lowStock = inventory.filter(i => (i.available || 0) <= 3 && (i.available || 0) > 0).length;
    const reserved = inventory.reduce((sum, i) => sum + (i.reserved || 0), 0);

    const totalEl = document.getElementById('stat-total-products');
    const lowEl = document.getElementById('stat-low-stock');
    const reservedEl = document.getElementById('stat-reserved');

    if (totalEl) totalEl.textContent = totalProducts;
    if (lowEl) lowEl.textContent = lowStock;
    if (reservedEl) reservedEl.textContent = reserved;
  }

  function showToast(message, type = 'info') {
    const toast = document.getElementById('admin-toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = 'admin-toast show ' + type;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Recalculate reserved stock based on pending orders
  async function recalculateReserved() {
    if (!db || !currentUser) {
      showToast('Debe iniciar sesión primero', 'error');
      return;
    }
    
    if (!confirm('¿Recalcular el stock reservado basado en los pedidos pendientes? Esto corregirá inconsistencias.')) {
      return;
    }
    
    try {
      showToast('Recalculando stock reservado...', 'info');
      
      // Get all pending orders
      const pendingOrders = orders.filter(o => o.status === 'pending');
      
      // Calculate reserved per item
      const reservedByItem = {};
      for (const order of pendingOrders) {
        for (const item of order.items || []) {
          const baseItemId = String(item.itemId).split('_')[0];
          const key = item.variantId ? `${baseItemId}_${item.variantId}` : baseItemId;
          reservedByItem[key] = (reservedByItem[key] || 0) + (item.quantity || 1);
        }
      }
      
      // Update each inventory item
      const batch = db.batch();
      for (const inv of inventory) {
        const reserved = reservedByItem[inv.key] || 0;
        const available = (inv.stock || 0) - reserved;
        
        const ref = db.collection('inventario').doc(CATALOG_KEY).collection('items').doc(inv.key);
        batch.update(ref, {
          reserved: reserved,
          available: available,
          updatedAt: new Date().toISOString()
        });
      }
      
      await batch.commit();
      showToast('Stock reservado recalculado correctamente', 'success');
      
    } catch (error) {
      console.error('Error recalculating reserved:', error);
      showToast('Error al recalcular: ' + error.message, 'error');
    }
  }

  // Expose public API
  window.InventoryAdmin = {
    setFilter: setFilter,
    confirmOrder: confirmOrder,
    cancelOrder: cancelOrder,
    contactCustomer: contactCustomer,
    updateStock: updateStock,
    recalculateReserved: recalculateReserved
  };

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
