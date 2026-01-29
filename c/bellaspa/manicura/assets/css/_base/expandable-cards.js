/* ============================================
   Expandable Cards Feature
   Allows all cards to expand on click for better viewing
   ============================================ */

(function() {
  'use strict';

  let backdrop = null;
  let expandedCard = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    // Check if expandable cards are disabled for this theme
    // Check body class, CSS display:none on backdrop, or global flag
    const body = document.body;
    if (body.classList.contains('theme-pastry') || 
        window.EXPANDABLE_CARDS_DISABLED === true) {
      // Expose empty API and exit
      window.expandableCards = {
        expand: function() {},
        collapse: function() {},
        isDisabled: true
      };
      return;
    }
    
    // Create backdrop element if not exists
    backdrop = document.querySelector('.card-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'card-backdrop';
      document.body.appendChild(backdrop);
    }
    
    // Check if backdrop is hidden by CSS (theme disabled it)
    const backdropStyle = window.getComputedStyle(backdrop);
    if (backdropStyle.display === 'none') {
      window.expandableCards = {
        expand: function() {},
        collapse: function() {},
        isDisabled: true
      };
      return;
    }

    // Find all item cards - make ALL cards expandable
    const cards = document.querySelectorAll('.item-card');
    
    cards.forEach(card => {
      // Mark all cards as expandable
      card.classList.add('expandable');
      
      // Add click handler to card content (not buttons)
      card.addEventListener('click', (e) => {
        // Don't expand if clicking on buttons, selects, or close button
        if (e.target.closest('button, select, .btn, .item-card-close, .variant-select')) {
          return;
        }
        
        if (card.classList.contains('expanded')) {
          return; // Already expanded, let close button handle it
        }
        
        expandCard(card);
      });

      // Close button handler
      const closeBtn = card.querySelector('.item-card-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          collapseCard(card);
        });
      }
    });

    // Close on backdrop click
    backdrop.addEventListener('click', () => {
      if (expandedCard) {
        collapseCard(expandedCard);
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && expandedCard) {
        collapseCard(expandedCard);
      }
    });
    
    // Expose API
    window.expandableCards = {
      expand: expandCard,
      collapse: collapseCard,
      isDisabled: false
    };
  }

  function expandCard(card) {
    // Close any previously expanded card
    if (expandedCard && expandedCard !== card) {
      collapseCard(expandedCard);
    }

    // Store original position for animation
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--original-top', rect.top + 'px');
    card.style.setProperty('--original-left', rect.left + 'px');
    card.style.setProperty('--original-width', rect.width + 'px');

    // Expand
    card.classList.add('expanded');
    backdrop.classList.add('active');
    expandedCard = card;

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  function collapseCard(card) {
    card.classList.remove('expanded');
    if (backdrop) {
      backdrop.classList.remove('active');
    }
    expandedCard = null;

    // Restore body scroll
    document.body.style.overflow = '';
  }

})();
