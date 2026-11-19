/* Push only: this worker does not cache pages, tokens, or attendance data. */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* show safe default */ }
  const test = data.kind === 'test';
  event.waitUntil(self.registration.showNotification(test ? 'EDVA · Prueba de avisos' : 'EDVA · Hora de comida', {
    body: test ? 'Este dispositivo puede recibir tus recordatorios de comida.' : 'Recuerda tomar tu hora de comida y registrar tu salida.',
    icon: '/meal-icon-192.png', badge: '/meal-icon-192.png', tag: test ? 'edva-meal-test' : 'edva-meal',
    renotify: false, data: { url:'/promoter/attendance' },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('/promoter/attendance',self.location.origin).href;
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const own = windows.find(client => new URL(client.url).origin === self.location.origin);
    if(own) { await own.navigate(url); return own.focus(); }
    return self.clients.openWindow(url);
  })());
});
