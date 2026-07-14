"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import type { IsFormState } from "@/app/actions/is"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { fotograflariYukle } from "@/lib/foto-istemci"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { KameraYakala } from "@/components/kamera-yakala"

type Secenek = { id: string; ad: string }

export type IsFormVarsayilan = {
  musteri_id?: string | null
  cihaz_adi?: string | null
  seri_no?: string | null
  servis_no?: string | null
  gelis_tarihi?: string | null
  cikis_tarihi?: string | null
  durum_id?: string | null
  teknik_personel_id?: string | null
  fatura_durumu_id?: string | null
  ilgili_kisi?: string | null
  telefon?: string | null
  adres?: string | null
  kargo_takip_no?: string | null
  grup_id?: string | null
  sube_id?: string | null
  fiyat_teklifi?: number | null
  teklif_birim?: string | null
  fatura_tutari?: number | null
  fatura_tarihi?: string | null
  garanti_no?: string | null
  aciklama?: string | null
}

type Props = {
  action: (prev: IsFormState, formData: FormData) => Promise<IsFormState>
  musteriler: Secenek[]
  durumlar: Secenek[]
  personeller: Secenek[]
  faturaDurumlari: Secenek[]
  subeler?: Secenek[] // seçili firmanın (grup) şubeleri — varsa "şube seç" çıkar
  varsayilan?: IsFormVarsayilan
  gonderEtiketi?: string
  iptalHref?: string
  finansalGoster?: boolean
  servisNoGoster?: boolean
  servisNoEtiket?: string // BOYTEKS için "Firma stok kodu"
  degisiklikTakip?: boolean
  fotoSecimi?: boolean
  personelMod?: boolean // tekniker/durum/çıkış/geliş gizli; geliş & durum sabit
}

const selectClass =
  "h-9 w-full rounded-[9px] border border-input bg-card px-2.5 text-sm outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15 disabled:opacity-50"

const labelClass = "text-xs font-semibold text-muted-foreground"

function Bolum({
  baslik,
  children,
}: {
  baslik: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold">
        <span className="h-3.5 w-[5px] rounded-[3px] bg-primary" />
        {baslik}
      </div>
      {children}
    </div>
  )
}

