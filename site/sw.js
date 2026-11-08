// App shell + data.json: stale-while-revalidate (instant on weak signal; tells the page when something changed).
// t/* and vendor/*: cache-first, cached only when used (keeps device storage small). URLs carry ?v= so revisions bust.
const SHELL = 'shell';
const FILES = 'files';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(['./', 'style.css', 'app.js', 'data.json', 'icon.svg', 'app.webmanifest', 'img/header.jpg', 'img/footer.jpg'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

const notify = () => self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage('update')));

async function swr(e) {
  const c = await caches.open(SHELL);
  const hit = await c.match(e.request, { ignoreSearch: true });
  const old = hit && hit.clone();
  const net = fetch(e.request).then(async r => {
    if (r.ok) {
      if (old && (await old.text()) !== (await r.clone().text())) notify();
      await c.put(e.request, r.clone());
    }
    return r;
  });
  if (hit) {
    e.waitUntil(net.catch(() => {}));
    return hit;
  }
  return net.catch(() => c.match('./'));
}

async function cacheFirst(req) {
  const c = await caches.open(FILES);
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok) await c.put(req, r.clone());
  return r;
}

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(/\/(t|vendor)\//.test(u.pathname) ? cacheFirst(e.request) : swr(e));
});
