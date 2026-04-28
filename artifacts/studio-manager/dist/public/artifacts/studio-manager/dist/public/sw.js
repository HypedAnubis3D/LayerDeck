self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

self.addEventListener('push', function(event) {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { return; }

  const isPrintComplete = data.type === 'print-complete';

  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: isPrintComplete ? [200, 100, 200, 100, 200] : [200],
    data: { type: data.type, printId: data.printId || null },
    requireInteraction: isPrintComplete,
    actions: isPrintComplete ? [
      { action: 'confirm-done',    title: '✓ Yes, it finished!' },
      { action: 'still-printing', title: '⏱ Still going' },
    ] : [],
    tag: data.type + (data.printId ? '-' + data.printId : ''),
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'HypedAnubis3D', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const d = event.notification.data || {};

  if (event.action === 'confirm-done' && d.printId) {
    event.waitUntil(
      fetch('/api/push/confirm-print/' + d.printId, { method: 'POST' })
        .then(() => clients.openWindow('/?push-action=confirm-print&id=' + d.printId))
        .catch(() => clients.openWindow('/'))
    );
  } else if (event.action === 'still-printing' && d.printId) {
    event.waitUntil(
      fetch('/api/push/watch-print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.printId, extendMins: 30 }),
      }).catch(() => {})
    );
  } else {
    const url = d.type === 'order-aging' ? '/?tab=orders'
              : d.type === 'convention-tomorrow' || d.type === 'convention-soon' ? '/?tab=convention'
              : '/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
        const existing = cs.find((c) => c.url.includes(self.location.origin));
        if (existing) { existing.focus(); existing.postMessage({ type: 'push-nav', tab: d.type }); }
        else clients.openWindow(url);
      })
    );
  }
});
