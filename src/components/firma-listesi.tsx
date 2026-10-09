"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import {
  grupDuzenle,
  grupMusteridenEkle,
  grupSil,
  grupSirala,
  subeDuzenle,
  subeEkle,
  subeSil,
} from "@/app/actions/tanim"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { tint } from "@/components/rozet"
import { kaydedildiGoster } from "@/lib/toast"
import { renkSec, basHarf, isRozeti } from "@/lib/renk-palet"

type Grup = { id: string; ad: string; sira: number }
type Sube = {
  id: string
  grup_id: string
  ad: string
  ilgili_kisi: string | null
  telefon: string | null
  ust_sube_id: string | null // null → firmaya doğrudan bağlı üst seviye şube
}
type Musteri = { id: string; ad: string }

const IkonKisi = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)
const IkonTel = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" />
  </svg>
)

// Ayarlar > Firmalar: müşteriden ekle, sürükleyerek sırala, adını değiştir, şube ekle, sil.
// Renkli kartlar: her firma kendi renginde; iş/şube sayısı rozetli; düzenleme ve
// silme yalnız "Düzenle" açılınca görünür.
export function FirmaListesi({
  gruplar,
  musteriler,
  subeler,
  isSayisi = {},
  subeIsSayisi = {},
}: {
  gruplar: Grup[]
  musteriler: Musteri[]
  subeler: Sube[]
  isSayisi?: Record<string, number>
  subeIsSayisi?: Record<string, number>
}) {
  const router = useRouter()
  // Kaydetten sonra: alt onay + tazele
  const yenile = () => {
    kaydedildiGoster()
    router.refresh()
  }
  const [liste, setListe] = useState(gruplar)
  const [surukleIdx, setSurukleIdx] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  // Sunucu tazelenince (ekle/sil) listeyi güncelle — sürükleme dışında
  useEffect(() => {
    if (surukleIdx === null) setListe(gruplar)
  }, [gruplar, surukleIdx])

  // Şubeler: firmanın üst-seviye şubeleri + her şubenin alt şubeleri
  const { subeMap, altSubeMap } = useMemo(() => {
    const ust = new Map<string, Sube[]>() // grup_id → üst seviye şubeler
    const alt = new Map<string, Sube[]>() // ust_sube_id → alt şubeler
    for (const s of subeler) {
      if (s.ust_sube_id) {
        const l = alt.get(s.ust_sube_id) ?? []
        l.push(s)
        alt.set(s.ust_sube_id, l)
      } else {
        const l = ust.get(s.grup_id) ?? []
        l.push(s)
        ust.set(s.grup_id, l)
      }
    }
    return { subeMap: ust, altSubeMap: alt }
  }, [subeler])
  const [acikSube, setAcikSube] = useState<Set<string>>(new Set())
  const [acikAltEkle, setAcikAltEkle] = useState<Set<string>>(new Set())
  const [duzenlenenGrup, setDuzenlenenGrup] = useState<string | null>(null)
  const [duzenlenenSube, setDuzenlenenSube] = useState<string | null>(null)
  function toggle(set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    set((prev) => {
      const y = new Set(prev)
      if (y.has(id)) y.delete(id)
      else y.add(id)
      return y
    })
  }

  // Yeni firma: müşteri arama
  const [ara, setAra] = useState("")
  const [aramaAcik, setAramaAcik] = useState(false)
  const aramaKutu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function disari(e: MouseEvent) {
      if (aramaKutu.current && !aramaKutu.current.contains(e.target as Node))
        setAramaAcik(false)
    }
    document.addEventListener("mousedown", disari)
    return () => document.removeEventListener("mousedown", disari)
  }, [])
  const menudekiAdlar = useMemo(
    () => new Set(liste.map((g) => g.ad.toLocaleUpperCase("tr-TR"))),
    [liste]
  )
  const filtreliMusteriler = useMemo(() => {
    const q = ara.trim().toLocaleLowerCase("tr-TR")
    return musteriler
      .filter(
        (m) =>
          !menudekiAdlar.has(m.ad.toLocaleUpperCase("tr-TR")) &&
          (!q || m.ad.toLocaleLowerCase("tr-TR").includes(q))
      )
      .slice(0, 30)
  }, [musteriler, ara, menudekiAdlar])

  function firmaEkle(m: Musteri) {
    setAramaAcik(false)
    setAra("")
    startTransition(async () => {
      const fd = new FormData()
      fd.set("musteri_id", m.id)
      await grupMusteridenEkle(fd)
      yenile()
    })
  }

  function siralamayiKaydet(yeni: Grup[]) {
    startTransition(async () => {
      await grupSirala(yeni.map((g) => g.id))
      yenile()
    })
  }

  function sil(g: Grup) {
    if (
      !window.confirm(
        `"${g.ad}" firması sol menüden KALICI olarak silinecek.\nİşleri silinmez, DİĞER'e taşınır. Şubeleri de silinir. Emin misin?`
      )
    )
      return
    setListe((l) => l.filter((x) => x.id !== g.id))
    setDuzenlenenGrup(null)
    startTransition(async () => {
      await grupSil(g.id)
      yenile()
    })
  }

  function subeSilTikla(s: Sube) {
    const altSayisi = (altSubeMap.get(s.id) ?? []).length
    const mesaj = altSayisi
      ? `"${s.ad}" şubesi ve ${altSayisi} alt şubesi silinecek.\nİşleri silinmez, ana firmaya döner. Emin misin?`
      : `"${s.ad}" şubesi silinecek. İşleri ana firmaya döner. Emin misin?`
    if (!window.confirm(mesaj)) return
    setDuzenlenenSube(null)
    startTransition(async () => {
      await subeSil(s.id)
      yenile()
    })
  }

  // Şubeyi ve alt şubelerini özyinelemeli çiz (her seviyede "alt şube ekle" var)
  function subeSatiri(s: Sube, gRenk: string): React.ReactNode {
    const cocuklar = altSubeMap.get(s.id) ?? []
    const ekleAcik = acikAltEkle.has(s.id)
    const n = subeIsSayisi[s.id] ?? 0
    const rozet = isRozeti(n)
    return (
      <div key={s.id} className="grid gap-1.5">
        {duzenlenenSube === s.id ? (
          <form
            action={async (fd) => {
              await subeDuzenle(fd)
              setDuzenlenenSube(null)
              yenile()
            }}
            className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/[0.04] p-1.5"
            style={{ borderLeft: `3px solid ${gRenk}` }}
          >
            <input type="hidden" name="id" value={s.id} />
            <Input name="ad" defaultValue={s.ad} placeholder="Şube adı" className="h-8 min-w-[7rem] flex-1" required autoFocus />
            <Input name="ilgili_kisi" defaultValue={s.ilgili_kisi ?? ""} placeholder="İlgili kişi" className="h-8 w-[8.5rem]" />
            <Input name="telefon" defaultValue={s.telefon ?? ""} placeholder="Telefon" className="h-8 w-[7.5rem]" />
            <Button type="submit" size="sm">Kaydet</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDuzenlenenSube(null)}>İptal</Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => subeSilTikla(s)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Sil
            </Button>
          </form>
        ) : (
          <div
            className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-2.5 py-2"
            style={{ borderLeft: `3px solid ${gRenk}` }}
          >
            <span className="text-[13px] font-semibold">{s.ad}</span>
            {(s.ilgili_kisi || s.telefon) && (
              <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
                {s.ilgili_kisi && (
                  <span className="inline-flex items-center gap-1">
                    <IkonKisi />
                    {s.ilgili_kisi}
                  </span>
                )}
                {s.telefon && (
                  <a href={`tel:${s.telefon}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <IkonTel />
                    {s.telefon}
                  </a>
                )}
              </span>
            )}
            <span className="ml-auto flex items-center gap-1">
              {n > 0 && (
                <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={tint(rozet.renk)}>
                  {rozet.metin}
                </span>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => toggle(setAcikAltEkle, s.id)}
                className={cn("text-muted-foreground", ekleAcik && "bg-muted")}
              >
                + Alt şube
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground opacity-70 group-hover:opacity-100"
                onClick={() => setDuzenlenenSube(s.id)}
              >
                Düzenle
              </Button>
            </span>
          </div>
        )}

        {/* Bu şubenin altına yeni alt şube */}
        {ekleAcik && (
          <form
            action={async (fd) => {
              await subeEkle(fd)
              setAcikAltEkle((p) => {
                const y = new Set(p)
                y.delete(s.id)
                return y
              })
              yenile()
            }}
            className="ml-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed p-1.5"
            style={{ borderColor: gRenk }}
          >
            {/* Firma bilgisi üst şubeden devralınır (grup_id göndermiyoruz) */}
            <input type="hidden" name="ust_sube_id" value={s.id} />
            <Input name="ad" placeholder={`${s.ad} → alt şube adı`} className="h-8 min-w-[8rem] flex-1" required autoFocus />
            <Input name="ilgili_kisi" placeholder="İlgili kişi (ops.)" className="h-8 w-[8.5rem]" />
            <Input name="telefon" placeholder="Telefon (ops.)" className="h-8 w-[7.5rem]" />
            <Button type="submit" size="sm">+ Ekle</Button>
          </form>
        )}

        {/* Alt şubeler */}
        {cocuklar.length > 0 && (
          <div className="ml-4 grid gap-1.5 pl-2" style={{ borderLeft: `2px dashed color-mix(in oklab, ${gRenk} 45%, transparent)` }}>
            {cocuklar.map((c) => subeSatiri(c, gRenk))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid max-w-4xl gap-3">
      {/* Yeni firma: yalnız kayıtlı müşteriden seç */}
      <div ref={aramaKutu} className="relative rounded-2xl border border-border bg-card p-3">
        <div className="mb-1.5 text-[12px] font-semibold text-muted-foreground">Menüye firma ekle</div>
        <div className="relative max-w-sm">
          <svg aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <Input
            value={ara}
            placeholder="Müşteri ara ve menüye ekle…"
            autoComplete="off"
            onFocus={() => setAramaAcik(true)}
            onChange={(e) => {
              setAra(e.target.value)
              setAramaAcik(true)
            }}
            className="pl-8"
          />
        </div>
        {aramaAcik && (
          <div className="absolute left-3 top-full z-30 mt-1 max-h-64 w-full max-w-sm overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-xl">
            {filtreliMusteriler.length === 0 ? (
              <div className="px-3 py-2.5 text-sm text-muted-foreground">
                {ara.trim()
                  ? "Eşleşen müşteri yok. Yeni firmayı önce Müşteriler'e ekleyin."
                  : "Aramak için yazın…"}
              </div>
            ) : (
              filtreliMusteriler.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => firmaEkle(m)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold"
                    style={tint(renkSec(m.ad))}
                  >
                    {basHarf(m.ad)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.ad}</span>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">+ ekle</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className={cn("grid gap-2", pending && "opacity-60")}>
        {liste.map((g, i) => {
          const gRenk = renkSec(g.ad)
          const gSubeler = subeMap.get(g.id) ?? [] // üst seviye şubeler
          const toplamSube = subeler.filter((s) => s.grup_id === g.id).length // alt şubeler dahil
          const subeAcik = acikSube.has(g.id)
          const n = isSayisi[g.id] ?? 0
          const rozet = isRozeti(n)
          const duzenle = duzenlenenGrup === g.id
          return (
            <div
              key={g.id}
              className={cn(
                "overflow-hidden rounded-2xl border border-border bg-card transition-shadow",
                surukleIdx === i && "border-primary ring-2 ring-primary/20"
              )}
              style={{ borderLeft: `4px solid ${gRenk}` }}
            >
              <div
                draggable={!duzenle}
                onDragStart={() => setSurukleIdx(i)}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (surukleIdx === null || surukleIdx === i) return
                  setListe((l) => {
                    const yeni = [...l]
                    const [tasinan] = yeni.splice(surukleIdx, 1)
                    yeni.splice(i, 0, tasinan)
                    return yeni
                  })
                  setSurukleIdx(i)
                }}
                onDragEnd={() => {
                  setSurukleIdx(null)
                  siralamayiKaydet(liste)
                }}
                className="group flex flex-wrap items-center gap-2 p-2.5"
              >
                {/* Tutma sapı */}
                <span
                  title="Sürükleyerek sırala"
                  className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground/50 active:cursor-grabbing"
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                    <circle cx="2.5" cy="2.5" r="1.4" /><circle cx="7.5" cy="2.5" r="1.4" />
                    <circle cx="2.5" cy="8" r="1.4" /><circle cx="7.5" cy="8" r="1.4" />
                    <circle cx="2.5" cy="13.5" r="1.4" /><circle cx="7.5" cy="13.5" r="1.4" />
                  </svg>
                </span>
                <span className="w-5 text-right font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg border text-[12px] font-bold"
                  style={tint(gRenk)}
                  aria-hidden
                >
                  {basHarf(g.ad)}
                </span>

                {duzenle ? (
                  <form
                    action={async (fd) => {
                      await grupDuzenle(fd)
                      setDuzenlenenGrup(null)
                      yenile()
                    }}
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="id" value={g.id} />
                    <Input name="ad" defaultValue={g.ad} className="h-8 min-w-[10rem] flex-1" required autoFocus />
                    <Button type="submit" size="sm">Kaydet</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setDuzenlenenGrup(null)}>İptal</Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => sil(g)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Sil
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{g.ad}</span>
                    {n > 0 ? (
                      <Link
                        href={`/?grup=${g.id}`}
                        className="rounded-full border px-2 py-0.5 text-[11.5px] font-semibold hover:brightness-95"
                        style={tint(rozet.renk)}
                        title="Bu firmanın işlerini gör"
                      >
                        {rozet.metin}
                      </Link>
                    ) : (
                      <span className="rounded-full border px-2 py-0.5 text-[11.5px] font-medium" style={tint(rozet.renk)}>
                        {rozet.metin}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(setAcikSube, g.id)}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold transition-[filter] hover:brightness-95"
                      style={subeAcik ? { background: gRenk, borderColor: gRenk, color: "#fff" } : tint(gRenk)}
                    >
                      {toplamSube > 0 ? `${toplamSube} şube` : "Şube ekle"}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={cn("transition-transform", subeAcik && "rotate-180")}>
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground opacity-70 group-hover:opacity-100"
                      onClick={() => setDuzenlenenGrup(g.id)}
                    >
                      Düzenle
                    </Button>
                  </>
                )}
              </div>

              {/* Şube paneli — şubeler + alt şubeler (iç içe) */}
              {subeAcik && (
                <div
                  className="grid gap-1.5 border-t p-2.5"
                  style={{
                    background: `color-mix(in oklab, ${gRenk} 6%, var(--card))`,
                    borderColor: `color-mix(in oklab, ${gRenk} 25%, var(--card))`,
                  }}
                >
                  {gSubeler.map((s) => subeSatiri(s, gRenk))}
                  {/* Yeni (üst seviye) şube ekle */}
                  <form
                    action={async (fd) => {
                      await subeEkle(fd)
                      yenile()
                    }}
                    className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed p-1.5"
                    style={{ borderColor: `color-mix(in oklab, ${gRenk} 50%, var(--card))` }}
                  >
                    <input type="hidden" name="grup_id" value={g.id} />
                    <Input name="ad" placeholder="Yeni şube adı" className="h-8 min-w-[8rem] flex-1" required />
                    <Input name="ilgili_kisi" placeholder="İlgili kişi (ops.)" className="h-8 w-[9rem]" />
                    <Input name="telefon" placeholder="Telefon (ops.)" className="h-8 w-[8rem]" />
                    <Button type="submit" size="sm">+ Şube ekle</Button>
                  </form>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
