"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

// Uygulamayı ilk açışta bir defaya mahsus "hoş geldiniz" karşılaması.
// localStorage ile tek sefer gösterilir (sürüm değişirse tekrar gösterilebilir).
const ANAHTAR = "nameteknik-hosgeldin-1"

export function Hosgeldin({ ad }: { ad?: string | null }) {
  const [goster, setGoster] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(ANAHTAR)) setGoster(true)
    } catch {
      /* localStorage kapalıysa gösterme */
    }
  }, [])

  function kapat() {
    try {
      localStorage.setItem(ANAHTAR, "1")
    } catch {}
    setGoster(false)
  }

  if (!goster) return null

  const ilkAd = (ad ?? "").trim().split(/\s+/)[0]

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-hosgeldin relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b1b3f] via-[#12275e] to-[#1e40af] p-8 text-center shadow-2xl">
        {/* Işıltı */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-blue-500/25 blur-3xl" />

        <div className="relative">
          <div className="mx-auto mb-5 flex h-16 items-center justify-center">
            <Image
              src="/name-teknik-logo-beyaz.png"
              alt="Name Teknik"
              width={1592}
              height={238}
              priority
              className="h-9 w-auto object-contain"
            />
          </div>

          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sky-200">
            <span className="text-base leading-none">🚀</span> Artık dijitalsin
          </div>

          <h1 className="text-[22px] font-extrabold leading-tight text-white">
            {ilkAd ? `Hoş geldin, ${ilkAd}!` : "Hoş geldiniz!"}
          </h1>
          <p className="mt-1 text-[15px] font-bold tracking-wide text-sky-100">
            NAME TEKNİK UYGULAMASI
          </p>

          <p className="mt-4 text-[13.5px] leading-relaxed text-blue-100/90">
            Kağıt kalem, karışık Excel derdi bitti. Bütün işler artık tek yerde:
            telefondan iş ekle, fotoğraf çek, durumu tek dokunuşla değiştir.
            İnternet gitse bile yazdıkların kaybolmaz — gelince kendiliğinden yüklenir.
          </p>

          <ul className="mx-auto mt-4 grid max-w-xs gap-1.5 text-left text-[12.5px] text-blue-50">
            <li className="flex items-center gap-2"><Tik /> Telefondan hızlı iş girişi + kamera</li>
            <li className="flex items-center gap-2"><Tik /> Anında arama, filtre, takip</li>
            <li className="flex items-center gap-2"><Tik /> Otomatik yedek, kaybolan veri yok</li>
          </ul>

          <button
            type="button"
            onClick={kapat}
            className="mt-6 w-full rounded-xl bg-white px-5 py-3 text-[15px] font-bold text-[#12275e] shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
          >
            Hadi başlayalım →
          </button>
          <p className="mt-2 text-[11px] text-blue-200/70">Kolay gelsin! 💪</p>
        </div>
      </div>

      <style>{`
        @keyframes hosgeldinGir {
          from { opacity: 0; transform: translateY(16px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-hosgeldin { animation: hosgeldinGir .45s cubic-bezier(.16,1,.3,1); }
      `}</style>
    </div>
  )
}

function Tik() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-400/30 text-sky-200">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </span>
  )
}
