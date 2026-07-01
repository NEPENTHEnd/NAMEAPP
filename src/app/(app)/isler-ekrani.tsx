"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { isGrupAta } from "@/app/actions/is"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DurumRozeti, FaturaRozeti } from "@/components/rozet"
import { HucreDuzenle } from "@/components/hucre-duzenle"
import { PanelFinansal } from "@/components/panel-finansal"

type Secenek = { id: string; ad: string; renk?: string | null }

export type Kayit = {
  id: string
  servis_no: string | null
  cihaz_adi: string
  seri_no: string | null
  gelis_tarihi: string | null
  cikis_tarihi: string | null
  fatura_tarihi: string | null
  durum_id: string
  durum: { ad: string; renk: string | null } | null
  fatura_durumu_id: string | null
  fatura_durumu: { ad: string } | null
  teknik_personel: { ad: string } | null
  musteri: { ad: string; sube_sehir: string | null } | null
  garanti_no: string | null
  kargo_takip_no: string | null
  fiyat_teklifi: number | null
  fatura_tutari: number | null
  grup_id: string | null
}

export type SeciliBilgi = {
  id: string
  cihaz_adi: string
  servis_no: string | null
  musteriAd: string | null
  aciklama: string | null
  kargo_takip_no: string | null
  fatura_durumu_id: string | null
  fiyat_teklifi: number | null
  fatura_tutari: number | null
  garanti_no: string | null
  fotolar: { id: string; url: string }[]
}

const tutarBicim = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
})
const tutarTR = (n: number | null) => (n == null ? "—" : tutarBicim.format(n))
function tarihTR(s: string | null): string {
  if (!s) return "—"
  const [y, m, g] = s.split("-")
  return `${g}.${m}.${y}`
}

