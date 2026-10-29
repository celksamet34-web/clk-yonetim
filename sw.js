// Uygulama olarak kurulabilsin diye. Önbellek tutulmaz: her açılışta en son yayınlanan sürüm gelir.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
