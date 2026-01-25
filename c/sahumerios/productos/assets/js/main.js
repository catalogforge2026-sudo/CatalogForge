/**
 * Stream Theme - Main JavaScript
 * Modern streaming-style interactions
 */

(function() {
  'use strict';

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    initSmoothScroll();
    initNavHighlight();
    initCardInteractions();
    initHorizontalScroll();
    initLazyLoading();
  }

  /**
   * Smooth scroll for navigation links
   */
  function initSmoothScroll() {
    document.querySelectorAll('.section-nav a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').slice(1);
        const target = document.getElementById(targetId);
        
        if (target) {
          const headerHeight = document.querySelector('.site-header')?.offsetHeight || 0;
          const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });

          // Update active state
          document.querySelectorAll('.section-nav a').forEach(a => a.classList.remove('active'));
          link.classList.add('active');
        }
      });
    });
  }

  /**
   * Highlight active section in navigation
   */
  function initNavHighlight() {
    const sections = document.querySelectorAll('.catalog-section');
    const navLinks = document.querySelectorAll('.section-nav a');
    
    if (!sections.length || !navLinks.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
          });
        }
      });
    }, {
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    });

    sections.forEach(section => observer.observe(section));
  }

  /**
   * Card hover interactions
   * El botón del carrito aparece automáticamente en hover via CSS
   */
  function initCardInteractions() {
    const cards = document.querySelectorAll('.item-card');
    
    cards.forEach(card => {
      // Add subtle parallax effect on hover
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px) scale(1.02)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /**
   * Horizontal scroll with mouse wheel on mobile-style grids
   */
  function initHorizontalScroll() {
    const grids = document.querySelectorAll('.items-grid');
    
    grids.forEach(grid => {
      // Check if grid is in horizontal scroll mode
      if (getComputedStyle(grid).display === 'flex') {
        grid.addEventListener('wheel', (e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault();
            grid.scrollLeft += e.deltaY;
          }
        }, { passive: false });
      }
    });
  }

  /**
   * Lazy loading for images with fade-in effect
   */
  function initLazyLoading() {
    const images = document.querySelectorAll('.item-image img[loading="lazy"]');
    
    images.forEach(img => {
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.4s ease';
      
      if (img.complete) {
        img.style.opacity = '1';
      } else {
        img.addEventListener('load', () => {
          img.style.opacity = '1';
        });
      }
    });
  }

})();
