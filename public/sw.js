/* Cache only an explicit public application shell. APIs and order files always use the network. */
const CACHE='jasahub-shell-pwa-v1';
const SHELL=['/','/offline.html','/assets/emerald.css','/assets/jasahub.js','/assets/emerald.js','/assets/pwa.js','/assets/logo-website.png','/assets/icons/icon-192.png','/assets/icons/icon-512.png','/assets/icons/icon-maskable-512.png','/manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('jasahub-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.search)return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).catch(()=>caches.match('/offline.html')));return;
 }
 if(!SHELL.includes(url.pathname))return;
 event.respondWith(fetch(req).then(response=>{if(response.ok&&response.type==='basic'){const copy=response.clone();return caches.open(CACHE).then(c=>c.put(req,copy)).then(()=>response);}return response;}).catch(()=>caches.match(req)));
});
