"use client"

import { useState } from "react"

// İş detayında takip kodunu gösterir + müşteriye verilecek linki/kodu kopyalar.
export function TakipKodu({ kod }: { kod: string }) {
  const [kopyalandi, setKopyalandi] = useState<"kod" | "link" | null>(null)

  function kopyala(tur: "kod" | "link") {
    const metin =
      tur === "kod"
        ? kod
        : `${window.location.origin}/takip?kod=${encodeURIComponent(kod)}`
    navigator.clipboard?.writeText(metin).then(() => {
      setKopyalandi(tur)
      window.setTimeout(() => setKopyalandi(null), 1500)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5">
      <span className="text-xs font-semibold text-muted-foreground">
        Müşteri takip kodu
      </span>
      <span className="font-mono text-sm font-semibold tracking-wide">{kod}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => kopyala("kod")}
          className="rounded-lg border border-input bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          {kopyalandi === "kod" ? "Kopyalandı ✓" : "Kodu kopyala"}
        </button>
        <button
          type="button"
          onClick={() => kopyala("link")}
          className="rounded-lg border border-input bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          {kopyalandi === "link" ? "Kopyalandı ✓" : "Takip linki"}
        </button>
      </div>
    </div>
  )
}
