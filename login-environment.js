// Classic script also runs when a page is accidentally opened using file://.
if (location.protocol === 'file:') {
  const form = document.querySelector('.auth-form');
  form?.addEventListener('submit', event => event.preventDefault());
  const button = form?.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  const box = document.querySelector('.form-message');
  if (box) {
    box.textContent = 'Login needs the local website server. Open this page using the link below. ';
    const link = document.createElement('a');
    const page = location.pathname.split('/').pop();
    link.href = 'http://127.0.0.1:8000/' + page;
    link.textContent = 'Open the local website';
    box.append(link);
  }
}
