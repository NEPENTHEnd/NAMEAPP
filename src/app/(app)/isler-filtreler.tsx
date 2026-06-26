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
}

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function IslerFiltreler({
  durumlar,
  personeller,
  faturaDurumlari,
  musteriler,
  basePath = "/",
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Arama kutusu için yerel durum (debounce ile URL'e yazılır)
  const [arama, setArama] = useState(searchParams.get("q") ?? "")

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
    <div className={cn("grid gap-3", isPending && "opacity-70")}>
      <Input
        type="search"
        inputMode="search"
        placeholder="Ara: cihaz, seri no, servis no veya müşteri…"
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        className="max-w-md"
      />

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
    </div>
  )
}
