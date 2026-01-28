/**
 * Mixology Theme - Interactive Features
 * Bar & Cocktail Premium Theme
 */

document.addEventListener('DOMContentLoaded', function() {
  // Casero preset: split header text into two lines
  initCaseroHeader();
  
  // Divertido preset: split header text into two lines (same as casero)
  initDivertidoHeader();
  
  // Smooth scroll for navigation
  initSmoothScroll();
  
  // Sticky header shadow
  initStickyHeader();
  
  // Lazy load images with fade effect
  initLazyImages();
  
  // Section type detection
  initSectionTypes();
  
  // Promotions carousel
  initPromotionsCarousel();
});

/**
 * Casero Preset: Split header text into two lines
 * First word on top, rest below - simulating the neon logo style
 */
function initCaseroHeader() {
  // Only apply if body has font-casero class
  if (!document.body.classList.contains('font-casero')) return;
  
  const headerSubtitle = document.querySelector('.header-subtitle');
  const headerText = document.querySelector('.header-text');
  if (!headerSubtitle) return;
  
  // Get text and remove quotes if present
  let text = headerSubtitle.textContent.trim();
  text = text.replace(/["""'']/g, ''); // Remove any quotes
  
  const words = text.split(/\s+/);
  
  if (words.length >= 2) {
    // First word on top, rest below
    const firstWord = words[0];
    const restWords = words.slice(1).join(' ');
    
    headerSubtitle.innerHTML = `<span class="casero-line-1">${firstWord}</span><span class="casero-line-2">${restWords}</span>`;
  } else {
    // Single word: just display it
    headerSubtitle.innerHTML = `<span class="casero-line-2">${text}</span>`;
  }
  
  // Add touch flicker effect for mobile
  if (headerText) {
    headerText.addEventListener('touchstart', function() {
      this.classList.add('neon-flicker');
    }, { passive: true });
    
    headerText.addEventListener('touchend', function() {
      // Remove class after animation completes
      setTimeout(() => {
        this.classList.remove('neon-flicker');
      }, 800);
    }, { passive: true });
    
    // Also trigger on click for desktop testing
    headerText.addEventListener('click', function() {
      this.classList.add('neon-flicker');
      setTimeout(() => {
        this.classList.remove('neon-flicker');
      }, 800);
    });
  }
}

/**
 * Divertido Preset: Split header text into two lines
 * First word on top, rest below - simulating the neon logo style (same as casero but with Curlz MT)
 */
function initDivertidoHeader() {
  // Only apply if body has font-divertido class
  if (!document.body.classList.contains('font-divertido')) return;
  
  const headerSubtitle = document.querySelector('.header-subtitle');
  const headerText = document.querySelector('.header-text');
  if (!headerSubtitle) return;
  
  // Get text and remove quotes if present
  let text = headerSubtitle.textContent.trim();
  text = text.replace(/["""'']/g, ''); // Remove any quotes
  
  const words = text.split(/\s+/);
  
  if (words.length >= 2) {
    // First word on top, rest below
    const firstWord = words[0];
    const restWords = words.slice(1).join(' ');
    
    headerSubtitle.innerHTML = `<span class="casero-line-1">${firstWord}</span><span class="casero-line-2">${restWords}</span>`;
  } else {
    // Single word: just display it
    headerSubtitle.innerHTML = `<span class="casero-line-2">${text}</span>`;
  }
  
  // Add touch flicker effect for mobile
  if (headerText) {
    headerText.addEventListener('touchstart', function() {
      this.classList.add('neon-flicker');
    }, { passive: true });
    
    headerText.addEventListener('touchend', function() {
      // Remove class after animation completes
      setTimeout(() => {
        this.classList.remove('neon-flicker');
      }, 800);
    }, { passive: true });
    
    // Also trigger on click for desktop testing
    headerText.addEventListener('click', function() {
      this.classList.add('neon-flicker');
      setTimeout(() => {
        this.classList.remove('neon-flicker');
      }, 800);
    });
  }
}

/**
 * Divertido Preset: Split header text into two lines (same as casero but with Curlz MT)
 * First word on top, rest below - simulating the neon logo style
 */
