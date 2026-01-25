// Social Theme - JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll
  document.querySelectorAll('.section-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      const target = document.querySelector(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelectorAll('.section-nav a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  });

  // Glow effect following mouse on cards (only when not expanded)
  document.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      // Don't apply glow effect when card is expanded
      if (card.classList.contains('expanded')) return;
      
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mouse-x', `${x}%`);
      card.style.setProperty('--mouse-y', `${y}%`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--mouse-x', '50%');
      card.style.setProperty('--mouse-y', '50%');
    });
  });

  // ============================================
  // Expandable Cards Feature
  // ============================================
  initExpandableCards();
});

function initExpandableCards() {
  // Create backdrop element
  let backdrop = document.querySelector('.card-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'card-backdrop';
    document.body.appendChild(backdrop);
  }

  // Find cards with long descriptions (more than 80 chars)
  const cards = document.querySelectorAll('.item-card');
  let expandedCard = null;

  cards.forEach(card => {
    const description = card.querySelector('.item-description');
    const expandIndicator = card.querySelector('.expand-indicator');
    
    if (description && description.textContent.length > 80) {
      card.classList.add('expandable');
      
      // Only expand when clicking on "Ver más" indicator
      if (expandIndicator) {
        expandIndicator.style.cursor = 'pointer';
        expandIndicator.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!card.classList.contains('expanded')) {
            expandCard(card);
          }
        });
      }
    }
    
    // Close button
    const closeBtn = card.querySelector('.item-card-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (card.classList.contains('expanded')) {
          collapseCard(card);
        }
      });
    }
  });

  // Click backdrop to close
  backdrop.addEventListener('click', () => {
    if (expandedCard) {
      collapseCard(expandedCard);
    }
  });

  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && expandedCard) {
      collapseCard(expandedCard);
    }
  });

  function expandCard(card) {
    // Store scroll position
    card.dataset.scrollY = window.scrollY;

    // Add placeholder to maintain layout
    const rect = card.getBoundingClientRect();
    const placeholder = document.createElement('div');
    placeholder.className = 'card-placeholder';
    placeholder.style.width = rect.width + 'px';
    placeholder.style.height = rect.height + 'px';
    card.parentNode.insertBefore(placeholder, card);
    card._placeholder = placeholder;

    // Expand
    expandedCard = card;
    card.classList.add('expanded');
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus close button for accessibility
    const closeBtn = card.querySelector('.item-card-close');
    if (closeBtn) {
      setTimeout(() => closeBtn.focus(), 100);
    }
  }

  function collapseCard(card) {
    card.classList.remove('expanded');
    backdrop.classList.remove('active');
    document.body.style.overflow = '';

    // Remove placeholder
    if (card._placeholder) {
      card._placeholder.remove();
      card._placeholder = null;
    }

    // Restore scroll position
    if (card.dataset.scrollY) {
      window.scrollTo(0, parseInt(card.dataset.scrollY));
    }

    expandedCard = null;
  }
}
