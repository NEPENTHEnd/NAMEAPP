"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import type { CSSProperties } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { kaydedildiGoster } from "@/lib/toast"
import { isTasima, isGeriAl, isSil } from "@/app/actions/is"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DurumRozeti, FaturaRozeti, durumRenk, faturaRenk } from "@/components/rozet"
import { HucreDuzenle } from "@/components/hucre-duzenle"
import { TeklifBirimi } from "@/components/teklif-birimi"
import { PanelFinansal } from "@/components/panel-finansal"

type Secenek = { id: string; ad: string; renk?: string | null }

export type Kayit = {
  id: string
  servis_no: string | null
  cihaz_adi: string
  seri_no: string | null
  gelis_tarihi: string | null
  gelis_saat: string | null
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
  talep_no: string | null
  kargo_takip_no: string | null
  telefon: string | null
  ilgili_kisi: string | null
  adres: string | null
  fiyat_teklifi: number | null
  teklif_birim: string | null
  fatura_tutari: number | null
  grup_id: string | null
  sube_id: string | null
  olusturan_ad: string | null
  ilk_foto_url: string | null // satır üzerine gelince gösterilen küçük önizleme
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
  teklif_birim: string | null
  fatura_tutari: number | null
  fatura_tarihi: string | null
  garanti_no: string | null
  talep_no: string | null
  fotolar: { id: string; url: string }[]
}

const sayiBicim = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 })
// "1000" → "1.000 TL" (₺ simgesi yok, düz birim son eki)
const paraTR = (n: number | null, birim: string) =>
  n == null ? "—" : `${sayiBicim.format(n)} ${birim}`
function tarihTR(s: string | null): string {
  if (!s) return "—"
  const [y, m, g] = s.split("-")
  return `${g}.${m}.${y}`
}
// "16:52:00" -> "16:52"
function saatTR(s: string | null): string {
  return s ? s.slice(0, 5) : ""
}

// Arama sonucunda bir satır HANGİ alandan eşleşti? Görünmeyen alanları (telefon/seri/
// fiş/takip/talep/ilgili/kargo/adres) öne alır; cihaz/müşteri zaten tabloda görünür.
function aramaEslesmesi(
  k: Kayit,
  q: string
): { etiket: string; deger: string } | null {
  const s = q.trim()
  if (s.length < 2) return null
  const up = s.toLocaleUpperCase("tr-TR")
  const dig = s.replace(/\D/g, "")
  const telBenzeri = dig.length >= 3 && s.replace(/[\d\s()+\-.]/g, "") === ""
  const icerir = (v: string | null) => !!v && v.toLocaleUpperCase("tr-TR").includes(up)
  // 1) Görünmeyen alanlarda düz alt-metin eşleşmesi (en güvenilir sebep, öncelikli)
  const gizliAlanlar: [string, string | null][] = [
    ["telefon", k.telefon],
    ["seri no", k.seri_no],
    ["fiş no", k.servis_no],
    ["takip no", k.garanti_no],
    ["talep no", k.talep_no],
    ["ilgili kişi", k.ilgili_kisi],
    ["kargo", k.kargo_takip_no],
    ["adres", k.adres],
  ]
  for (const [etiket, v] of gizliAlanlar) if (icerir(v)) return { etiket, deger: v! }
  // 2) Telefon: rakamlar biçimli saklanır (0507 151 44 29). ARAMA ile AYNI mantık —
  // telefonun biçimsiz rakamları sorgu rakamlarını ARDIŞIK içeriyorsa eşleşmedir.
  if (telBenzeri && k.telefon && k.telefon.replace(/\D/g, "").includes(dig)) {
    return { etiket: "telefon", deger: k.telefon }
  }
  // 3) Son çare: eşleşme cihaz/müşteride olabilir (görünür sütunlar) — yine de belirt
  if (icerir(k.cihaz_adi)) return { etiket: "cihaz", deger: k.cihaz_adi }
  if (icerir(k.musteri?.ad ?? null)) return { etiket: "müşteri", deger: k.musteri!.ad }
  return null
}

