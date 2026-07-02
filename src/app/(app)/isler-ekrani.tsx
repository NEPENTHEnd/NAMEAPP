"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import type { CSSProperties } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { isGrupAta, isSil } from "@/app/actions/is"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DurumRozeti, FaturaRozeti, durumRenk } from "@/components/rozet"
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
  fatura_durumu: { ad: string; renk: string | null } | null
  teknik_personel_id: string | null
  teknik_personel: { ad: string } | null
  musteri: { ad: string; sube_sehir: string | null } | null
  garanti_no: string | null
  kargo_takip_no: string | null
  fiyat_teklifi: number | null
  fatura_tutari: number | null
  grup_id: string | null
  olusturan_ad: string | null
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
  personeller,
  faturaDurumlari,
  finansal,
  seciliId,
  seciliBilgi,
  aktifGrup,
  ustSlot,
}: {
  kayitlar: Kayit[]
  gruplar: Secenek[]
  durumlar: Secenek[]
  personeller: Secenek[]
  faturaDurumlari: Secenek[]
  finansal: boolean
  seciliId: string
  seciliBilgi: SeciliBilgi | null
  aktifGrup: string // "" (tümü) | "diger" | grup id
  ustSlot?: React.ReactNode // arama+filtreler — tablo sütununun üstünde
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

  // Görünüm modları
  const grupGorunumu = aktifGrup !== "" && aktifGrup !== "diger" // belirli firma seçili
  const aktifGrupAd = gruplar.find((g) => g.id === aktifGrup)?.ad ?? null
  const stokKoduModu = aktifGrupAd === "BOYTEKS" // fiş no yerine firma stok kodu

  // ---- Sürükle-bırak: fiş no'nun solundaki SAPTAN tutulur ----
  const [surukle, setSurukle] = useState<Kayit | null>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [hedef, setHedef] = useState<string | null>(null) // "diger" | grup id | null
  const [pending, startTransition] = useTransition()
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
    document.body.style.userSelect = "none" // sürüklerken metin seçilmesin
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
      document.body.style.userSelect = ""
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
  }, [surukle, hedef, router])

  const hedefIndex = hedef ? hedefler.findIndex((h) => h.anahtar === hedef) : -1

  return (
    <div className="hidden min-w-0 gap-4 md:flex">
      {/* Sol menü: firmalar */}
      <aside className="w-48 shrink-0">
        <div className="sticky top-20 grid gap-1.5">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Firmalar
          </div>
          {/* Açılır listeden hızlı firma seçimi */}
          <select
            value={aktifGrup}
            onChange={(e) => git({ grup: e.target.value || null, bakilmadi: null })}
            aria-label="Firma seç"
            className="mb-0.5 h-8 w-full rounded-lg border border-input bg-card px-2 text-[12.5px] outline-none transition focus:border-primary"
          >
            <option value="">Tüm firmalar</option>
            <option value="diger">DİĞER</option>
            {gruplar.map((g) => (
              <option key={g.id} value={g.id}>
                {g.ad}
              </option>
            ))}
          </select>
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
                          ? "bg-accent font-semibold text-primary"
                          : h.anahtar === "diger"
                            ? "font-semibold text-amber-600 hover:bg-muted dark:text-amber-400"
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
              İpucu: satırın başındaki ⠿ sapından tutup firmaya sürükleyerek atarsın.
              Çift tıklayınca foto paneli açılır.
            </p>
          )}
        </div>
      </aside>

      {/* Orta sütun: filtreler + tablo */}
      <div className="min-w-0 flex-1">
        {ustSlot && <div className="mb-3">{ustSlot}</div>}
        {/* Kaydırma tablonun KENDİ kabında: başlıklar buna yapışır; kutu ekranın altına kadar uzar */}
        <Table
          containerClassName="h-[calc(100vh-160px)] overflow-auto rounded-lg border"
          className="text-[13px] [&_td]:px-2 [&_td]:py-1.5 [&_th]:h-9 [&_th]:px-2"
        >
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-card [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
            <TableRow>
              {finansal && <TableHead className="w-7 p-0" />}
              <TableHead>
                <Link href={siralaHref("servis")} scroll={false} className="hover:underline">
                  {stokKoduModu ? "Firma Stok Kodu" : "Fiş No"}
                  {ok("servis")}
                </Link>
              </TableHead>
              {finansal && <TableHead>Takip No</TableHead>}
              {!grupGorunumu && <TableHead>Müşteri</TableHead>}
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
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {kayitlar.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7 + (grupGorunumu ? 0 : 1) + (finansal ? 5 : 0)}
                  className="p-10 text-center text-sm text-muted-foreground"
                >
                  Bu görünümde kayıt yok. Soldaki firma adının yanındaki yeşil +
                  ile iş ekleyebilirsin.
                </TableCell>
              </TableRow>
            )}
            {kayitlar.map((k) => (
              <TableRow
                key={k.id}
                data-selected={k.id === seciliId}
                onDoubleClick={() => git({ secili: k.id })}
                // Satırın tamamı durum rengine boyanır (Excel'deki dolgu gibi)
                style={{ "--satir": durumRenk(k.durum?.ad, k.durum?.renk) } as CSSProperties}
                className={cn(
                  "border-b transition-colors",
                  "bg-[color-mix(in_oklab,var(--satir)_48%,transparent)] hover:bg-[color-mix(in_oklab,var(--satir)_60%,transparent)] data-[selected=true]:bg-[color-mix(in_oklab,var(--satir)_72%,transparent)]",
                  surukle?.id === k.id && "opacity-40"
                )}
              >
                {/* Sürükleme sapı — fiş no'nun hemen solunda */}
                {finansal && (
                  <TableCell className="w-7 p-0 pl-1">
                    <button
                      type="button"
                      title="Tutup sol menüdeki firmaya sürükle"
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSurukle(k)
                        setPos({ x: e.clientX, y: e.clientY })
                      }}
                      className="flex h-8 w-5 cursor-grab items-center justify-center rounded text-muted-foreground/50 hover:bg-muted hover:text-foreground active:cursor-grabbing"
                      style={{ touchAction: "none" }}
                    >
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="2.5" cy="2.5" r="1.4" /><circle cx="7.5" cy="2.5" r="1.4" />
                        <circle cx="2.5" cy="8" r="1.4" /><circle cx="7.5" cy="8" r="1.4" />
                        <circle cx="2.5" cy="13.5" r="1.4" /><circle cx="7.5" cy="13.5" r="1.4" />
                      </svg>
                    </button>
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  {stokKoduModu && finansal ? (
                    <HucreDuzenle isId={k.id} alan="servis_no" deger={k.servis_no} bosEtiket="Stok kodu gir" className="font-mono text-[13px]" />
                  ) : (
                    <Link href={`/is/${k.id}`} onPointerDown={(e) => e.stopPropagation()} className="text-primary underline-offset-4 hover:underline">
                      {k.servis_no ?? "Aç"}
                    </Link>
                  )}
                  {/* Kim kaydetti — küçük */}
                  {k.olusturan_ad && (
                    <span className="block text-[10px] font-normal leading-tight text-muted-foreground">
                      {k.olusturan_ad}
                    </span>
                  )}
                </TableCell>
                {finansal && (
                  <TableCell className="min-w-[80px]">
                    {/* Takip no (eski adı garanti no) — fiş no'nun hemen yanında */}
                    <HucreDuzenle isId={k.id} alan="garanti_no" deger={k.garanti_no} bosEtiket="—" className="text-xs" />
                  </TableCell>
                )}
                {!grupGorunumu && (
                  <TableCell className="min-w-[120px] max-w-[170px]">
                    <HucreDuzenle isId={k.id} alan="musteri" deger={k.musteri?.ad ?? null} placeholder="Firma adı" className="truncate" />
                  </TableCell>
                )}
                <TableCell className="min-w-[130px] max-w-[210px]">
                  <HucreDuzenle isId={k.id} alan="cihaz_adi" deger={k.cihaz_adi} className="truncate" />
                  <HucreDuzenle isId={k.id} alan="seri_no" deger={k.seri_no} bosEtiket="SN ekle" className="truncate text-xs text-muted-foreground" />
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
                <TableCell className="min-w-[90px]">
                  <HucreDuzenle
                    isId={k.id}
                    alan="teknik_personel_id"
                    tip="select"
                    deger={k.teknik_personel_id}
                    secenekler={personeller}
                    duzenlenebilir={finansal}
                    goster={() => k.teknik_personel?.ad ?? <span className="text-muted-foreground">—</span>}
                  />
                </TableCell>
                {finansal && (
                  <TableCell className="min-w-[120px]">
                    <HucreDuzenle
                      isId={k.id}
                      alan="fatura_durumu_id"
                      tip="select"
                      deger={k.fatura_durumu_id}
                      secenekler={faturaDurumlari}
                      goster={() => <FaturaRozeti ad={k.fatura_durumu?.ad} renk={k.fatura_durumu?.renk} />}
                    />
                  </TableCell>
                )}
                {finansal && (
                  <TableCell>
                    <HucreDuzenle isId={k.id} alan="fatura_tarihi" tip="tarih" deger={k.fatura_tarihi} goster={() => tarihTR(k.fatura_tarihi)} />
                  </TableCell>
                )}
                {finansal && (
                  <TableCell className="text-right tabular-nums">
                    <HucreDuzenle
                      isId={k.id}
                      alan="fatura_tutari"
                      deger={k.fatura_tutari != null ? String(k.fatura_tutari) : null}
                      goster={() => tutarTR(k.fatura_tutari ?? k.fiyat_teklifi)}
                      placeholder="Tutar ₺"
                      className="text-right"
                    />
                  </TableCell>
                )}
                <TableCell className="w-8 p-0 text-center">
                  {/* Sağdaki ok: foto/açıklama panelini aç (çift tıklama da açar) */}
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

                {/* Kargo takip (fotoğrafın/açıklamanın altında) */}
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

                {/* Fiş no / stok kodu — yönetici düzeltebilir */}
                {finansal && (
                  <div className="mt-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fiş no / stok kodu</div>
                    <HucreDuzenle
                      isId={seciliBilgi.id}
                      alan="servis_no"
                      deger={seciliBilgi.servis_no}
                      bosEtiket="Fiş no gir…"
                      className="font-mono text-sm"
                    />
                  </div>
                )}

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

                {/* İşi sil — yalnız yönetici, onaylı */}
                {finansal && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Bu işi ve fotoğraflarını KALICI olarak silmek istediğine emin misin?"
                        )
                      ) {
                        startTransition(async () => {
                          await isSil(seciliBilgi.id)
                        })
                      }
                    }}
                    className="mt-3 w-full rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                  >
                    İşi sil
                  </button>
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
          <span className="ml-1 text-muted-foreground">→ {hedef ? hedefler.find((h) => h.anahtar === hedef)?.ad : "soldaki firmaya bırak"}</span>
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
