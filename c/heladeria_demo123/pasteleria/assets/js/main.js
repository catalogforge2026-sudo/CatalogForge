/**
 * Pastry Shop Theme - JavaScript
 * Delicado • Artesanal • Dulce • Premium
 */

// Disable expandable cards for this theme
window.EXPANDABLE_CARDS_DISABLED = true;

(function() {
  'use strict';

  // Theme configuration
  const CONFIG = {
    decorations: ['🍓', '🧁', '🍰', '🎂', '🍪', '✨', '🌸', '🍫'],
    floatingCount: 6,
    animationDuration: 6000
  };

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', initPastryTheme);

  function initPastryTheme() {
    // Add floating decorations
    addFloatingDecorations();
    
    // Initialize base features
    initBaseFeatures();
    
    // Add smooth scroll navigation
    initSmoothScroll();
    
    // Add card interactions
    initCardInteractions();
    
    // Add button effects
    initButtonEffects();
    
    // Add scroll animations
    initScrollAnimations();
    
    // Add touch feedback for mobile
    initTouchFeedback();
    
    // Add footer decoration
    addFooterDecoration();
  }

  function initBaseFeatures() {
    // DISABLED: Expandable cards feature for Pastry theme
    // Remove expandable class from all cards to prevent any expand behavior
    document.querySelectorAll('.item-card').forEach(card => {
      card.classList.remove('expandable');
      card.classList.remove('expanded');
    });
    
    // Remove backdrop if exists
    const backdrop = document.querySelector('.card-backdrop');
    if (backdrop) {
      backdrop.remove();
    }
    
    // Restore body scroll in case it was locked
    document.body.style.overflow = '';
    
    // Disable the expandable cards API
    if (window.expandableCards) {
      window.expandableCards.expand = function() {};
      window.expandableCards.collapse = function() {};
    }
    
    // Also run this after a short delay to catch any late initialization
    setTimeout(() => {
      document.querySelectorAll('.item-card').forEach(card => {
        card.classList.remove('expandable');
        card.classList.remove('expanded');
      });
      const backdropLate = document.querySelector('.card-backdrop');
      if (backdropLate) {
        backdropLate.remove();
      }
      document.body.style.overflow = '';
    }, 100);
    
    // Initialize cart if available
    if (typeof window.initCart === 'function') {
      window.initCart();
    }
    
    // Initialize search if available
    if (typeof window.initSearch === 'function') {
      window.initSearch();
    }
  }

  function addFloatingDecorations() {
    const container = document.createElement('div');
    container.className = 'floating-decorations';
    container.setAttribute('aria-hidden', 'true');
    
    for (let i = 0; i < CONFIG.floatingCount; i++) {
      const deco = document.createElement('span');
      deco.textContent = CONFIG.decorations[i % CONFIG.decorations.length];
      
      const size = 0.8 + Math.random() * 0.8;
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const delay = Math.random() * 3;
      const duration = 5 + Math.random() * 4;
      
      deco.style.cssText = `
        font-size: ${size}rem;
        opacity: ${0.08 + Math.random() * 0.08};
        left: ${left}%;
        top: ${top}%;
        animation: float ${duration}s ease-in-out infinite;
        animation-delay: ${delay}s;
      `;
      
      container.appendChild(deco);
    }
    
    document.body.appendChild(container);
  }

  function initSmoothScroll() {
    document.querySelectorAll('.section-nav a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const target = document.querySelector(targetId);
        
        if (target) {
          // Update active state
          document.querySelectorAll('.section-nav a').forEach(a => {
            a.classList.remove('active');
          });
          this.classList.add('active');
          
          // Smooth scroll with offset for sticky nav
          const navHeight = document.querySelector('.section-nav')?.offsetHeight || 0;
          const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
    
    // Update active nav on scroll
    let ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        window.requestAnimationFrame(function() {
          updateActiveNav();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  function updateActiveNav() {
    const sections = document.querySelectorAll('.catalog-section');
    const navLinks = document.querySelectorAll('.section-nav a');
    const navHeight = document.querySelector('.section-nav')?.offsetHeight || 0;
    
    let currentSection = '';
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop - navHeight - 100;
      if (window.pageYOffset >= sectionTop) {
        currentSection = section.getAttribute('id');
      }
    });
    
    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + currentSection) {
        link.classList.add('active');
      }
    });
  }


  function initCardInteractions() {
    // Expandable cards DISABLED for Pastry theme
    // Only add decoration to featured items
    
    document.querySelectorAll('.item-card.is-featured').forEach(card => {
      if (!card.querySelector('.featured-sparkle')) {
        const decoration = document.createElement('span');
        decoration.className = 'featured-sparkle';
        decoration.textContent = '✨';
        decoration.setAttribute('aria-hidden', 'true');
        decoration.style.cssText = `
          position: absolute;
          top: -10px;
          left: -10px;
          font-size: 1.5rem;
          z-index: 10;
          animation: float 2.5s ease-in-out infinite;
          pointer-events: none;
        `;
        card.style.position = 'relative';
        card.appendChild(decoration);
      }
    });
  }

  function initButtonEffects() {
    // Add to cart buttons
    document.querySelectorAll('.btn-add-cart').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        
        // Ripple effect
        createRipple(this, e);
        
        // Visual feedback
        const originalHTML = this.innerHTML;
        this.classList.add('added');
        this.innerHTML = '✓ ¡Agregado!';
        
        // Animate cart FAB
        const cartFab = document.querySelector('.cart-fab');
        if (cartFab) {
          cartFab.classList.add('has-items');
          setTimeout(() => cartFab.classList.remove('has-items'), 500);
        }
        
        // Reset button
        setTimeout(() => {
          this.classList.remove('added');
          this.innerHTML = originalHTML;
        }, 1800);
      });
    });
    
    // Large add to cart button in modal
    document.querySelectorAll('.btn-add-cart-lg').forEach(btn => {
      btn.addEventListener('click', function(e) {
        createRipple(this, e);
        
        // Success animation
        const originalHTML = this.innerHTML;
        this.innerHTML = '✓ ¡Añadido al carrito!';
        this.style.background = 'var(--accent-color)';
        
        setTimeout(() => {
          this.innerHTML = originalHTML;
          this.style.background = '';
        }, 2000);
      });
    });
  }

  function createRipple(element, event) {
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: rgba(255, 255, 255, 0.4);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 0.6s ease-out;
      pointer-events: none;
    `;
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
  }

  function initScrollAnimations() {
    // Intersection Observer for fade-in animations
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      });
      
      // Observe sections
      document.querySelectorAll('.catalog-section').forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
      });
    }
    
    // Add visible class styles
    const style = document.createElement('style');
    style.textContent = `
      .catalog-section.is-visible {
        opacity: 1 !important;
        transform: translateY(0) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function initTouchFeedback() {
    // Touch feedback for mobile devices - only for buttons, NOT cards
    const touchElements = document.querySelectorAll('.btn-add-cart, .option-btn, .section-nav a');
    
    touchElements.forEach(el => {
      el.addEventListener('touchstart', function() {
        this.style.transform = 'scale(0.98)';
      }, { passive: true });
      
      el.addEventListener('touchend', function() {
        this.style.transform = '';
      }, { passive: true });
      
      el.addEventListener('touchcancel', function() {
        this.style.transform = '';
      }, { passive: true });
    });
  }

  function addFooterDecoration() {
    const footerDeco = document.querySelector('.footer-decoration');
    if (footerDeco && !footerDeco.textContent.trim()) {
      footerDeco.innerHTML = '🍰 🧁 🍰';
    }
    
    // If no decoration element exists, create one
    const footer = document.querySelector('.site-footer .footer-container');
    if (footer && !footerDeco) {
      const deco = document.createElement('div');
      deco.className = 'footer-decoration';
      deco.innerHTML = '🍰 🧁 🍰';
      deco.setAttribute('aria-hidden', 'true');
      footer.insertBefore(deco, footer.firstChild);
    }
  }

  // Quantity selector functionality
  window.initQuantitySelector = function(container) {
    const minusBtn = container.querySelector('.quantity-btn.minus');
    const plusBtn = container.querySelector('.quantity-btn.plus');
    const valueEl = container.querySelector('.quantity-value');
    
    if (!minusBtn || !plusBtn || !valueEl) return;
    
    let quantity = parseInt(valueEl.textContent) || 1;
    
    minusBtn.addEventListener('click', () => {
      if (quantity > 1) {
        quantity--;
        valueEl.textContent = quantity;
        updatePrice();
      }
    });
    
    plusBtn.addEventListener('click', () => {
      quantity++;
      valueEl.textContent = quantity;
      updatePrice();
    });
    
    function updatePrice() {
      const event = new CustomEvent('quantityChange', { detail: { quantity } });
      container.dispatchEvent(event);
    }
  };

  // Option selector functionality
  window.initOptionSelector = function(container) {
    const buttons = container.querySelectorAll('.option-btn');
    
    buttons.forEach(btn => {
      btn.addEventListener('click', function() {
        // Remove selected from siblings
        buttons.forEach(b => b.classList.remove('selected'));
        // Add selected to clicked
        this.classList.add('selected');
        
        // Dispatch event
        const event = new CustomEvent('optionChange', {
          detail: {
            value: this.dataset.value,
            price: this.dataset.price
          }
        });
        container.dispatchEvent(event);
      });
    });
  };

  // Export for external use
  window.PastryTheme = {
    init: initPastryTheme,
    addFloatingDecorations,
    createRipple
  };

})();
