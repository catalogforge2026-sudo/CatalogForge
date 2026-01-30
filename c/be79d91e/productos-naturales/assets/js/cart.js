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
  const cartData = window.CATALOG_DATA?.cart || {};
  const formConfig = cartData.formConfig || {};
  
  const config = {
    enabled: cartData.enabled || false,
    whatsappNumber: window.CATALOG_DATA?.client?.phone || '',
    whatsappMessage: cartData.whatsappMessage || 'Hola! Quiero hacer el siguiente pedido:',
    buttonText: cartData.buttonText || 'Agregar',
    clientName: window.CATALOG_DATA?.client?.name || '',
    catalogName: window.CATALOG_DATA?.catalog?.name || '',
    // Form configuration
    form: {
      requireName: formConfig.requireName !== false,
      requirePhone: formConfig.requirePhone !== false,
      showAddress: formConfig.showAddress || false,
      addressRequired: formConfig.addressRequired || false,
      addressPlaceholder: formConfig.addressPlaceholder || 'Dirección de envío',
      showNotes: formConfig.showNotes || false,
      notesPlaceholder: formConfig.notesPlaceholder || 'Notas adicionales',
      showPaymentMethod: formConfig.showPaymentMethod || false,
      paymentMethods: formConfig.paymentMethods || [],
      paymentRequired: formConfig.paymentRequired || false,
      showDeliveryZone: formConfig.showDeliveryZone || false,
      deliveryZones: formConfig.deliveryZones || [],
      deliveryRequired: formConfig.deliveryRequired || false,
      customFields: formConfig.customFields || [],
    }
  };

  // Form state for dynamic fields
  let formState = {
    deliveryZone: null,
    deliveryCost: 0
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
        
        // Validate cart items - clear if prices look corrupted
        // (e.g., price is suspiciously low like 12 instead of 12000)
        let needsClear = false;
        for (const item of cart) {
          // If price is less than 100 but priceText suggests thousands, clear cart
          if (item.price < 100 && item.priceText) {
            const textMatch = item.priceText.match(/[\d.,]+/);
            if (textMatch) {
              let numStr = textMatch[0];
              // Remove thousands separators
              if (/^\d{1,3}(\.\d{3})+$/.test(numStr)) {
                numStr = numStr.replace(/\./g, '');
              } else if (/^\d{1,3}(,\d{3})+$/.test(numStr)) {
                numStr = numStr.replace(/,/g, '');
              }
              const textPrice = parseFloat(numStr);
              if (textPrice > item.price * 10) {
                needsClear = true;
                break;
              }
            }
          }
        }
        
        if (needsClear) {
          console.warn('Cart prices look corrupted, clearing cart');
          cart = [];
          localStorage.removeItem(STORAGE_KEY);
        }
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
          <div id="cart-dynamic-fields"></div>
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

    // Customization Modal (for items with ingredients)
    createCustomizationModal();

    // Add "Add to cart" buttons to items
    addCartButtons();
    
    // Render dynamic form fields
    renderDynamicFields();
  }

  // Customization modal state
  let customizationModal = null;
  let pendingItem = null;

  // Create customization modal
  function createCustomizationModal() {
    customizationModal = document.createElement('div');
    customizationModal.className = 'customization-modal-overlay';
    customizationModal.innerHTML = `
      <div class="customization-modal">
        <div class="customization-modal-header">
          <h3 class="customization-modal-title">Personalizá tu pedido</h3>
          <button class="customization-modal-close">&times;</button>
        </div>
        <div class="customization-modal-body">
          <p class="customization-modal-subtitle">Deseleccioná lo que no querés:</p>
          <div class="customization-options"></div>
        </div>
        <div class="customization-modal-footer">
          <button class="customization-confirm-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            Agregar al carrito
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(customizationModal);

    // Event listeners for customization modal
    customizationModal.querySelector('.customization-modal-close').addEventListener('click', closeCustomizationModal);
    customizationModal.addEventListener('click', function(e) {
      if (e.target === customizationModal) closeCustomizationModal();
    });
    customizationModal.querySelector('.customization-confirm-btn').addEventListener('click', confirmCustomization);
  }

  // Open customization modal
  function openCustomizationModal(itemData, customizations) {
    pendingItem = { ...itemData, customizations };
    
    // Update modal title with item name
    customizationModal.querySelector('.customization-modal-title').textContent = itemData.name;
    
    // Render customization options (all checked by default)
    const optionsContainer = customizationModal.querySelector('.customization-options');
    optionsContainer.innerHTML = customizations.map(c => `
      <label class="customization-option">
        <input type="checkbox" checked data-id="${c.id}" data-name="${c.name}">
        <span class="customization-checkbox"></span>
        <span class="customization-name">${c.name}</span>
      </label>
    `).join('');
    
    customizationModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  // Close customization modal
  function closeCustomizationModal() {
    customizationModal.classList.remove('open');
    document.body.style.overflow = '';
    pendingItem = null;
  }

  // Confirm customization and add to cart
  function confirmCustomization() {
    if (!pendingItem) return;
    
    // Get unchecked items (exclusions)
    const checkboxes = customizationModal.querySelectorAll('.customization-options input[type="checkbox"]');
    const exclusions = [];
    checkboxes.forEach(cb => {
      if (!cb.checked) {
        exclusions.push(cb.dataset.name);
      }
    });
    
    // Create unique ID if there are exclusions
    let itemId = pendingItem.id;
    if (exclusions.length > 0) {
      // Create a hash of exclusions to make unique cart entries
      itemId = pendingItem.id + '_exc_' + exclusions.sort().join('_').toLowerCase().replace(/\s+/g, '-');
    }
    
    // Add to cart with exclusions
    addToCart({
      id: itemId,
      name: pendingItem.name,
      price: pendingItem.price,
      priceText: pendingItem.priceText,
      image: pendingItem.image,
      exclusions: exclusions,
      variantId: pendingItem.variantId,
      variantName: pendingItem.variantName
    });
    
    closeCustomizationModal();
  }

  // Render dynamic form fields based on config
  function renderDynamicFields() {
    const container = document.getElementById('cart-dynamic-fields');
    if (!container) return;
    
    let html = '';
    const form = config.form;
    
    // Address field
    if (form.showAddress) {
      const required = form.addressRequired ? '*' : '';
      const placeholder = form.addressPlaceholder || 'Dirección de envío';
      html += `
        <div class="cart-form-group">
          <textarea class="cart-form-input cart-form-textarea" id="cart-address" 
            placeholder="${placeholder} ${required}" 
            ${form.addressRequired ? 'required' : ''}
            rows="2"></textarea>
        </div>
      `;
    }
    
    // Delivery zones selector
    if (form.showDeliveryZone && form.deliveryZones?.length > 0) {
      const required = form.deliveryRequired ? '*' : '';
      html += `
        <div class="cart-form-group">
          <label class="cart-form-label">🚚 Zona de envío ${required}</label>
          <select class="cart-form-input cart-form-select" id="cart-delivery-zone" 
            ${form.deliveryRequired ? 'required' : ''}>
            <option value="">Seleccionar zona...</option>
            ${form.deliveryZones.map(zone => `
              <option value="${zone.id}" data-cost="${zone.toConsult ? 0 : zone.cost}" data-time="${zone.estimatedTime || ''}" data-name="${zone.name}" data-to-consult="${zone.toConsult || false}">
                ${zone.name} ${zone.toConsult ? '(A consultar)' : (zone.cost > 0 ? '(+' + formatPrice(zone.cost) + ')' : '(Gratis)')}
                ${zone.estimatedTime ? ' - ' + zone.estimatedTime : ''}
              </option>
            `).join('')}
          </select>
        </div>
      `;
    }
    
    // Payment methods selector
    if (form.showPaymentMethod && form.paymentMethods?.length > 0) {
      const required = form.paymentRequired ? '*' : '';
      html += `
        <div class="cart-form-group">
          <label class="cart-form-label">💳 Forma de pago ${required}</label>
          <select class="cart-form-input cart-form-select" id="cart-payment-method" 
            ${form.paymentRequired ? 'required' : ''}>
            <option value="">Seleccionar...</option>
            ${form.paymentMethods.map(opt => `
              <option value="${opt.id}">${opt.icon ? opt.icon + ' ' : ''}${opt.label}${opt.description ? ' - ' + opt.description : ''}</option>
            `).join('')}
          </select>
        </div>
      `;
    }
    
    // Notes field
    if (form.showNotes) {
      const placeholder = form.notesPlaceholder || 'Notas adicionales';
      html += `
        <div class="cart-form-group">
          <textarea class="cart-form-input cart-form-textarea" id="cart-notes" 
            placeholder="${placeholder}" rows="2"></textarea>
        </div>
      `;
    }
    
    // Custom fields
    if (form.customFields?.length > 0) {
      form.customFields.forEach(field => {
        const required = field.required ? '*' : '';
        if (field.type === 'text') {
          html += `
            <div class="cart-form-group">
              <input type="text" class="cart-form-input" id="cart-custom-${field.id}" 
                placeholder="${field.label} ${required}" 
                ${field.required ? 'required' : ''}>
            </div>
          `;
        } else if (field.type === 'textarea') {
          html += `
            <div class="cart-form-group">
              <textarea class="cart-form-input cart-form-textarea" id="cart-custom-${field.id}" 
                placeholder="${field.placeholder || field.label} ${required}" 
                ${field.required ? 'required' : ''} rows="2"></textarea>
            </div>
          `;
        } else if (field.type === 'select' && field.options?.length > 0) {
          html += `
            <div class="cart-form-group">
              <label class="cart-form-label">${field.label} ${required}</label>
              <select class="cart-form-input cart-form-select" id="cart-custom-${field.id}" 
                ${field.required ? 'required' : ''}>
                <option value="">Seleccionar...</option>
                ${field.options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
              </select>
            </div>
          `;
        } else if (field.type === 'checkbox') {
          html += `
            <div class="cart-form-group cart-form-checkbox">
              <label>
                <input type="checkbox" id="cart-custom-${field.id}" ${field.required ? 'required' : ''}>
                <span>${field.label} ${required}</span>
              </label>
            </div>
          `;
        }
      });
    }
    
    container.innerHTML = html;
    
    // Attach delivery zone change listener
    const deliverySelect = document.getElementById('cart-delivery-zone');
    if (deliverySelect) {
      deliverySelect.addEventListener('change', function() {
        const selected = this.options[this.selectedIndex];
        const toConsult = selected.dataset.toConsult === 'true';
        formState.deliveryZone = selected.value ? {
          id: selected.value,
          name: selected.dataset.name || selected.textContent.split('(')[0].trim(),
          cost: toConsult ? 0 : (parseFloat(selected.dataset.cost) || 0),
          time: selected.dataset.time || '',
          toConsult: toConsult
        } : null;
        formState.deliveryCost = formState.deliveryZone?.cost || 0;
        updateUI();
      });
    }
  }

  // Add cart buttons to items
  function addCartButtons() {
    // Add buttons to regular items
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
        // Handle locale-formatted numbers where dot is thousands separator
        // Examples: "12.000" = 12000, "1.234.567" = 1234567
        let numStr = rawPrice.trim();
        
        // Check if it looks like a locale-formatted number with dots as thousands separators
        // Pattern: digits followed by groups of .XXX (3 digits after each dot)
        if (/^\d{1,3}(\.\d{3})+$/.test(numStr)) {
          // Remove all dots - they are thousands separators
          numStr = numStr.replace(/\./g, '');
        }
        
        // Also handle comma as thousands separator (e.g., "12,000")
        if (/^\d{1,3}(,\d{3})+$/.test(numStr)) {
          numStr = numStr.replace(/,/g, '');
        }
        
        price = parseFloat(numStr);
        
        // Sanity check: if price is suspiciously low compared to priceText, try parsing priceText
        if (price < 100 && priceText) {
          const textMatch = priceText.match(/[\d.,]+/);
          if (textMatch) {
            let textNum = textMatch[0];
            // Remove thousands separators
            if (/^\d{1,3}(\.\d{3})+$/.test(textNum)) {
              textNum = textNum.replace(/\./g, '');
            } else if (/^\d{1,3}(,\d{3})+$/.test(textNum)) {
              textNum = textNum.replace(/,/g, '');
            }
            const textPrice = parseFloat(textNum);
            // If text price is much higher, use it instead
            if (textPrice > price * 10) {
              price = textPrice;
            }
          }
        }
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
          // Debug log
          console.log('[Cart] Parsed price from text:', priceText, '-> numStr:', numStr, '-> price:', price);
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

      // Check for customizations
      const hasCustomizations = item.dataset.hasCustomizations === 'true';
      let customizations = [];
      if (hasCustomizations && item.dataset.customizations) {
        try {
          customizations = JSON.parse(item.dataset.customizations);
        } catch (e) {
          console.warn('Could not parse customizations:', e);
        }
      }

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
      btn.dataset.hasCustomizations = hasCustomizations;
      if (hasCustomizations) {
        btn.dataset.customizations = JSON.stringify(customizations);
      }

      // Find or create footer area
      let footer = item.querySelector('.item-footer, .item-actions');
      if (!footer) {
        footer = document.createElement('div');
        footer.className = 'item-footer';
        item.appendChild(footer);
      }
      footer.appendChild(btn);
    });

    // Add buttons to promotions with price
    const promos = document.querySelectorAll('.promo-card.has-price');
    promos.forEach(promo => {
      const promoId = promo.dataset.promoId;
      const promoName = promo.dataset.promoName;
      const rawPrice = promo.dataset.promoPrice;
      const priceText = promo.dataset.promoPriceText;
      
      if (!promoId || !promoName || !rawPrice || rawPrice === 'null') return;
      
      const price = parseFloat(rawPrice);
      if (price <= 0) return;
      
      const imageEl = promo.querySelector('.promo-card-visual img');
      const imageUrl = imageEl?.src || '';
      
      // Create button for promo
      const btn = document.createElement('button');
      btn.className = 'promo-add-cart';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        ${config.buttonText}
      `;
      btn.dataset.itemId = 'promo_' + promoId;
      btn.dataset.itemName = promoName;
      btn.dataset.itemPrice = price;
      btn.dataset.itemImage = imageUrl;
      btn.dataset.itemPriceText = priceText || formatPrice(price);
      
      // Find or create footer area in promo card
      let footer = promo.querySelector('.promo-card-footer');
      if (!footer) {
        footer = document.createElement('div');
        footer.className = 'promo-card-footer';
        promo.querySelector('.promo-card-text').appendChild(footer);
      }
      footer.appendChild(btn);
    });
  }

  // Attach event listeners
  function attachEventListeners() {
    // Add to cart buttons (items and promos)
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('.item-add-cart, .promo-add-cart');
      if (btn) {
        e.preventDefault();
        
        // Check if this is a variant item
        if (btn.dataset.hasVariants === 'true') {
          if (!btn.dataset.variantId) {
            showToast('⚠️ Seleccioná una opción primero');
            return;
          }
          // For variants, check if parent item has customizations
          const itemCard = btn.closest('.item-card');
          const hasCustomizations = itemCard?.dataset.hasCustomizations === 'true';
          let customizations = [];
          if (hasCustomizations && itemCard.dataset.customizations) {
            try {
              customizations = JSON.parse(itemCard.dataset.customizations);
            } catch (e) {}
          }
          
          if (hasCustomizations && customizations.length > 0) {
            openCustomizationModal({
              id: btn.dataset.itemId + '_' + btn.dataset.variantId,
              name: btn.dataset.itemName + ' - ' + btn.dataset.variantName,
              price: parseFloat(btn.dataset.itemPrice),
              priceText: btn.dataset.itemPriceText,
              image: btn.dataset.itemImage,
              variantId: btn.dataset.variantId,
              variantName: btn.dataset.variantName
            }, customizations);
          } else {
            addToCart({
              id: btn.dataset.itemId + '_' + btn.dataset.variantId,
              name: btn.dataset.itemName + ' - ' + btn.dataset.variantName,
              price: parseFloat(btn.dataset.itemPrice),
              priceText: btn.dataset.itemPriceText,
              image: btn.dataset.itemImage,
              variantId: btn.dataset.variantId,
              variantName: btn.dataset.variantName
            });
          }
        } else {
          // Check if item has customizations
          const hasCustomizations = btn.dataset.hasCustomizations === 'true';
          let customizations = [];
          if (hasCustomizations && btn.dataset.customizations) {
            try {
              customizations = JSON.parse(btn.dataset.customizations);
            } catch (e) {}
          }
          
          if (hasCustomizations && customizations.length > 0) {
            // Open customization modal
            openCustomizationModal({
              id: btn.dataset.itemId,
              name: btn.dataset.itemName,
              price: parseFloat(btn.dataset.itemPrice),
              priceText: btn.dataset.itemPriceText,
              image: btn.dataset.itemImage
            }, customizations);
          } else {
            // Add directly to cart
            addToCart({
              id: btn.dataset.itemId,
              name: btn.dataset.itemName,
              price: parseFloat(btn.dataset.itemPrice),
              priceText: btn.dataset.itemPriceText,
              image: btn.dataset.itemImage
            });
          }
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
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const delivery = formState.deliveryCost || 0;
    const total = subtotal + delivery;
    return { count, subtotal, delivery, total };
  }

  // Format price - uses locale and format from catalog config
  function formatPrice(price) {
    const config = window.CATALOG_DATA?.catalog?.config || {};
    const locale = config.locale || 'es-AR';
    const priceFormat = config.priceFormat || '$ {price}';
    
    const formattedNumber = price.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return priceFormat.replace('{price}', formattedNumber);
  }

  // Update UI
  function updateUI() {
    const { count, subtotal, delivery, total } = getCartTotals();

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
            ${item.exclusions && item.exclusions.length > 0 ? `
              <div class="cart-item-exclusions">❌ Sin ${item.exclusions.join(', Sin ')}</div>
            ` : ''}
            <div class="cart-item-price">${formatPrice(item.price)} x ${item.qty} = ${formatPrice(item.price * item.qty)}</div>
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

      // Update summary with subtotal, delivery, and total
      summary.querySelector('.cart-summary-subtotal').textContent = formatPrice(subtotal);
      
      // Show/hide delivery row
      let deliveryRow = summary.querySelector('.cart-summary-delivery');
      const hasDeliveryZone = formState.deliveryZone !== null;
      const isToConsult = formState.deliveryZone?.toConsult === true;
      
      if (hasDeliveryZone) {
        if (!deliveryRow) {
          const subtotalRow = summary.querySelector('.cart-summary-row');
          deliveryRow = document.createElement('div');
          deliveryRow.className = 'cart-summary-row cart-summary-delivery';
          deliveryRow.innerHTML = `<span>Envío</span><span class="cart-delivery-value"></span>`;
          subtotalRow.after(deliveryRow);
        }
        if (isToConsult) {
          deliveryRow.querySelector('.cart-delivery-value').textContent = 'A consultar';
          deliveryRow.querySelector('.cart-delivery-value').style.color = '#f97316';
        } else {
          deliveryRow.querySelector('.cart-delivery-value').textContent = delivery > 0 ? formatPrice(delivery) : 'Gratis';
          deliveryRow.querySelector('.cart-delivery-value').style.color = '';
        }
        deliveryRow.style.display = 'flex';
      } else if (deliveryRow) {
        deliveryRow.style.display = 'none';
      }
      
      // Show total with note if delivery is to consult
      const totalValue = summary.querySelector('.cart-summary-value');
      if (isToConsult) {
        totalValue.textContent = formatPrice(subtotal) + ' + envío';
      } else {
        totalValue.textContent = formatPrice(total);
      }
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
    const addressInput = document.getElementById('cart-address');
    const deliverySelect = document.getElementById('cart-delivery-zone');
    const paymentSelect = document.getElementById('cart-payment-method');
    const notesInput = document.getElementById('cart-notes');
    const form = config.form;

    // Validate required fields
    let valid = true;
    
    if (form.requireName && !nameInput.value.trim()) {
      nameInput.classList.add('error');
      valid = false;
    } else {
      nameInput.classList.remove('error');
    }
    
    if (form.requirePhone && !phoneInput.value.trim()) {
      phoneInput.classList.add('error');
      valid = false;
    } else {
      phoneInput.classList.remove('error');
    }
    
    // Validate dynamic required fields
    if (addressInput && form.addressRequired && !addressInput.value.trim()) {
      addressInput.classList.add('error');
      valid = false;
    } else if (addressInput) {
      addressInput.classList.remove('error');
    }
    
    if (deliverySelect && form.deliveryRequired && !deliverySelect.value) {
      deliverySelect.classList.add('error');
      valid = false;
    } else if (deliverySelect) {
      deliverySelect.classList.remove('error');
    }
    
    if (paymentSelect && form.paymentRequired && !paymentSelect.value) {
      paymentSelect.classList.add('error');
      valid = false;
    } else if (paymentSelect) {
      paymentSelect.classList.remove('error');
    }
    
    // Validate custom required fields
    if (form.customFields?.length > 0) {
      form.customFields.forEach(field => {
        if (field.required) {
          const input = document.getElementById(`cart-custom-${field.id}`);
          if (input) {
            const value = field.type === 'checkbox' ? input.checked : input.value.trim();
            if (!value) {
              input.classList.add('error');
              valid = false;
            } else {
              input.classList.remove('error');
            }
          }
        }
      });
    }

    if (!valid) {
      showToast('⚠️ Completá los campos requeridos');
      return;
    }

    // Build message
    const { subtotal, delivery, total } = getCartTotals();
    const isToConsult = formState.deliveryZone?.toConsult === true;
    let message = config.whatsappMessage + '\n\n';
    message += `📋 *Pedido de ${config.catalogName}*\n`;
    message += `━━━━━━━━━━━━━━━━━━\n\n`;

    cart.forEach(item => {
      message += `• ${item.name}\n`;
      // Add exclusions if any
      if (item.exclusions && item.exclusions.length > 0) {
        message += `  ❌ Sin ${item.exclusions.join(', Sin ')}\n`;
      }
      message += `  ${item.qty} x ${formatPrice(item.price)} = ${formatPrice(item.price * item.qty)}\n\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `📦 *Subtotal:* ${formatPrice(subtotal)}\n`;
    
    // Add delivery info if selected
    if (formState.deliveryZone) {
      if (isToConsult) {
        message += `🚚 *Envío (${formState.deliveryZone.name}):* A consultar\n`;
      } else {
        message += `🚚 *Envío (${formState.deliveryZone.name}):* ${delivery > 0 ? formatPrice(delivery) : 'Gratis'}\n`;
      }
    }
    
    if (isToConsult) {
      message += `💰 *TOTAL: ${formatPrice(subtotal)} + envío a consultar*\n\n`;
    } else {
      message += `💰 *TOTAL: ${formatPrice(total)}*\n\n`;
    }
    
    message += `👤 *Cliente:* ${nameInput.value.trim()}\n`;
    message += `📱 *Teléfono:* ${phoneInput.value.trim()}\n`;
    
    // Add address if provided
    if (addressInput && addressInput.value.trim()) {
      message += `📍 *Dirección:* ${addressInput.value.trim()}\n`;
    }
    
    // Add payment method if selected
    if (paymentSelect && paymentSelect.value) {
      const selectedPayment = paymentSelect.options[paymentSelect.selectedIndex].textContent;
      message += `💳 *Forma de pago:* ${selectedPayment}\n`;
    }
    
    // Add custom fields
    if (form.customFields?.length > 0) {
      form.customFields.forEach(field => {
        const input = document.getElementById(`cart-custom-${field.id}`);
        if (input) {
          let value = '';
          if (field.type === 'checkbox') {
            value = input.checked ? 'Sí' : 'No';
          } else if (field.type === 'select') {
            value = input.options[input.selectedIndex]?.textContent || '';
          } else {
            value = input.value.trim();
          }
          if (value) {
            message += `📌 *${field.label}:* ${value}\n`;
          }
        }
      });
    }
    
    // Add notes if provided
    if (notesInput && notesInput.value.trim()) {
      message += `\n📝 *Notas:* ${notesInput.value.trim()}\n`;
    }

    // Clean phone number - support multiple country codes
    let phone = config.whatsappNumber.replace(/\D/g, '');
    // Don't force country code - let the number be as configured
    if (phone.length < 10) {
      showToast('⚠️ Número de WhatsApp no válido');
      return;
    }

    // Open WhatsApp
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    // Clear cart and form after sending
    clearCart();
    closeModal();
    nameInput.value = '';
    phoneInput.value = '';
    if (addressInput) addressInput.value = '';
    if (deliverySelect) {
      deliverySelect.value = '';
      formState.deliveryZone = null;
      formState.deliveryCost = 0;
    }
    if (paymentSelect) paymentSelect.value = '';
    if (notesInput) notesInput.value = '';
    
    // Clear custom fields
    if (form.customFields?.length > 0) {
      form.customFields.forEach(field => {
        const input = document.getElementById(`cart-custom-${field.id}`);
        if (input) {
          if (field.type === 'checkbox') {
            input.checked = false;
          } else {
            input.value = '';
          }
        }
      });
    }
    
    showToast('✅ Pedido enviado!');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
