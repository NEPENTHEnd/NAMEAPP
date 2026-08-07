"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

export type GrafikNokta = {
  firma: string
  ayKey: string // "2026-07"
  ayAd: string // "Tem"
  adet: number
  tutar: number
}

const PALET = [
  "#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444",
  "#06b6d4", "#eab308", "#ec4899", "#84cc16", "#f97316",
  "#6366f1", "#14b8a6", "#f43f5e", "#8b5cf6", "#22c55e",
]

const tamTutar = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
})
const kisaSayi = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
})

type Tip = "sutun" | "cizgi" | "pasta" | "firmalar" | "balon"
type Metrik = "adet" | "tutar"

type Balon = {
  ad: string
  deger: number
  diger?: boolean
  r: number
  x: number
  y: number
}

// Paketli balon yerleşimi: değeri büyük olan ORTADA, küçükler dışa doğru.
// Phyllotaxis (ayçiçeği) başlangıç + çakışmaları iterasyonla ayır + merkeze hafif çek.
function balonYerlesim(
  items: { ad: string; deger: number; diger?: boolean }[]
): { bubbles: Balon[]; vb: string } {
  if (!items.length) return { bubbles: [], vb: "0 0 200 160" }
  const sirali = [...items].sort((a, b) => b.deger - a.deger)
  const maks = Math.max(1, ...sirali.map((i) => i.deger))
  const rMin = 15
  const rMax = 66
  const b: Balon[] = sirali.map((it) => ({
    ...it,
    r: rMin + (rMax - rMin) * Math.sqrt(it.deger / maks),
    x: 0,
    y: 0,
  }))
  const altin = Math.PI * (3 - Math.sqrt(5))
  b.forEach((bb, i) => {
    const rr = 30 * Math.sqrt(i)
    const a = i * altin
    bb.x = Math.cos(a) * rr
    bb.y = Math.sin(a) * rr
  })
  for (let pass = 0; pass < 200; pass++) {
    for (let i = 0; i < b.length; i++) {
      for (let j = i + 1; j < b.length; j++) {
        const dx = b[j].x - b[i].x
        const dy = b[j].y - b[i].y
        const d = Math.hypot(dx, dy) || 0.001
        const min = b[i].r + b[j].r + 5
        if (d < min) {
          const p = (min - d) / 2
          const ux = dx / d
          const uy = dy / d
          b[i].x -= ux * p
          b[i].y -= uy * p
          b[j].x += ux * p
          b[j].y += uy * p
        }
      }
      b[i].x *= 0.99 // merkeze hafif çek → kompakt kalsın, büyükler ortada
      b[i].y *= 0.99
    }
  }
  const minX = Math.min(...b.map((x) => x.x - x.r))
  const maxX = Math.max(...b.map((x) => x.x + x.r))
  const minY = Math.min(...b.map((x) => x.y - x.r))
  const maxY = Math.max(...b.map((x) => x.y + x.r))
  const pad = 8
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
  return { bubbles: b, vb }
}

