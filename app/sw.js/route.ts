// Service worker servi à la racine (/sw.js) : affiche les notifications push et ouvre l'appli au clic.
export const dynamic = 'force-static'

const SW = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'Riad Anyssates', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Riad Anyssates', {
    body: d.body || '',
    data: { url: d.url || '/manager' },
    tag: d.tag ? d.tag + '-' + Date.now() : undefined,
    icon: '/icon.svg',
    badge: '/icon.svg',
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/manager';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { await c.focus(); if ('navigate' in c) { try { await c.navigate(url); } catch (e) {} } return; } }
    await self.clients.openWindow(url);
  })());
});
`

export function GET() {
  return new Response(SW, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    },
  })
}
