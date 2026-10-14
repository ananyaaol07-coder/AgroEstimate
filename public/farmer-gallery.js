const gallery = document.querySelector('.farmer-gallery');
if (gallery) {
  const cards = gallery.querySelectorAll('.farmer-card');
  let paused = false;
  const render = () => {
    gallery.classList.toggle('is-paused', paused);
    cards.forEach(card => card.setAttribute('aria-pressed', String(paused)));
  };
  gallery.addEventListener('click', event => {
    if (!event.target.closest('.farmer-card')) return;
    paused = !paused;
    render();
  });
  render();
}
