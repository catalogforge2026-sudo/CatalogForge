/* Beauty Theme - Main Script */
(function() {
  'use strict';
  
  // Add theme class to body
  document.body.classList.add('theme-beauty');
  
  // Smooth reveal animation for cards
  function initCardAnimations() {
    const cards = document.querySelectorAll('.item-card');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
          }, index * 100);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    cards.forEach(card => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      observer.observe(card);
    });
  }
  
  // Touch support for showing price on mobile
  function initTouchSupport() {
    const cards = document.querySelectorAll('.item-card');
    let lastTouchedCard = null;
    
    cards.forEach(card => {
      card.addEventListener('touchstart', function(e) {
        // Remove touched class from previous card
        if (lastTouchedCard && lastTouchedCard !== this) {
          lastTouchedCard.classList.remove('touched');
        }
        
        // Toggle touched class on current card
        this.classList.add('touched');
        lastTouchedCard = this;
      }, { passive: true });
    });
    
    // Remove touched class when tapping outside
    document.addEventListener('touchstart', function(e) {
      if (!e.target.closest('.item-card')) {
        if (lastTouchedCard) {
          lastTouchedCard.classList.remove('touched');
          lastTouchedCard = null;
        }
      }
    }, { passive: true });
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initCardAnimations();
      initTouchSupport();
    });
  } else {
    initCardAnimations();
    initTouchSupport();
  }
})();
