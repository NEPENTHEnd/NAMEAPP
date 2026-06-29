"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

import { createClient } from "@/lib/supabase/client"

type YeniIs = {
  id: string
  cihaz_adi: string
  created_at: string
  musteri: { ad: string | null } | null
}

function zamanTR(s: string): string {
  return new Date(s).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Yöneticiye okunmamış yeni işleri gösteren zil + açılır liste.
// Layout istemci-içi gezinmede yeniden render olmadığından kendi verisini çeker:
// açılış + odak + 60 sn'de bir tazeler.
export function BildirimRozeti() {
  const [isler, setIsler] = useState<YeniIs[]>([])
  const [acik, setAcik] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    let iptal = false

    async function getir() {
      const { data } = await supabase
        .from("is_kaydi")
        .select("id, cihaz_adi, created_at, musteri:musteri_id ( ad )")
        .eq("yonetici_gordu", false)
        .order("created_at", { ascending: false })
        .limit(15)
      if (!iptal) setIsler((data ?? []) as YeniIs[])
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

  useEffect(() => {
    function disari(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener("mousedown", disari)
    return () => document.removeEventListener("mousedown", disari)
  }, [])

  const sayi = isler.length

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
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
      </button>

      {acik && (
        <div className="absolute right-0 top-12 z-40 w-72 overflow-hidden rounded-xl border border-border bg-popover shadow-[0_16px_40px_-16px_rgba(15,23,42,.3)]">
          <div className="border-b border-muted px-3 py-2 text-[12.5px] font-semibold">
            Yeni işler{sayi > 0 ? ` (${sayi})` : ""}
          </div>
          {sayi === 0 ? (
            <p className="px-3 py-4 text-center text-[12.5px] text-muted-foreground">
              Okunmamış yeni iş yok.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {isler.map((k) => (
                <li key={k.id}>
                  <Link
                    href={`/is/${k.id}`}
                    onClick={() => setAcik(false)}
                    className="block px-3 py-2 transition-colors hover:bg-muted"
                  >
                    <div className="truncate text-[13px] font-medium">
                      {k.musteri?.ad ?? "—"}
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {k.cihaz_adi}
                    </div>
                    <div className="text-[11px] text-muted-foreground/80">
                      {zamanTR(k.created_at)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
