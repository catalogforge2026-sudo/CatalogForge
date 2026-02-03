/* Spa Theme - Main JavaScript */

// Deshabilitar expandable cards para este tema
window.EXPANDABLE_CARDS_DISABLED = true;

document.addEventListener('DOMContentLoaded', function() {
  // Add sparkle animation to cards on hover
  const cards = document.querySelectorAll('.item-card');
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.setProperty('--sparkle-opacity', '1');
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.setProperty('--sparkle-opacity', '0');
    });
  });
  
  // Smooth scroll for navigation
  const navLinks = document.querySelectorAll('.section-nav a');
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      // Remove active class from all
      navLinks.forEach(l => l.classList.remove('active'));
      // Add to clicked
      this.classList.add('active');
    });
  });
  
  // Set first nav item as active by default
  if (navLinks.length > 0) {
    navLinks[0].classList.add('active');
  }
});
