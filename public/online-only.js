// Retire only this site's old offline worker; preserve saved user data.
(async () => {
  if (!('serviceWorker' in navigator)) return;
  const workerUrl = new URL('sw.js', document.baseURI).href;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    const worker = registration.active || registration.waiting || registration.installing;
    if (worker?.scriptURL !== workerUrl) continue;
    // Updating activates the no-cache worker for already controlled tabs too.
    try { await registration.update(); } catch { /* Retry on the next online visit. */ }
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('agro-offline-')).map(key => caches.delete(key)));
  }
})().catch(() => {});
