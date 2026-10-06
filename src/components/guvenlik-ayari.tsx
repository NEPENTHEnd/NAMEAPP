"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { guvenlikAyarla } from "@/app/actions/guvenlik"
import { GuvenlikKarti } from "@/components/guvenlik-penceresi"

// Yalnız sahip: yönetici e-posta doğrulamasını aç/kapa. Açmak için önce KENDİ cihazını
// e-posta koduyla doğrulaması gerekir — e-posta gitmiyorsa açılamaz, kimse kilitlenmez.
export function GuvenlikAyari({
  acik,
  benDogrulandi,
  epostaMaskeli,
}: {
  acik: boolean
  benDogrulandi: boolean
  epostaMaskeli: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dogrulamaAcik, setDogrulamaAcik] = useState(false)
  const [mesaj, setMesaj] = useState<{ ok: boolean; metin: string } | null>(null)

  function ayarla(yeni: boolean) {
    setMesaj(null)
    startTransition(async () => {
      const s = await guvenlikAyarla(yeni)
      setMesaj(s.ok ? { ok: true, metin: s.mesaj } : { ok: false, metin: s.hata })
      setDogrulamaAcik(false)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            Yönetici e-posta doğrulaması
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                acik
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {acik ? "Açık" : "Kapalı"}
            </span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Açıkken her yönetici her cihazında bir kez e-postasına gelen kodu girer; o cihazda bir
            daha sorulmaz. Şifresi ele geçse bile kod olmadan yönetici yetkisi kullanılamaz.
          </p>
        </div>
        {acik ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (confirm("Yönetici e-posta doğrulaması KAPATILSIN mı? Yöneticiler kod girmeden devam eder."))
                ayarla(false)
            }}
          >
            Kapat
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (benDogrulandi) {
                if (confirm("Yönetici e-posta doğrulaması AÇILSIN mı?")) ayarla(true)
              } else {
                setDogrulamaAcik(true)
              }
            }}
          >
            Aç
          </Button>
        )}
      </div>

      {/* Yöneticilerin göreceği tam ekran pencerenin AYNISI — sahip açmadan önce kendi
          cihazını doğrular; kod gelmezse ayar kapalı kalır, kimse kilitlenmez. */}
      {!acik && dogrulamaAcik && (
        <GuvenlikKarti epostaMaskeli={epostaMaskeli} onBasari={() => ayarla(true)}>
          <p className="mb-2 text-[11.5px] text-muted-foreground">
            Diğer yöneticiler de girişte bu pencereyi görecek. Kod size ulaşırsa doğrulama açılır.
          </p>
          <button
            type="button"
            onClick={() => setDogrulamaAcik(false)}
            className="text-[12.5px] text-muted-foreground hover:underline"
          >
            Vazgeç
          </button>
        </GuvenlikKarti>
      )}

      {mesaj && (
        <p
          className={cn(
            "mt-3 rounded-lg border px-3 py-2 text-[12.5px]",
            mesaj.ok
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          {mesaj.metin}
        </p>
      )}
    </div>
  )
}
