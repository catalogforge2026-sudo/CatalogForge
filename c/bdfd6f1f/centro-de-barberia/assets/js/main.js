/**
 * Barber Theme - Main JavaScript
 * Funcionalidad interactiva para el tema de barbería
 */

(function() {
  'use strict';

  // Touch support para cards
  function initTouchSupport() {
    const cards = document.querySelectorAll('.item-card');
    
    cards.forEach(card => {
      card.addEventListener('touchstart', function(e) {
        // Remover clase touched de otras cards
        cards.forEach(c => {
          if (c !== this) c.classList.remove('touched');
        });
        // Toggle en la card actual
        this.classList.toggle('touched');
      }, { passive: true });
    });

    // Cerrar al tocar fuera
    document.addEventListener('touchstart', function(e) {
      if (!e.target.closest('.item-card')) {
        cards.forEach(card => card.classList.remove('touched'));
      }
    }, { passive: true });
  }

  // Smooth scroll para navegación
  function initSmoothScroll() {
    const navLinks = document.querySelectorAll('.section-nav a[href^="#"]');
    
    navLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  // Animación de entrada para cards
  function initScrollAnimations() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    const cards = document.querySelectorAll('.item-card');
    cards.forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = `opacity 0.5s ease ${index * 0.05}s, transform 0.5s ease ${index * 0.05}s`;
      observer.observe(card);
    });
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    initTouchSupport();
    initSmoothScroll();
    initScrollAnimations();
  }
})();
