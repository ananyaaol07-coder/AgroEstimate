// Retirement worker: remove the previous offline cache without touching history.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('agro-offline-')).map(key => caches.delete(key)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
// No fetch handler: all requests use the network normally.