function initDivertidoHeader() {
  // Only apply if body has font-divertido class
  if (!document.body.classList.contains('font-divertido')) return;
  
  const headerSubtitle = document.querySelector('.header-subtitle');
  const headerText = document.querySelector('.header-text');
  if (!headerSubtitle) return;
  
  // Get text and remove quotes if present
  let text = headerSubtitle.textContent.trim();
  text = text.replace(/["""'']/g, ''); // Remove any quotes
  
  const words = text.split(/\s+/);
  
  if (words.length >= 2) {
    // First word on top, rest below
    const firstWord = words[0];
    const restWords = words.slice(1).join(' ');
    
    headerSubtitle.innerHTML = `<span class="casero-line-1">${firstWord}</span><span class="casero-line-2">${restWords}</span>`;
  } else {
    // Single word: just display it
    headerSubtitle.innerHTML = `<span class="casero-line-2">${text}</span>`;
  }
  
  // Add touch flicker effect for mobile
  if (headerText) {
    headerText.addEventListener('touchstart', function() {
      this.classList.add('neon-flicker');
    }, { passive: true });
    
    headerText.addEventListener('touchend', function() {
      // Remove class after animation completes
      setTimeout(() => {
        this.classList.remove('neon-flicker');
      }, 800);
    }, { passive: true });
    
    // Also trigger on click for desktop testing
    headerText.addEventListener('click', function() {
      this.classList.add('neon-flicker');
      setTimeout(() => {
        this.classList.remove('neon-flicker');
      }, 800);
    });
  }
}

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
 * Promotions Carousel with Autoplay & Glow Effects
 * Horizontal cards with neon glow borders
 */
function initPromotionsCarousel() {
  const carousel = document.querySelector('.promotions-carousel');
  if (!carousel) return;
  
  const track = carousel.querySelector('.carousel-track');
  const cards = carousel.querySelectorAll('.promo-card');
  const dots = carousel.querySelectorAll('.carousel-dot');
  const prevBtn = carousel.querySelector('.carousel-prev');
  const nextBtn = carousel.querySelector('.carousel-next');
  
  if (cards.length === 0) return;
  
  let currentIndex = 0;
  let autoplayInterval = null;
  const autoplayDelay = parseInt(carousel.dataset.autoplay) || 5000;
  
  // Add floating effect on click
  cards.forEach(card => {
    card.addEventListener('click', function(e) {
      // Don't trigger if clicking a link
      if (e.target.tagName === 'A') return;
      
      // Add floating class
      this.classList.add('floating');
      
      // Remove after animation
      setTimeout(() => {
        this.classList.remove('floating');
      }, 600);
    });
    
    // Touch feedback for mobile
    card.addEventListener('touchstart', function() {
      this.classList.add('floating');
    }, { passive: true });
    
    card.addEventListener('touchend', function() {
      setTimeout(() => {
        this.classList.remove('floating');
      }, 300);
    }, { passive: true });
  });
  
  // Calculate visible cards based on screen size
  function getVisibleCards() {
    const width = window.innerWidth;
    if (width < 600) return 1;
    if (width < 900) return 1;
    return Math.min(2, cards.length);
  }
  
  // Get max index based on visible cards
  function getMaxIndex() {
    const visible = getVisibleCards();
    return Math.max(0, cards.length - visible);
  }
  
  // Update carousel position
  function goToSlide(index, instant = false) {
    const maxIndex = getMaxIndex();
    currentIndex = Math.max(0, Math.min(index, maxIndex));
    
    if (window.innerWidth < 600) {
      // Mobile: scroll within track only (not the whole page)
      const card = cards[currentIndex];
      if (card && track) {
        const cardWidth = card.offsetWidth + 12; // width + gap
        const scrollPosition = currentIndex * cardWidth;
        // Use instant scroll for loop transitions to avoid visual glitches
        track.scrollTo({ 
          left: scrollPosition, 
          behavior: instant ? 'instant' : 'smooth' 
        });
      }
    } else {
      // Desktop: transform
      const cardWidth = cards[0].offsetWidth;
      const gap = 16; // gap from CSS
      const offset = currentIndex * (cardWidth + gap);
      track.style.transform = `translateX(-${offset}px)`;
    }
    
    updateDots();
  }
  
  // Update active dot
  function updateDots() {
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentIndex);
    });
  }
  
  // Next slide
  function nextSlide() {
    const maxIndex = getMaxIndex();
    if (currentIndex >= maxIndex) {
      goToSlide(0, true); // Loop back instantly to avoid scroll glitch
    } else {
      goToSlide(currentIndex + 1);
    }
  }
  
  // Previous slide
  function prevSlide() {
    if (currentIndex <= 0) {
      goToSlide(getMaxIndex(), true); // Loop to end instantly
    } else {
      goToSlide(currentIndex - 1);
    }
  }
  
  // Start autoplay
  function startAutoplay() {
    stopAutoplay();
    // Disable autoplay on mobile to prevent scroll issues
    if (window.innerWidth >= 600 && cards.length > getVisibleCards()) {
      autoplayInterval = setInterval(nextSlide, autoplayDelay);
    }
  }
  
  // Stop autoplay
  function stopAutoplay() {
    if (autoplayInterval) {
      clearInterval(autoplayInterval);
      autoplayInterval = null;
    }
  }
  
  // Event listeners for dots
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      goToSlide(i);
      startAutoplay(); // Reset autoplay
    });
  });
  
  // Event listeners for buttons
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      prevSlide();
      startAutoplay();
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      nextSlide();
      startAutoplay();
    });
  }
  
  // Pause on hover (desktop)
  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);
  
  // Touch support for mobile swipe
  let touchStartX = 0;
  let touchEndX = 0;
  
  track.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    stopAutoplay();
  }, { passive: true });
  
  track.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
    startAutoplay();
  }, { passive: true });
  
  function handleSwipe() {
    const diff = touchStartX - touchEndX;
    const threshold = 50;
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  }
  
  // Mobile scroll detection for dots update
  if (window.innerWidth < 600) {
    let scrollTimeout;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollLeft = track.scrollLeft;
        const cardWidth = cards[0].offsetWidth + 12; // width + gap
        const newIndex = Math.round(scrollLeft / cardWidth);
        if (newIndex !== currentIndex && newIndex >= 0 && newIndex < cards.length) {
          currentIndex = newIndex;
          updateDots();
        }
      }, 100);
    }, { passive: true });
  }
  
  // Handle resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      goToSlide(Math.min(currentIndex, getMaxIndex()));
      startAutoplay();
    }, 200);
  });
  
  // Start autoplay
  startAutoplay();
  
  // Pause when page is not visible
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoplay();
    } else {
      startAutoplay();
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
