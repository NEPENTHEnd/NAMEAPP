"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Oneri = { metin: string; tur: "cihaz" | "firma" | "fiş" }

// Eşleşen kısmı kalın göster (PI → PICANOL...)
function Vurgula({ metin, q }: { metin: string; q: string }) {
  const i = metin.toLocaleLowerCase("tr-TR").indexOf(q.toLocaleLowerCase("tr-TR"))
  if (i < 0) return <>{metin}</>
  return (
    <>
      {metin.slice(0, i)}
      <strong className="font-bold">{metin.slice(i, i + q.length)}</strong>
      {metin.slice(i + q.length)}
    </>
  )
}

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

  // Arama kutusu için yerel durum (debounce ile URL'e yazılır).
  // Bu bileşen sayfada iki kez monte (masaüstü + mobil kopya); yalnız
  // KENDİSİNE yazılan kopya URL'e yazar, diğeri URL'i takip eder —
  // aksi halde iki kopya URL'i kapışıp sayfayı gidip getirir.
  const urlQ = searchParams.get("q") ?? ""
  const [arama, setArama] = useState(urlQ)
  const kullaniciYazdi = useRef(false)

  // Canlı öneriler (autocomplete): yazdıkça cihaz/firma/fiş eşleşmeleri
  const [oneriler, setOneriler] = useState<Oneri[]>([])
  const [oneriAcik, setOneriAcik] = useState(false)
  const oneriKutu = useRef<HTMLDivElement>(null)
  const istekNo = useRef(0)

  useEffect(() => {
    const q = arama.trim()
    if (!kullaniciYazdi.current || q.length < 2) {
      setOneriler([])
      return
    }
    const no = ++istekNo.current
    const t = setTimeout(async () => {
      const supabase = createClient()
      const desen = `%${q}%`
      const [cihazRes, firmaRes, fisRes] = await Promise.all([
        supabase.from("is_kaydi").select("cihaz_adi").ilike("cihaz_adi", desen).limit(12),
        supabase.from("musteri").select("ad").ilike("ad", desen).limit(5),
        supabase.from("is_kaydi").select("servis_no").ilike("servis_no", `${q}%`).not("servis_no", "is", null).limit(4),
      ])
      if (no !== istekNo.current) return // eski istek, at
      const gorulen = new Set<string>()
      const liste: Oneri[] = []
      for (const r of cihazRes.data ?? []) {
        const k = r.cihaz_adi.toLocaleUpperCase("tr-TR")
        if (!gorulen.has(k)) {
          gorulen.add(k)
          liste.push({ metin: r.cihaz_adi, tur: "cihaz" })
        }
        if (liste.length >= 6) break
      }
      for (const r of firmaRes.data ?? []) {
        if (liste.length >= 9) break
        liste.push({ metin: r.ad, tur: "firma" })
      }
      for (const r of fisRes.data ?? []) {
        if (liste.length >= 11 || !r.servis_no) break
        const k = "F:" + r.servis_no
        if (!gorulen.has(k)) {
          gorulen.add(k)
          liste.push({ metin: r.servis_no, tur: "fiş" })
        }
      }
      setOneriler(liste)
      setOneriAcik(true)
    }, 220)
    return () => clearTimeout(t)
  }, [arama])

  // Dışarı tıklayınca öneri listesini kapat
  useEffect(() => {
    function d(e: MouseEvent) {
      if (oneriKutu.current && !oneriKutu.current.contains(e.target as Node))
        setOneriAcik(false)
    }
    document.addEventListener("mousedown", d)
    return () => document.removeEventListener("mousedown", d)
  }, [])

  // Dışarıdan (öteki kopya, geri tuşu) değişen URL'i kutuya yansıt
  useEffect(() => {
    if (kullaniciYazdi.current) {
      // Yazdığımız değer URL'e ulaştıysa bayrağı indir
      if (urlQ === arama.trim()) kullaniciYazdi.current = false
      return
    }
    setArama(urlQ)
  }, [urlQ, arama])

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

  // NOT: Yazarken tablo SORGULANMAZ (her tuşta sayfa kasmasın) — yalnız
  // öneriler güncellenir. Arama Enter'da ya da öneri seçiminde çalışır.
  function aramayiCalistir(deger: string) {
    setOneriAcik(false)
    if (deger.trim() !== urlQ) paramGuncelle("q", deger.trim())
  }

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
        <div ref={oneriKutu} className="relative w-full max-w-[250px]">
          <Input
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Ara + Enter: cihaz, seri, fiş…"
            value={arama}
            onChange={(e) => {
              kullaniciYazdi.current = true
              const v = e.target.value
              setArama(v)
              // Kutu tamamen temizlenince filtreyi kaldır (✕ tuşu dahil)
              if (v === "" && urlQ) paramGuncelle("q", "")
            }}
            onFocus={() => oneriler.length > 0 && setOneriAcik(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOneriAcik(false)
              if (e.key === "Enter") aramayiCalistir(arama)
            }}
            className="w-full"
          />
          {/* Canlı öneriler — yazdıkça daralır, tıklayınca arar */}
          {oneriAcik && oneriler.length > 0 && (
            <div className="absolute left-0 top-full z-40 mt-1 max-h-72 w-[300px] overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-xl">
              {oneriler.map((o, i) => (
                <button
                  key={o.tur + o.metin + i}
                  type="button"
                  onClick={() => {
                    kullaniciYazdi.current = true
                    setArama(o.metin)
                    aramayiCalistir(o.metin)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                >
                  <span className="min-w-0 flex-1 truncate">
                    <Vurgula metin={o.metin} q={arama.trim()} />
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {o.tur}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
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
