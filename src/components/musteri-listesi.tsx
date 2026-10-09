"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { tint } from "@/components/rozet"
import { musteriEkle, musteriDuzenle, musteriAktiflik } from "@/app/actions/tanim"
import { MusteriSil } from "@/components/musteri-sil"
import { renkSec, basHarf, isRozeti } from "@/lib/renk-palet"

type Musteri = { id: string; ad: string; sube_sehir: string | null; aktif: boolean }
type Sube = { id: string; grup_id: string; ad: string; ust_sube_id: string | null }
type Grup = { id: string; ad: string }
type Kisi = { ad: string | null; telefon: string | null }
type Suzgec = "tumu" | "isli" | "issiz" | "pasif"

const norm = (s: string) => s.toLocaleUpperCase("tr-TR").replace(/\s+/g, " ").trim()
// İşlerden toplanan kişilerde çöp girişler var ("0", ".", "5"): yalnız GÖRÜNÜMDE ele —
// telefon en az 7 rakam, isim en az 2 harf. (Veri değişmez.)
function temizKisiler(liste: Kisi[]): Kisi[] {
  const sonuc: Kisi[] = []
  for (const c of liste) {
    const ad = c.ad && (c.ad.match(/\p{L}/gu)?.length ?? 0) >= 2 ? c.ad : null
    const telefon = c.telefon && c.telefon.replace(/\D/g, "").length >= 7 ? c.telefon : null
    if (!ad && !telefon) continue
    if (!sonuc.some((x) => x.ad === ad && x.telefon === telefon)) sonuc.push({ ad, telefon })
  }
  return sonuc
}
const harfOf = (ad: string) => {
  const h = ad.trim().charAt(0).toLocaleUpperCase("tr-TR")
  return /\p{L}/u.test(h) ? h : "#"
}

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

