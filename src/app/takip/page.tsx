"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

import { createClient } from "@/lib/supabase/client"
import { DurumRozeti } from "@/components/rozet"

type Sonuc = {
  musteri_ad: string | null
  cihaz_adi: string
  servis_no: string | null
  durum_ad: string | null
  durum_renk: string | null
  gelis_tarihi: string
  cikis_tarihi: string | null
}

function tarihTR(s: string | null): string {
  if (!s) return "—"
  return new Date(s).toLocaleDateString("tr-TR", { dateStyle: "long" })
}

export default function TakipPage() {
  const [kod, setKod] = useState("")
  const [sonuc, setSonuc] = useState<Sonuc | null>(null)
  const [bulunamadi, setBulunamadi] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)

  async function sorgula(aramaKodu: string) {
    const temiz = aramaKodu.trim()
    if (!temiz) return
    setYukleniyor(true)
    setHata(null)
    setBulunamadi(false)
    setSonuc(null)

    const supabase = createClient()
    const { data, error } = await supabase.rpc("takip_sorgula", {
      p_takip_no: temiz,
    })

    if (error) {
      setHata("Sorgulama sırasında bir hata oluştu. Lütfen tekrar deneyin.")
    } else if (!data || data.length === 0) {
      setBulunamadi(true)
    } else {
      setSonuc(data[0] as Sonuc)
    }
    setYukleniyor(false)
  }

  // Bağlantıyla gelinmişse (?kod=NT...) otomatik sorgula.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("kod")
    if (p) {
      setKod(p)
      sorgula(p)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main
      className="flex min-h-svh items-center justify-center p-6"
      style={{
        background:
          "radial-gradient(120% 120% at 50% 0%, var(--accent) 0%, var(--background) 42%)",
      }}
    >
      <div className="w-full max-w-[440px]">
        <div className="rounded-[18px] border border-border bg-card px-8 pb-7 pt-9 shadow-[0_18px_48px_-24px_rgba(15,23,42,.28),0_2px_6px_-2px_rgba(15,23,42,.06)]">
          <div className="mb-7 flex flex-col items-center gap-1">
            <Image
              src="/name-teknik-logo.png"
              alt="Name Teknik"
              width={1592}
              height={238}
              priority
              className="mb-2 h-9 w-auto object-contain dark:hidden"
            />
            <Image
              src="/name-teknik-logo-beyaz.png"
              alt="Name Teknik"
              width={1592}
              height={238}
              priority
              className="mb-2 hidden h-9 w-auto object-contain dark:block"
            />
            <div className="text-[13px] font-medium text-muted-foreground">
              Servis Takip
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              sorgula(kod)
            }}
          >
            <div className="mb-3 flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-foreground">
                Takip kodu
              </label>
              <input
                value={kod}
                onChange={(e) => setKod(e.target.value)}
                placeholder="Örn. NT3F9C2D"
                autoFocus
                className="w-full rounded-[10px] border border-input bg-card px-3.5 py-2.5 text-sm uppercase outline-none transition placeholder:normal-case focus:border-primary focus:ring-[3px] focus:ring-primary/15"
              />
            </div>
            <button
              type="submit"
              disabled={yukleniyor}
              className="mt-1 w-full rounded-[10px] bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(30,64,175,.4)] transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {yukleniyor ? "Sorgulanıyor…" : "Cihazımı sorgula"}
            </button>
          </form>

          {hata && <p className="mt-4 text-sm text-destructive">{hata}</p>}

          {bulunamadi && (
            <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
              Bu koda ait bir kayıt bulunamadı. Lütfen kodu kontrol edip tekrar
              deneyin.
            </div>
          )}

          {sonuc && (
            <div className="mt-5 grid gap-3 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  Durum
                </span>
                <DurumRozeti ad={sonuc.durum_ad} renk={sonuc.durum_renk} />
              </div>
              <Satir baslik="Cihaz" deger={sonuc.cihaz_adi} />
              {sonuc.musteri_ad && (
                <Satir baslik="Müşteri" deger={sonuc.musteri_ad} />
              )}
              {sonuc.servis_no && (
                <Satir baslik="Fiş no" deger={sonuc.servis_no} mono />
              )}
              <Satir baslik="Geliş tarihi" deger={tarihTR(sonuc.gelis_tarihi)} />
              <Satir
                baslik="Çıkış tarihi"
                deger={
                  sonuc.cikis_tarihi ? tarihTR(sonuc.cikis_tarihi) : "Devam ediyor"
                }
              />
            </div>
          )}
        </div>
        <div className="mt-[18px] text-center text-xs text-muted-foreground/80">
          © 2026 Name Teknik · Kayseri · Endüstriyel Elektronik Onarım
        </div>
      </div>
    </main>
  )
}

function Satir({
  baslik,
  deger,
  mono = false,
}: {
  baslik: string
  deger: string
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-border/60 pt-2.5 first:border-0 first:pt-0">
      <span className="text-xs font-semibold text-muted-foreground">{baslik}</span>
      <span
        className={`text-right text-sm font-medium ${mono ? "font-mono" : ""}`}
      >
        {deger}
      </span>
    </div>
  )
}
