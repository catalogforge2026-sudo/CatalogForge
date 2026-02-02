/**
 * Natura Theme - Main JavaScript
 * Handles cover page interactions and smooth transitions
 */

(function() {
  'use strict';

  // Wait for DOM ready
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    setupCoverPage();
    setupSmoothScroll();
    setupScrollIndicator();
    setupHeaderVisibility();
  }

  /**
   * Setup cover page button click
   */
  function setupCoverPage() {
    const coverButton = document.querySelector('.cover-button');
    const catalogPage = document.querySelector('.catalog-page');
    
    if (coverButton && catalogPage) {
      coverButton.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Smooth scroll to catalog section
        catalogPage.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      });
    }
  }

  /**
   * Setup smooth scrolling for all anchor links
   */
  function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  /**
   * Setup scroll indicator animation
   */
  function setupScrollIndicator() {
    const scrollIndicator = document.querySelector('.cover-scroll-indicator');
    
    if (scrollIndicator) {
      // Hide indicator when user scrolls past cover
      let hidden = false;
      
      window.addEventListener('scroll', function() {
        const scrollY = window.scrollY;
        const coverHeight = window.innerHeight * 0.5;
        
        if (scrollY > coverHeight && !hidden) {
          scrollIndicator.style.opacity = '0';
          scrollIndicator.style.pointerEvents = 'none';
          hidden = true;
        } else if (scrollY <= coverHeight && hidden) {
          scrollIndicator.style.opacity = '1';
          scrollIndicator.style.pointerEvents = 'auto';
          hidden = false;
        }
      });

      // Click on indicator scrolls to catalog
      scrollIndicator.addEventListener('click', function() {
        const catalogPage = document.querySelector('.catalog-page');
        if (catalogPage) {
          catalogPage.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    }
  }

  /**
   * Setup header visibility based on scroll position
   */
  function setupHeaderVisibility() {
    const header = document.querySelector('.header');
    const coverPage = document.querySelector('.cover-page');
    
    if (!header || !coverPage) return;
    
    // Initially hide header when on cover page
    header.style.transform = 'translateY(-100%)';
    header.style.transition = 'transform 0.3s ease';
    
    let lastScrollY = 0;
    let headerVisible = false;
    
    window.addEventListener('scroll', function() {
      const scrollY = window.scrollY;
      const coverHeight = coverPage.offsetHeight;
      
      // Show header after scrolling past cover
      if (scrollY > coverHeight - 100) {
        if (!headerVisible) {
          header.style.transform = 'translateY(0)';
          headerVisible = true;
        }
      } else {
        if (headerVisible) {
          header.style.transform = 'translateY(-100%)';
          headerVisible = false;
        }
      }
      
      lastScrollY = scrollY;
    });
  }

  /**
   * Parallax effect for cover background (optional, subtle)
   */
  function setupParallax() {
    const coverBg = document.querySelector('.cover-background img');
    
    if (!coverBg) return;
    
    window.addEventListener('scroll', function() {
      const scrollY = window.scrollY;
      const coverHeight = window.innerHeight;
      
      if (scrollY < coverHeight) {
        const parallaxOffset = scrollY * 0.3;
        coverBg.style.transform = `translateY(${parallaxOffset}px) scale(1.1)`;
      }
    });
  }

})();
