"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { dogrulamaKoduGonder, dogrulamaKoduKontrol } from "@/app/actions/guvenlik"

// Yönetici e-posta doğrulaması: kodu e-postaya gönder → 6 haneli kodu gir.
// Başarılıysa cihaz 60 gün güvenilir olur. onBasari verilmezse sayfa yenilenir.
export function GuvenlikPenceresi({
  epostaMaskeli,
  onBasari,
}: {
  epostaMaskeli: string
  onBasari?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [gonderildi, setGonderildi] = useState(false)
  const [kod, setKod] = useState("")
  const [mesaj, setMesaj] = useState<{ ok: boolean; metin: string } | null>(null)
  const [bekle, setBekle] = useState(0)

  // Yeniden gönderme geri sayımı
  useEffect(() => {
    if (bekle <= 0) return
    const t = setTimeout(() => setBekle((b) => b - 1), 1000)
    return () => clearTimeout(t)
  }, [bekle])

  function gonder() {
    setMesaj(null)
    startTransition(async () => {
      const s = await dogrulamaKoduGonder()
      if (s.ok) {
        setGonderildi(true)
        setMesaj({ ok: true, metin: s.mesaj })
      } else {
        setMesaj({ ok: false, metin: s.hata })
      }
      if (s.bekle) setBekle(s.bekle)
    })
  }

  function dogrula(e: React.FormEvent) {
    e.preventDefault()
    setMesaj(null)
    startTransition(async () => {
      const s = await dogrulamaKoduKontrol(kod)
      if (s.ok) {
        setMesaj({ ok: true, metin: s.mesaj })
        if (onBasari) onBasari()
        else router.refresh()
      } else {
        setMesaj({ ok: false, metin: s.hata })
        setKod("")
      }
    })
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </span>
        <div>
          <h2 className="text-[15px] font-semibold">Güvenlik doğrulaması</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Bu cihazda yönetici olarak devam etmek için <strong>{epostaMaskeli}</strong> adresine
            gönderilecek 6 haneli kodu girin. Doğrulanan cihazda 2 ay boyunca tekrar sorulmaz.
          </p>
        </div>
      </div>

      {!gonderildi ? (
        <Button type="button" onClick={gonder} disabled={pending || bekle > 0}>
          {pending ? "Gönderiliyor…" : bekle > 0 ? `Tekrar göndermek için ${bekle} sn` : "Doğrulama kodu gönder"}
        </Button>
      ) : (
        <form onSubmit={dogrula} className="grid gap-2.5">
          <input
            value={kod}
            onChange={(e) => setKod(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="______"
            aria-label="6 haneli doğrulama kodu"
            className="w-full rounded-[10px] border border-input bg-card px-3.5 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15"
          />
          <Button type="submit" disabled={pending || kod.length !== 6}>
            {pending ? "Doğrulanıyor…" : "Doğrula"}
          </Button>
          <button
            type="button"
            onClick={gonder}
            disabled={pending || bekle > 0}
            className="text-[12.5px] text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            {bekle > 0 ? `Yeni kod ${bekle} sn sonra istenebilir` : "Kod gelmedi mi? Yeniden gönder"}
          </button>
        </form>
      )}

      {mesaj && (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-[12.5px]",
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

// Güvenilir cihazda oturum az önce işaretlendi: sayfayı bir kez yenile
// (aynı istekte paralel çalışan sayfa sorguları işaretten önce koşmuş olabilir).
export function OturumYenile() {
  const router = useRouter()
  useEffect(() => {
    router.refresh()
  }, [router])
  return (
    <main className="flex min-h-svh items-center justify-center p-6 text-sm text-muted-foreground">
      Oturum doğrulanıyor…
    </main>
  )
}
