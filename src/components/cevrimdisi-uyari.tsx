"use client"

import { useEffect, useState } from "react"

// İnternet bağlantısı kesilince üstte uyarı şeridi gösterir.
export function CevrimdisiUyari() {
  const [cevrimdisi, setCevrimdisi] = useState(false)

  useEffect(() => {
    const guncelle = () => setCevrimdisi(!navigator.onLine)
    guncelle()
    window.addEventListener("online", guncelle)
    window.addEventListener("offline", guncelle)
    return () => {
      window.removeEventListener("online", guncelle)
      window.removeEventListener("offline", guncelle)
    }
  }, [])

  if (!cevrimdisi) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-center text-[13px] font-medium text-white">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
      </svg>
      İnternet bağlantısı yok — değişiklikler kaydedilemeyebilir.
    </div>
  )
}