export function IsFormu({
  action,
  musteriler,
  durumlar,
  personeller,
  faturaDurumlari,
  subeler = [],
  varsayilan = {},
  gonderEtiketi = "Kaydet",
  iptalHref = "/",
  finansalGoster = true,
  servisNoGoster = false, // fiş no otomatik üretilir; alan salt-okunur gösterilir
  servisNoEtiket = "Servis (fiş) no",
  degisiklikTakip = false,
  fotoSecimi = false,
  personelMod = false,
}: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<IsFormState, FormData>(
    action,
    {}
  )
  const [yeniMusteri, setYeniMusteri] = useState(false)
  const [yeniMusteriAd, setYeniMusteriAd] = useState("") // yazdığı isim buraya taşınır
  // Aranabilir müşteri seçici (uzun listede tek tek gezmek yerine yazarak bul)
  const [musteriId, setMusteriId] = useState(varsayilan.musteri_id ?? "")
  const [musteriAra, setMusteriAra] = useState("")
  const [musteriAcik, setMusteriAcik] = useState(false)
  const musteriKutu = useRef<HTMLDivElement>(null)
  const seciliMusteriAd = musteriler.find((m) => m.id === musteriId)?.ad ?? ""
  const filtreliMusteriler = useMemo(() => {
    const q = musteriAra.trim().toLocaleLowerCase("tr-TR")
    const kaynak = q
      ? musteriler.filter((m) => m.ad.toLocaleLowerCase("tr-TR").includes(q))
      : musteriler
    return kaynak.slice(0, 50)
  }, [musteriler, musteriAra])

  useEffect(() => {
    function disari(e: MouseEvent) {
      if (musteriKutu.current && !musteriKutu.current.contains(e.target as Node))
        setMusteriAcik(false)
    }
    document.addEventListener("mousedown", disari)
    return () => document.removeEventListener("mousedown", disari)
  }, [])

  // İlgili kişi & telefon — ayrı kutular; rehberden seçince ikisi de dolar
  const [ilgiliKisi, setIlgiliKisi] = useState(varsayilan.ilgili_kisi ?? "")
  const [telefon, setTelefon] = useState(varsayilan.telefon ?? "")
  const [rehberVar, setRehberVar] = useState(false)
  useEffect(() => {
    const nav = navigator as Navigator & { contacts?: { select?: unknown } }
    setRehberVar(!!nav.contacts && typeof nav.contacts.select === "function")
  }, [])
  async function rehberdenSec() {
    try {
      const nav = navigator as Navigator & {
        contacts?: {
          select: (
            props: string[],
            opts?: { multiple?: boolean }
          ) => Promise<Array<{ name?: string[]; tel?: string[] }>>
        }
      }
      if (!nav.contacts) return
      const secilenler = await nav.contacts.select(["name", "tel"], { multiple: false })
      const c = secilenler?.[0]
      if (c) {
        const ad = Array.isArray(c.name) ? c.name[0] : c.name
        const tel = Array.isArray(c.tel) ? c.tel[0] : c.tel
        if (ad) setIlgiliKisi(ad)
        if (tel) setTelefon(tel)
        if ((ad || tel) && degisiklikTakip) setDegisti(true)
      }
    } catch {
      /* kullanıcı iptal etti ya da desteklenmiyor — elle yazabilir */
    }
  }
  // Adet: yeni kayıtta birden çok aynı ürün → tek fiş no, ayrı satırlar
  const [adet, setAdet] = useState(1)
  const cokluAdet = !degisiklikTakip // yalnız yeni iş girişinde adet seçilir
  // Zorunlu alan pop-up'ı (yalnız yeni kayıtta; düzenlemede eski kayıtlar bloklanmasın)
  const [eksikAlanlar, setEksikAlanlar] = useState<string[]>([])
  const zorunluKontrol = !degisiklikTakip // yeni iş girişi
  function gonderKontrol(e: React.FormEvent<HTMLFormElement>) {
    if (!zorunluKontrol) return
    const fd = new FormData(e.currentTarget)
    const eksik: string[] = []
    const musteriDolu = yeniMusteri ? yeniMusteriAd.trim() : musteriId
    if (!musteriDolu) eksik.push("Müşteri")
    if (!String(fd.get("cihaz_adi") ?? "").trim()) eksik.push("Kart / cihaz adı")
    if (!ilgiliKisi.trim()) eksik.push("İlgili kişi")
    if (!telefon.trim()) eksik.push("Telefon")
    if (!personelMod) {
      if (!String(fd.get("gelis_tarihi") ?? "").trim()) eksik.push("Geliş tarihi")
      if (!String(fd.get("durum_id") ?? "").trim()) eksik.push("Durum")
    }
    if (eksik.length) {
      e.preventDefault()
      setEksikAlanlar(eksik)
    }
  }
  // Değişiklik takibi: edit modunda buton değişiklik olana dek pasif kalır.
  const [degisti, setDegisti] = useState(!degisiklikTakip)
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)
  // Kameradan çekilen kareler (kaydedince dosya seçimiyle birlikte yüklenir).
  const [kameraDosyalari, setKameraDosyalari] = useState<File[]>([])
  const kameraRef = useRef<File[]>([])
  const fe = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.id) {
      // Yeni iş oluşturuldu: seçili + çekilen fotoğrafları yükle, sonra detaya git.
      const dosyalar = [
        ...Array.from(fotoRef.current?.files ?? []),
        ...kameraRef.current,
      ]
      const detayaGit = () => router.push(`/is/${state.id}`)
      if (dosyalar.length === 0) {
        detayaGit()
        return
      }
      setFotoYukleniyor(true)
      fotograflariYukle(createClient(), state.id, dosyalar, 0)
        .catch(() => {}) // foto hatası olsa da iş oluştu; detayda eklenebilir
        .finally(detayaGit)
    } else if (state.basari) {
      setDegisti(false)
    }
  }, [state, router])

  function Hata({ alan }: { alan: string }) {
    return fe[alan] ? <p className="text-xs text-destructive">{fe[alan]}</p> : null
  }

  return (
    <form
      action={formAction}
      onSubmit={gonderKontrol}
      onInput={() => {
        if (degisiklikTakip && !degisti) setDegisti(true)
      }}
      className="grid gap-4"
    >
      {state.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {/* Zorunlu alan uyarısı — ekrana pop-up */}
      {eksikAlanlar.length > 0 && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEksikAlanlar([])}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2 text-base font-semibold text-destructive">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
              Bunları doldurmadınız
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Şu zorunlu alanlar boş kaldı:
            </p>
            <ul className="mb-5 list-disc space-y-1 pl-5 text-sm font-medium">
              {eksikAlanlar.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <Button type="button" className="w-full" onClick={() => setEksikAlanlar([])}>
              Tamam
            </Button>
          </div>
        </div>
      )}

      <Bolum baslik="Müşteri & İletişim">
        <div className="mb-3.5 grid gap-2">
          <div className="flex items-center justify-between">
            <label className={labelClass}>Müşteri</label>
            {/* Büyük, kolay basılır düğme (mobilde personel için) */}
            <button
              type="button"
              onClick={() => setYeniMusteri((v) => !v)}
              className="rounded-lg border border-primary/40 bg-accent px-3.5 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              {yeniMusteri ? "← Mevcuttan seç" : "+ Yeni müşteri"}
            </button>
          </div>
          {yeniMusteri ? (
            <Input
              name="yeni_musteri_adi"
              placeholder="Yeni müşteri adı"
              autoFocus
              value={yeniMusteriAd}
              onChange={(e) => setYeniMusteriAd(e.target.value)}
            />
          ) : (
            <div ref={musteriKutu} className="relative">
              {/* Yazarak ara — kayıtlı müşteriler süzülür, tıkla seç */}
              <Input
                value={musteriAcik ? musteriAra : seciliMusteriAd}
                placeholder="Müşteri ara…"
                autoComplete="off"
                aria-invalid={!!fe.musteri_id}
                onFocus={() => {
                  setMusteriAcik(true)
                  setMusteriAra("")
                }}
                onChange={(e) => {
                  setMusteriAcik(true)
                  setMusteriAra(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setMusteriAcik(false)
                }}
              />
              <input type="hidden" name="musteri_id" value={musteriId} />
              {musteriAcik && (
                <div className="absolute left-0 top-full z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-xl">
                  {filtreliMusteriler.length === 0 && (
                    musteriAra.trim() ? (
                      // Eşleşme yoksa: tıkla → yazdığı ismi yeni müşteri olarak ekle
                      <button
                        type="button"
                        onClick={() => {
                          setYeniMusteriAd(musteriAra.trim())
                          setYeniMusteri(true)
                          setMusteriAcik(false)
                          if (degisiklikTakip) setDegisti(true)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                        </span>
                        <span>
                          <strong>&quot;{musteriAra.trim()}&quot;</strong> adıyla yeni müşteri ekle
                        </span>
                      </button>
                    ) : (
                      <div className="px-3 py-2.5 text-sm text-muted-foreground">
                        Aramak için yazın…
                      </div>
                    )
                  )}
                  {filtreliMusteriler.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMusteriId(m.id)
                        setMusteriAcik(false)
                        if (degisiklikTakip) setDegisti(true)
                      }}
                      className={cn(
                        "block w-full px-3 py-2.5 text-left text-sm hover:bg-muted",
                        m.id === musteriId && "bg-accent font-semibold text-primary"
                      )}
                    >
                      {m.ad}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Hata alan="musteri_id" />
        </div>
        {/* Şube: yalnız şubeli firmalarda (yönetici) çıkar */}
        {!personelMod && subeler.length > 0 && (
          <div className="mb-3.5 grid gap-1.5">
            <label className={labelClass} htmlFor="sube_id">Şube</label>
            <select
              id="sube_id"
              name="sube_id"
              className={selectClass}
              defaultValue={varsayilan.sube_id ?? ""}
            >
              <option value="">Ana firma (şubesiz)</option>
              {subeler.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ad}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className={labelClass}>İlgili kişi & telefon *</label>
            {rehberVar && (
              <button
                type="button"
                onClick={rehberdenSec}
                className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-accent px-2.5 py-1 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 8v6M18 11h6"/></svg>
                Rehberden seç
              </button>
            )}
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input
              id="ilgili_kisi"
              name="ilgili_kisi"
              placeholder="Ad Soyad"
              value={ilgiliKisi}
              onChange={(e) => setIlgiliKisi(e.target.value)}
              aria-invalid={!!fe.ilgili_kisi}
            />
            <Input
              id="telefon"
              name="telefon"
              type="tel"
              inputMode="tel"
              placeholder="05xx…"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              aria-invalid={!!fe.telefon}
            />
          </div>
        </div>
        <div className="mt-3.5 grid gap-1.5 sm:max-w-[50%]">
          {servisNoGoster ? (
            <>
              <label className={labelClass} htmlFor="servis_no">{servisNoEtiket}</label>
              <Input id="servis_no" name="servis_no" placeholder="Örn. 9577" defaultValue={varsayilan.servis_no ?? ""} />
            </>
          ) : (
            <>
              <label className={labelClass}>Fiş no</label>
              <div className="flex h-9 items-center rounded-[9px] border border-input bg-muted/40 px-2.5 font-mono text-sm">
                {varsayilan.servis_no ?? (
                  <span className="font-sans text-muted-foreground">
                    Kaydedince otomatik üretilir
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {/* Adres personelde gizli (yalnız yönetici) */}
        {!personelMod && (
          <div className="mt-3.5 grid gap-1.5">
            <label className={labelClass} htmlFor="adres">Adres</label>
            <Input id="adres" name="adres" placeholder="Müşteri / cihaz adresi" defaultValue={varsayilan.adres ?? ""} />
          </div>
        )}
      </Bolum>

      <Bolum baslik="Cihaz Bilgileri">
        <div className="mb-3.5 grid gap-1.5">
          <label className={labelClass} htmlFor="cihaz_adi">Kart / cihaz adı *</label>
          <Input id="cihaz_adi" name="cihaz_adi" placeholder="Örn. SIEMENS 6SE3221 7.5KW SÜRÜCÜ" defaultValue={varsayilan.cihaz_adi ?? ""} aria-invalid={!!fe.cihaz_adi} />
          <Hata alan="cihaz_adi" />
        </div>
        {cokluAdet && (
          <div className="mb-3.5 grid gap-1.5 sm:max-w-[160px]">
            <label className={labelClass} htmlFor="adet">Adet</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAdet((a) => Math.max(1, a - 1))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input bg-card text-lg hover:bg-muted"
                aria-label="Azalt"
              >
                −
              </button>
              <input
                id="adet"
                name="adet"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                value={adet}
                onChange={(e) =>
                  setAdet(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                }
                className={cn(selectClass, "w-16 text-center")}
              />
              <button
                type="button"
                onClick={() => setAdet((a) => Math.min(50, a + 1))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input bg-card text-lg hover:bg-muted"
                aria-label="Artır"
              >
                +
              </button>
            </div>
          </div>
        )}
        {cokluAdet && adet > 1 ? (
          <div className="grid gap-2">
            <label className={labelClass}>Seri no ({adet} ürün)</label>
            {Array.from({ length: adet }).map((_, i) => (
              <Input
                key={i}
                name="seri_no"
                placeholder={`Seri no #${i + 1}`}
                autoComplete="off"
              />
            ))}
            <span className="text-[11px] text-muted-foreground">
              Her ürün ayrı satır olur; fiş no hepsinde aynıdır.
            </span>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="seri_no">Seri no</label>
            <Input id="seri_no" name="seri_no" defaultValue={varsayilan.seri_no ?? ""} />
          </div>
        )}
      </Bolum>

      {personelMod ? (
        <>
          <input type="hidden" name="durum_id" value={varsayilan.durum_id ?? ""} />
          <input type="hidden" name="gelis_tarihi" value={varsayilan.gelis_tarihi ?? ""} />
        </>
      ) : (
      <Bolum baslik="Süreç & Atama">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="gelis_tarihi">Geliş tarihi *</label>
            <input id="gelis_tarihi" name="gelis_tarihi" type="date" className={selectClass} defaultValue={varsayilan.gelis_tarihi ?? ""} aria-invalid={!!fe.gelis_tarihi} />
            <Hata alan="gelis_tarihi" />
          </div>
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="cikis_tarihi">Çıkış tarihi</label>
            <input id="cikis_tarihi" name="cikis_tarihi" type="date" className={selectClass} defaultValue={varsayilan.cikis_tarihi ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="durum_id">Durum *</label>
            <select id="durum_id" name="durum_id" className={selectClass} defaultValue={varsayilan.durum_id ?? ""} aria-invalid={!!fe.durum_id}>
              <option value="">Seçin…</option>
              {durumlar.map((d) => (
                <option key={d.id} value={d.id}>{d.ad}</option>
              ))}
            </select>
            <Hata alan="durum_id" />
          </div>
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="teknik_personel_id">Tekniker (işi yapan)</label>
            <select id="teknik_personel_id" name="teknik_personel_id" className={selectClass} defaultValue={varsayilan.teknik_personel_id ?? ""}>
              <option value="">Atanmadı</option>
              {personeller.map((p) => (
                <option key={p.id} value={p.id}>{p.ad}</option>
              ))}
            </select>
          </div>
        </div>
      </Bolum>
      )}

      {finansalGoster && (
      <Bolum baslik="Mali Bilgiler">
        <div className="grid gap-3.5 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="fatura_durumu_id">Fatura durumu</label>
            <select id="fatura_durumu_id" name="fatura_durumu_id" className={selectClass} defaultValue={varsayilan.fatura_durumu_id ?? ""}>
              <option value="">—</option>
              {faturaDurumlari.map((f) => (
                <option key={f.id} value={f.id}>{f.ad}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="fiyat_teklifi">Fiyat teklifi</label>
            <div className="flex gap-1.5">
              <Input id="fiyat_teklifi" name="fiyat_teklifi" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" defaultValue={varsayilan.fiyat_teklifi ?? ""} aria-invalid={!!fe.fiyat_teklifi} className="flex-1" />
              <select
                name="teklif_birim"
                defaultValue={varsayilan.teklif_birim ?? "TL"}
                aria-label="Para birimi"
                className={cn(selectClass, "w-[80px] shrink-0")}
              >
                <option value="TL">TL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
            <Hata alan="fiyat_teklifi" />
          </div>
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="fatura_tutari">Fatura tutarı (TL)</label>
            <Input id="fatura_tutari" name="fatura_tutari" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" defaultValue={varsayilan.fatura_tutari ?? ""} aria-invalid={!!fe.fatura_tutari} />
            <Hata alan="fatura_tutari" />
          </div>
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="fatura_tarihi">Fatura tarihi</label>
            <input id="fatura_tarihi" name="fatura_tarihi" type="date" className={selectClass} defaultValue={varsayilan.fatura_tarihi ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="garanti_no">Takip no</label>
            <Input id="garanti_no" name="garanti_no" placeholder="Harf/rakam olabilir" defaultValue={varsayilan.garanti_no ?? ""} />
          </div>
        </div>
      </Bolum>
      )}

      {/* Grup ataması (yeşil + ile gruba hızlı ekleme): gizli alan */}
      {finansalGoster && varsayilan.grup_id ? (
        <input type="hidden" name="grup_id" value={varsayilan.grup_id} />
      ) : null}

      <Bolum baslik="Açıklama / Notlar">
        <textarea
          id="aciklama"
          name="aciklama"
          rows={4}
          placeholder="Yapılan işlem, değişen parçalar, müşteri notları…"
          className="w-full resize-y rounded-[9px] border border-input bg-card p-3 text-sm leading-relaxed outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15"
          defaultValue={varsayilan.aciklama ?? ""}
        />
      </Bolum>

      {fotoSecimi && (
        <Bolum baslik="Fotoğraflar">
          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
          />
          <div className="mt-3 flex items-center gap-2">
            <KameraYakala
              onCek={(d) =>
                setKameraDosyalari((p) => {
                  const yeni = [...p, d]
                  kameraRef.current = yeni
                  return yeni
                })
              }
            />
            {kameraDosyalari.length > 0 && (
              <span className="text-xs font-medium text-muted-foreground">
                {kameraDosyalari.length} foto çekildi
                <button
                  type="button"
                  onClick={() => {
                    kameraRef.current = []
                    setKameraDosyalari([])
                  }}
                  className="ml-2 text-destructive hover:underline"
                >
                  temizle
                </button>
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Kaydedince fotoğraflar otomatik yüklenir. Telefonda ya da PC kamerasından
            doğrudan çekebilirsin.
          </p>
        </Bolum>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={pending || fotoYukleniyor || (degisiklikTakip && !degisti)}
        >
          {pending
            ? "Kaydediliyor…"
            : fotoYukleniyor
              ? "Fotoğraflar yükleniyor…"
              : gonderEtiketi}
        </Button>
        {degisiklikTakip && state.basari && !degisti && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Kaydedildi
          </span>
        )}
        <Link href={iptalHref} className={buttonVariants({ variant: "ghost" })}>
          İptal
        </Link>
      </div>
    </form>
  )
}