// Eşleşen alt-metni kalın/vurgulu göster (bulunamazsa düz metin)
function aramaVurgula(deger: string, q: string): React.ReactNode {
  const s = q.trim()
  const i = s ? deger.toLocaleLowerCase("tr-TR").indexOf(s.toLocaleLowerCase("tr-TR")) : -1
  if (i < 0) return deger
  return (
    <>
      {deger.slice(0, i)}
      <mark className="rounded bg-primary/25 px-0.5 text-inherit">{deger.slice(i, i + s.length)}</mark>
      {deger.slice(i + s.length)}
    </>
  )
}

type Sube = {
  id: string
  grup_id: string
  ad: string
  ust_sube_id: string | null // null → firmaya doğrudan bağlı üst seviye şube
}

export function IslerEkrani({
  kayitlar,
  gruplar,
  subeler = [],
  durumlar,
  personeller,
  faturaDurumlari,
  finansal,
  seciliId,
  seciliBilgi,
  aktifGrup,
  aktifSube = "",
  arama = "",
  ustSlot,
}: {
  kayitlar: Kayit[]
  gruplar: Secenek[]
  subeler?: Sube[]
  durumlar: Secenek[]
  personeller: Secenek[]
  faturaDurumlari: Secenek[]
  finansal: boolean
  seciliId: string
  seciliBilgi: SeciliBilgi | null
  aktifGrup: string // "" (tümü) | "diger" | grup id
  aktifSube?: string // belirli şube id
  arama?: string // aktif arama metni — satırda "eşleşme nerede" göstermek için
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
  // Müşteri sütunu HER görünümde gösterilir — firma/grup içinde de müşteri + şube adı görünsün.
  const musteriGoster = true
  const aktifGrupAd = gruplar.find((g) => g.id === aktifGrup)?.ad ?? null
  const stokKoduModu = aktifGrupAd === "BOYTEKS" // fiş no yerine firma stok kodu

  // Şubeler: firmanın üst-seviye şubeleri + her şubenin alt şubeleri
  const subeMap = new Map<string, Sube[]>() // grup_id → üst seviye şubeler
  const altSubeMap = new Map<string, Sube[]>() // ust_sube_id → alt şubeler
  for (const s of subeler) {
    if (s.ust_sube_id) {
      const l = altSubeMap.get(s.ust_sube_id) ?? []
      l.push(s)
      altSubeMap.set(s.ust_sube_id, l)
    } else {
      const l = subeMap.get(s.grup_id) ?? []
      l.push(s)
      subeMap.set(s.grup_id, l)
    }
  }
  // Şube id → ad (tabloda müşteri altında şube adı göstermek için)
  const subeAdMap = new Map(subeler.map((s) => [s.id, s.ad]))
  // Bir şubenin üst şube zinciri (aktif şubenin atalarını otomatik açmak için)
  function atalar(subeId: string): string[] {
    const yol: string[] = []
    let simdiki = subeler.find((x) => x.id === subeId)
    while (simdiki?.ust_sube_id) {
      const ustId: string = simdiki.ust_sube_id
      yol.push(ustId)
      simdiki = subeler.find((x) => x.id === ustId)
    }
    return yol
  }

  // Açık (genişletilmiş) firmalar — aktif şube/grup otomatik açık başlar
  const [acikGruplar, setAcikGruplar] = useState<Set<string>>(() => {
    const s = new Set<string>()
    const bulun = aktifSube ? subeler.find((x) => x.id === aktifSube) : null
    if (bulun) s.add(bulun.grup_id)
    if (aktifGrup && subeMap.has(aktifGrup)) s.add(aktifGrup)
    return s
  })
  function grupAcKapa(id: string) {
    setAcikGruplar((prev) => {
      const y = new Set(prev)
      if (y.has(id)) y.delete(id)
      else y.add(id)
      return y
    })
  }
  // Açık (genişletilmiş) şubeler — aktif şubenin üst zinciri otomatik açık
  const [acikSubeler, setAcikSubeler] = useState<Set<string>>(() => {
    const s = new Set<string>()
    if (aktifSube) for (const a of atalar(aktifSube)) s.add(a)
    return s
  })
  function subeAcKapa(id: string) {
    setAcikSubeler((prev) => {
      const y = new Set(prev)
      if (y.has(id)) y.delete(id)
      else y.add(id)
      return y
    })
  }

  // ---- Çoklu seçim: Ctrl (⌘) + tıkla → birlikte sürükle ----
  const [secili, setSecili] = useState<Set<string>>(new Set())
  function seciliDegistir(id: string) {
    setSecili((prev) => {
      const y = new Set(prev)
      if (y.has(id)) y.delete(id)
      else y.add(id)
      return y
    })
  }
  const gorunenIdler = kayitlar.map((k) => k.id)

  // ---- Son yapılan taşıma (alt şeritte gösterilir + geri alınabilir) ----
  type SonIslem = {
    oncekiler: { id: string; grup_id: string | null; sube_id: string | null }[]
    metin: string
    adet: number
  }
  const [sonIslem, setSonIslem] = useState<SonIslem | null>(null)
  // Bir işin bulunduğu yerin adı (şube > firma > DİĞER)
  function yerAdi(grupId: string | null, subeId: string | null): string {
    if (subeId) return subeler.find((s) => s.id === subeId)?.ad ?? "şube"
    if (grupId) return gruplar.find((g) => g.id === grupId)?.ad ?? "firma"
    return "DİĞER"
  }
  function geriAl() {
    if (!sonIslem) return
    const oncekiler = sonIslem.oncekiler
    setSonIslem(null)
    startTransition(async () => {
      await isGeriAl(oncekiler)
      kaydedildiGoster("Geri alındı")
      router.refresh()
    })
  }

  // ---- Sürükle-bırak: fiş no'nun solundaki SAPTAN tutulur ----
  const [surukle, setSurukle] = useState<Kayit | null>(null)
  const [surukleIdler, setSurukleIdler] = useState<string[]>([])
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [hedef, setHedef] = useState<string | null>(null) // "diger" | grup id | "sube:<id>"
  const [pending, startTransition] = useTransition()
  const ogeRef = useRef<Map<string, HTMLElement>>(new Map())

  // ---- Satır foto önizleme: satırda ~3 sn beklenince imlecin sağ-üstünde ----
  const ONIZLEME_BOY = 200 // px (kare kutu — çok büyük değil)
  const ONIZLEME_GECIKME = 1500 // ms — hemen değil, bu kadar durunca açılır
  const [onizlemeUrl, setOnizlemeUrl] = useState<string | null>(null)
  const onizlemeRef = useRef<HTMLDivElement>(null)
  const imlecRef = useRef({ x: 0, y: 0 })
  const beklemeRef = useRef<number | null>(null) // gecikme zamanlayıcısı
  const gecikmeIptal = useCallback(() => {
    if (beklemeRef.current != null) {
      window.clearTimeout(beklemeRef.current)
      beklemeRef.current = null
    }
  }, [])
  // Bileşen kalkarsa bekleyen zamanlayıcı sızmasın
  useEffect(() => gecikmeIptal, [gecikmeIptal])
  // Kutu imlecin sağ-üstünde; ekran kenarına taşarsa içe alınır
  const konumHesapla = useCallback((x: number, y: number) => {
    const bosluk = 16
    let sol = x + bosluk
    let ust = y - ONIZLEME_BOY - bosluk
    if (typeof window !== "undefined" && sol + ONIZLEME_BOY > window.innerWidth - 8)
      sol = x - ONIZLEME_BOY - bosluk
    if (ust < 8) ust = y + bosluk // yukarı sığmazsa imlecin altına
    return { sol, ust }
  }, [])
  const onizlemeKonumla = useCallback(() => {
    const el = onizlemeRef.current
    if (!el) return
    const { sol, ust } = konumHesapla(imlecRef.current.x, imlecRef.current.y)
    el.style.left = `${sol}px`
    el.style.top = `${ust}px`
  }, [konumHesapla])
  useEffect(() => {
    if (!onizlemeUrl) return
    onizlemeKonumla() // ilk konum
    function move(e: MouseEvent) {
      imlecRef.current = { x: e.clientX, y: e.clientY }
      onizlemeKonumla()
    }
    window.addEventListener("mousemove", move)
    return () => window.removeEventListener("mousemove", move)
  }, [onizlemeUrl, onizlemeKonumla])

  // "Diğer" + gruplar sürükleme hedefleri
  const hedefler: { anahtar: string; ad: string }[] = [
    { anahtar: "diger", ad: "DİĞER" },
    ...gruplar.map((g) => ({ anahtar: g.id, ad: g.ad })),
  ]
  // Şube id → üst firma (grup) id — bırakınca firmayı da doğru ayarlamak için
  const subeUst = new Map(subeler.map((s) => [s.id, s.grup_id]))
  // Hedef anahtarını okunur ada çevir (etiket için)
  function hedefAd(key: string | null): string {
    if (!key) return ""
    if (key.startsWith("sube:")) return subeler.find((s) => s.id === key.slice(5))?.ad ?? "şube"
    return hedefler.find((h) => h.anahtar === key)?.ad ?? ""
  }

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
      const idler = surukleIdler
      setSurukle(null)
      setSurukleIdler([])
      setHedef(null)
      if (h && idler.length > 0) {
        let grupId: string | null
        let subeId: string | null = null
        if (h === "diger") {
          grupId = null
        } else if (h.startsWith("sube:")) {
          subeId = h.slice(5)
          grupId = subeUst.get(subeId) ?? null
        } else {
          grupId = h
        }
        // Taşımadan ÖNCEKİ yerleri sakla → "Geri al" bunları geri yazar
        const kayitMap = new Map(kayitlar.map((k) => [k.id, k]))
        const oncekiler = idler.map((id) => ({
          id,
          grup_id: kayitMap.get(id)?.grup_id ?? null,
          sube_id: kayitMap.get(id)?.sube_id ?? null,
        }))
        // Hiçbiri gerçekten yer değiştirmiyorsa dokunma
        const degisen = oncekiler.some(
          (o) => o.grup_id !== grupId || o.sube_id !== subeId
        )
        if (!degisen) return
        const kaynaklar = new Set(oncekiler.map((o) => yerAdi(o.grup_id, o.sube_id)))
        const kaynakAd =
          kaynaklar.size === 1 ? [...kaynaklar][0] : `${kaynaklar.size} farklı yer`
        const metin = `${kaynakAd} → ${hedefAd(h)}`
        startTransition(async () => {
          const r = await isTasima(idler, grupId, subeId)
          setSecili(new Set())
          if (r.ok) {
            setSonIslem({ oncekiler, metin, adet: idler.length })
            kaydedildiGoster("Taşındı")
          }
          router.refresh()
        })
      }
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      document.body.style.userSelect = ""
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surukle, surukleIdler, hedef, router])

  const hedefIndex = hedef ? hedefler.findIndex((h) => h.anahtar === hedef) : -1

  // Şube (ve alt şubelerini) özyinelemeli çiz. Bileşen DEĞİL düz fonksiyon:
  // sürüklerken her karede yeniden bağlanıp ogeRef'i bozmasın diye.
  function subeAgaci(s: Sube, grupAnahtar: string): React.ReactNode {
    const cocuklar = altSubeMap.get(s.id) ?? []
    const subeAcikMi = acikSubeler.has(s.id)
    const subeVurgulu = surukle != null && hedef === `sube:${s.id}`
    return (
      <div key={s.id}>
        <div className="flex items-center">
          {/* Alt şubesi olan şubede aç/kapa oku */}
          {cocuklar.length > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                subeAcKapa(s.id)
              }}
              title={subeAcikMi ? "Alt şubeleri gizle" : "Alt şubeleri göster"}
              className="flex h-5 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn("transition-transform", subeAcikMi && "rotate-90")}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <Link
            ref={(el) => {
              const anahtar = `sube:${s.id}`
              if (el) ogeRef.current.set(anahtar, el)
              else ogeRef.current.delete(anahtar)
            }}
            href={url({ grup: grupAnahtar, sube: s.id, bakilmadi: null })}
            scroll={false}
            className={cn(
              "min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-[12.5px] transition-colors",
              subeVurgulu
                ? "bg-emerald-500 font-bold text-white ring-2 ring-inset ring-emerald-200"
                : aktifSube === s.id
                  ? "bg-accent font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {s.ad}
          </Link>
        </div>
        {subeAcikMi && cocuklar.length > 0 && (
          <div className="ml-3 grid gap-0.5 border-l border-border pl-1">
            {cocuklar.map((c) => subeAgaci(c, grupAnahtar))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="hidden min-w-0 gap-4 md:flex">
      {/* Sol menü: firmalar */}
      <aside className="w-48 shrink-0">
        {/* Menü tabloyla aynı hizada biter; uzarsa kendi içinde kayar */}
        <div className="sticky top-20 grid h-[calc(100vh-116px)] content-start gap-1.5 overflow-y-auto overflow-x-hidden px-0.5">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Firmalar
          </div>
          {/* Açılır listeden hızlı firma seçimi */}
          <select
            value={aktifGrup}
            onChange={(e) => git({ grup: e.target.value || null, sube: null, bakilmadi: null })}
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
              const aktifMi = aktifGrup === h.anahtar && !aktifSube
              const suruklemeVar = surukle != null
              // "ağız gibi açılma": sürüklerken hedefin üstü yukarı, altı aşağı kayar
              let ty = 0
              if (suruklemeVar && hedefIndex >= 0) {
                if (i < hedefIndex) ty = -10
                else if (i > hedefIndex) ty = 10
              }
              const vurgulu = suruklemeVar && hedef === h.anahtar
              const hSubeler =
                h.anahtar === "diger" ? [] : subeMap.get(h.anahtar) ?? []
              const acik = acikGruplar.has(h.anahtar)
              return (
                <div key={h.anahtar}>
                  <div
                    ref={(el) => {
                      if (el) ogeRef.current.set(h.anahtar, el)
                      else ogeRef.current.delete(h.anahtar)
                    }}
                    className="group/firma relative flex items-center transition-transform duration-150"
                    style={{ transform: `translateY(${ty}px)` }}
                  >
                    {/* Şubesi olan firmada aç/kapa oku (adın solunda) */}
                    {hSubeler.length > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          grupAcKapa(h.anahtar)
                        }}
                        title={acik ? "Şubeleri gizle" : "Şubeleri göster"}
                        className="flex h-6 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={cn("transition-transform", acik && "rotate-90")}
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    ) : (
                      <span className="w-5 shrink-0" />
                    )}
                    <Link
                      href={url({ grup: h.anahtar, sube: null, bakilmadi: null })}
                      scroll={false}
                      className={cn(
                        "flex-1 truncate rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors",
                        vurgulu
                          ? "bg-emerald-500 font-bold text-white ring-2 ring-inset ring-emerald-200"
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
                  {/* Şubeler + alt şubeler (açıkken alt alta) — sürükle-bırak hedefi */}
                  {acik && hSubeler.length > 0 && (
                    <div className="mb-0.5 ml-[18px] grid gap-0.5 border-l border-border pl-1.5">
                      {hSubeler.map((s) => subeAgaci(s, h.anahtar))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </aside>

      {/* Orta sütun: filtreler + tablo */}
      <div className="min-w-0 flex-1">
        {ustSlot && <div className="mb-3">{ustSlot}</div>}
        {/* Kaydırma tablonun KENDİ kabında: başlıklar buna yapışır; kutu ekranın altına kadar uzar */}
        <Table
          containerClassName="h-[calc(100vh-164px)] overflow-auto rounded-lg border"
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
              {musteriGoster && <TableHead>Müşteri</TableHead>}
              <TableHead>
                <Link href={siralaHref("cihaz")} scroll={false} className="hover:underline">Cihaz{ok("cihaz")}</Link>
              </TableHead>
              {arama && <TableHead className="text-primary">Eşleşme</TableHead>}
              <TableHead>
                <Link href={siralaHref("gelis")} scroll={false} className="hover:underline">Geliş{ok("gelis")}</Link>
              </TableHead>
              <TableHead>
                <Link href={siralaHref("cikis")} scroll={false} className="hover:underline">Çıkış{ok("cikis")}</Link>
              </TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Personel</TableHead>
              {finansal && <TableHead>Fatura</TableHead>}
              {finansal && <TableHead className="text-right">Fiyat Teklifi</TableHead>}
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
                  colSpan={7 + (musteriGoster ? 1 : 0) + (arama ? 1 : 0) + (finansal ? 5 : 0)}
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
                // Ctrl (Mac'te ⌘) + tıkla → satırı seç. Capture: hücre düzenleyiciler
                // kendi onClick'lerinde durdurduğu için onlardan ÖNCE yakalanmalı.
                onClickCapture={(e) => {
                  if (!finansal) return
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault()
                    e.stopPropagation()
                    seciliDegistir(k.id)
                  }
                }}
                // Satır rengi Excel'deki gibi: önce FATURA (SONUÇ), yoksa DURUM
                style={{
                  "--satir":
                    faturaRenk(k.fatura_durumu?.ad, k.fatura_durumu?.renk) ??
                    durumRenk(k.durum?.ad, k.durum?.renk),
                } as CSSProperties}
                className={cn(
                  "border-b transition-colors",
                  "bg-[color-mix(in_oklab,var(--satir)_48%,transparent)] hover:bg-[color-mix(in_oklab,var(--satir)_60%,transparent)] data-[selected=true]:bg-[color-mix(in_oklab,var(--satir)_72%,transparent)]",
                  surukleIdler.includes(k.id) && "opacity-40",
                  secili.has(k.id) && "ring-2 ring-inset ring-primary/70"
                )}
              >
                {/* Sürükleme sapı — fiş no'nun hemen solunda (seçim: Ctrl + tıkla) */}
                {finansal && (
                  <TableCell className="w-7 p-0 pl-1">
                    <button
                      type="button"
                      title="Tutup sol menüdeki firmaya/şubeye sürükle (çoklu için Ctrl+tıkla seç)"
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        // Seçili satırlardan biri tutulduysa hepsini taşı; değilse yalnız bunu
                        const idler =
                          secili.has(k.id) && secili.size > 0
                            ? Array.from(secili)
                            : [k.id]
                        setSurukle(k)
                        setSurukleIdler(idler)
                        setPos({ x: e.clientX, y: e.clientY })
                      }}
                      className={cn(
                        "flex h-8 w-5 cursor-grab items-center justify-center rounded hover:bg-muted hover:text-foreground active:cursor-grabbing",
                        secili.has(k.id) ? "text-primary" : "text-muted-foreground/50"
                      )}
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
                    {/* İkinci no alanı (talep_no) — otomatik "Talep" etiketi YOK; müdür ne
                        no olduğunu kendi yazar (teklif no vb.). Değer olduğu gibi gösterilir. */}
                    {k.talep_no && (
                      <div className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                        <HucreDuzenle isId={k.id} alan="talep_no" deger={k.talep_no} className="min-w-0" />
                      </div>
                    )}
                  </TableCell>
                )}
                {musteriGoster && (
                  <TableCell className="min-w-[120px] max-w-[170px]">
                    <HucreDuzenle isId={k.id} alan="musteri" deger={k.musteri?.ad ?? null} placeholder="Firma adı" className="truncate" />
                    {/* Müşteri adının altında şube adı (varsa ve addan farklıysa) */}
                    {(() => {
                      const subeAd = k.sube_id ? subeAdMap.get(k.sube_id) : null
                      return subeAd && subeAd !== (k.musteri?.ad ?? "") ? (
                        <span className="block truncate text-[11px] text-muted-foreground" title={subeAd}>
                          şube: {subeAd}
                        </span>
                      ) : null
                    })()}
                  </TableCell>
                )}
                <TableCell
                  className="min-w-[130px] max-w-[210px]"
                  // Önizleme YALNIZ Cihaz hücresinde ~3 sn beklenince açılır
                  onMouseEnter={(e) => {
                    if (surukle || !k.ilk_foto_url) return
                    imlecRef.current = { x: e.clientX, y: e.clientY }
                    const url = k.ilk_foto_url
                    gecikmeIptal()
                    beklemeRef.current = window.setTimeout(() => setOnizlemeUrl(url), ONIZLEME_GECIKME)
                  }}
                  onMouseMove={(e) => {
                    if (beklemeRef.current != null || onizlemeUrl) imlecRef.current = { x: e.clientX, y: e.clientY }
                  }}
                  onMouseLeave={() => {
                    gecikmeIptal()
                    setOnizlemeUrl(null)
                  }}
                >
                  <HucreDuzenle isId={k.id} alan="cihaz_adi" deger={k.cihaz_adi} className="truncate" />
                  <HucreDuzenle isId={k.id} alan="seri_no" deger={k.seri_no} bosEtiket="SN ekle" className="truncate text-xs text-muted-foreground" />
                </TableCell>
                {/* Eşleşme sütunu — YALNIZ arama yapılırken; cihaz ile geliş arasında, ortada */}
                {arama &&
                  (() => {
                    const e = aramaEslesmesi(k, arama)
                    return (
                      <TableCell className="min-w-[150px] max-w-[240px]">
                        {e ? (
                          <span
                            className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-[12.5px] font-medium text-foreground shadow-sm ring-1 ring-inset ring-border"
                            title={`${e.etiket}: ${e.deger}`}
                          >
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              {e.etiket}
                            </span>
                            <span className="truncate">{aramaVurgula(e.deger, arama)}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )
                  })()}
                <TableCell className="min-w-[92px]">
                  <HucreDuzenle isId={k.id} alan="gelis_tarihi" tip="tarih" deger={k.gelis_tarihi} goster={() => tarihTR(k.gelis_tarihi)} />
                  <HucreDuzenle
                    isId={k.id}
                    alan="gelis_saat"
                    tip="saat"
                    // "16:52:00" değil "16:52" ver: time input'un döndürdüğüyle aynı
                    // olsun ki değişmeden kapatınca boşuna kayıt atmasın
                    deger={saatTR(k.gelis_saat) || null}
                    bosEtiket="saat ekle"
                    goster={() =>
                      k.gelis_saat ? (
                        saatTR(k.gelis_saat)
                      ) : (
                        <span className="text-muted-foreground/60">saat ekle</span>
                      )
                    }
                    className="text-xs text-muted-foreground"
                  />
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
                    {/* Fatura tarihi — YALNIZ "FATURA EDİLDİ" durumunda görünür; oto gelir, düzenlenebilir */}
                    {k.fatura_durumu?.ad?.toLocaleUpperCase("tr-TR") === "FATURA EDİLDİ" && (
                      <HucreDuzenle
                        isId={k.id}
                        alan="fatura_tarihi"
                        tip="tarih"
                        deger={k.fatura_tarihi}
                        goster={() => (k.fatura_tarihi ? tarihTR(k.fatura_tarihi) : "tarih ekle")}
                        className="mt-0.5 text-[11px] text-muted-foreground"
                      />
                    )}
                  </TableCell>
                )}
                {finansal && (
                  <TableCell className="min-w-[110px] text-right tabular-nums">
                    <div className="flex items-center justify-end gap-0.5">
                      <HucreDuzenle
                        isId={k.id}
                        alan="fiyat_teklifi"
                        deger={k.fiyat_teklifi != null ? String(k.fiyat_teklifi) : null}
                        goster={() =>
                          k.fiyat_teklifi != null ? (
                            sayiBicim.format(k.fiyat_teklifi)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        }
                        placeholder="Teklif"
                        className="text-right"
                      />
                      <TeklifBirimi isId={k.id} birim={k.teklif_birim} />
                    </div>
                  </TableCell>
                )}
                {finansal && (
                  <TableCell className="text-right tabular-nums">
                    <HucreDuzenle
                      isId={k.id}
                      alan="fatura_tutari"
                      deger={k.fatura_tutari != null ? String(k.fatura_tutari) : null}
                      goster={() =>
                        k.fatura_tutari != null ? (
                          paraTR(k.fatura_tutari, "TL")
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )
                      }
                      placeholder="Tutar"
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
          <div className="sticky top-20 max-h-[calc(100vh-165px)] overflow-y-auto rounded-lg border p-3">
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
                      teklif_birim: seciliBilgi.teklif_birim,
                      fatura_tutari: seciliBilgi.fatura_tutari,
                      fatura_tarihi: seciliBilgi.fatura_tarihi,
                      garanti_no: seciliBilgi.garanti_no,
                      talep_no: seciliBilgi.talep_no,
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

      {/* Satır foto önizlemesi — mouse imlecinin sağ-üstünde küçük görsel */}
      {onizlemeUrl &&
        (() => {
          const { sol, ust } = konumHesapla(imlecRef.current.x, imlecRef.current.y)
          return (
            <div
              ref={onizlemeRef}
              className="pointer-events-none fixed z-[60] overflow-hidden rounded-lg border-2 border-primary/50 bg-card shadow-2xl"
              style={{ left: sol, top: ust, width: ONIZLEME_BOY, height: ONIZLEME_BOY }}
            >
              <Image
                src={onizlemeUrl}
                alt="Önizleme"
                fill
                sizes="200px"
                quality={60}
                className="object-cover"
              />
            </div>
          )
        })()}

      {/* Sürükleme sırasında imleci takip eden etiket */}
      {surukle && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-emerald-400 bg-card px-3 py-1.5 text-xs font-medium shadow-lg"
          style={{ left: pos.x + 12, top: pos.y + 12 }}
        >
          {surukleIdler.length > 1
            ? `${surukleIdler.length} iş`
            : surukle.servis_no ?? surukle.cihaz_adi}
          <span className="ml-1 text-muted-foreground">
            → {hedef ? hedefAd(hedef) : "soldaki firmaya/şubeye bırak"}
          </span>
        </div>
      )}

      {/* Alt şerit: seçim bilgisi + son yapılan taşıma & geri al */}
      {finansal && (secili.size > 0 || sonIslem) && (
        <div className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 shadow-xl">
          {secili.size > 0 && (
            <>
              <span className="text-[12.5px] font-semibold text-primary">
                {secili.size} iş seçili
              </span>
              <button
                type="button"
                onClick={() => setSecili(new Set(gorunenIdler))}
                className="rounded-lg border border-border px-2 py-1 text-[12px] font-medium hover:bg-muted"
              >
                Tümünü seç
              </button>
              <button
                type="button"
                onClick={() => setSecili(new Set())}
                className="rounded-lg px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted"
              >
                Temizle
              </button>
            </>
          )}
          {secili.size > 0 && sonIslem && <span className="h-4 w-px bg-border" />}
          {sonIslem && (
            <>
              <span className="text-[12.5px]">
                <strong>{sonIslem.adet} iş</strong> taşındı
                <span className="ml-1 text-muted-foreground">{sonIslem.metin}</span>
              </span>
              <button
                type="button"
                onClick={geriAl}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-accent px-2.5 py-1 text-[12px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                </svg>
                Geri al
              </button>
              <button
                type="button"
                onClick={() => setSonIslem(null)}
                title="Kapat"
                className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </>
          )}
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
