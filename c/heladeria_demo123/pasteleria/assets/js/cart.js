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
          <div class="customization-section customization-variant-section" style="display:none;">
            <p class="customization-modal-subtitle">🍽️ Elegí tu opción:</p>
            <div class="customization-options customization-variant-options"></div>
          </div>
          <div class="customization-groups-container"></div>
          <div class="customization-section customization-remove-section" style="display:none;">
            <p class="customization-modal-subtitle">🥗 Deseleccioná lo que no querés:</p>
            <div class="customization-options customization-remove-options"></div>
          </div>
          <div class="customization-section customization-add-section" style="display:none;">
            <p class="customization-modal-subtitle">➕ Agregá extras:</p>
            <div class="customization-options customization-add-options"></div>
          </div>
        </div>
        <div class="customization-modal-footer">
          <div class="customization-price-summary">
            <span class="customization-base-price"></span>
            <span class="customization-addons-price" style="display:none;"></span>
            <span class="customization-total-price"></span>
          </div>
          <div class="customization-validation-error" style="display:none;"></div>
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

  // Open variant selection modal (for no-image items with variants)
  function openVariantSelectionModal(itemData) {
    pendingItem = { 
      ...itemData, 
      variants: itemData.variants || [],
      customizations: itemData.customizations || [],
      customizationGroups: itemData.customizationGroups || [],
      selectedVariant: null
    };
    
    // Update modal title
    customizationModal.querySelector('.customization-modal-title').textContent = itemData.name;
    
    // Render variant options as radio buttons
    const variantSection = customizationModal.querySelector('.customization-variant-section');
    const variantContainer = customizationModal.querySelector('.customization-variant-options');
    
    if (itemData.variants && itemData.variants.length > 0) {
      variantSection.style.display = 'block';
      variantContainer.innerHTML = itemData.variants.map((v, i) => `
        <label class="customization-option customization-variant">
          <input type="radio" name="variant" value="${v.id}" data-name="${v.name}" data-price="${v.price}" data-price-text="${v.priceText}" ${i === 0 ? 'checked' : ''}>
          <span class="customization-checkbox"></span>
          <span class="customization-name">${v.name}</span>
          <span class="customization-price">${v.priceText}</span>
        </label>
      `).join('');
      
      // Set initial selected variant
      pendingItem.selectedVariant = itemData.variants[0];
      
      // Add change listeners
      variantContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', function() {
          pendingItem.selectedVariant = {
            id: this.value,
            name: this.dataset.name,
            price: parseFloat(this.dataset.price),
            priceText: this.dataset.priceText
          };
          updateCustomizationPrice();
        });
      });
    } else {
      variantSection.style.display = 'none';
      variantContainer.innerHTML = '';
    }
    
    // Render customization groups
    renderCustomizationGroups(itemData.customizationGroups || []);
    
    // Render customizations (remove items) - only ungrouped ones
    const removeItems = (itemData.customizations || []).filter(c => c.type === 'remove' || !c.type);
    const addItems = (itemData.customizations || []).filter(c => c.type === 'add' || c.type === 'addon');
    
    const removeSection = customizationModal.querySelector('.customization-remove-section');
    const removeContainer = customizationModal.querySelector('.customization-remove-options');
    if (removeItems.length > 0) {
      removeSection.style.display = 'block';
      removeContainer.innerHTML = removeItems.map(c => `
        <label class="customization-option">
          <input type="checkbox" checked data-id="${c.id}" data-name="${c.name}" data-type="remove">
          <span class="customization-checkbox"></span>
          <span class="customization-name">${c.name}</span>
        </label>
      `).join('');
    } else {
      removeSection.style.display = 'none';
      removeContainer.innerHTML = '';
    }
    
    // Render add options
    const addSection = customizationModal.querySelector('.customization-add-section');
    const addContainer = customizationModal.querySelector('.customization-add-options');
    if (addItems.length > 0) {
      addSection.style.display = 'block';
      addContainer.innerHTML = addItems.map(c => `
        <label class="customization-option customization-addon">
          <input type="checkbox" ${c.isDefault ? 'checked' : ''} data-id="${c.id}" data-name="${c.name}" data-type="add" data-price="${c.price || 0}" data-price-formatted="${c.priceFormatted || ''}">
          <span class="customization-checkbox"></span>
          <span class="customization-name">${c.name}</span>
          ${c.priceFormatted ? `<span class="customization-price">+${c.priceFormatted}</span>` : ''}
        </label>
      `).join('');
      
      addContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', updateCustomizationPrice);
      });
    } else {
      addSection.style.display = 'none';
      addContainer.innerHTML = '';
    }
    
    updateCustomizationPrice();
    customizationModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  // Render customization groups
  function renderCustomizationGroups(groups) {
    const container = customizationModal.querySelector('.customization-groups-container');
    if (!groups || groups.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    container.innerHTML = groups.map(group => {
      const selectionLabel = getGroupSelectionLabel(group);
      const isRadio = group.selectionType === 'exactly' && group.maxSelections === 1;
      const dependsOn = group.dependsOnOptionId || '';
      const isHidden = dependsOn ? 'style="display:none;"' : '';
      
      return `
        <div class="customization-section customization-group" data-group-id="${group.id}" data-selection-type="${group.selectionType}" data-min="${group.minSelections}" data-max="${group.maxSelections || ''}" data-required="${group.isRequired}" data-depends-on="${dependsOn}" ${isHidden}>
          <p class="customization-modal-subtitle">
            ${group.isRequired ? '⭐' : '📋'} ${group.name}
            <span class="customization-group-rule">(${selectionLabel})</span>
          </p>
          <div class="customization-group-status"></div>
          <div class="customization-options customization-group-options">
            ${group.options.map((opt, i) => `
              <label class="customization-option customization-group-option${opt.price ? ' has-price' : ''}">
                <input type="${isRadio ? 'radio' : 'checkbox'}" 
                  name="group_${group.id}" 
                  value="${opt.id}" 
                  data-id="${opt.id}" 
                  data-name="${opt.name}" 
                  data-group-id="${group.id}"
                  data-price="${opt.price || 0}" 
                  data-price-formatted="${opt.priceFormatted || ''}">
                <span class="customization-checkbox"></span>
                <span class="customization-name">${opt.name}</span>
                ${opt.priceFormatted ? `<span class="customization-price">+${opt.priceFormatted}</span>` : ''}
              </label>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
    
    // Add change listeners for validation, price update, and conditional groups
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', (e) => {
        const checkbox = e.target;
        const groupEl = checkbox.closest('.customization-group');
        const max = groupEl.dataset.max ? parseInt(groupEl.dataset.max) : null;
        const selectionType = groupEl.dataset.selectionType;
        
        // If checking and we have a max limit, enforce it
        if (checkbox.checked && max !== null && selectionType !== 'at_least') {
          const checkedCount = groupEl.querySelectorAll('input:checked').length;
          if (checkedCount > max) {
            // Prevent selection - uncheck this one
            checkbox.checked = false;
            return;
          }
        }
        
        // Update conditional groups visibility
        updateConditionalGroups();
        validateGroups();
        updateCustomizationPrice();
      });
    });
    
    // Initial conditional groups check and validation
    updateConditionalGroups();
    validateGroups();
  }

  // Update visibility of conditional groups based on selected options
  function updateConditionalGroups() {
    const container = customizationModal.querySelector('.customization-groups-container');
    if (!container) return;
    
    // Get all selected option IDs
    const selectedOptionIds = new Set();
    container.querySelectorAll('input:checked').forEach(input => {
      selectedOptionIds.add(input.dataset.id);
    });
    
    // Show/hide groups based on their dependencies
    container.querySelectorAll('.customization-group[data-depends-on]').forEach(groupEl => {
      const dependsOn = groupEl.dataset.dependsOn;
      if (!dependsOn) return;
      
      const shouldShow = selectedOptionIds.has(dependsOn);
      groupEl.style.display = shouldShow ? '' : 'none';
      
      // If hiding, uncheck all options in this group
      if (!shouldShow) {
        groupEl.querySelectorAll('input:checked').forEach(input => {
          input.checked = false;
        });
      }
    });
  }

  // Get selection label for group
  function getGroupSelectionLabel(group) {
    const { selectionType, minSelections, maxSelections } = group;
    if (selectionType === 'exactly') {
      return `Elegir ${minSelections}`;
    } else if (selectionType === 'up_to') {
      return maxSelections ? `Hasta ${maxSelections}` : 'Opcional';
    } else if (selectionType === 'at_least') {
      return `Mínimo ${minSelections}`;
    }
    return '';
  }

  // Validate all groups and enforce max selection limits
  function validateGroups() {
    const groups = customizationModal.querySelectorAll('.customization-group');
    let allValid = true;
    const errors = [];
    
    groups.forEach(groupEl => {
      // Skip hidden conditional groups
      if (groupEl.style.display === 'none') {
        groupEl.classList.remove('is-valid', 'is-invalid');
        return;
      }
      
      const groupId = groupEl.dataset.groupId;
      const selectionType = groupEl.dataset.selectionType;
      const min = parseInt(groupEl.dataset.min) || 0;
      const max = groupEl.dataset.max ? parseInt(groupEl.dataset.max) : null;
      const isRequired = groupEl.dataset.required === 'true';
      const groupName = groupEl.querySelector('.customization-modal-subtitle').textContent.split('(')[0].trim();
      
      const checkboxes = groupEl.querySelectorAll('input[type="checkbox"]');
      const checkedCount = groupEl.querySelectorAll('input:checked').length;
      const statusEl = groupEl.querySelector('.customization-group-status');
      
      let isValid = true;
      let statusText = '';
      
      if (selectionType === 'exactly') {
        isValid = checkedCount === min;
        statusText = `${checkedCount}/${min} seleccionados`;
        if (!isValid && isRequired) {
          errors.push(`${groupName}: Elegí exactamente ${min}`);
        }
        // Disable unchecked options when limit reached
        if (checkedCount >= min) {
          checkboxes.forEach(cb => {
            if (!cb.checked) {
              cb.disabled = true;
              cb.closest('.customization-option').classList.add('is-disabled');
            }
          });
        } else {
          checkboxes.forEach(cb => {
            cb.disabled = false;
            cb.closest('.customization-option').classList.remove('is-disabled');
          });
        }
      } else if (selectionType === 'up_to') {
        isValid = max ? checkedCount <= max : true;
        if (isRequired && checkedCount === 0) {
          isValid = false;
          errors.push(`${groupName}: Elegí al menos 1`);
        }
        statusText = max ? `${checkedCount}/${max} seleccionados` : `${checkedCount} seleccionados`;
        // Disable unchecked options when max reached
        if (max && checkedCount >= max) {
          checkboxes.forEach(cb => {
            if (!cb.checked) {
              cb.disabled = true;
              cb.closest('.customization-option').classList.add('is-disabled');
            }
          });
        } else {
          checkboxes.forEach(cb => {
            cb.disabled = false;
            cb.closest('.customization-option').classList.remove('is-disabled');
          });
        }
      } else if (selectionType === 'at_least') {
        isValid = checkedCount >= min;
        statusText = `${checkedCount}/${min}+ seleccionados`;
        if (!isValid) {
          errors.push(`${groupName}: Elegí al menos ${min}`);
        }
      }
      
      groupEl.classList.toggle('is-valid', isValid);
      groupEl.classList.toggle('is-invalid', !isValid && isRequired);
      statusEl.textContent = statusText;
      statusEl.className = 'customization-group-status ' + (isValid ? 'valid' : (isRequired ? 'invalid' : ''));
      
      if (!isValid && isRequired) {
        allValid = false;
      }
    });
    
    // Update validation error display
    const errorEl = customizationModal.querySelector('.customization-validation-error');
    const confirmBtn = customizationModal.querySelector('.customization-confirm-btn');
    
    if (!allValid) {
      errorEl.textContent = errors[0] || 'Completá las selecciones requeridas';
      errorEl.style.display = 'block';
      confirmBtn.disabled = true;
    } else {
      errorEl.style.display = 'none';
      confirmBtn.disabled = false;
    }
    
    return allValid;
  }

  // Open customization modal
  function openCustomizationModal(itemData, customizations) {
    pendingItem = { ...itemData, customizations };
    
    // Update modal title with item name
    customizationModal.querySelector('.customization-modal-title').textContent = itemData.name;
    
    // Clear variant section (not used in this flow)
    const variantSection = customizationModal.querySelector('.customization-variant-section');
    const variantContainer = customizationModal.querySelector('.customization-variant-options');
    variantSection.style.display = 'none';
    variantContainer.innerHTML = '';
    
    // Clear customization groups container (not used in this flow)
    const groupsContainer = customizationModal.querySelector('.customization-groups-container');
    groupsContainer.innerHTML = '';
    
    // Separate customizations by type
    const removeItems = customizations.filter(c => c.type === 'remove' || !c.type);
    const addItems = customizations.filter(c => c.type === 'add' || c.type === 'addon');
    
    // Render "remove" options (ingredients to exclude) - checked by default
    const removeSection = customizationModal.querySelector('.customization-remove-section');
    const removeContainer = customizationModal.querySelector('.customization-remove-options');
    if (removeItems.length > 0) {
      removeSection.style.display = 'block';
      removeContainer.innerHTML = removeItems.map(c => `
        <label class="customization-option">
          <input type="checkbox" checked data-id="${c.id}" data-name="${c.name}" data-type="remove">
          <span class="customization-checkbox"></span>
          <span class="customization-name">${c.name}</span>
        </label>
      `).join('');
    } else {
      removeSection.style.display = 'none';
      removeContainer.innerHTML = '';
    }
    
    // Render "add" options (extras with price) - unchecked by default
    const addSection = customizationModal.querySelector('.customization-add-section');
    const addContainer = customizationModal.querySelector('.customization-add-options');
    if (addItems.length > 0) {
      addSection.style.display = 'block';
      addContainer.innerHTML = addItems.map(c => `
        <label class="customization-option customization-addon">
          <input type="checkbox" ${c.isDefault ? 'checked' : ''} data-id="${c.id}" data-name="${c.name}" data-type="add" data-price="${c.price || 0}" data-price-formatted="${c.priceFormatted || ''}">
          <span class="customization-checkbox"></span>
          <span class="customization-name">${c.name}</span>
          ${c.priceFormatted ? `<span class="customization-price">+${c.priceFormatted}</span>` : ''}
        </label>
      `).join('');
      
      // Add change listeners to update price
      addContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', updateCustomizationPrice);
      });
    } else {
      addSection.style.display = 'none';
      addContainer.innerHTML = '';
    }
    
    // Update price display
    updateCustomizationPrice();
    
    customizationModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  // Update price display in customization modal
  function updateCustomizationPrice() {
    if (!pendingItem) return;
    
    // Get base price from selected variant or item price
    const basePrice = pendingItem.selectedVariant?.price || pendingItem.price || 0;
    let addonsTotal = 0;
    
    // Sum selected addons from ungrouped customizations
    const addonCheckboxes = customizationModal.querySelectorAll('.customization-add-options input[type="checkbox"]:checked');
    addonCheckboxes.forEach(cb => {
      addonsTotal += parseFloat(cb.dataset.price) || 0;
    });
    
    // Sum selected options from groups that have prices
    const groupOptions = customizationModal.querySelectorAll('.customization-group-options input:checked');
    groupOptions.forEach(input => {
      addonsTotal += parseFloat(input.dataset.price) || 0;
    });
    
    const totalPrice = basePrice + addonsTotal;
    
    // Update display
    const basePriceEl = customizationModal.querySelector('.customization-base-price');
    const addonsPriceEl = customizationModal.querySelector('.customization-addons-price');
    const totalPriceEl = customizationModal.querySelector('.customization-total-price');
    
    basePriceEl.textContent = `Producto: ${formatPrice(basePrice)}`;
    
    if (addonsTotal > 0) {
      addonsPriceEl.style.display = 'block';
      addonsPriceEl.textContent = `Adicionales: +${formatPrice(addonsTotal)}`;
      totalPriceEl.innerHTML = `<strong>Total: ${formatPrice(totalPrice)}</strong>`;
    } else {
      addonsPriceEl.style.display = 'none';
      totalPriceEl.innerHTML = `<strong>Total: ${formatPrice(basePrice)}</strong>`;
    }
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
    
    // Validate groups first
    if (!validateGroups()) {
      showToast('⚠️ Completá las selecciones requeridas');
      return;
    }
    
    // Get unchecked "remove" items (exclusions)
    const removeCheckboxes = customizationModal.querySelectorAll('.customization-remove-options input[type="checkbox"]');
    const exclusions = [];
    removeCheckboxes.forEach(cb => {
      if (!cb.checked) {
        exclusions.push(cb.dataset.name);
      }
    });
    
    // Get checked "add" items (addons) from ungrouped customizations
    const addCheckboxes = customizationModal.querySelectorAll('.customization-add-options input[type="checkbox"]:checked');
    const addons = [];
    let addonsTotal = 0;
    addCheckboxes.forEach(cb => {
      const price = parseFloat(cb.dataset.price) || 0;
      addons.push({
        name: cb.dataset.name,
        price: price,
        priceFormatted: cb.dataset.priceFormatted || formatPrice(price)
      });
      addonsTotal += price;
    });
    
    // Get selections from groups
    const groupSelections = [];
    const groups = customizationModal.querySelectorAll('.customization-group');
    groups.forEach(groupEl => {
      const groupName = groupEl.querySelector('.customization-modal-subtitle').textContent.split('(')[0].trim().replace(/^[⭐📋]\s*/, '');
      const selectedOptions = [];
      
      groupEl.querySelectorAll('input:checked').forEach(input => {
        const price = parseFloat(input.dataset.price) || 0;
        selectedOptions.push({
          name: input.dataset.name,
          price: price,
          priceFormatted: input.dataset.priceFormatted || (price > 0 ? formatPrice(price) : '')
        });
        addonsTotal += price;
      });
      
      if (selectedOptions.length > 0) {
        groupSelections.push({
          groupName: groupName,
          options: selectedOptions
        });
      }
    });
    
    // Get base price from selected variant or item price
    const hasVariant = pendingItem.selectedVariant && pendingItem.selectedVariant.price;
    const basePrice = hasVariant ? pendingItem.selectedVariant.price : (pendingItem.price || 0);
    const finalPrice = basePrice + addonsTotal;
    
    // Build item name with variant
    let itemName = pendingItem.name;
    if (hasVariant) {
      itemName = pendingItem.name + ' - ' + pendingItem.selectedVariant.name;
    }
    
    // Create unique ID based on variant, exclusions, addons and group selections
    let itemId = pendingItem.id;
    const idParts = [];
    if (hasVariant) {
      idParts.push('var_' + pendingItem.selectedVariant.id);
    }
    if (exclusions.length > 0) {
      idParts.push('exc_' + exclusions.sort().join('_').toLowerCase().replace(/\s+/g, '-'));
    }
    if (addons.length > 0) {
      idParts.push('add_' + addons.map(a => a.name).sort().join('_').toLowerCase().replace(/\s+/g, '-'));
    }
    if (groupSelections.length > 0) {
      const groupIds = groupSelections.map(g => g.options.map(o => o.name).join('-')).join('_');
      idParts.push('grp_' + groupIds.toLowerCase().replace(/\s+/g, '-'));
    }
    if (idParts.length > 0) {
      itemId = pendingItem.id + '_' + idParts.join('_');
    }
    
    // Add to cart with exclusions, addons and group selections
    addToCart({
      id: itemId,
      name: itemName,
      price: finalPrice,
      priceText: formatPrice(finalPrice),
      image: pendingItem.image,
      exclusions: exclusions,
      addons: addons,
      groupSelections: groupSelections,
      variantId: hasVariant ? pendingItem.selectedVariant.id : pendingItem.variantId,
      variantName: hasVariant ? pendingItem.selectedVariant.name : pendingItem.variantName
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
        const isNoImageItem = item.classList.contains('no-image');
        
        // For no-image items (price list style), create button that opens variant modal
        if (isNoImageItem) {
          // Get variants data from select options
          const variants = [];
          if (variantSelect) {
            Array.from(variantSelect.options).forEach(opt => {
              if (opt.value) {
                variants.push({
                  id: opt.value,
                  name: opt.dataset.name,
                  price: parseFloat(opt.dataset.price),
                  priceText: opt.dataset.priceText
                });
              }
            });
          }
          
          // Get customizations
          const hasCustomizations = item.dataset.hasCustomizations === 'true';
          let customizations = [];
          if (hasCustomizations && item.dataset.customizations) {
            try {
              customizations = JSON.parse(item.dataset.customizations);
            } catch (e) {}
          }
          
          // Get customization groups
          const hasCustomizationGroups = item.dataset.hasCustomizationGroups === 'true';
          let customizationGroups = [];
          if (hasCustomizationGroups && item.dataset.customizationGroups) {
            try {
              customizationGroups = JSON.parse(item.dataset.customizationGroups);
            } catch (e) {}
          }
          
          // Create button that opens variant selection modal
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
          btn.dataset.itemImage = imageUrl;
          btn.dataset.hasVariants = 'true';
          btn.dataset.isNoImage = 'true';
          btn.dataset.variants = JSON.stringify(variants);
          btn.dataset.hasCustomizations = hasCustomizations ? 'true' : 'false';
          if (hasCustomizations) {
            btn.dataset.customizations = item.dataset.customizations;
          }
          btn.dataset.hasCustomizationGroups = hasCustomizationGroups ? 'true' : 'false';
          if (hasCustomizationGroups) {
            btn.dataset.customizationGroups = item.dataset.customizationGroups;
          }

          // Find or create footer area
          let footer = item.querySelector('.item-footer, .item-actions');
          if (!footer) {
            footer = document.createElement('div');
            footer.className = 'item-footer';
            item.appendChild(footer);
          }
          footer.appendChild(btn);
          return;
        }
        
        // For items with image, use dropdown selector
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

      // Check for customization groups
      const hasCustomizationGroups = item.dataset.hasCustomizationGroups === 'true';
      let customizationGroups = [];
      if (hasCustomizationGroups && item.dataset.customizationGroups) {
        try {
          customizationGroups = JSON.parse(item.dataset.customizationGroups);
        } catch (e) {
          console.warn('Could not parse customization groups:', e);
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
      btn.dataset.hasCustomizationGroups = hasCustomizationGroups;
      if (hasCustomizationGroups) {
        btn.dataset.customizationGroups = JSON.stringify(customizationGroups);
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
          // Check if this is a no-image item that needs variant selection modal
          if (btn.dataset.isNoImage === 'true') {
            const variants = JSON.parse(btn.dataset.variants || '[]');
            const hasCustomizations = btn.dataset.hasCustomizations === 'true';
            let customizations = [];
            if (hasCustomizations && btn.dataset.customizations) {
              try {
                customizations = JSON.parse(btn.dataset.customizations);
              } catch (e) {}
            }
            
            const hasCustomizationGroups = btn.dataset.hasCustomizationGroups === 'true';
            let customizationGroups = [];
            if (hasCustomizationGroups && btn.dataset.customizationGroups) {
              try {
                customizationGroups = JSON.parse(btn.dataset.customizationGroups);
              } catch (e) {}
            }
            
            openVariantSelectionModal({
              id: btn.dataset.itemId,
              name: btn.dataset.itemName,
              image: btn.dataset.itemImage,
              variants: variants,
              customizations: customizations,
              customizationGroups: customizationGroups
            });
            return;
          }
          
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
          
          // Check if item has customization groups
          const hasCustomizationGroups = btn.dataset.hasCustomizationGroups === 'true';
          let customizationGroups = [];
          if (hasCustomizationGroups && btn.dataset.customizationGroups) {
            try {
              customizationGroups = JSON.parse(btn.dataset.customizationGroups);
            } catch (e) {}
          }
          
          if (hasCustomizationGroups && customizationGroups.length > 0) {
            // Open variant selection modal (which also handles customization groups)
            openVariantSelectionModal({
              id: btn.dataset.itemId,
              name: btn.dataset.itemName,
              price: parseFloat(btn.dataset.itemPrice),
              priceText: btn.dataset.itemPriceText,
              image: btn.dataset.itemImage,
              variants: [],
              customizations: customizations,
              customizationGroups: customizationGroups
            });
          } else if (hasCustomizations && customizations.length > 0) {
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
    // Check stock availability before adding
    if (window.SCG_Inventory) {
      // Extract base item ID for stock check
      const baseItemId = String(item.id).split('_')[0];
      const currentQty = cart.filter(i => String(i.id).split('_')[0] === baseItemId)
        .reduce((sum, i) => sum + i.qty, 0);
      const available = window.SCG_Inventory.getAvailable(baseItemId, item.variantId);
      
      if (available !== null && available <= currentQty) {
        showToast(`⚠️ No hay más stock disponible de ${item.name}`);
        return;
      }
    }
    
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

    // Check stock availability before increasing
    if (delta > 0 && window.SCG_Inventory) {
      // Extract base item ID for stock check
      const baseItemId = String(itemId).split('_')[0];
      const currentQty = cart.filter(i => String(i.id).split('_')[0] === baseItemId)
        .reduce((sum, i) => sum + i.qty, 0);
      const available = window.SCG_Inventory.getAvailable(baseItemId, item.variantId);
      if (available !== null && available <= currentQty) {
        showToast(`⚠️ No hay más stock disponible`);
        return;
      }
    }

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
            ${item.groupSelections && item.groupSelections.length > 0 ? `
              <div class="cart-item-groups">
                ${item.groupSelections.map(g => `<div class="cart-item-group">📋 ${g.groupName}: ${g.options.map(o => o.name).join(', ')}</div>`).join('')}
              </div>
            ` : ''}
            ${item.addons && item.addons.length > 0 ? `
              <div class="cart-item-addons">➕ ${item.addons.map(a => a.name).join(', ')}</div>
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

  // Check if inventory feature is enabled
  function isInventoryEnabled() {
    return window.FEATURES?.inventory && window.INVENTORY_CONFIG?.enabled;
  }

  // Validate stock availability before submitting order
  async function validateStockAvailability() {
    if (!isInventoryEnabled() || !window.SCG_Inventory) {
      return { valid: true, errors: [] };
    }

    const errors = [];
    
    // Group cart items by base item ID to check total quantity per product
    const itemTotals = {};
    for (const item of cart) {
      const baseItemId = String(item.id).split('_')[0];
      const key = item.variantId ? `${baseItemId}_${item.variantId}` : baseItemId;
      if (!itemTotals[key]) {
        itemTotals[key] = { name: item.name.split(' - ')[0], qty: 0, variantId: item.variantId };
      }
      itemTotals[key].qty += item.qty;
    }
    
    for (const [key, data] of Object.entries(itemTotals)) {
      const baseItemId = key.split('_')[0];
      const available = window.SCG_Inventory.getAvailable(baseItemId, data.variantId);
      if (available !== null && available < data.qty) {
        if (available <= 0) {
          errors.push(`"${data.name}" ya no está disponible`);
        } else {
          errors.push(`"${data.name}" solo tiene ${available} unidades disponibles`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Create order in Firebase and reserve stock
  async function createFirebaseOrder(customerData, orderTotal) {
    if (!isInventoryEnabled()) {
      return { success: true, orderId: null };
    }

    const CATALOG_KEY = window.CATALOG_KEY;
    if (!CATALOG_KEY || typeof firebase === 'undefined') {
      return { success: true, orderId: null };
    }

    try {
      const db = firebase.firestore();
      const expiryHours = window.INVENTORY_CONFIG?.orderExpiryHours || 24;
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

      // Prepare order items
      const orderItems = cart.map(item => ({
        itemId: item.id,
        variantId: item.variantId || null,
        name: item.name,
        variantName: item.variantName || null,
        quantity: item.qty,
        price: item.price,
        priceText: formatPrice(item.price * item.qty),
        image: item.image || null
      }));

      // Create order document
      const orderRef = await db.collection('inventario')
        .doc(CATALOG_KEY)
        .collection('orders')
        .add({
          catalogKey: CATALOG_KEY,
          status: 'pending',
          items: orderItems,
          customer: customerData,
          subtotal: orderTotal.subtotal,
          deliveryCost: orderTotal.delivery,
          total: orderTotal.total,
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt
        });

      // Reserve stock for each item using transactions for atomicity
      console.log('📦 Starting stock reservation...');
      for (const item of orderItems) {
        // Extract base item ID (remove customization suffixes like _var_123_exc_...)
        const baseItemId = String(item.itemId).split('_')[0];
        const key = item.variantId ? `${baseItemId}_${item.variantId}` : baseItemId;
        const invRef = db.collection('inventario').doc(CATALOG_KEY).collection('items').doc(key);
        
        console.log(`📦 Reserving stock: itemId=${item.itemId}, baseId=${baseItemId}, key=${key}, qty=${item.quantity}`);
        console.log(`📦 Firebase path: inventario/${CATALOG_KEY}/items/${key}`);
        
        try {
          await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(invRef);
            console.log(`📦 Document exists: ${doc.exists}`);
            
            if (doc.exists) {
              const data = doc.data();
              console.log(`📦 Current data:`, data);
              const currentStock = data.stock || 0;
              const currentReserved = data.reserved || 0;
              const newReserved = currentReserved + item.quantity;
              const newAvailable = currentStock - newReserved;
              
              console.log(`📦 Updating ${key}: stock=${currentStock}, reserved=${currentReserved}->${newReserved}, available->${newAvailable}`);
              
              transaction.update(invRef, {
                reserved: newReserved,
                available: newAvailable,
                updatedAt: new Date().toISOString()
              });
            } else {
              // Document doesn't exist, create it with reserved stock
              console.log(`📦 Creating inventory doc for ${key} with reserved=${item.quantity}`);
              transaction.set(invRef, {
                itemId: baseItemId,
                stock: 0,
                reserved: item.quantity,
                available: -item.quantity,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            }
          });
          console.log(`✅ Stock reserved for ${key}`);
        } catch (stockError) {
          console.error(`⚠️ Error reserving stock for ${key}:`, stockError);
          console.error(`⚠️ Error code:`, stockError.code);
          console.error(`⚠️ Error message:`, stockError.message);
          // Continue with other items even if one fails
        }
      }
      console.log('📦 Stock reservation complete');

      return { success: true, orderId: orderRef.id };

    } catch (error) {
      console.error('Error creating Firebase order:', error);
      return { success: false, orderId: null, error: error.message };
    }
  }

  // Submit order via WhatsApp
  async function submitOrder() {
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

    // Validate stock availability if inventory is enabled
    const stockValidation = await validateStockAvailability();
    if (!stockValidation.valid) {
      showToast('⚠️ ' + stockValidation.errors[0]);
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
      // Add group selections if any
      if (item.groupSelections && item.groupSelections.length > 0) {
        item.groupSelections.forEach(g => {
          const optionNames = g.options.map(o => o.price > 0 ? `${o.name} (+${o.priceFormatted})` : o.name).join(', ');
          message += `  📋 ${g.groupName}: ${optionNames}\n`;
        });
      }
      // Add addons if any
      if (item.addons && item.addons.length > 0) {
        message += `  ➕ Con ${item.addons.map(a => `${a.name} (+${a.priceFormatted})`).join(', ')}\n`;
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

    // Create Firebase order and reserve stock (if inventory enabled)
    const customerData = {
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      address: addressInput?.value.trim() || null,
      notes: notesInput?.value.trim() || null,
      paymentMethod: paymentSelect?.value || null,
      deliveryZone: formState.deliveryZone?.name || null
    };
    
    const orderResult = await createFirebaseOrder(customerData, { subtotal, delivery, total });
    
    // Add order ID to message if created
    if (orderResult.orderId) {
      const orderIdShort = orderResult.orderId.substring(0, 8).toUpperCase();
      message = `📦 *Pedido #${orderIdShort}*\n` + message;
      message += `\n━━━━━━━━━━━━━━━━━━\n`;
      message += `⚠️ _Stock reservado. Confirmar en admin._\n`;
    }

    // Clean phone number - support multiple country codes
    let phone = config.whatsappNumber.replace(/\D/g, '');
    // Don't force country code - let the number be as configured
    if (phone.length < 10) {
      showToast('⚠️ Número de WhatsApp no válido');
      return;
    }

    // Sanitize message to avoid URI malformed errors
    // Remove any problematic Unicode characters and normalize the string
    let sanitizedMessage = message;
    try {
      sanitizedMessage = message.normalize('NFC');
    } catch (e) {
      // If normalize fails, continue with original
    }
    // Remove lone surrogates and control characters (compatible with all browsers)
    sanitizedMessage = sanitizedMessage
      .split('')
      .filter(char => {
        const code = char.charCodeAt(0);
        // Remove control characters (except newline, carriage return, tab)
        if (code < 32 && code !== 10 && code !== 13 && code !== 9) return false;
        if (code === 127) return false;
        // Remove lone surrogates
        if (code >= 0xD800 && code <= 0xDFFF) return false;
        return true;
      })
      .join('');

    // Open WhatsApp with error handling
    try {
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(sanitizedMessage)}`;
      window.open(url, '_blank');
    } catch (e) {
      console.error('Error encoding message:', e);
      // Fallback: try with a simpler message
      try {
        const simpleMessage = sanitizedMessage.replace(/[^\x20-\x7E\n\r\u00A0-\u00FF\u0100-\u017F]/g, '');
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(simpleMessage)}`;
        window.open(url, '_blank');
      } catch (e2) {
        console.error('Error with fallback encoding:', e2);
        showToast('⚠️ Error al enviar el pedido. Intentá de nuevo.');
        return;
      }
    }

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
