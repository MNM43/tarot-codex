// Tarot Codex PWA Service Worker
// 策略（照搬 MNM 的稳健做法）：导航(HTML) 联网优先，静态资源(JS/CSS/图标，文件名带 hash) 缓存优先。
// 目的：每次部署后手机都能自动拿到最新 index.html，避免旧缓存导致排版/功能异常。
const CACHE = 'tarot-shell-v1'
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/tarot-icon.svg',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return

  const accept = req.headers.get('accept') || ''
  const isNavigation = req.mode === 'navigate' || accept.includes('text/html')

  // 导航 / HTML：联网优先，拿到最新页面；断网才回退缓存
  if (isNavigation) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html'))),
    )
    return
  }

  // 静态资源：缓存优先，未命中再联网并写入缓存（文件名带 hash，天然防旧）
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
            return res
          })
          .catch(() => caches.match('./index.html')),
    ),
  )
})
