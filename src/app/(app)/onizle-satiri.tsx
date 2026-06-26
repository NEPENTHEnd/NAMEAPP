"use client"

import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"

// Tıklanınca yan önizleme panelini açan tablo satırı.
// İçindeki <a> (detay linki) tıklanırsa önizleme tetiklenmez, link çalışır.
export function OnizleSatiri({
  href,
  secili,
  children,
}: {
  href: string
  secili: boolean
  children: React.ReactNode
}) {
  const router = useRouter()

  return (
    <tr
      data-selected={secili}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) return
        router.replace(href, { scroll: false })
      }}
      className={cn(
        "cursor-pointer border-b transition-colors hover:bg-muted/50",
        secili && "bg-muted"
      )}
    >
      {children}
    </tr>
  )
}
