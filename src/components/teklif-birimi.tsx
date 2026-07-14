"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { isHucreGuncelle } from "@/app/actions/is"
import { cn } from "@/lib/utils"

const BIRIMLER = ["TL", "USD", "EUR", "CHF"] as const

// Fiyat teklifi para birimi — tuşa basınca açılır liste; oradan seç (TL/USD/EUR/CHF)
export function TeklifBirimi({
  isId,
  birim,
  className,
}: {
  isId: string
  birim: string | null
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [acik, setAcik] = useState(false)
  const kutuRef = useRef<HTMLDivElement>(null)
  const simdi = (BIRIMLER as readonly string[]).includes(birim ?? "")
    ? (birim as string)
    : "TL"

  useEffect(() => {
    if (!acik) return
    function disari(e: MouseEvent) {
      if (kutuRef.current && !kutuRef.current.contains(e.target as Node))
        setAcik(false)
    }
    document.addEventListener("mousedown", disari)
    return () => document.removeEventListener("mousedown", disari)
  }, [acik])

  function sec(b: string) {
    setAcik(false)
    if (b === simdi) return
    startTransition(async () => {
      const r = await isHucreGuncelle(isId, "teklif_birim", b)
      if (r.ok) router.refresh()
    })
  }

  return (
    <div
      ref={kutuRef}
      className={cn("relative", className)}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={pending}
        onClick={() => setAcik((v) => !v)}
        title="Para birimini seç"
        className={cn(
          "flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          pending && "opacity-50"
        )}
      >
        {simdi}
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {acik && (
        <div className="absolute right-0 top-full z-30 mt-1 w-16 rounded-lg border border-border bg-popover p-1 shadow-lg">
          {BIRIMLER.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => sec(b)}
              className={cn(
                "block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted",
                b === simdi && "bg-accent font-semibold text-primary"
              )}
            >
              {b}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