export function FirmaGrafik({
  noktalar,
  firmalar,
  aylar,
}: {
  noktalar: GrafikNokta[]
  firmalar: string[]
  aylar: { key: string; ad: string }[]
}) {
  const [firma, setFirma] = useState<string>("") // "" = tüm firmalar
  const [tip, setTip] = useState<Tip>("balon") // varsayılan: balon
  const [metrik, setMetrik] = useState<Metrik>("adet")
  const [digerAcik, setDigerAcik] = useState(false) // balon: "Diğer" grubunu açtı mı

  const deger = (n: { adet: number; tutar: number }) =>
    metrik === "adet" ? n.adet : n.tutar
  const etiket = (v: number) =>
    metrik === "adet" ? String(v) : kisaSayi.format(v) + " ₺"
  const uzunEtiket = (v: number) =>
    metrik === "adet" ? `${v} iş` : tamTutar.format(v)

  // Ay bazında seri (seçili firma ya da tüm firmaların toplamı)
  const seri = useMemo(
    () =>
      aylar.map((a) => {
        const uyanlar = noktalar.filter(
          (n) => n.ayKey === a.key && (!firma || n.firma === firma)
        )
        return {
          ad: a.ad,
          deger: uyanlar.reduce((t, n) => t + deger(n), 0),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [noktalar, aylar, firma, metrik]
  )
  const maks = Math.max(1, ...seri.map((s) => s.deger))

  // Pasta dilimleri: tümü → firmalara göre; firma seçili → aylara göre
  const dilimler = useMemo(() => {
    let ham: { ad: string; deger: number }[]
    if (!firma) {
      const m = new Map<string, number>()
      for (const n of noktalar) m.set(n.firma, (m.get(n.firma) ?? 0) + deger(n))
      ham = [...m.entries()].map(([ad, d]) => ({ ad, deger: d }))
      ham.sort((a, b) => b.deger - a.deger)
      // En büyük 9 firma + gerisi tek dilim
      if (ham.length > 10) {
        const kalan = ham.slice(9).reduce((t, x) => t + x.deger, 0)
        ham = [...ham.slice(0, 9), { ad: "Diğerleri", deger: kalan }]
      }
    } else {
      ham = seri.map((s) => ({ ad: s.ad, deger: s.deger }))
    }
    return ham.filter((x) => x.deger > 0)
  }, [noktalar, seri, firma, deger])
  const dilimToplam = Math.max(1, dilimler.reduce((t, d) => t + d.deger, 0))

  // Firma bazlı toplamlar (Firmalar sütunu + Balon için; 6 aylık pencere)
  const firmaToplam = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of noktalar) m.set(n.firma, (m.get(n.firma) ?? 0) + deger(n))
    return [...m.entries()]
      .map(([ad, d]) => ({ ad, deger: d }))
      .filter((x) => x.deger > 0)
      .sort((a, b) => b.deger - a.deger)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noktalar, metrik])
  const firmaMaks = Math.max(1, ...firmaToplam.map((f) => f.deger))

  // Balon verisi: ilk N firma tek tek + gerisi "Diğer" balonu. "Diğer" açıksa
  // yalnız o küçük firmalar tek tek gösterilir (geri tuşuyla dönülür).
  const TOP = 14
  const balon = useMemo(() => {
    const kalan = firmaToplam.slice(TOP)
    let items: { ad: string; deger: number; diger?: boolean }[]
    if (digerAcik) {
      items = kalan.map((f) => ({ ad: f.ad, deger: f.deger }))
    } else {
      items = firmaToplam.slice(0, TOP).map((f) => ({ ad: f.ad, deger: f.deger }))
      if (kalan.length) {
        items.push({
          ad: `Diğer (${kalan.length})`,
          deger: kalan.reduce((t, x) => t + x.deger, 0),
          diger: true,
        })
      }
    }
    return { ...balonYerlesim(items), bos: items.length === 0, kalanSayi: kalan.length }
  }, [firmaToplam, digerAcik])

  // Pasta conic-gradient
  let acc = 0
  const stops: string[] = []
  dilimler.forEach((d, i) => {
    const from = (acc / dilimToplam) * 360
    acc += d.deger
    stops.push(`${PALET[i % PALET.length]} ${from}deg ${(acc / dilimToplam) * 360}deg`)
  })
  const pastaBg = stops.length
    ? `conic-gradient(${stops.join(",")})`
    : "conic-gradient(var(--muted) 0deg 360deg)"

  // SVG ölçüleri (sütun + çizgi)
  const W = 640
  const H = 230
  const solPad = 8
  const altPad = 28
  const ustPad = 22
  const cizimH = H - altPad - ustPad
  const adimW = (W - solPad * 2) / seri.length

  const secBtn = (aktif: boolean) =>
    cn(
      "rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors",
      aktif
        ? "bg-primary text-primary-foreground"
        : "border border-border bg-card text-muted-foreground hover:bg-muted"
    )

  return (
    <div className="grid gap-4">
      {/* Kontroller */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={firma}
          onChange={(e) => setFirma(e.target.value)}
          disabled={tip === "firmalar" || tip === "balon"}
          aria-label="Firma seç"
          className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm outline-none transition focus:border-primary disabled:opacity-50"
        >
          <option value="">Tüm firmalar</option>
          {firmalar.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => setTip("sutun")} className={secBtn(tip === "sutun")}>Sütun</button>
          <button type="button" onClick={() => setTip("cizgi")} className={secBtn(tip === "cizgi")}>Çizgi</button>
          <button type="button" onClick={() => setTip("pasta")} className={secBtn(tip === "pasta")}>Pasta</button>
          <button type="button" onClick={() => setTip("firmalar")} className={secBtn(tip === "firmalar")}>Firmalar</button>
          <button type="button" onClick={() => setTip("balon")} className={secBtn(tip === "balon")}>Balon</button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setMetrik("adet")} className={secBtn(metrik === "adet")}>İş adedi</button>
          <button type="button" onClick={() => setMetrik("tutar")} className={secBtn(metrik === "tutar")}>Kazanç ₺</button>
        </div>
      </div>

      {/* Grafik */}
      {tip === "pasta" ? (
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative shrink-0">
            <div className="size-[180px] rounded-full" style={{ background: pastaBg }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex size-[104px] flex-col items-center justify-center rounded-full bg-card shadow-[inset_0_0_0_1px_rgba(148,163,184,.2)]">
                <span className="font-mono text-lg font-semibold">
                  {metrik === "adet" ? dilimToplam : kisaSayi.format(dilimToplam)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {firma || "tüm firmalar"} · {metrik === "adet" ? "iş" : "₺"}
                </span>
              </div>
            </div>
          </div>
          <div className="grid min-w-[220px] flex-1 gap-1.5">
            {dilimler.length === 0 && (
              <p className="text-sm text-muted-foreground">Bu aralıkta veri yok.</p>
            )}
            {dilimler.map((d, i) => (
              <div key={d.ad} className="flex items-center gap-2 text-[12.5px]">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: PALET[i % PALET.length] }} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.ad}</span>
                <span className="font-mono font-semibold">{uzunEtiket(d.deger)}</span>
                <span className="w-10 text-right text-muted-foreground">
                  %{Math.round((d.deger / dilimToplam) * 100)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : tip === "balon" ? (
        /* Paketli balon: büyük ortada, küçükler dışta; yüzen; «Diğer» tıklanınca açılır */
        <div className="relative">
          <div className="mb-1 flex items-center gap-2">
            {digerAcik && (
              <button
                type="button"
                onClick={() => setDigerAcik(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted"
              >
                ‹ Geri
              </button>
            )}
            <span className="text-[11.5px] text-muted-foreground">
              {digerAcik
                ? "Diğer (küçük) firmalar"
                : balon.kalanSayi > 0
                  ? "Büyük olan ortada · «Diğer» balonuna tıkla → küçük firmaları gör"
                  : "Firma büyüklüğüne göre balonlar"}
            </span>
          </div>

          {balon.bos ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Bu aralıkta veri yok.</p>
          ) : (
            <svg
              viewBox={balon.vb}
              className="h-[330px] w-full animate-[balonGir_.5s_ease-out]"
              preserveAspectRatio="xMidYMid meet"
            >
              {balon.bubbles.map((bb, i) => {
                const renk = bb.diger ? "#64748b" : PALET[i % PALET.length]
                const yaziGoster = bb.r >= 23
                const anaBoyut = Math.max(9, Math.min(14, bb.r * 0.42))
                const altBoyut = Math.max(7, Math.min(10.5, bb.r * 0.26))
                return (
                  <g key={bb.ad} transform={`translate(${bb.x} ${bb.y})`}>
                    <g
                      className={cn(
                        "transition-[filter] duration-200 hover:brightness-110",
                        bb.diger && "cursor-pointer"
                      )}
                      onClick={bb.diger ? () => setDigerAcik(true) : undefined}
                      style={{
                        animation: `balonYuz ${(2.6 + (i % 4) * 0.5).toFixed(1)}s ease-in-out ${(i * 0.13).toFixed(2)}s infinite`,
                      }}
                    >
                      <circle r={bb.r} fill={renk} style={{ filter: "drop-shadow(0 3px 7px rgba(2,6,23,.22))" }} />
                      {/* Cam parlaklığı */}
                      <circle cx={-bb.r * 0.3} cy={-bb.r * 0.34} r={bb.r * 0.3} fill="#ffffff" opacity="0.18" />
                      {yaziGoster && (
                        <>
                          <text textAnchor="middle" y={-1} fontSize={anaBoyut} fontWeight="800" fill="#fff">
                            {bb.diger ? "Diğer" : etiket(bb.deger)}
                          </text>
                          <text textAnchor="middle" y={anaBoyut * 0.62 + 4} fontSize={altBoyut} fill="#fff" opacity="0.9">
                            {bb.diger
                              ? `${balon.kalanSayi} firma →`
                              : bb.ad.length > 13
                                ? bb.ad.slice(0, 12) + "…"
                                : bb.ad}
                          </text>
                        </>
                      )}
                      <title>{`${bb.ad}: ${uzunEtiket(bb.deger)}`}</title>
                    </g>
                  </g>
                )
              })}
            </svg>
          )}

          <style>{`
            @keyframes balonYuz { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
            @keyframes balonGir { from { opacity: 0; transform: scale(.92) } to { opacity: 1; transform: scale(1) } }
          `}</style>
        </div>
      ) : tip === "firmalar" ? (
        /* Tüm firmalar yan yana ince sütunlar — hepsinin değeri görünür */
        <svg viewBox="0 0 760 320" className="h-auto w-full">
          <line x1="8" y1="240" x2="752" y2="240" stroke="currentColor" strokeOpacity="0.15" />
          {firmaToplam.length === 0 && (
            <text x="380" y="130" textAnchor="middle" fontSize="13" fill="currentColor" opacity="0.5">
              Bu aralıkta veri yok
            </text>
          )}
          {firmaToplam.map((f, i) => {
            const adim = 744 / Math.max(1, firmaToplam.length)
            const bw = Math.min(26, adim * 0.6)
            const x = 8 + adim * i + (adim - bw) / 2
            const bh = Math.round((f.deger / firmaMaks) * 195)
            const y = 240 - bh
            return (
              <g key={f.ad}>
                <rect x={x} y={y} width={bw} height={Math.max(bh, 3)} rx={4} fill={PALET[i % PALET.length]}>
                  <title>{`${f.ad}: ${uzunEtiket(f.deger)}`}</title>
                </rect>
                {/* Değer — sütunun üstünde eğik */}
                <text
                  transform={`rotate(-45 ${x + bw / 2} ${y - 6})`}
                  x={x + bw / 2}
                  y={y - 6}
                  textAnchor="start"
                  fontSize="10"
                  fontWeight="700"
                  fill="currentColor"
                >
                  {etiket(f.deger)}
                </text>
                {/* Firma adı — altta eğik */}
                <text
                  transform={`rotate(-45 ${x + bw / 2} 254)`}
                  x={x + bw / 2}
                  y={254}
                  textAnchor="end"
                  fontSize="9.5"
                  fill="currentColor"
                  opacity="0.65"
                >
                  {f.ad.length > 14 ? f.ad.slice(0, 13) + "…" : f.ad}
                </text>
              </g>
            )
          })}
        </svg>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
          {/* taban çizgisi */}
          <line x1={solPad} y1={H - altPad} x2={W - solPad} y2={H - altPad} stroke="currentColor" strokeOpacity="0.15" />
          {tip === "sutun" &&
            seri.map((s, i) => {
              const bh = Math.round((s.deger / maks) * cizimH)
              const bw = Math.min(64, adimW * 0.55)
              const x = solPad + adimW * i + (adimW - bw) / 2
              const y = H - altPad - bh
              return (
                <g key={s.ad}>
                  <rect x={x} y={y} width={bw} height={Math.max(bh, s.deger > 0 ? 3 : 0)} rx={6} fill={PALET[i % PALET.length]}>
                    <title>{`${s.ad}: ${uzunEtiket(s.deger)}`}</title>
                  </rect>
                  <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="currentColor">
                    {s.deger > 0 ? etiket(s.deger) : ""}
                  </text>
                </g>
              )
            })}
          {tip === "cizgi" && (
            <>
              <polyline
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={seri
                  .map((s, i) => {
                    const x = solPad + adimW * i + adimW / 2
                    const y = H - altPad - (s.deger / maks) * cizimH
                    return `${x},${y}`
                  })
                  .join(" ")}
              />
              {seri.map((s, i) => {
                const x = solPad + adimW * i + adimW / 2
                const y = H - altPad - (s.deger / maks) * cizimH
                return (
                  <g key={s.ad}>
                    <circle cx={x} cy={y} r="4.5" fill="#3b82f6">
                      <title>{`${s.ad}: ${uzunEtiket(s.deger)}`}</title>
                    </circle>
                    <text x={x} y={y - 10} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="currentColor">
                      {s.deger > 0 ? etiket(s.deger) : ""}
                    </text>
                  </g>
                )
              })}
            </>
          )}
          {/* Ay etiketleri */}
          {seri.map((s, i) => (
            <text
              key={s.ad + i}
              x={solPad + adimW * i + adimW / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize="11.5"
              fill="currentColor"
              opacity="0.6"
            >
              {s.ad}
            </text>
          ))}
        </svg>
      )}
    </div>
  )
}
