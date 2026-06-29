"use client"

import { useEffect, useState } from "react"

import { pushAbone, pushCikis } from "@/app/actions/push"

type Durum = "kontrol" | "destekyok" | "kapali" | "acik" | "islemde" | "reddedildi"

// VAPID public anahtarını pushManager için Uint8Array'e çevirir.
function anahtarCevir(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const ham = atob(b64)
  const buf = new ArrayBuffer(ham.length)
  const cikti = new Uint8Array(buf)
  for (let i = 0; i < ham.length; i++) cikti[i] = ham.charCodeAt(i)
  return cikti
}

export function PushDugmesi() {
  const [durum, setDurum] = useState<Durum>("kontrol")

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setDurum("destekyok")
      return
    }
    if (Notification.permission === "denied") {
      setDurum("reddedildi")
      return
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setDurum(sub ? "acik" : "kapali"))
      .catch(() => setDurum("kapali"))
  }, [])

  async function ac() {
    setDurum("islemde")
    try {
      const reg = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready
      const izin = await Notification.requestPermission()
      if (izin !== "granted") {
        setDurum(izin === "denied" ? "reddedildi" : "kapali")
        return
      }
      const anahtar = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!anahtar) {
        setDurum("destekyok")
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: anahtarCevir(anahtar),
      })
      const json = sub.toJSON()
      const r = await pushAbone({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      })
      setDurum(r.ok ? "acik" : "kapali")
    } catch {
      setDurum("kapali")
    }
  }

  async function kapat() {
    setDurum("islemde")
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await pushCikis(sub.endpoint)
        await sub.unsubscribe()
      }
      setDurum("kapali")
    } catch {
      setDurum("acik")
    }
  }

  if (durum === "destekyok") {
    return (
      <div className="px-2.5 py-2 text-[11.5px] leading-snug text-muted-foreground">
        Bu cihaz/tarayıcı push bildirimi desteklemiyor. (iPhone&apos;da uygulamayı
        ana ekrana ekleyin.)
      </div>
    )
  }
  if (durum === "reddedildi") {
    return (
      <div className="px-2.5 py-2 text-[11.5px] leading-snug text-muted-foreground">
        Bildirim izni engellenmiş. Tarayıcı/site ayarlarından izin verin.
      </div>
    )
  }

  const acikMi = durum === "acik"
  return (
    <button
      type="button"
      disabled={durum === "islemde" || durum === "kontrol"}
      onClick={acikMi ? kapat : ac}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-muted disabled:opacity-60"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {durum === "kontrol"
        ? "Bildirimler…"
        : durum === "islemde"
          ? "İşleniyor…"
          : acikMi
            ? "Bildirimler açık · kapat"
            : "Telefon bildirimlerini aç"}
    </button>
  )
}
