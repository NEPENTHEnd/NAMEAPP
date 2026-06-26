"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import type { AyOgesi } from "@/lib/aylar"

// İşler/Pano/Raporlar başlığının sağında kayan ay kutucukları.
// Güncel ay altın sarısı, diğer aylar mavi. Seçili kutu dolu gösterilir.
export function AySecici({
  aylar,
  basePath = "/",
}: {
  aylar: AyOgesi[]
  basePath?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const aktif = searchParams.get("ay") ?? ""

  function sec(key: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (key) params.set("ay", key)
    else params.delete("ay")
    params.delete("sayfa")
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false })
    })
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", isPending && "opacity-70")}>
      <button
        type="button"
        onClick={() => sec("")}
        className={cn(
          "rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
          aktif === ""
            ? "border-foreground/15 bg-foreground/5 text-foreground"
            : "border-border bg-card text-muted-foreground hover:bg-muted"
        )}
      >
        Tümü
      </button>
      {aylar.map((a) => {
        const secili = aktif === a.key
        const cls = a.guncel
          ? secili
            ? "border-amber-500 bg-amber-500 text-white shadow-[0_1px_2px_rgba(217,119,6,.4)]"
            : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
          : secili
            ? "border-primary bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(30,64,175,.35)]"
            : "border-border bg-card text-muted-foreground hover:bg-muted"
        return (
          <button
            key={a.key}
            type="button"
            onClick={() => sec(a.key)}
            title={`${a.label} ${a.yil}`}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
              cls
            )}
          >
            {a.label}
          </button>
        )
      })}
    </div>
  )
}
