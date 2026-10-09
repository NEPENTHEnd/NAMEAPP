"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { tint } from "@/components/rozet"
import {
  cozumle,
  siralaOgeler,
  ustYaziRengi,
  type HizliAyar,
  type HizliOge,
} from "@/lib/hizli-filtre"
import { hizliFiltreKaydet } from "@/app/actions/tercih"

type Satir = { buton: boolean; renk: string }

const TUR_AD: Record<HizliOge["tur"], string> = {
  durum: "İş durumu",
  ozel: "Özel",
  fatura: "Fatura durumu",
}

// Ayarlar → Filtre Butonları: her yönetici kendi iş listesi şeridini ayarlar.
// "Buton" = üst şeritte görünür (↑↓ ile sıralanır); "Filtre içinde" = Filtre
// tuşunun panelinde durur. Renk varsayılanı durumun kendi rengi.
export function HizliFiltreAyari({ ogeler, ayar }: { ogeler: HizliOge[]; ayar: HizliAyar | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mesaj, setMesaj] = useState<{ ok: boolean; metin: string } | null>(null)

  const ogeMap = useMemo(() => new Map(ogeler.map((o) => [o.anahtar, o])), [ogeler])
  const varsayilanSira = useMemo(() => ogeler.map((o) => o.anahtar), [ogeler])
  const baslangic = useMemo(() => {
    const d: Record<string, Satir> = {}
    for (const o of ogeler) d[o.anahtar] = cozumle(o, ayar)
    return { durum: d, sira: siralaOgeler(ogeler, ayar).map((o) => o.anahtar) }
  }, [ogeler, ayar])
  const [durum, setDurum] = useState<Record<string, Satir>>(baslangic.durum)
  const [sira, setSira] = useState<string[]>(baslangic.sira)

  const degisti =
    sira.join("|") !== baslangic.sira.join("|") ||
    ogeler.some(
      (o) =>
        durum[o.anahtar].buton !== baslangic.durum[o.anahtar].buton ||
        durum[o.anahtar].renk !== baslangic.durum[o.anahtar].renk
    )

  const butonlar = sira.filter((k) => durum[k].buton)
  const gizliler = sira.filter((k) => !durum[k].buton)

  function guncelle(anahtar: string, yama: Partial<Satir>) {
    setMesaj(null)
    setDurum((p) => ({ ...p, [anahtar]: { ...p[anahtar], ...yama } }))
  }

  // Butonlar arasında bir yukarı/aşağı (gizliler araya girse de doğru yer değiştirir)
  function tasi(anahtar: string, yon: -1 | 1) {
    const i = butonlar.indexOf(anahtar)
    const j = i + yon
    if (i < 0 || j < 0 || j >= butonlar.length) return
    const diger = butonlar[j]
    setMesaj(null)
    setSira((p) => {
      const y = [...p]
      const a = y.indexOf(anahtar)
      const b = y.indexOf(diger)
      ;[y[a], y[b]] = [y[b], y[a]]
      return y
    })
  }

  function butonYap(anahtar: string) {
    guncelle(anahtar, { buton: true })
    // Şeridin sonuna ekle (sonra ↑ ile istenen yere taşınır)
    setSira((p) => {
      const y = p.filter((k) => k !== anahtar)
      const sonButon = y.reduce((s, k, i) => (durum[k]?.buton ? i : s), -1)
      y.splice(sonButon + 1, 0, anahtar)
      return y
    })
  }

  function kaydet(d: Record<string, Satir>, s: string[]) {
    setMesaj(null)
    const siraOzel = s.join("|") !== varsayilanSira.join("|")
    const yuk: Record<string, { buton: boolean; renk: string; sira?: number }> = {}
    s.forEach((k, i) => {
      yuk[k] = { buton: d[k].buton, renk: d[k].renk, ...(siraOzel ? { sira: i } : {}) }
    })
    startTransition(async () => {
      const r = await hizliFiltreKaydet(yuk)
      setMesaj(r.ok ? { ok: true, metin: "Kaydedildi. İş listesi artık bu düzende görünecek." } : { ok: false, metin: r.hata })
      router.refresh()
    })
  }

  function varsayilan() {
    if (!confirm("Tüm filtre butonları varsayılana (görünürlük, sıra ve orijinal renkler) dönsün mü?")) return
    const d: Record<string, Satir> = {}
    for (const o of ogeler) d[o.anahtar] = { buton: o.varsayilanButon, renk: o.varsayilanRenk }
    setDurum(d)
    setSira(varsayilanSira)
    kaydet(d, varsayilanSira)
  }

  const renkKontrol = (o: HizliOge) => {
    const s = durum[o.anahtar]
    const ozel = s.renk.toLowerCase() !== o.varsayilanRenk.toLowerCase()
    return (
      <span className="flex items-center gap-1.5">
        <input
          type="color"
          value={s.renk}
          onChange={(e) => guncelle(o.anahtar, { renk: e.target.value })}
          className="h-8 w-10 cursor-pointer rounded border border-input bg-card"
          aria-label={`${o.etiket} rengi`}
          title="Renk seç"
        />
        <button
          type="button"
          onClick={() => guncelle(o.anahtar, { renk: o.varsayilanRenk })}
          disabled={!ozel}
          className="text-[11.5px] text-primary hover:underline disabled:invisible"
        >
          orijinal
        </button>
      </span>
    )
  }

  const okBtn =
    "flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-30"

  return (
    <section className="grid gap-5">
      <p className="text-xs text-muted-foreground">
        İş listesinin üstündeki hızlı filtreleri <strong>kendine göre</strong> düzenle: hangisi
        buton olsun, hangi <strong>sırada</strong> dursun, hangisi <strong>Filtre</strong> tuşunun
        içinde kalsın ve hangi renkte olsun. Renkler başlangıçta durumun kendi rengiyle gelir. Bu
        ayar yalnız <strong>senin</strong> ekranını değiştirir.
      </p>

      {/* Canlı önizleme — iş listesinde tam böyle görünür */}
      <div className="grid gap-2 rounded-2xl border border-border bg-muted/20 p-3">
        <div className="text-[12px] font-semibold text-muted-foreground">Önizleme (iş listesi şeridi)</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-lg border border-emerald-400/50 px-2.5 py-1.5 text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-300">
            Excel
          </span>
          {butonlar.map((k) => {
            const o = ogeMap.get(k)!
            return (
              <span key={k} className="rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold" style={tint(durum[k].renk)}>
                {o.etiket}
              </span>
            )
          })}
          {butonlar.length === 0 && (
            <span className="text-[12px] text-muted-foreground">Hiç buton yok — hepsi Filtre içinde.</span>
          )}
        </div>
      </div>

      {/* Şeritteki butonlar — sıralı */}
      <div className="grid gap-2">
        <h2 className="text-sm font-semibold">Şeritteki butonlar ({butonlar.length}) — sırası</h2>
        {butonlar.map((k, i) => {
          const o = ogeMap.get(k)!
          const s = durum[k]
          return (
            <div key={k} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-2">
              <span className="w-6 text-center text-[12px] font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="flex items-center gap-1">
                <button type="button" className={okBtn} onClick={() => tasi(k, -1)} disabled={i === 0} aria-label="Yukarı taşı" title="Öne al">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                </button>
                <button type="button" className={okBtn} onClick={() => tasi(k, 1)} disabled={i === butonlar.length - 1} aria-label="Aşağı taşı" title="Sona al">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </button>
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="truncate rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold" style={tint(s.renk)}>
                  {o.etiket}
                </span>
                <span
                  className="hidden rounded-lg border px-2 py-1 text-[11px] font-semibold sm:inline"
                  style={{ background: s.renk, borderColor: s.renk, color: ustYaziRengi(s.renk) }}
                  title="Seçiliyken böyle görünür"
                >
                  seçili
                </span>
                <span className="hidden text-[11px] text-muted-foreground md:inline">{TUR_AD[o.tur]}</span>
              </span>
              {renkKontrol(o)}
              <Button type="button" size="sm" variant="outline" onClick={() => guncelle(k, { buton: false })}>
                Filtre içine al
              </Button>
            </div>
          )
        })}
      </div>

      {/* Filtre içinde olanlar */}
      <div className="grid gap-2">
        <h2 className="text-sm font-semibold">Filtre içinde olanlar ({gizliler.length})</h2>
        {gizliler.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Hepsi şeritte buton olarak görünüyor.</p>
        ) : (
          <div className="grid gap-1.5">
            {gizliler.map((k) => {
              const o = ogeMap.get(k)!
              const s = durum[k]
              return (
                <div key={k} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-border bg-card/60 p-2">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold opacity-80" style={tint(s.renk)}>
                      {o.etiket}
                    </span>
                    <span className="hidden text-[11px] text-muted-foreground md:inline">{TUR_AD[o.tur]}</span>
                  </span>
                  {renkKontrol(o)}
                  <Button type="button" size="sm" onClick={() => butonYap(k)}>
                    Buton yap
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="sticky bottom-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-2.5 shadow-sm backdrop-blur">
        <Button type="button" onClick={() => kaydet(durum, sira)} disabled={pending || !degisti}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <Button type="button" variant="ghost" onClick={varsayilan} disabled={pending}>
          Tümünü varsayılana döndür
        </Button>
        {degisti && !pending && <span className="text-[12px] text-amber-600 dark:text-amber-400">Kaydedilmemiş değişiklik var</span>}
        {mesaj && (
          <span className={cn("text-[12.5px]", mesaj.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive")}>
            {mesaj.metin}
          </span>
        )}
      </div>
    </section>
  )
}
