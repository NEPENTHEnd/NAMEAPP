"use client"

import { useEffect, useRef, useState } from "react"

import { cikisYap } from "@/app/actions/auth"
import { PushDugmesi } from "@/components/push-dugmesi"

function basharfler(ad: string | null, eposta: string | null): string {
  const kaynak = (ad ?? eposta ?? "?").trim()
  const parcalar = kaynak.split(/\s+/).filter(Boolean)
  if (parcalar.length >= 2) return (parcalar[0][0] + parcalar[1][0]).toUpperCase()
  return kaynak.slice(0, 2).toUpperCase()
}

export function UserMenu({
  ad,
  eposta,
  rol,
}: {
  ad: string | null
  eposta: string | null
  rol: string
}) {
  const [acik, setAcik] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function disari(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener("mousedown", disari)
    return () => document.removeEventListener("mousedown", disari)
  }, [])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setAcik((v) => !v)}
        className="flex items-center gap-2.5 rounded-[10px] border border-border bg-transparent py-1 pr-2 pl-1.5 transition-colors hover:bg-muted/60"
      >
        <span className="flex size-[30px] items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
          {basharfler(ad, eposta)}
        </span>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="text-[12.5px] font-semibold text-foreground">
            {ad ?? eposta}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {rol === "yonetici" ? "Yönetici" : "Personel"}
          </span>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-0.5 text-muted-foreground"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {acik && (
        <div className="absolute right-0 top-12 w-56 rounded-xl border border-border bg-popover p-1.5 shadow-[0_16px_40px_-16px_rgba(15,23,42,.3)]">
          <div className="mb-1 border-b border-muted px-2.5 pb-2 pt-1.5">
            <div className="text-[13px] font-semibold">{ad ?? "Kullanıcı"}</div>
            <div className="text-[11.5px] text-muted-foreground">{eposta}</div>
          </div>
          {rol === "yonetici" && (
            <div className="mb-1 border-b border-muted pb-1">
              <PushDugmesi />
            </div>
          )}
          <form action={cikisYap}>
            <button
              type="submit"
              className="w-full rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              Çıkış yap
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
