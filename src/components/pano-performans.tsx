"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Tekniker (işi yapan) — aylık; tıklayınca önceki aylar açılır.
export type AylikPerf = {
  key: string // "2026-09"
  label: string // "Eylül 2026"
  toplam: number
  onarildi: number
  calismadi: number
  faturaAdet: number
  faturaYuzde: number
  basari: number
  pasta: string | null
}
export type TeknikerAylik = { ad: string; aylar: AylikPerf[] } // aylar: yeni→eski

// Personel (kaydeden) — aylık; çok renkli durum pastası.
export type AylikPersonel = {
  key: string
  label: string
  toplam: number
  faturaAdet: number
  faturaYuzde: number
  pasta: string | null
  dilimler: { ad: string; renk: string; adet: number }[]
}
export type PersonelAylik = { ad: string; aylar: AylikPersonel[] }

const BOS_PERF = {
  toplam: 0, onarildi: 0, calismadi: 0, faturaAdet: 0, faturaYuzde: 0, basari: 0, pasta: null as string | null,
}

function toplamAy(aylar: { toplam: number }[]) {
  return aylar.reduce((t, a) => t + a.toplam, 0)
}

export function TeknikerAylikBolum({
  teknikerler, buAyKey, buAyLabel,
}: {
  teknikerler: TeknikerAylik[]
  buAyKey: string
  buAyLabel: string
}) {
  const [acik, setAcik] = useState<string | null>(null)
  const sirali = [...teknikerler].sort((a, b) => {
    const av = a.aylar.find((x) => x.key === buAyKey)?.toplam ?? 0
    const bv = b.aylar.find((x) => x.key === buAyKey)?.toplam ?? 0
    return bv !== av ? bv - av : toplamAy(b.aylar) - toplamAy(a.aylar)
  })
  const secili = sirali.find((t) => t.ad === acik)

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[13.5px] font-semibold">Teknikerler</span>
        <span className="text-[11px] text-muted-foreground">· {buAyLabel} (her ay sıfırlanır — karta tıkla, önceki aylar)</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="size-2.5 rounded-full" style={{ background: "#10b981" }} /> Onarıldı</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="size-2.5 rounded-full" style={{ background: "#ef4444" }} /> Çalışmadı</span>
      </div>
      {sirali.length === 0 ? (
        <p className="text-sm text-muted-foreground">Kayıt yok.</p>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {sirali.map((t) => {
            const b = t.aylar.find((x) => x.key === buAyKey) ?? { key: buAyKey, label: buAyLabel, ...BOS_PERF }
            const acikMi = acik === t.ad
            return (
              <button
                key={t.ad}
                type="button"
                onClick={() => setAcik(acikMi ? null : t.ad)}
                className={cn(
                  "rounded-xl border p-3.5 text-left transition-colors",
                  acikMi ? "border-primary bg-primary/5" : "border-border/70 hover:bg-muted/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="size-14 rounded-full shadow-[inset_0_0_0_1px_rgba(148,163,184,.3)]" style={{ background: b.pasta ?? "var(--muted)" }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex size-8 items-center justify-center rounded-full bg-card text-[11px] font-semibold">
                        {b.onarildi + b.calismadi > 0 ? `%${b.basari}` : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{t.ad}</div>
                    <div className="text-[11px] text-muted-foreground">{b.toplam} iş</div>
                    <div className="mt-0.5 flex gap-2.5 text-[11.5px] font-medium">
                      <span className="text-emerald-600 dark:text-emerald-400">✓ {b.onarildi}</span>
                      <span className="text-rose-600 dark:text-rose-400">✗ {b.calismadi}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-baseline justify-between text-[11px]">
                    <span className="text-muted-foreground">Fatura edilen</span>
                    <span className="font-semibold">%{b.faturaYuzde} <span className="font-normal text-muted-foreground">({b.faturaAdet}/{b.toplam})</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${b.faturaYuzde}%` }} />
                  </div>
                </div>
                <div className="mt-2 text-[10.5px] font-medium text-primary">
                  {acikMi ? "▾ önceki aylar açık" : "▸ önceki ayları gör"}
                </div>
              </button>
            )
          })}
        </div>
      )}
      {secili && (
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/[0.03] p-3.5">
          <div className="mb-2 text-[12.5px] font-semibold">{secili.ad} — aylık geçmiş</div>
          <div className="grid gap-1.5">
            {secili.aylar.map((a) => (
              <div key={a.key} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
                <span className="w-28 shrink-0 font-medium">{a.label}</span>
                <span className="w-14 shrink-0 tabular-nums text-muted-foreground">{a.toplam} iş</span>
                <span className="text-emerald-600 dark:text-emerald-400">✓ {a.onarildi}</span>
                <span className="text-rose-600 dark:text-rose-400">✗ {a.calismadi}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">%{a.basari} başarı · %{a.faturaYuzde} fatura</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function PersonelAylikBolum({
  personeller, buAyKey, buAyLabel,
}: {
  personeller: PersonelAylik[]
  buAyKey: string
  buAyLabel: string
}) {
  const [acik, setAcik] = useState<string | null>(null)
  const sirali = [...personeller].sort((a, b) => {
    const av = a.aylar.find((x) => x.key === buAyKey)?.toplam ?? 0
    const bv = b.aylar.find((x) => x.key === buAyKey)?.toplam ?? 0
    return bv !== av ? bv - av : toplamAy(b.aylar) - toplamAy(a.aylar)
  })
  const secili = sirali.find((p) => p.ad === acik)

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[13.5px] font-semibold">Personel (kaydeden)</span>
        <span className="text-[11px] text-muted-foreground">· {buAyLabel} (her ay sıfırlanır — karta tıkla, önceki aylar)</span>
      </div>
      {sirali.length === 0 ? (
        <p className="text-sm text-muted-foreground">Kayıt yok.</p>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {sirali.map((p) => {
            const b = p.aylar.find((x) => x.key === buAyKey) ?? { key: buAyKey, label: buAyLabel, toplam: 0, faturaAdet: 0, faturaYuzde: 0, pasta: null, dilimler: [] }
            const acikMi = acik === p.ad
            return (
              <button
                key={p.ad}
                type="button"
                onClick={() => setAcik(acikMi ? null : p.ad)}
                className={cn(
                  "rounded-xl border p-3.5 text-left transition-colors",
                  acikMi ? "border-primary bg-primary/5" : "border-border/70 bg-muted/20 hover:bg-muted/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="size-14 rounded-full shadow-[inset_0_0_0_1px_rgba(148,163,184,.3)]" style={{ background: b.pasta ?? "var(--muted)" }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex size-8 items-center justify-center rounded-full bg-card text-[11px] font-semibold">{b.toplam}</div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{p.ad}</div>
                    <div className="text-[11px] text-muted-foreground">{b.toplam} iş kaydetti</div>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  {b.dilimler.map((d) => (
                    <span key={d.ad} className="flex items-center gap-1 text-muted-foreground">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: d.renk }} />
                      {d.ad} <span className="font-semibold text-foreground">{d.adet}</span>
                    </span>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-baseline justify-between text-[11px]">
                    <span className="text-muted-foreground">Fatura edilen</span>
                    <span className="font-semibold">%{b.faturaYuzde} <span className="font-normal text-muted-foreground">({b.faturaAdet}/{b.toplam})</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${b.faturaYuzde}%` }} />
                  </div>
                </div>
                <div className="mt-2 text-[10.5px] font-medium text-primary">
                  {acikMi ? "▾ önceki aylar açık" : "▸ önceki ayları gör"}
                </div>
              </button>
            )
          })}
        </div>
      )}
      {secili && (
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/[0.03] p-3.5">
          <div className="mb-2 text-[12.5px] font-semibold">{secili.ad} — aylık geçmiş</div>
          <div className="grid gap-1.5">
            {secili.aylar.map((a) => (
              <div key={a.key} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
                <span className="w-28 shrink-0 font-medium">{a.label}</span>
                <span className="w-20 shrink-0 tabular-nums text-muted-foreground">{a.toplam} iş kaydetti</span>
                <span className="ml-auto tabular-nums text-muted-foreground">%{a.faturaYuzde} fatura ({a.faturaAdet}/{a.toplam})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
