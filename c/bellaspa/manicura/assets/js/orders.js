/**
 * Orders Module - Public Catalog
 * Creates orders and reserves stock when sending WhatsApp orders
 * VERSION: 2026-02-01-v1
 */

(function() {
  'use strict';

  const FIREBASE_CONFIG = window.FIREBASE_CONFIG;
  const CATALOG_KEY = window.CATALOG_KEY;
  const FEATURES = window.FEATURES || {};
  const INVENTORY_CONFIG = window.INVENTORY_CONFIG || {};

  // Skip if inventory feature not enabled
  if (!FEATURES.inventory || !FIREBASE_CONFIG || !CATALOG_KEY) {
    return;
  }

  let db = null;

  // Initialize Firebase
  function initFirebase() {
    if (typeof firebase === 'undefined') return false;

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      db = firebase.firestore();
      return true;
    } catch (error) {
      console.error('Error initializing Firebase for orders:', error);
      return false;
    }
  }

  // Generate short order ID
  function generateOrderId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Create order and reserve stock
  async function createOrder(orderData) {
    if (!db) {
      if (!initFirebase()) {
        throw new Error('Firebase not available');
      }
    }

    const orderId = generateOrderId();
    const now = new Date();
    const expiryHours = INVENTORY_CONFIG.orderExpiryHours || 24;
    const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

    const order = {
      id: orderId,
      catalogKey: CATALOG_KEY,
      status: 'pending',
      items: orderData.items,
      customer: orderData.customer,
      subtotal: orderData.subtotal,
      deliveryCost: orderData.deliveryCost || 0,
      total: orderData.total,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    // Use transaction to create order and reserve stock atomically
    try {
      await db.runTransaction(async (transaction) => {
        // First, verify stock availability for all items
        const stockChecks = [];
        
        for (const item of orderData.items) {
          const itemKey = item.variantId ? `${item.itemId}_${item.variantId}` : String(item.itemId);
          const stockRef = db.collection('inventario').doc(CATALOG_KEY).collection('items').doc(itemKey);
          stockChecks.push({ ref: stockRef, item, itemKey });
        }

        // Read all stock documents
        const stockDocs = await Promise.all(
          stockChecks.map(async ({ ref }) => {
            const doc = await transaction.get(ref);
            return doc;
          })
        );

        // Verify availability
        for (let i = 0; i < stockChecks.length; i++) {
          const doc = stockDocs[i];
          const { item, itemKey } = stockChecks[i];
          
          if (doc.exists) {
            const data = doc.data();
            const available = (data.stock || 0) - (data.reserved || 0);
            
            if (available < item.quantity) {
              throw new Error(`Stock insuficiente para "${item.name}". Disponible: ${available}, Solicitado: ${item.quantity}`);
            }
          }
          // If doc doesn't exist, assume unlimited stock (no inventory control for this item)
        }

        // Create order document
        const orderRef = db.collection('inventario').doc(CATALOG_KEY).collection('orders').doc(orderId);
        transaction.set(orderRef, order);

        // Reserve stock for each item
        for (let i = 0; i < stockChecks.length; i++) {
          const doc = stockDocs[i];
          const { ref, item } = stockChecks[i];
          
          if (doc.exists) {
            const data = doc.data();
            const newReserved = (data.reserved || 0) + item.quantity;
            const newAvailable = (data.stock || 0) - newReserved;
            
            transaction.update(ref, {
              reserved: newReserved,
              available: newAvailable,
              updatedAt: now.toISOString()
            });
          }
        }
      });

      console.log(`✅ Order ${orderId} created, stock reserved`);
      return { success: true, orderId, order };

    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // Format order for WhatsApp message
  function formatOrderForWhatsApp(order, catalogName, clientName) {
    const lines = [];
    
    lines.push(`📦 *Nuevo Pedido #${order.id}*`);
    lines.push('━━━━━━━━━━━━━━━━━━');
    lines.push('');
    
    if (catalogName) {
      lines.push(`🏪 *${catalogName}*`);
      lines.push('');
    }
    
    lines.push(`👤 *Cliente:* ${order.customer.name}`);
    lines.push(`📱 *Teléfono:* ${order.customer.phone}`);
    
    if (order.customer.address) {
      lines.push(`📍 *Dirección:* ${order.customer.address}`);
    }
    
    lines.push('');
    lines.push('🛒 *Productos:*');
    
    order.items.forEach(item => {
      let itemLine = `• ${item.name}`;
      if (item.variantName) {
        itemLine += ` (${item.variantName})`;
      }
      itemLine += ` x${item.quantity} - ${item.priceText}`;
      lines.push(itemLine);
    });
    
    lines.push('');
    
    if (order.deliveryCost > 0) {
      lines.push(`📦 *Envío:* $${order.deliveryCost.toLocaleString('es-AR')}`);
    }
    
    lines.push(`💰 *Total:* $${order.total.toLocaleString('es-AR')}`);
    
    if (order.customer.notes) {
      lines.push('');
      lines.push(`📝 *Notas:* ${order.customer.notes}`);
    }
    
    if (order.customer.paymentMethod) {
      lines.push(`💳 *Pago:* ${order.customer.paymentMethod}`);
    }
    
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━');
    lines.push('⚠️ _Stock reservado automáticamente._');
    lines.push('_Confirmar pedido en el panel admin._');
    
    return lines.join('\n');
  }

  // Expose functions for cart integration
  window.SCG_Orders = {
    createOrder: createOrder,
    formatOrderForWhatsApp: formatOrderForWhatsApp,
    generateOrderId: generateOrderId
  };

  // Initialize Firebase on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebase);
  } else {
    initFirebase();
  }

})();
