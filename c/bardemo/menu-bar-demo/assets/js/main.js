/**
 * Mixology Theme - Interactive Features
 * Bar & Cocktail Premium Theme
 */

document.addEventListener('DOMContentLoaded', function() {
  // Smooth scroll for navigation
  initSmoothScroll();
  
  // Sticky header shadow
  initStickyHeader();
  
  // Lazy load images with fade effect
  initLazyImages();
  
  // Section type detection
  initSectionTypes();
});

/**
 * Smooth scroll to sections
 */
function initSmoothScroll() {
  document.querySelectorAll('.section-nav a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const target = document.querySelector(targetId);
      
      if (target) {
        const headerHeight = document.querySelector('.site-header')?.offsetHeight || 0;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
        
        // Update active state
        document.querySelectorAll('.section-nav a').forEach(a => a.classList.remove('active'));
        this.classList.add('active');
      }
    });
  });
}

/**
 * Sticky header with shadow on scroll
 */
function initStickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  
  let lastScroll = 0;
  
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 50) {
      header.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.3)';
    } else {
      header.style.boxShadow = 'none';
    }
    
    lastScroll = currentScroll;
  }, { passive: true });
}

/**
 * Lazy load images with fade effect
 */
function initLazyImages() {
  const images = document.querySelectorAll('.item-image img');
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          img.style.opacity = '1';
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.1
    });
    
    images.forEach(img => {
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.5s ease';
      imageObserver.observe(img);
    });
  }
}

/**
 * Auto-detect section types based on content
 * Adds .section-food or .section-drinks class
 */
function initSectionTypes() {
  const sections = document.querySelectorAll('.catalog-section');
  
  sections.forEach(section => {
    const title = section.querySelector('.section-title')?.textContent?.toLowerCase() || '';
    
    // Keywords for drinks
    const drinkKeywords = ['bebida', 'drink', 'cocktail', 'coctel', 'gin', 'vodka', 'whisky', 
                          'tequila', 'mezcal', 'ron', 'cerveza', 'beer', 'vino', 'wine', 
                          'shot', 'trago', 'licor', 'spirit'];
    
    // Keywords for food
    const foodKeywords = ['comida', 'food', 'plato', 'entrada', 'principal', 'postre', 
                         'hamburguesa', 'pizza', 'taco', 'snack', 'appetizer', 'dessert'];
    
    const isDrinks = drinkKeywords.some(keyword => title.includes(keyword));
    const isFood = foodKeywords.some(keyword => title.includes(keyword));
    
    if (isDrinks && !section.classList.contains('section-food')) {
      section.classList.add('section-drinks');
    } else if (isFood || !isDrinks) {
      section.classList.add('section-food');
    }
  });
}

/**
 * Highlight active section in navigation on scroll
 */
function initScrollSpy() {
  const sections = document.querySelectorAll('.catalog-section[id]');
  const navLinks = document.querySelectorAll('.section-nav a');
  
  if (sections.length === 0 || navLinks.length === 0) return;
  
  const observerOptions = {
    rootMargin: '-20% 0px -80% 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, observerOptions);
  
  sections.forEach(section => observer.observe(section));
}

// Initialize scroll spy after DOM is ready
document.addEventListener('DOMContentLoaded', initScrollSpy);
