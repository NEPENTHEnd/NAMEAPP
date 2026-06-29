"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import type { IsFormState } from "@/app/actions/is"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { fotograflariYukle } from "@/lib/foto-istemci"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
  adres?: string | null
  fiyat_teklifi?: number | null
  fatura_tutari?: number | null
  garanti_no?: string | null
  aciklama?: string | null
}

type Props = {
  action: (prev: IsFormState, formData: FormData) => Promise<IsFormState>
  musteriler: Secenek[]
  durumlar: Secenek[]
  personeller: Secenek[]
  faturaDurumlari: Secenek[]
  varsayilan?: IsFormVarsayilan
  gonderEtiketi?: string
  iptalHref?: string
  finansalGoster?: boolean
  servisNoGoster?: boolean
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
  varsayilan = {},
  gonderEtiketi = "Kaydet",
  iptalHref = "/",
  finansalGoster = true,
  servisNoGoster = false, // fiş no otomatik üretilir; alan salt-okunur gösterilir
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
  // Değişiklik takibi: edit modunda buton değişiklik olana dek pasif kalır.
  const [degisti, setDegisti] = useState(!degisiklikTakip)
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)
  const fe = state.fieldErrors ?? {}

  useEffect(() => {
    if (state.id) {
      // Yeni iş oluşturuldu: seçili fotoğrafları yükle, sonra detaya git.
      const dosyalar = Array.from(fotoRef.current?.files ?? [])
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

      <Bolum baslik="Müşteri & İletişim">
        <div className="mb-3.5 grid gap-2">
          <div className="flex items-center justify-between">
            <label className={labelClass}>Müşteri</label>
            <button
              type="button"
              onClick={() => setYeniMusteri((v) => !v)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {yeniMusteri ? "Mevcuttan seç" : "+ Yeni müşteri"}
            </button>
          </div>
          {yeniMusteri ? (
            <Input name="yeni_musteri_adi" placeholder="Yeni müşteri adı" autoFocus />
          ) : (
            <select
              name="musteri_id"
              className={selectClass}
              defaultValue={varsayilan.musteri_id ?? ""}
            >
              <option value="">Müşteri seçin…</option>
              {musteriler.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.ad}
                </option>
              ))}
            </select>
          )}
          <Hata alan="musteri_id" />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="ilgili_kisi">İlgili kişi & telefon</label>
            <Input id="ilgili_kisi" name="ilgili_kisi" placeholder="Ad Soyad · 05xx…" defaultValue={varsayilan.ilgili_kisi ?? ""} />
          </div>
          {servisNoGoster ? (
            <div className="grid gap-1.5">
              <label className={labelClass} htmlFor="servis_no">Servis (fiş) no</label>
              <Input id="servis_no" name="servis_no" placeholder="Örn. 9577" defaultValue={varsayilan.servis_no ?? ""} />
            </div>
          ) : (
            <div className="grid gap-1.5">
              <label className={labelClass}>Fiş no</label>
              <div className="flex h-9 items-center rounded-[9px] border border-input bg-muted/40 px-2.5 font-mono text-sm">
                {varsayilan.servis_no ?? (
                  <span className="font-sans text-muted-foreground">
                    Kaydedince otomatik üretilir
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="mt-3.5 grid gap-1.5">
          <label className={labelClass} htmlFor="adres">Adres</label>
          <Input id="adres" name="adres" placeholder="Müşteri / cihaz adresi" defaultValue={varsayilan.adres ?? ""} />
        </div>
      </Bolum>

      <Bolum baslik="Cihaz Bilgileri">
        <div className="mb-3.5 grid gap-1.5">
          <label className={labelClass} htmlFor="cihaz_adi">Kart / cihaz adı *</label>
          <Input id="cihaz_adi" name="cihaz_adi" placeholder="Örn. SIEMENS 6SE3221 7.5KW SÜRÜCÜ" defaultValue={varsayilan.cihaz_adi ?? ""} aria-invalid={!!fe.cihaz_adi} />
          <Hata alan="cihaz_adi" />
        </div>
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="seri_no">Seri no</label>
          <Input id="seri_no" name="seri_no" defaultValue={varsayilan.seri_no ?? ""} />
        </div>
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
            <label className={labelClass} htmlFor="fiyat_teklifi">Fiyat teklifi (₺)</label>
            <Input id="fiyat_teklifi" name="fiyat_teklifi" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" defaultValue={varsayilan.fiyat_teklifi ?? ""} aria-invalid={!!fe.fiyat_teklifi} />
            <Hata alan="fiyat_teklifi" />
          </div>
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="fatura_tutari">Fatura tutarı (₺)</label>
            <Input id="fatura_tutari" name="fatura_tutari" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" defaultValue={varsayilan.fatura_tutari ?? ""} aria-invalid={!!fe.fatura_tutari} />
            <Hata alan="fatura_tutari" />
          </div>
          <div className="grid gap-1.5">
            <label className={labelClass} htmlFor="garanti_no">Garanti no</label>
            <Input id="garanti_no" name="garanti_no" placeholder="Harf/rakam olabilir" defaultValue={varsayilan.garanti_no ?? ""} />
          </div>
        </div>
      </Bolum>
      )}

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
          <p className="mt-2 text-xs text-muted-foreground">
            Kaydedince fotoğraflar otomatik yüklenir. Telefonda doğrudan kameradan
            çekebilirsin.
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
