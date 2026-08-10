"use client"

import { useRouter } from "next/navigation"

// Tarayıcının geri tuşu gibi: nereden gelindiyse oraya döner (filtreler korunur).
// Geçmiş yoksa (doğrudan link ile açıldıysa) işler listesine düşer.
export function GeriButonu({ className }: { className?: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back()
        else router.push("/")
      }}
      className={className}
    >
      ← Geri
    </button>
  )
}
