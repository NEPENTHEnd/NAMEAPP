"use client"

import { useEffect, useState } from "react"

// Ekranın altında beliren "Kaydedildi" onayı. kaydedildiGoster() ile tetiklenir.
export function Toaster() {
  const [mesaj, setMesaj] = useState<string | null>(null)

  useEffect(() => {
    let zaman: number
    function ac(e: Event) {
      const m = (e as CustomEvent<string>).detail || "Kaydedildi"
      setMesaj(m)
      window.clearTimeout(zaman)
      zaman = window.setTimeout(() => setMesaj(null), 2200)
    }
    window.addEventListener("app-kaydedildi", ac)
    return () => {
      window.removeEventListener("app-kaydedildi", ac)
      window.clearTimeout(zaman)
    }
  }, [])

  if (!mesaj) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4 sm:bottom-6">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(5,150,105,.7)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {mesaj}
      </div>
    </div>
  )
}
