"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Secenek = { id: string; ad: string }

type Props = {
  durumlar: Secenek[]
  personeller: Secenek[]
  faturaDurumlari: Secenek[]
  musteriler: Secenek[]
  basePath?: string
  sagSlot?: React.ReactNode // aramanın sağındaki hızlı butonlar
  aySlot?: React.ReactNode // en sağda ay kutucukları
}

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function IslerFiltreler({
  durumlar,
  personeller,
  faturaDurumlari,
  musteriler,
  basePath = "/",
  sagSlot,
  aySlot,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Arama kutusu için yerel durum (debounce ile URL'e yazılır)
  const [arama, setArama] = useState(searchParams.get("q") ?? "")

  // Seçili detay filtre sayısı (arama hariç) — Filtre tuşundaki rozet
  const detayFiltreSayisi = ["durum", "personel", "musteri", "baslangic", "bitis"]
    .filter((k) => !!searchParams.get(k)).length
  // Detay filtreler varsayılan gizli; aktif filtre varsa açık başlar
  const [filtreAcik, setFiltreAcik] = useState(detayFiltreSayisi > 0)

  // URL'i tek bir parametreyi güncelleyerek yenile; sayfa (sayfa) sıfırlanır.
  const paramGuncelle = useCallback(
    (anahtar: string, deger: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (deger) {
        params.set(anahtar, deger)
      } else {
        params.delete(anahtar)
      }
      params.delete("sayfa")
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false })
      })
    },
    [router, searchParams, basePath]
  )

  // Arama kutusunu 350ms debounce ile q parametresine yaz.
  useEffect(() => {
    const mevcut = searchParams.get("q") ?? ""
    if (arama === mevcut) return
    const t = setTimeout(() => paramGuncelle("q", arama.trim()), 350)
    return () => clearTimeout(t)
  }, [arama, searchParams, paramGuncelle])

  const filtreVar =
    !!searchParams.get("q") ||
    !!searchParams.get("durum") ||
    !!searchParams.get("personel") ||
    !!searchParams.get("fatura") ||
    !!searchParams.get("musteri") ||
    !!searchParams.get("baslangic") ||
    !!searchParams.get("bitis")

  function temizle() {
    setArama("")
    startTransition(() => {
      router.replace(basePath, { scroll: false })
    })
  }

  return (
    <div className={cn("grid gap-2.5", isPending && "opacity-70")}>
      {/* Üst satır: arama + Filtre tuşu + hızlı butonlar + ay kutucukları */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          inputMode="search"
          placeholder="Ara: cihaz, seri, fiş, takip no…"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          className="w-full max-w-[250px]"
        />
        <button
          type="button"
          onClick={() => setFiltreAcik((v) => !v)}
          title="Detay filtreleri aç/kapat"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors",
            filtreAcik || detayFiltreSayisi > 0
              ? "border-primary/40 bg-accent text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
          Filtre
          {detayFiltreSayisi > 0 && (
            <span className="inline-flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
              {detayFiltreSayisi}
            </span>
          )}
        </button>
        {sagSlot}
        {aySlot && <div className="ml-auto">{aySlot}</div>}
      </div>

      {/* Detay filtreler — Filtre tuşuyla açılır/kapanır */}
      {filtreAcik && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Durum"
            className={selectClass}
            value={searchParams.get("durum") ?? ""}
            onChange={(e) => paramGuncelle("durum", e.target.value)}
          >
            <option value="">Tüm durumlar</option>
            {durumlar.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ad}
              </option>
            ))}
          </select>

          <select
            aria-label="Teknik personel"
            className={selectClass}
            value={searchParams.get("personel") ?? ""}
            onChange={(e) => paramGuncelle("personel", e.target.value)}
          >
            <option value="">Tüm personel</option>
            {personeller.map((p) => (
              <option key={p.id} value={p.id}>
                {p.ad}
              </option>
            ))}
          </select>

          <select
            aria-label="Fatura durumu"
            className={selectClass}
            value={searchParams.get("fatura") ?? ""}
            onChange={(e) => paramGuncelle("fatura", e.target.value)}
          >
            <option value="">Tüm fatura durumları</option>
            {faturaDurumlari.map((f) => (
              <option key={f.id} value={f.id}>
                {f.ad}
              </option>
            ))}
          </select>

          <select
            aria-label="Müşteri"
            className={selectClass}
            value={searchParams.get("musteri") ?? ""}
            onChange={(e) => paramGuncelle("musteri", e.target.value)}
          >
            <option value="">Tüm müşteriler</option>
            {musteriler.map((m) => (
              <option key={m.id} value={m.id}>
                {m.ad}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Geliş:
            <input
              type="date"
              aria-label="Başlangıç tarihi"
              className={selectClass}
              value={searchParams.get("baslangic") ?? ""}
              onChange={(e) => paramGuncelle("baslangic", e.target.value)}
            />
            –
            <input
              type="date"
              aria-label="Bitiş tarihi"
              className={selectClass}
              value={searchParams.get("bitis") ?? ""}
              onChange={(e) => paramGuncelle("bitis", e.target.value)}
            />
          </label>

          {filtreVar && (
            <Button variant="ghost" size="sm" onClick={temizle}>
              Filtreleri temizle
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
