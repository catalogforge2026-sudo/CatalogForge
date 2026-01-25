// Bold Theme - JavaScript
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.section-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
});