export function IslerEkrani({
  kayitlar,
  gruplar,
  durumlar,
  faturaDurumlari,
  finansal,
  seciliId,
  seciliBilgi,
  aktifGrup,
}: {
  kayitlar: Kayit[]
  gruplar: Secenek[]
  durumlar: Secenek[]
  faturaDurumlari: Secenek[]
  finansal: boolean
  seciliId: string
  seciliBilgi: SeciliBilgi | null
  aktifGrup: string // "" (tümü) | "diger" | grup id
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Mevcut parametreleri koruyarak URL üret
  const url = useCallback(
    (degisiklik: Record<string, string | null>) => {
      const p = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(degisiklik)) {
        if (v === null || v === "") p.delete(k)
        else p.set(k, v)
      }
      p.delete("sayfa")
      const qs = p.toString()
      return qs ? `/?${qs}` : "/"
    },
    [searchParams]
  )

  const git = (d: Record<string, string | null>) =>
    router.replace(url(d), { scroll: false })

  // Sıralama başlığı
  const sirala = searchParams.get("sirala") ?? ""
  const yon = searchParams.get("yon") === "asc" ? "asc" : "desc"
  function siralaHref(anahtar: string) {
    const yeni = sirala === anahtar && yon === "asc" ? "desc" : "asc"
    return url({ sirala: anahtar, yon: yeni })
  }
  const ok = (a: string) => (sirala !== a ? "" : yon === "asc" ? " ▲" : " ▼")

  // ---- Sürükle-bırak (satırı gruba ata) ----
  const [surukle, setSurukle] = useState<Kayit | null>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [hedef, setHedef] = useState<string | null>(null) // "diger" | grup id | null
  const [pending, startTransition] = useTransition()
  const holdRef = useRef<{ id: string; x: number; y: number; t: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const ogeRef = useRef<Map<string, HTMLElement>>(new Map())

  // "Diğer" + gruplar sürükleme hedefleri
  const hedefler: { anahtar: string; ad: string }[] = [
    { anahtar: "diger", ad: "DİĞER" },
    ...gruplar.map((g) => ({ anahtar: g.id, ad: g.ad })),
  ]

  function hedefBul(y: number): string | null {
    let bulunan: string | null = null
    ogeRef.current.forEach((el, key) => {
      const r = el.getBoundingClientRect()
      if (y >= r.top && y <= r.bottom) bulunan = key
    })
    return bulunan
  }

  useEffect(() => {
    if (!surukle) return
    function move(e: PointerEvent) {
      setPos({ x: e.clientX, y: e.clientY })
      setHedef(hedefBul(e.clientY))
    }
    function up() {
      const h = hedef
      const sr = surukle
      setSurukle(null)
      setHedef(null)
      if (sr && h) {
        const grupId = h === "diger" ? null : h
        if (grupId !== sr.grup_id) {
          startTransition(async () => {
            await isGrupAta(sr.id, grupId)
            router.refresh()
          })
        }
      }
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
  }, [surukle, hedef, router])

  // Satır basılı tut → sürüklemeye başla (yalnız yönetici)
  function satirPointerDown(e: React.PointerEvent, k: Kayit) {
    if (!finansal || e.button !== 0) return
    holdRef.current = { id: k.id, x: e.clientX, y: e.clientY, t: Date.now() }
    const baslat = window.setTimeout(() => {
      if (holdRef.current?.id === k.id) {
        setSurukle(k)
        setPos({ x: e.clientX, y: e.clientY })
      }
    }, 200)
    function iptal(ev: PointerEvent) {
      const h = holdRef.current
      if (h && (Math.abs(ev.clientX - h.x) > 10 || Math.abs(ev.clientY - h.y) > 10)) {
        window.clearTimeout(baslat)
        holdRef.current = null
        window.removeEventListener("pointermove", iptal)
      }
    }
    function bitir() {
      window.clearTimeout(baslat)
      holdRef.current = null
      window.removeEventListener("pointermove", iptal)
      window.removeEventListener("pointerup", bitir)
    }
    window.addEventListener("pointermove", iptal)
    window.addEventListener("pointerup", bitir)
  }

  const hedefIndex = hedef ? hedefler.findIndex((h) => h.anahtar === hedef) : -1

  return (
    <div className="hidden gap-4 md:flex">
      {/* Sol menü: büyük şirketler */}
      <aside className="w-52 shrink-0">
        <div className="sticky top-20 grid gap-1.5">
          <Link
            href={url({ grup: null, bakilmadi: null })}
            scroll={false}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              aktifGrup === "" && !searchParams.get("bakilmadi")
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground hover:bg-muted"
            )}
          >
            Tüm İşler
          </Link>
          <Link
            href={url({ bakilmadi: "1", grup: null })}
            scroll={false}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              searchParams.get("bakilmadi")
                ? "border-amber-400 bg-amber-400/15 text-amber-700 dark:text-amber-300"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            Bakılmadı (gelenler)
          </Link>

          <div className="mt-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Firmalar
          </div>
          <div className="grid gap-0.5">
            {hedefler.map((h, i) => {
              const aktifMi = aktifGrup === h.anahtar
              const suruklemeVar = surukle != null
              // "ağız gibi açılma": sürüklerken hedefin üstü yukarı, altı aşağı kayar
              let ty = 0
              if (suruklemeVar && hedefIndex >= 0) {
                if (i < hedefIndex) ty = -10
                else if (i > hedefIndex) ty = 10
              }
              const vurgulu = suruklemeVar && hedef === h.anahtar
              return (
                <div
                  key={h.anahtar}
                  ref={(el) => {
                    if (el) ogeRef.current.set(h.anahtar, el)
                    else ogeRef.current.delete(h.anahtar)
                  }}
                  className="group/firma relative flex items-center transition-transform duration-150"
                  style={{ transform: `translateY(${ty}px) scale(${vurgulu ? 1.06 : 1})` }}
                >
                  <Link
                    href={url({ grup: h.anahtar, bakilmadi: null })}
                    scroll={false}
                    className={cn(
                      "flex-1 truncate rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                      vurgulu
                        ? "bg-emerald-500 text-white ring-2 ring-emerald-300"
                        : aktifMi
                          ? "bg-accent text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {h.ad}
                  </Link>
                  {/* Yeşil + : bu gruba hızlı iş ekle */}
                  <Link
                    href={h.anahtar === "diger" ? "/yeni" : `/yeni?grup=${h.anahtar}`}
                    title={`${h.ad} grubuna iş ekle`}
                    className="absolute right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white opacity-0 transition-opacity hover:bg-emerald-600 group-hover/firma:opacity-100"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </Link>
                </div>
              )
            })}
          </div>
          {finansal && (
            <p className="mt-2 px-1 text-[10.5px] leading-snug text-muted-foreground/80">
              İpucu: bir satırı basılı tutup buradaki firmaya sürükleyerek atayabilirsin.
            </p>
          )}
        </div>
      </aside>

      {/* Tablo */}
      <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Link href={siralaHref("servis")} scroll={false} className="hover:underline">Fiş No{ok("servis")}</Link>
              </TableHead>
              <TableHead>Müşteri</TableHead>
              <TableHead>
                <Link href={siralaHref("cihaz")} scroll={false} className="hover:underline">Cihaz{ok("cihaz")}</Link>
              </TableHead>
              <TableHead>
                <Link href={siralaHref("gelis")} scroll={false} className="hover:underline">Geliş{ok("gelis")}</Link>
              </TableHead>
              <TableHead>
                <Link href={siralaHref("cikis")} scroll={false} className="hover:underline">Çıkış{ok("cikis")}</Link>
              </TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Personel</TableHead>
              {finansal && <TableHead>Fatura</TableHead>}
              {finansal && <TableHead>Fatura Tarihi</TableHead>}
              {finansal && (
                <TableHead className="text-right">
                  <Link href={siralaHref("tutar")} scroll={false} className="hover:underline">Tutar{ok("tutar")}</Link>
                </TableHead>
              )}
              <TableHead>Kargo Takip</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {kayitlar.map((k) => (
              <TableRow
                key={k.id}
                data-selected={k.id === seciliId}
                onPointerDown={(e) => satirPointerDown(e, k)}
                className={cn(
                  "border-b transition-colors hover:bg-muted/50",
                  k.id === seciliId && "bg-muted",
                  surukle?.id === k.id && "opacity-40",
                  finansal && "cursor-grab"
                )}
              >
                <TableCell className="font-medium">
                  <Link href={`/is/${k.id}`} onPointerDown={(e) => e.stopPropagation()} className="text-primary underline-offset-4 hover:underline">
                    {k.servis_no ?? "Aç"}
                  </Link>
                </TableCell>
                <TableCell className="min-w-[140px]">
                  <HucreDuzenle isId={k.id} alan="musteri" deger={k.musteri?.ad ?? null} placeholder="Firma adı" />
                </TableCell>
                <TableCell className="min-w-[180px]">
                  <HucreDuzenle isId={k.id} alan="cihaz_adi" deger={k.cihaz_adi} />
                  <HucreDuzenle isId={k.id} alan="seri_no" deger={k.seri_no} bosEtiket="SN ekle" className="text-xs text-muted-foreground" />
                </TableCell>
                <TableCell>
                  <HucreDuzenle isId={k.id} alan="gelis_tarihi" tip="tarih" deger={k.gelis_tarihi} goster={() => tarihTR(k.gelis_tarihi)} />
                </TableCell>
                <TableCell>
                  <HucreDuzenle isId={k.id} alan="cikis_tarihi" tip="tarih" deger={k.cikis_tarihi} goster={() => tarihTR(k.cikis_tarihi)} />
                </TableCell>
                <TableCell>
                  <HucreDuzenle
                    isId={k.id}
                    alan="durum_id"
                    tip="select"
                    deger={k.durum_id}
                    secenekler={durumlar}
                    goster={() => (k.durum ? <DurumRozeti ad={k.durum.ad} renk={k.durum.renk} /> : "—")}
                  />
                </TableCell>
                <TableCell>{k.teknik_personel?.ad ?? "—"}</TableCell>
                {finansal && (
                  <TableCell className="min-w-[120px]">
                    <HucreDuzenle
                      isId={k.id}
                      alan="fatura_durumu_id"
                      tip="select"
                      deger={k.fatura_durumu_id}
                      secenekler={faturaDurumlari}
                      goster={() => <FaturaRozeti ad={k.fatura_durumu?.ad} />}
                    />
                  </TableCell>
                )}
                {finansal && (
                  <TableCell>
                    <HucreDuzenle isId={k.id} alan="fatura_tarihi" tip="tarih" deger={k.fatura_tarihi} goster={() => tarihTR(k.fatura_tarihi)} />
                  </TableCell>
                )}
                {finansal && (
                  <TableCell className="text-right tabular-nums">{tutarTR(k.fatura_tutari ?? k.fiyat_teklifi)}</TableCell>
                )}
                <TableCell className="text-xs text-muted-foreground">{k.kargo_takip_no ?? "—"}</TableCell>
                <TableCell className="w-8 p-0 text-center">
                  {/* Sağdaki ok: foto/açıklama panelini aç */}
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => git({ secili: k.id })}
                    title="Foto & açıklama panelini aç"
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Yan panel: foto + açıklama + kargo, × ile kapanır */}
      {seciliId && (
        <aside className="w-80 shrink-0 lg:w-96">
          <div className="sticky top-20 rounded-lg border p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {seciliBilgi?.servis_no ?? seciliBilgi?.cihaz_adi ?? "İş"}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {seciliBilgi?.musteriAd ? `${seciliBilgi.musteriAd} · ` : ""}
                  {seciliBilgi?.cihaz_adi}
                </div>
              </div>
              <button
                type="button"
                onClick={() => git({ secili: null })}
                title="Paneli kapat"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {seciliBilgi ? (
              <>
                {seciliBilgi.fotolar.length > 0 ? (
                  <div className="grid gap-2">
                    <a href={seciliBilgi.fotolar[0].url} target="_blank" rel="noopener noreferrer" className="relative block aspect-square overflow-hidden rounded-md border">
                      <Image src={seciliBilgi.fotolar[0].url} alt="Önizleme" fill sizes="(min-width:1024px) 360px, 300px" quality={70} className="object-cover" />
                    </a>
                    {seciliBilgi.fotolar.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {seciliBilgi.fotolar.slice(1).map((f) => (
                          <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="relative aspect-square overflow-hidden rounded-md border">
                            <Image src={f.url} alt="Önizleme" fill sizes="90px" quality={60} className="object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Bu işte fotoğraf yok.</p>
                )}

                {/* Açıklama (fotoğrafın altında, düzenlenebilir) */}
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Açıklama</div>
                  <HucreDuzenle
                    isId={seciliBilgi.id}
                    alan="aciklama"
                    deger={seciliBilgi.aciklama}
                    bosEtiket="Açıklama ekle…"
                    className="min-h-[32px] text-sm"
                  />
                </div>

                {/* Kargo takip (açıklamanın/fotoğrafın altında) */}
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Kargo takip no</div>
                  <HucreDuzenle
                    isId={seciliBilgi.id}
                    alan="kargo_takip_no"
                    deger={seciliBilgi.kargo_takip_no}
                    bosEtiket="Kargo no ekle…"
                    className="text-sm"
                  />
                </div>

                <Link href={`/is/${seciliBilgi.id}`} className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline">
                  Detayı aç →
                </Link>

                {finansal && (
                  <PanelFinansal
                    key={seciliBilgi.id}
                    isKaydiId={seciliBilgi.id}
                    faturaDurumlari={faturaDurumlari}
                    varsayilan={{
                      fatura_durumu_id: seciliBilgi.fatura_durumu_id,
                      fiyat_teklifi: seciliBilgi.fiyat_teklifi,
                      fatura_tutari: seciliBilgi.fatura_tutari,
                      garanti_no: seciliBilgi.garanti_no,
                    }}
                  />
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Önizleme yüklenemedi.</p>
            )}
          </div>
        </aside>
      )}

      {/* Sürükleme sırasında imleci takip eden etiket */}
      {surukle && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-emerald-400 bg-card px-3 py-1.5 text-xs font-medium shadow-lg"
          style={{ left: pos.x + 12, top: pos.y + 12 }}
        >
          {surukle.servis_no ?? surukle.cihaz_adi}
          <span className="ml-1 text-muted-foreground">→ {hedef ? hedefler.find((h) => h.anahtar === hedef)?.ad : "bir firmaya bırak"}</span>
        </div>
      )}

      {pending && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow">
          Atanıyor…
        </div>
      )}
    </div>
  )
}
