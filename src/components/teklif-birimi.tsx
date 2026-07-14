"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"

import { isHucreGuncelle } from "@/app/actions/is"
import { cn } from "@/lib/utils"

const BIRIMLER = ["TL", "EUR", "USD"] as const

// Fiyat teklifi para birimi — küçük tuş; tıkla → TL → EUR → USD → TL
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
  const simdi = (BIRIMLER as readonly string[]).includes(birim ?? "")
    ? (birim as string)
    : "TL"

  function dondur(e: React.MouseEvent) {
    e.stopPropagation()
    const sonraki =
      BIRIMLER[(BIRIMLER.indexOf(simdi as (typeof BIRIMLER)[number]) + 1) % BIRIMLER.length]
    startTransition(async () => {
      const r = await isHucreGuncelle(isId, "teklif_birim", sonraki)
      if (r.ok) router.refresh()
    })
  }

  return (
    <button
      type="button"
      disabled={pending}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={dondur}
      title="Para birimini değiştir (TL / EUR / USD)"
      className={cn(
        "shrink-0 rounded px-1 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        pending && "opacity-50",
        className
      )}
    >
      {simdi}
    </button>
  )
}
