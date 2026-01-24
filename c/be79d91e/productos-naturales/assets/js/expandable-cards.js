/* ============================================
   Expandable Cards Feature
   Allows cards with long descriptions to expand
   ============================================ */

(function() {
  'use strict';

  const MIN_DESC_LENGTH = 80; // Minimum characters to make card expandable
  let backdrop = null;
  let expandedCard = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    // Create backdrop element
    backdrop = document.createElement('div');
    backdrop.className = 'card-backdrop';
    document.body.appendChild(backdrop);

    // Find all item cards with descriptions
    const cards = document.querySelectorAll('.item-card');
    
    cards.forEach(card => {
      const description = card.querySelector('.item-description');
      if (description && description.textContent.length > MIN_DESC_LENGTH) {
        // Mark as expandable
        card.classList.add('expandable');
        
        // Add click handler to card content (not buttons)
        card.addEventListener('click', (e) => {
          // Don't expand if clicking on buttons, selects, or close button
          if (e.target.closest('button, select, .btn, .item-card-close')) {
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
    backdrop.classList.remove('active');
    expandedCard = null;

    // Restore body scroll
    document.body.style.overflow = '';
  }

  // Expose API
  window.expandableCards = {
    expand: expandCard,
    collapse: collapseCard
  };

})();