export function MusteriListesi({
  musteriler,
  subeler,
  gruplar,
  iletisim,
  isSayisi,
}: {
  musteriler: Musteri[]
  subeler: Sube[]
  gruplar: Grup[]
  iletisim: Record<string, Kisi[]>
  isSayisi: Record<string, number>
}) {
  const router = useRouter()
  const [arama, setArama] = useState("")
  const [suzgec, setSuzgec] = useState<Suzgec>("tumu")
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null)
  const [acikKisiler, setAcikKisiler] = useState<Set<string>>(new Set())
  const [yeniAcik, setYeniAcik] = useState(false)

  const isOf = (id: string) => isSayisi[id] ?? 0
  const sayilar = useMemo(() => {
    const isli = musteriler.filter((m) => (isSayisi[m.id] ?? 0) > 0).length
    return {
      toplam: musteriler.length,
      isli,
      issiz: musteriler.length - isli,
      pasif: musteriler.filter((m) => !m.aktif).length,
    }
  }, [musteriler, isSayisi])

  // Şubeli firmalar → ağaç; ağaçta yer alan müşteriler düz listeden çıkar
  const { agac, agactaki } = useMemo(() => {
    const byAd = new Map(musteriler.map((m) => [norm(m.ad), m]))
    const agactaki = new Set<string>()
    for (const s of subeler) {
      const m = byAd.get(norm(s.ad))
      if (m) agactaki.add(m.id)
    }
    // Büyükten küçüğe: en kalabalık firma solda, küçükler sağ sütunda alt alta dolar
    const agac = gruplar
      .map((g) => ({
        g,
        ust: subeler.filter((s) => s.grup_id === g.id && !s.ust_sube_id),
        toplam: subeler.filter((s) => s.grup_id === g.id).length,
      }))
      .filter((x) => x.ust.length > 0)
      .sort((a, b) => b.toplam - a.toplam)
    return { agac, agactaki }
  }, [musteriler, subeler, gruplar])
  const musteriByAd = useMemo(() => new Map(musteriler.map((m) => [norm(m.ad), m])), [musteriler])

  const q = arama.trim().toLocaleLowerCase("tr-TR")
  const qRakam = arama.replace(/\D/g, "")
  const eslesir = (m: Musteri) => {
    if (suzgec === "isli" && isOf(m.id) === 0) return false
    if (suzgec === "issiz" && isOf(m.id) > 0) return false
    if (suzgec === "pasif" && m.aktif) return false
    if (!q) return true
    if (m.ad.toLocaleLowerCase("tr-TR").includes(q)) return true
    if (m.sube_sehir?.toLocaleLowerCase("tr-TR").includes(q)) return true
    return (iletisim[m.id] ?? []).some(
      (c) =>
        c.ad?.toLocaleLowerCase("tr-TR").includes(q) ||
        (qRakam.length >= 3 && c.telefon?.replace(/\D/g, "").includes(qRakam))
    )
  }
  const sonucModu = !!q || suzgec !== "tumu"
  const sonuclar = sonucModu ? musteriler.filter(eslesir) : []
  // A–Z gruplama (ağaçta olmayan müşteriler)
  const { duzSayi, harfGruplari } = useMemo(() => {
    const duz = musteriler.filter((m) => !agactaki.has(m.id))
    const g = new Map<string, Musteri[]>()
    for (const m of duz) {
      const h = harfOf(m.ad)
      if (!g.has(h)) g.set(h, [])
      g.get(h)!.push(m)
    }
    const sirali = [...g.entries()].sort((a, b) =>
      a[0] === "#" ? 1 : b[0] === "#" ? -1 : a[0].localeCompare(b[0], "tr")
    )
    return { duzSayi: duz.length, harfGruplari: sirali }
  }, [musteriler, agactaki])

  // Not: bileşen değil düz çizim fonksiyonu — iç içe bileşen her çizimde baştan
  // kurulur ve düzenleme kutusundaki yazı kaybolurdu.
  const satirCiz = (m: Musteri, seviye = 0, cizgiRenk?: string): ReactNode => {
    const renk = renkSec(m.ad)
    const n = isOf(m.id)
    const rozet = isRozeti(n)
    const kisiler = temizKisiler(iletisim[m.id] ?? [])
    const acik = acikKisiler.has(m.id)
    const gorunen = acik ? kisiler : kisiler.slice(0, 3)
    const girinti = seviye ? { marginLeft: seviye * 20 } : undefined

    if (duzenlenen === m.id) {
      return (
        <div
          key={m.id}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/[0.04] p-2.5"
          style={girinti}
        >
          <form
            action={async (fd) => {
              await musteriDuzenle(fd)
              setDuzenlenen(null)
              router.refresh()
            }}
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <input type="hidden" name="id" value={m.id} />
            <Input name="ad" defaultValue={m.ad} className="h-8 max-w-xs" required autoFocus />
            <Input name="sube_sehir" defaultValue={m.sube_sehir ?? ""} placeholder="Şube/şehir" className="h-8 max-w-[11rem]" />
            <Button type="submit" size="sm">Kaydet</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDuzenlenen(null)}>İptal</Button>
          </form>
          <form
            action={async (fd) => {
              await musteriAktiflik(fd)
              setDuzenlenen(null)
              router.refresh()
            }}
          >
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="aktif" value={m.aktif ? "false" : "true"} />
            <Button type="submit" size="sm" variant="outline">{m.aktif ? "Pasifleştir" : "Aktifleştir"}</Button>
          </form>
          <MusteriSil id={m.id} ad={m.ad} isSayisi={n} />
        </div>
      )
    }

    return (
      <div
        key={m.id}
        className={cn(
          "group flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30",
          !m.aktif && "opacity-60"
        )}
        style={{ ...girinti, ...(cizgiRenk ? { borderLeft: `3px solid ${cizgiRenk}` } : {}) }}
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border text-[12px] font-bold"
          style={tint(renk)}
          aria-hidden
        >
          {basHarf(m.ad)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-semibold">{m.ad}</span>
            {m.sube_sehir && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {m.sube_sehir}
              </span>
            )}
            {!m.aktif && (
              <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                pasif
              </span>
            )}
          </div>
          {kisiler.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              {gorunen.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  {c.ad && (
                    <>
                      <IkonKisi />
                      <span className="text-foreground/80">{c.ad}</span>
                    </>
                  )}
                  {c.telefon && (
                    <a href={`tel:${c.telefon}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <IkonTel />
                      {c.telefon}
                    </a>
                  )}
                </span>
              ))}
              {kisiler.length > 3 && (
                <button
                  type="button"
                  onClick={() =>
                    setAcikKisiler((p) => {
                      const y = new Set(p)
                      if (y.has(m.id)) y.delete(m.id)
                      else y.add(m.id)
                      return y
                    })
                  }
                  className="font-medium text-primary hover:underline"
                >
                  {acik ? "daha az" : `+${kisiler.length - 3} kişi`}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {n > 0 ? (
            <Link
              href={`/?musteri=${m.id}`}
              className="rounded-full border px-2 py-0.5 text-[11.5px] font-semibold hover:brightness-95"
              style={tint(rozet.renk)}
              title="Bu müşterinin işlerini gör"
            >
              {rozet.metin}
            </Link>
          ) : (
            <span className="rounded-full border px-2 py-0.5 text-[11.5px] font-medium" style={tint(rozet.renk)}>
              {rozet.metin}
            </span>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground opacity-70 group-hover:opacity-100"
            onClick={() => setDuzenlenen(m.id)}
          >
            Düzenle
          </Button>
        </div>
      </div>
    )
  }

  const renderSube = (s: Sube, seviye: number, gRenk: string): ReactNode => {
    const m = musteriByAd.get(norm(s.ad))
    const altlar = subeler.filter((x) => x.ust_sube_id === s.id)
    return (
      <div key={s.id} className="grid gap-1.5">
        {m ? (
          satirCiz(m, seviye, gRenk)
        ) : (
          <div
            className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/30 px-3 py-2 text-[13px]"
            style={{ marginLeft: seviye * 20, borderLeft: `3px solid ${gRenk}` }}
          >
            <span className="font-medium">{s.ad}</span>
            <span className="text-[11px] text-muted-foreground">müşteri kaydı yok</span>
          </div>
        )}
        {altlar.map((a) => renderSube(a, seviye + 1, gRenk))}
      </div>
    )
  }

  const SUZGECLER: { k: Suzgec; etiket: string; sayi: number; renk: string }[] = [
    { k: "tumu", etiket: "Tümü", sayi: sayilar.toplam, renk: "#64748b" },
    { k: "isli", etiket: "İşi olanlar", sayi: sayilar.isli, renk: "#10b981" },
    { k: "issiz", etiket: "İşi olmayanlar", sayi: sayilar.issiz, renk: "#94a3b8" },
    { k: "pasif", etiket: "Pasif", sayi: sayilar.pasif, renk: "#ef4444" },
  ]

  return (
    <section className="grid gap-4">
      {/* Üst: arama + süzgeçler + yeni müşteri */}
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-sm">
            <svg aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
            <Input
              type="search"
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Müşteri, şube, kişi ya da telefon ara…"
              className="pl-8"
            />
          </div>
          <Button type="button" size="sm" onClick={() => setYeniAcik((v) => !v)} className="ml-auto">
            {yeniAcik ? "Kapat" : "+ Yeni müşteri"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUZGECLER.map((s) => {
            const aktif = suzgec === s.k
            return (
              <button
                key={s.k}
                type="button"
                onClick={() => setSuzgec(s.k)}
                className="rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-[filter] hover:brightness-95"
                style={aktif ? { background: s.renk, borderColor: s.renk, color: "#fff" } : tint(s.renk)}
              >
                {s.etiket} <span className="opacity-75">{s.sayi}</span>
              </button>
            )
          })}
        </div>
        {yeniAcik && (
          <form
            action={async (fd) => {
              await musteriEkle(fd)
              setYeniAcik(false)
              router.refresh()
            }}
            className="flex flex-wrap gap-2 border-t border-border pt-3"
          >
            <Input name="ad" placeholder="Müşteri adı" required className="h-8 max-w-xs" autoFocus />
            <Input name="sube_sehir" placeholder="Şube/şehir (isteğe bağlı)" className="h-8 max-w-xs" />
            <Button type="submit" size="sm">Ekle</Button>
          </form>
        )}
        <p className="text-[11.5px] text-muted-foreground">
          Liste <strong>otomatik büyür</strong>: bir işe yeni firma yazılınca buraya eklenir; ilgili kişi ve
          telefonlar işlerden toplanır. Rozet rengi iş sayısını gösterir:{" "}
          <span style={{ color: "#0ea5e9" }}>1–4</span> ·{" "}
          <span style={{ color: "#10b981" }}>5–19</span> ·{" "}
          <span style={{ color: "#f59e0b" }}>20–49</span> ·{" "}
          <span style={{ color: "#8b5cf6" }}>50+</span>.
        </p>
      </div>

      {sonucModu ? (
        <div className="grid gap-1.5">
          <h2 className="text-sm font-semibold">
            {sonuclar.length} sonuç
          </h2>
          {sonuclar.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Eşleşen müşteri yok.
            </p>
          ) : (
            sonuclar.map((m) => satirCiz(m))
          )}
        </div>
      ) : (
        <>
          {agac.length > 0 && (
            <div className="grid gap-2">
              <h2 className="text-sm font-semibold">Firmalara bağlı şubeler</h2>
              {/* Duvar düzeni (CSS sütunları): kartlar sütunlara akar, boşluk kalmaz */}
              <div className="columns-1 gap-3 lg:columns-2">
                {agac.map(({ g, ust, toplam }) => {
                  const gRenk = renkSec(g.ad)
                  return (
                    <div key={g.id} className="mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-border bg-card">
                      <div
                        className="flex items-center gap-2 px-3 py-2 text-[13px] font-semibold"
                        style={{
                          background: `color-mix(in oklab, ${gRenk} 13%, var(--card))`,
                          color: `color-mix(in oklab, ${gRenk} 80%, var(--foreground))`,
                        }}
                      >
                        <span className="size-2.5 rounded-full" style={{ background: gRenk }} />
                        {g.ad}
                        <span className="ml-auto text-[11px] font-medium opacity-75">
                          {toplam} şube
                        </span>
                      </div>
                      <div className="grid gap-1.5 p-2">{ust.map((s) => renderSube(s, 0, gRenk))}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <h2 className="text-sm font-semibold">Diğer müşteriler ({duzSayi})</h2>
            {/* Harf atlama çubuğu */}
            <div className="flex flex-wrap gap-1">
              {harfGruplari.map(([h]) => (
                <a
                  key={h}
                  href={`#harf-${h}`}
                  className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-[12px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"
                >
                  {h}
                </a>
              ))}
            </div>
            {harfGruplari.map(([h, liste]) => (
              <div key={h} id={`harf-${h}`} className="grid scroll-mt-24 gap-1.5">
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="flex size-7 items-center justify-center rounded-lg text-[13px] font-bold text-white"
                    style={{ background: renkSec(h) }}
                  >
                    {h}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] text-muted-foreground">{liste.length}</span>
                </div>
                {liste.map((m) => (
                  satirCiz(m)
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
