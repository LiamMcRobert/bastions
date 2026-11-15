/* Bastions : mise en cache pour jouer hors ligne.
   - Page du jeu : « réseau d'abord ». Avec une connexion, la dernière version déposée sur GitHub
     s'affiche dès le lancement (simple vérification si rien n'a changé) ; sans connexion ou si le
     réseau tarde plus de 4 s, la copie gardée sur l'appareil est utilisée.
   - Icônes et manifeste : servis depuis le cache puis rafraîchis en arrière-plan.
   - Vérification de mise à jour (index.html?check=…) : toujours en direct, jamais mise en cache.
   - Le classement (script.google.com) n'est jamais mis en cache : il est toujours lu en direct. */
const CACHE = 'bastions-v4';   // changer ce nom force le rafraîchissement des icônes et du manifeste
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;   // autres sites : non interceptés
  if (url.searchParams.has('check')) { e.respondWith(fetch(e.request, { cache: 'no-store' })); return; }
  const isPage = e.request.mode === 'navigate' || url.pathname.endsWith('/index.html');
  if (isPage) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const fromNet = fetch(e.request, { cache: 'no-cache' }).then(res => {   // revalide auprès de GitHub
        if (res.ok) cache.put('./', res.clone());
        return res;
      });
      const timeout = new Promise(resolve => setTimeout(resolve, 4000));
      try {
        const res = await Promise.race([fromNet, timeout]);
        if (res) return res;
      } catch (err) { /* hors ligne : copie locale ci-dessous */ }
      return (await cache.match('./')) || fromNet;
    })());
    return;
  }
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request)
      .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
      .catch(() => cached);
    return cached || fresh;
  }));
});
