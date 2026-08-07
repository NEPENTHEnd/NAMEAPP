"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Oneri = { metin: string; tur: "cihaz" | "firma" | "fiş" | "seri" }

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
  sadeMod?: boolean // personel: yalnız arama (Filtre tuşu ve detay filtreler yok)
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
  sadeMod = false,
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
      // Ana arama ile AYNI karakter temizliği: özel karakterler joker '*' olur ki
      // öneri ile sonuç birebir tutsun ("1.2KW" hem öneride hem sonuçta çıksın).
      const temiz = q
        .replace(/[%,().:*\\&"]/g, "*")
        .replace(/\s+/g, "*")
        .replace(/\*{2,}/g, "*")
        .replace(/^\*|\*$/g, "")
        .trim()
      if (!temiz || temiz === "*") {
        setOneriler([])
        return
      }
      // Türkçe İ/i–I/ı: hem TR-büyük hem TR-küçük varyantla ara.
      const varyantlar = [
        ...new Set([temiz, temiz.toLocaleUpperCase("tr-TR"), temiz.toLocaleLowerCase("tr-TR")]),
      ]
      const orIfade = (kolon: string) =>
        varyantlar.map((v) => `${kolon}.ilike.*${v}*`).join(",")
      const [cihazRes, firmaRes, fisRes, seriRes] = await Promise.all([
        supabase.from("is_kaydi").select("cihaz_adi").or(orIfade("cihaz_adi")).limit(12),
        supabase.from("musteri").select("ad").or(orIfade("ad")).limit(5),
        supabase.from("is_kaydi").select("servis_no").or(orIfade("servis_no")).not("servis_no", "is", null).limit(6),
        supabase.from("is_kaydi").select("seri_no").or(orIfade("seri_no")).not("seri_no", "is", null).limit(6),
      ])
      if (no !== istekNo.current) return // eski istek, at
      const gorulen = new Set<string>()
      const liste: Oneri[] = []
      const ekle = (metin: string | null, tur: Oneri["tur"], onek = "") => {
        if (!metin) return
        const k = onek + metin.toLocaleUpperCase("tr-TR")
        if (gorulen.has(k)) return
        gorulen.add(k)
        liste.push({ metin, tur })
      }
      for (const r of cihazRes.data ?? []) { if (liste.length >= 6) break; ekle(r.cihaz_adi, "cihaz") }
      for (const r of firmaRes.data ?? []) { if (liste.length >= 9) break; ekle(r.ad, "firma", "M:") }
      for (const r of fisRes.data ?? []) { if (liste.length >= 11) break; ekle(r.servis_no, "fiş", "F:") }
      for (const r of seriRes.data ?? []) { if (liste.length >= 13) break; ekle(r.seri_no, "seri", "S:") }
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
  // Arama YAPINCA tüm filtreler iptal olur (grup/şube/ay/durum/personel/fatura/müşteri/
  // tarih) — yalnız q kalır; böylece arama TÜM tarihleri ve TÜM firmaları kapsar.
  function aramayiCalistir(deger: string) {
    setOneriAcik(false)
    const d = deger.trim()
    startTransition(() => {
      router.replace(d ? `${basePath}?q=${encodeURIComponent(d)}` : basePath, {
        scroll: false,
      })
    })
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
        <div ref={oneriKutu} className="relative w-full max-w-[280px]">
          <div className="relative">
            {/* Büyüteç ikonu */}
            <svg
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
            <Input
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Ara: cihaz, müşteri, seri, fiş, telefon…"
              value={arama}
              onChange={(e) => {
                kullaniciYazdi.current = true
                const v = e.target.value
                setArama(v)
                // Kutu tamamen temizlenince filtreyi kaldır (✕ tuşu dahil)
                if (v === "" && urlQ) paramGuncelle("q", "")
              }}
              onFocus={() => arama.trim().length >= 2 && setOneriAcik(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOneriAcik(false)
                if (e.key === "Enter") aramayiCalistir(arama)
              }}
              className="w-full pl-8"
            />
            {/* Arama sürerken dönen gösterge */}
            {isPending && (
              <svg
                aria-hidden
                className="absolute right-2.5 top-1/2 size-[15px] -translate-y-1/2 animate-spin text-primary"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
              >
                <path d="M21 12a9 9 0 1 1-6.2-8.5" />
              </svg>
            )}
          </div>
          {/* Canlı öneriler — üstte "tümünde ara", altında eşleşmeler */}
          {oneriAcik && arama.trim().length >= 2 && (
            <div className="absolute left-0 top-full z-40 mt-1 max-h-80 w-[320px] overflow-y-auto rounded-xl border border-border bg-popover py-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  kullaniciYazdi.current = true
                  aramayiCalistir(arama)
                }}
                className="flex w-full items-center gap-2 border-b border-border/60 px-3 py-2 text-left text-[13px] hover:bg-muted"
              >
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 text-primary">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                </svg>
                <span className="min-w-0 flex-1 truncate">
                  «<strong className="font-semibold">{arama.trim()}</strong>» — tümünde ara
                </span>
                <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">Enter</span>
              </button>
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
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 text-[10px] font-medium uppercase tracking-wide",
                      o.tur === "cihaz" && "bg-sky-500/15 text-sky-600 dark:text-sky-400",
                      o.tur === "firma" && "bg-violet-500/15 text-violet-600 dark:text-violet-400",
                      o.tur === "fiş" && "bg-primary/10 text-primary",
                      o.tur === "seri" && "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    )}
                  >
                    {o.tur === "firma" ? "müşteri" : o.tur}
                  </span>
                </button>
              ))}
              {oneriler.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-muted-foreground">
                  Eşleşen öneri yok — <strong>Enter</strong>'la yine de tüm alanlarda ara.
                </div>
              )}
            </div>
          )}
        </div>
        {!sadeMod && (
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
        )}
        {sagSlot}
        {aySlot && <div className="ml-auto">{aySlot}</div>}
      </div>

      {/* Detay filtreler — Filtre tuşuyla açılır/kapanır (sade modda hiç yok) */}
      {!sadeMod && filtreAcik && (
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
