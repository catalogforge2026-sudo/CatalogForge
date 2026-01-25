/* Ice Cream Theme - Main JavaScript */

document.addEventListener('DOMContentLoaded', function() {
  // Add bounce animation to cards on hover
  const cards = document.querySelectorAll('.item-card');
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-8px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0) scale(1)';
    });
  });
  
  // Smooth scroll for navigation
  const navLinks = document.querySelectorAll('.section-nav a');
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      navLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
    });
  });
  
  // Set first nav item as active by default
  if (navLinks.length > 0) {
    navLinks[0].classList.add('active');
  }
  
  // Add ripple effect to buttons
  const buttons = document.querySelectorAll('.item-add-cart, .btn-primary');
  buttons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      ripple.classList.add('ripple');
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
});
