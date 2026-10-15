/* RCP's-GAMES Tavla — çevrimdışı önbellek
 * Güncelleme yaparken: aşağıdaki V'yi bir artır VE index.html'deki ?v= numaralarını aynı sayıya getir. */
const V = '8';
const CACHE = 'rcp-tavla-v' + V;
const FILES = ['firebase-config.js', 'engine.js', 'sound.js', 'net.js', 'chat.js', 'fal.js', 'bot.js', 'music.js', 'voice.js', 'scene3d.js', 'cafe.js', 'app.js', 'style.css'];
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'].concat(FILES.map(f => './' + f + '?v=' + V));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (/firebaseio\.com|firebasedatabase\.app|identitytoolkit/.test(url.host + url.pathname)) return;
  // Kütüphaneler ve fontlar: önce önbellek
  if (/fonts\.(googleapis|gstatic)\.com|www\.gstatic\.com|cdnjs\.cloudflare\.com/.test(url.host)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // Uygulama dosyaları: her zaman sunucuya sor (tarayıcı önbelleğini atla), internet yoksa önbellekten ver
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
