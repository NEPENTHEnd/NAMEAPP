"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { createClient } from "@/lib/supabase/client"

// Yöneticiye "okunmamış yeni iş" sayısını gösteren zil rozeti.
// Layout istemci-içi gezinmede yeniden render olmadığından sayımı kendisi yapar:
// ilk açılış + sayfa odağa gelince + 60 sn'de bir tazeler.
export function BildirimRozeti() {
  const [sayi, setSayi] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let iptal = false

    async function getir() {
      const { count } = await supabase
        .from("is_kaydi")
        .select("id", { count: "exact", head: true })
        .eq("yonetici_gordu", false)
      if (!iptal) setSayi(count ?? 0)
    }

    getir()
    const t = window.setInterval(getir, 60000)
    window.addEventListener("focus", getir)
    return () => {
      iptal = true
      window.clearInterval(t)
      window.removeEventListener("focus", getir)
    }
  }, [])

  return (
    <Link
      href="/"
      aria-label={sayi > 0 ? `${sayi} yeni iş` : "Bildirimler"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-[9px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {sayi > 0 && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[17px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[17px] text-white">
          {sayi > 99 ? "99+" : sayi}
        </span>
      )}
    </Link>
  )
}
