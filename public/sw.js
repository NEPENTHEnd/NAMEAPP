// Name Teknik — push bildirim service worker'ı
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  let veri = {}
  try {
    veri = event.data ? event.data.json() : {}
  } catch {
    veri = { baslik: "Name Teknik", govde: event.data ? event.data.text() : "" }
  }
  const baslik = veri.baslik || "Name Teknik"
  const secenekler = {
    body: veri.govde || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: veri.url || "/" },
    tag: veri.tag || undefined,
  }
  event.waitUntil(self.registration.showNotification(baslik, secenekler))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const hedef = (event.notification.data && event.notification.data.url) || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((liste) => {
      for (const c of liste) {
        if ("focus" in c) {
          c.navigate(hedef)
          return c.focus()
        }
      }
      return self.clients.openWindow(hedef)
    })
  )
})
