// Bold Theme - JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // Establecer la imagen de sección como variable CSS para el pseudo-elemento
  document.querySelectorAll('.section-nav a[data-section-image]').forEach(link => {
    const imageUrl = link.getAttribute('data-section-image');
    if (imageUrl) {
      link.style.setProperty('--section-image', `url('${imageUrl}')`);
    }
  });

  document.querySelectorAll('.section-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
});
