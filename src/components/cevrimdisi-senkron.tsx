"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { isOlustur } from "@/app/actions/is"
import { createClient } from "@/lib/supabase/client"
import { fotograflariYukle } from "@/lib/foto-istemci"
import { kuyrukListe, kuyruktanSil, type BekleyenIs } from "@/lib/cevrimdisi-kuyruk"
import { kaydedildiGoster } from "@/lib/toast"

// Çevrimdışı girilen yeni işleri, internet gelince sunucuya yükler.
// Layout'ta bir kez render edilir; bekleyen sayısını alt şeritte gösterir.
export function CevrimdisiSenkron() {
  const router = useRouter()
  const [bekleyen, setBekleyen] = useState(0)
  const [yukluyor, setYukluyor] = useState(false)
  const calisiyor = useRef(false)

  const tazele = useCallback(async () => {
    try {
      setBekleyen((await kuyrukListe()).length)
    } catch {
      /* IndexedDB yoksa/erişilemezse sessiz geç */
    }
  }, [])

  const senkronla = useCallback(async () => {
    if (calisiyor.current) return
    if (typeof navigator !== "undefined" && !navigator.onLine) return
    let liste: BekleyenIs[]
    try {
      liste = await kuyrukListe()
    } catch {
      return
    }
    if (liste.length === 0) return

    calisiyor.current = true
    setYukluyor(true)
    let basarili = 0
    for (const b of liste) {
      if (typeof navigator !== "undefined" && !navigator.onLine) break
      try {
        const fd = new FormData()
        for (const [k, v] of b.veri) fd.append(k, v)
        const r = await isOlustur({}, fd)
        if (r.id) {
          if (b.fotolar.length > 0) {
            try {
              await fotograflariYukle(createClient(), r.id, b.fotolar, 0)
            } catch {
              /* foto yüklenemese de iş oluştu; detaydan eklenebilir */
            }
          }
          await kuyruktanSil(b.id)
          basarili++
        } else {
          // Sunucu doğrulama hatası (nadiren) → veriyi kaybetme, sonra tekrar dene
          break
        }
      } catch {
        break // ağ hatası → bir sonraki tetiklemede tekrar dene
      }
    }
    calisiyor.current = false
    setYukluyor(false)
    await tazele()
    if (basarili > 0) {
      kaydedildiGoster(`${basarili} çevrimdışı iş yüklendi`)
      router.refresh()
    }
  }, [tazele, router])

  useEffect(() => {
    tazele()
    senkronla()
    const on = () => senkronla()
    window.addEventListener("online", on)
    window.addEventListener("focus", on)
    const t = window.setInterval(senkronla, 30000)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("focus", on)
      window.clearInterval(t)
    }
  }, [tazele, senkronla])

  if (bekleyen === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[65] -translate-x-1/2 px-4 sm:bottom-6">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/95 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-lg">
        {yukluyor ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" /></svg>
        )}
        {yukluyor
          ? "Çevrimdışı işler yükleniyor…"
          : `${bekleyen} iş çevrimdışı bekliyor — internet gelince yüklenecek`}
      </div>
    </div>
  )
}
