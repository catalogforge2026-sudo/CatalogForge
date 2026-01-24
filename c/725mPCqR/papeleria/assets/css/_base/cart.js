/**
 * Shopping Cart Module
 * Reusable cart with WhatsApp integration
 */

(function() {
  'use strict';

  // Cart state
  let cart = [];
  const STORAGE_KEY = 'scg_cart_' + (window.CATALOG_DATA?.catalog?.id || 'default');

  // DOM Elements
  let floatingBar, modal, modalOverlay, toast;

  // Config from catalog data
  const config = {
    enabled: window.CATALOG_DATA?.cart?.enabled || false,
    whatsappNumber: window.CATALOG_DATA?.client?.phone || '',
    whatsappMessage: window.CATALOG_DATA?.cart?.whatsappMessage || 'Hola! Quiero hacer el siguiente pedido:',
    buttonText: window.CATALOG_DATA?.cart?.buttonText || 'Agregar',
    clientName: window.CATALOG_DATA?.client?.name || '',
    catalogName: window.CATALOG_DATA?.catalog?.name || ''
  };

  // Initialize
  function init() {
    if (!config.enabled) return;
    
    loadCart();
    createCartUI();
    attachEventListeners();
    updateUI();
  }

  // Load cart from localStorage
  function loadCart() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        cart = JSON.parse(saved);
      }
    } catch (e) {
      cart = [];
    }
  }

  // Save cart to localStorage
  function saveCart() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.warn('Could not save cart to localStorage');
    }
  }

  // Create cart UI elements
  function createCartUI() {
    // Toast
    toast = document.createElement('div');
    toast.className = 'cart-toast';
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span class="cart-toast-text"></span>
    `;
    document.body.appendChild(toast);

    // Floating Bar
    floatingBar = document.createElement('div');
    floatingBar.className = 'cart-floating-bar';
    floatingBar.innerHTML = `
      <div class="cart-floating-info">
        <div class="cart-floating-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          <span class="cart-floating-badge">0</span>
        </div>
        <div class="cart-floating-text">
          <div class="cart-floating-count">0 productos</div>
          <div class="cart-floating-total">$0</div>
        </div>
      </div>
      <button class="cart-floating-btn">
        Ver carrito
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    `;
    document.body.appendChild(floatingBar);

    // Modal
    modalOverlay = document.createElement('div');
    modalOverlay.className = 'cart-modal-overlay';
    modalOverlay.innerHTML = `
      <div class="cart-modal">
        <div class="cart-modal-header">
          <h2 class="cart-modal-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            Tu Pedido
          </h2>
          <div class="cart-modal-actions">
            <button class="cart-clear-btn" id="cart-clear" title="Vaciar carrito">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Vaciar
            </button>
            <button class="cart-modal-close">&times;</button>
          </div>
        </div>
        <div class="cart-modal-body">
          <div class="cart-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <p>Tu carrito está vacío</p>
          </div>
          <div class="cart-items"></div>
        </div>
        <div class="cart-summary" style="display: none;">
          <div class="cart-summary-row">
            <span>Subtotal</span>
            <span class="cart-summary-subtotal">$0</span>
          </div>
          <div class="cart-summary-row total">
            <span>Total</span>
            <span class="cart-summary-value">$0</span>
          </div>
        </div>
        <div class="cart-form" style="display: none;">
          <div class="cart-form-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            Datos para el pedido
          </div>
          <div class="cart-form-group">
            <input type="text" class="cart-form-input" id="cart-name" placeholder="Nombre completo *" required>
          </div>
          <div class="cart-form-group">
            <input type="tel" class="cart-form-input" id="cart-phone" placeholder="Teléfono / WhatsApp *" required>
          </div>
          <button class="cart-submit" id="cart-submit">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Enviar pedido por WhatsApp
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);
    modal = modalOverlay.querySelector('.cart-modal');

    // Add "Add to cart" buttons to items
    addCartButtons();
  }

  // Add cart buttons to items
  function addCartButtons() {
    const items = document.querySelectorAll('.item-card, .item-row');
    items.forEach(item => {
      // Get item data from data attributes (preferred) or content (fallback)
      const itemId = item.dataset.itemId;
      const itemName = item.dataset.itemName || item.querySelector('.item-name')?.textContent?.trim();
      const hasVariants = item.dataset.hasVariants === 'true';
      
      // PRIORITY: Use data-item-price (raw numeric value from DB) first
      // This avoids locale parsing issues (e.g., "7.500" in Argentina = 7500, not 7.5)
      let price = 0;
      let priceText = item.dataset.itemPriceText || '';
      
      // data-item-price contains the raw numeric value from the database
      const rawPrice = item.dataset.itemPrice;
      if (rawPrice && rawPrice !== '' && rawPrice !== 'null' && rawPrice !== 'undefined') {
        price = parseFloat(rawPrice);
      }
      
      // Fallback to DOM only if data attribute not available
      if (!priceText) {
        const priceEl = item.querySelector('.item-price .price-amount, .price-amount, .item-price');
        priceText = priceEl?.textContent?.trim() || '';
      }
      
      // Only parse from text as last resort (when no data-item-price)
      if (price === 0 && priceText) {
        // Parse price text - handle different locales:
        // Argentina: "$ 7.500" = 7500 (dot as thousands separator)
        // US: "$7,500" = 7500 (comma as thousands separator)
        // Europe: "7.500,00 €" = 7500 (dot thousands, comma decimals)
        const priceMatch = priceText.match(/[\d.,]+/);
        if (priceMatch) {
          let numStr = priceMatch[0];
          // Detect format: if has both . and , check which comes last
          const lastDot = numStr.lastIndexOf('.');
          const lastComma = numStr.lastIndexOf(',');
          
          if (lastDot > lastComma) {
            // Dot is decimal separator (US format): 7,500.00
            numStr = numStr.replace(/,/g, '');
          } else if (lastComma > lastDot) {
            // Comma is decimal separator (EU/AR format): 7.500,00
            numStr = numStr.replace(/\./g, '').replace(',', '.');
          } else if (lastDot >= 0 && lastComma < 0) {
            // Only dots - could be thousands (7.500) or decimals (7.50)
            // If 3 digits after dot, it's thousands separator
            const afterDot = numStr.split('.')[1];
            if (afterDot && afterDot.length === 3) {
              numStr = numStr.replace(/\./g, '');
            }
          } else if (lastComma >= 0 && lastDot < 0) {
            // Only commas - could be thousands (7,500) or decimals (7,50)
            const afterComma = numStr.split(',')[1];
            if (afterComma && afterComma.length === 3) {
              numStr = numStr.replace(/,/g, '');
            } else {
              numStr = numStr.replace(',', '.');
            }
          }
          price = parseFloat(numStr) || 0;
        }
      }
      
      const imageEl = item.querySelector('.item-image img');
      const imageUrl = imageEl?.src || '';

      // For items with variants, we need to handle differently
      if (hasVariants) {
        const variantSelect = item.querySelector('.variant-select');
        if (variantSelect) {
          // Create button for variant items
          const btn = document.createElement('button');
          btn.className = 'item-add-cart variant-add-btn';
          btn.disabled = true; // Disabled until variant is selected
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            ${config.buttonText}
          `;
          btn.dataset.itemId = itemId || itemName;
          btn.dataset.itemName = itemName;
          btn.dataset.itemImage = imageUrl;
          btn.dataset.hasVariants = 'true';

          // Listen for variant selection
          variantSelect.addEventListener('change', function() {
            const selected = this.options[this.selectedIndex];
            if (selected && selected.value) {
              btn.disabled = false;
              btn.dataset.variantId = selected.value;
              btn.dataset.variantName = selected.dataset.name;
              btn.dataset.itemPrice = selected.dataset.price;
              btn.dataset.itemPriceText = selected.dataset.priceText;
              
              // Update price display
              const priceDisplay = item.querySelector('.variant-price .price-amount');
              if (priceDisplay) {
                priceDisplay.textContent = selected.dataset.priceText;
              }
            } else {
              btn.disabled = true;
            }
          });

          // Find or create footer area
          let footer = item.querySelector('.item-footer, .item-actions');
          if (!footer) {
            footer = document.createElement('div');
            footer.className = 'item-footer';
            item.appendChild(footer);
          }
          footer.appendChild(btn);
        }
        return; // Skip regular button creation for variant items
      }

      // Skip items without name or price (for non-variant items)
      if (!itemName || price <= 0) return;

      // Create button for regular items
      const btn = document.createElement('button');
      btn.className = 'item-add-cart';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        ${config.buttonText}
      `;
      btn.dataset.itemId = itemId || itemName;
      btn.dataset.itemName = itemName;
      btn.dataset.itemPrice = price;
      btn.dataset.itemImage = imageUrl;
      btn.dataset.itemPriceText = priceText || formatPrice(price);

      // Find or create footer area
      let footer = item.querySelector('.item-footer, .item-actions');
      if (!footer) {
        footer = document.createElement('div');
        footer.className = 'item-footer';
        item.appendChild(footer);
      }
      footer.appendChild(btn);
    });
  }

  // Attach event listeners
  function attachEventListeners() {
    // Add to cart buttons
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('.item-add-cart');
      if (btn) {
        e.preventDefault();
        
        // Check if this is a variant item
        if (btn.dataset.hasVariants === 'true') {
          if (!btn.dataset.variantId) {
            showToast('⚠️ Seleccioná una opción primero');
            return;
          }
          addToCart({
            id: btn.dataset.itemId + '_' + btn.dataset.variantId,
            name: btn.dataset.itemName + ' - ' + btn.dataset.variantName,
            price: parseFloat(btn.dataset.itemPrice),
            priceText: btn.dataset.itemPriceText,
            image: btn.dataset.itemImage,
            variantId: btn.dataset.variantId,
            variantName: btn.dataset.variantName
          });
        } else {
          addToCart({
            id: btn.dataset.itemId,
            name: btn.dataset.itemName,
            price: parseFloat(btn.dataset.itemPrice),
            priceText: btn.dataset.itemPriceText,
            image: btn.dataset.itemImage
          });
        }
      }
    });

    // Floating bar click
    floatingBar.querySelector('.cart-floating-btn').addEventListener('click', openModal);

    // Modal close
    modalOverlay.querySelector('.cart-modal-close').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', function(e) {
      if (e.target === modalOverlay) closeModal();
    });

    // Submit order
    document.getElementById('cart-submit').addEventListener('click', submitOrder);

    // Clear cart button
    document.getElementById('cart-clear').addEventListener('click', function() {
      if (cart.length > 0 && confirm('¿Vaciar todo el carrito?')) {
        clearCart();
        showToast('🗑️ Carrito vaciado');
      }
    });

    // Quantity buttons (delegated)
    modal.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const itemId = btn.dataset.itemId;
      const action = btn.dataset.action;

      if (action === 'increase') {
        updateQuantity(itemId, 1);
      } else if (action === 'decrease') {
        updateQuantity(itemId, -1);
      } else if (action === 'remove') {
        removeFromCart(itemId);
      }
    });
  }

  // Add item to cart
  function addToCart(item) {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
      existing.qty++;
    } else {
      cart.push({ ...item, qty: 1 });
    }
    saveCart();
    updateUI();
    showToast(`✅ ${item.name} agregado al carrito`);
  }

  // Update quantity
  function updateQuantity(itemId, delta) {
    const item = cart.find(i => i.id === itemId);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
      removeFromCart(itemId);
    } else {
      saveCart();
      updateUI();
    }
  }

  // Remove from cart
  function removeFromCart(itemId) {
    cart = cart.filter(i => i.id !== itemId);
    saveCart();
    updateUI();
  }

  // Clear cart
  function clearCart() {
    cart = [];
    saveCart();
    updateUI();
  }

  // Calculate totals
  function getCartTotals() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    return { count, total };
  }

  // Format price - uses locale from catalog config or defaults to es-AR
  function formatPrice(price) {
    const locale = window.CATALOG_DATA?.catalog?.config?.locale || 'es-AR';
    return '$$' + price.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // Update UI
  function updateUI() {
    const { count, total } = getCartTotals();

    // Floating bar visibility
    const isVisible = count > 0;
    floatingBar.classList.toggle('visible', isVisible);
    
    // Add class to body for footer spacing (fallback for browsers without :has())
    document.body.classList.toggle('cart-bar-visible', isVisible);
    
    floatingBar.querySelector('.cart-floating-badge').textContent = count;
    floatingBar.querySelector('.cart-floating-count').textContent = count + ' producto' + (count !== 1 ? 's' : '');
    floatingBar.querySelector('.cart-floating-total').textContent = formatPrice(total);

    // Modal items
    const itemsContainer = modal.querySelector('.cart-items');
    const emptyMessage = modal.querySelector('.cart-empty');
    const summary = modal.querySelector('.cart-summary');
    const form = modal.querySelector('.cart-form');

    if (count === 0) {
      emptyMessage.style.display = 'block';
      itemsContainer.innerHTML = '';
      summary.style.display = 'none';
      form.style.display = 'none';
    } else {
      emptyMessage.style.display = 'none';
      summary.style.display = 'block';
      form.style.display = 'block';

      itemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item">
          ${item.image ? `<div class="cart-item-image"><img src="${item.image}" alt="${item.name}"></div>` : ''}
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${item.priceText} x ${item.qty} = ${formatPrice(item.price * item.qty)}</div>
          </div>
          <div class="cart-item-qty">
            <button data-action="decrease" data-item-id="${item.id}">−</button>
            <span>${item.qty}</span>
            <button data-action="increase" data-item-id="${item.id}">+</button>
          </div>
          <button class="cart-item-remove" data-action="remove" data-item-id="${item.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      `).join('');

      summary.querySelector('.cart-summary-subtotal').textContent = formatPrice(total);
      summary.querySelector('.cart-summary-value').textContent = formatPrice(total);
    }
  }

  // Show toast
  function showToast(message) {
    toast.querySelector('.cart-toast-text').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // Open modal
  function openModal() {
    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  // Close modal
  function closeModal() {
    modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Submit order via WhatsApp
  function submitOrder() {
    const nameInput = document.getElementById('cart-name');
    const phoneInput = document.getElementById('cart-phone');

    // Validate
    let valid = true;
    if (!nameInput.value.trim()) {
      nameInput.classList.add('error');
      valid = false;
    } else {
      nameInput.classList.remove('error');
    }
    if (!phoneInput.value.trim()) {
      phoneInput.classList.add('error');
      valid = false;
    } else {
      phoneInput.classList.remove('error');
    }

    if (!valid) {
      showToast('⚠️ Completá los campos requeridos');
      return;
    }

    // Build message
    const { total } = getCartTotals();
    let message = config.whatsappMessage + '\n\n';
    message += `📋 *Pedido de ${config.catalogName}*\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;

    cart.forEach(item => {
      message += `• ${item.name}\n`;
      message += `  ${item.qty} x ${item.priceText} = ${formatPrice(item.price * item.qty)}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 *TOTAL: ${formatPrice(total)}*\n\n`;
    message += `👤 *Cliente:* ${nameInput.value.trim()}\n`;
    message += `📱 *Teléfono:* ${phoneInput.value.trim()}\n`;

    // Clean phone number
    let phone = config.whatsappNumber.replace(/\D/g, '');
    if (!phone.startsWith('54')) {
      phone = '54' + phone;
    }

    // Open WhatsApp
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    // Clear cart after sending
    clearCart();
    closeModal();
    nameInput.value = '';
    phoneInput.value = '';
    showToast('✅ Pedido enviado!');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
