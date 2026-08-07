"use client"

import { useMemo, useRef, useState } from "react"

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
const TEAL = "#0e7490" // aylık grafik: iş adedi sütunu
const GOLD = "#ca8a04" // aylık grafik: kazanç sütunu
const KIRMIZI = "#dc2626" // negatif % değişim

const tamTutar = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
})
const kisaSayi = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
})

type Tip = "aylik" | "balon" | "pasta" | "firmalar"
type Metrik = "adet" | "tutar"
type Pencere = "son1" | "tum"

type Balon = { ad: string; deger: number; diger?: boolean; r: number; x: number; y: number }

// Paketli balon yerleşimi: EN BÜYÜK ORTADA (merkeze sabit), küçükler dışa doğru.
function balonYerlesim(items: { ad: string; deger: number; diger?: boolean }[]): {
  bubbles: Balon[]
  vb: string
} {
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
  for (let pass = 0; pass < 240; pass++) {
    for (let i = 0; i < b.length; i++) {
      for (let j = i + 1; j < b.length; j++) {
        const dx = b[j].x - b[i].x
        const dy = b[j].y - b[i].y
        const d = Math.hypot(dx, dy) || 0.001
        const min = b[i].r + b[j].r + 5
        if (d < min) {
          const p = min - d
          const ux = dx / d
          const uy = dy / d
          // 0. balon (en büyük) sabit; onun dışındakiler itilir
          if (i === 0) {
            b[j].x += ux * p
            b[j].y += uy * p
          } else {
            b[i].x -= (ux * p) / 2
            b[i].y -= (uy * p) / 2
            b[j].x += (ux * p) / 2
            b[j].y += (uy * p) / 2
          }
        }
      }
      if (i !== 0) {
        b[i].x *= 0.985 // merkeze hafif çek (kompakt); en büyüğe dokunma
        b[i].y *= 0.985
      }
    }
    b[0].x = 0 // en büyüğü her turda merkeze sabitle
    b[0].y = 0
  }
  const minX = Math.min(...b.map((x) => x.x - x.r))
  const maxX = Math.max(...b.map((x) => x.x + x.r))
  const minY = Math.min(...b.map((x) => x.y - x.r))
  const maxY = Math.max(...b.map((x) => x.y + x.r))
  const pad = 10
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
  const [firma, setFirma] = useState<string>("")
  const [tip, setTip] = useState<Tip>("balon") // varsayılan: balon (bu ay ile başlar)
  const [metrik, setMetrik] = useState<Metrik>("adet")
  const [pencere, setPencere] = useState<Pencere>("son1") // balon/pasta/firmalar: bu ay
  const [digerAcik, setDigerAcik] = useState(false)
  const [surukle, setSurukle] = useState<{ ad: string; dx: number; dy: number; birak: boolean } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const deger = (n: { adet: number; tutar: number }) => (metrik === "adet" ? n.adet : n.tutar)
  const etiket = (v: number) => (metrik === "adet" ? String(v) : kisaSayi.format(v) + " ₺")
  const uzunEtiket = (v: number) => (metrik === "adet" ? `${v} iş` : tamTutar.format(v))

  const sonAy = aylar[aylar.length - 1]?.key ?? ""
  // balon/pasta/firmalar penceresi: son1 = yalnız son ay, tum = tüm aylar
  const kapsamNokta = useMemo(
    () => (pencere === "son1" && sonAy ? noktalar.filter((n) => n.ayKey === sonAy) : noktalar),
    [noktalar, pencere, sonAy]
  )

  // Birleşik AYLIK grafik verisi: her ay için adet + kazanç (firma seçiliyse ona göre)
  const aylikSeri = useMemo(
    () =>
      aylar.map((a) => {
        const uy = noktalar.filter((n) => n.ayKey === a.key && (!firma || n.firma === firma))
        return {
          ad: a.ad,
          adet: uy.reduce((t, n) => t + n.adet, 0),
          tutar: uy.reduce((t, n) => t + n.tutar, 0),
        }
      }),
    [noktalar, aylar, firma]
  )
  const maxAdet = Math.max(1, ...aylikSeri.map((s) => s.adet))
  const maxTutar = Math.max(1, ...aylikSeri.map((s) => s.tutar))

  // Pasta dilimleri (kapsam penceresine göre)
  const dilimler = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of kapsamNokta) m.set(n.firma, (m.get(n.firma) ?? 0) + deger(n))
    let ham = [...m.entries()].map(([ad, d]) => ({ ad, deger: d })).sort((a, b) => b.deger - a.deger)
    if (ham.length > 10) {
      const kalan = ham.slice(9).reduce((t, x) => t + x.deger, 0)
      ham = [...ham.slice(0, 9), { ad: "Diğerleri", deger: kalan }]
    }
    return ham.filter((x) => x.deger > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kapsamNokta, metrik])
  const dilimToplam = Math.max(1, dilimler.reduce((t, d) => t + d.deger, 0))

  // Firma toplamları (balon + firmalar) — kapsam penceresine göre
  const firmaToplam = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of kapsamNokta) m.set(n.firma, (m.get(n.firma) ?? 0) + deger(n))
    return [...m.entries()]
      .map(([ad, d]) => ({ ad, deger: d }))
      .filter((x) => x.deger > 0)
      .sort((a, b) => b.deger - a.deger)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kapsamNokta, metrik])
  const firmaMaks = Math.max(1, ...firmaToplam.map((f) => f.deger))

  // Balon paketi: ilk 14 + "Diğer"; Diğer açıksa küçük firmalar
  const TOP = 14
  const balon = useMemo(() => {
    const kalan = firmaToplam.slice(TOP)
    let items: { ad: string; deger: number; diger?: boolean }[]
    if (digerAcik) {
      // "Diğer" açık: TÜM firmalar birlikte paketlenir — küçükler büyüklerin ETRAFINI doldurur
      items = firmaToplam.map((f) => ({ ad: f.ad, deger: f.deger }))
    } else {
      items = firmaToplam.slice(0, TOP).map((f) => ({ ad: f.ad, deger: f.deger }))
      if (kalan.length)
        items.push({ ad: `Diğer (${kalan.length})`, deger: kalan.reduce((t, x) => t + x.deger, 0), diger: true })
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
  const pastaBg = stops.length ? `conic-gradient(${stops.join(",")})` : "conic-gradient(var(--muted) 0deg 360deg)"

  const secBtn = (aktif: boolean) =>
    cn(
      "rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors",
      aktif ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"
    )

  // ---- Balon sürükleme ----
  function surukleBasla(ad: string, e: React.PointerEvent) {
    if (!svgRef.current) return
    e.preventDefault()
    const ctm = svgRef.current.getScreenCTM()
    const olcekX = ctm && ctm.a ? 1 / ctm.a : 1
    const olcekY = ctm && ctm.d ? 1 / ctm.d : 1
    const bx = e.clientX
    const by = e.clientY
    setSurukle({ ad, dx: 0, dy: 0, birak: false })
    const move = (ev: PointerEvent) => {
      setSurukle({ ad, dx: (ev.clientX - bx) * olcekX, dy: (ev.clientY - by) * olcekY, birak: false })
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      // yerine yaylanarak dön
      setSurukle({ ad, dx: 0, dy: 0, birak: true })
      window.setTimeout(() => setSurukle((s) => (s && s.ad === ad ? null : s)), 420)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

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
          <button type="button" onClick={() => setTip("aylik")} className={secBtn(tip === "aylik")}>Aylık</button>
          <button type="button" onClick={() => setTip("balon")} className={secBtn(tip === "balon")}>Balon</button>
          <button type="button" onClick={() => setTip("pasta")} className={secBtn(tip === "pasta")}>Pasta</button>
          <button type="button" onClick={() => setTip("firmalar")} className={secBtn(tip === "firmalar")}>Firmalar</button>
        </div>
        {/* metrik: aylık dışında (aylık zaten ikisini de gösterir) */}
        {tip !== "aylik" && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMetrik("adet")} className={secBtn(metrik === "adet")}>İş adedi</button>
            <button type="button" onClick={() => setMetrik("tutar")} className={secBtn(metrik === "tutar")}>Kazanç ₺</button>
          </div>
        )}
        {/* pencere: balon/pasta/firmalar için bu ay / tüm aylar */}
        {tip !== "aylik" && (
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setPencere("son1")} className={secBtn(pencere === "son1")}>Bu ay</button>
            <button type="button" onClick={() => setPencere("tum")} className={secBtn(pencere === "tum")}>Tüm aylar</button>
          </div>
        )}
      </div>

      {/* GRAFİK */}
      {tip === "aylik" ? (
        /* Birleşik: sütun = iş adedi (sol eksen), çizgi = kazanç ₺ (sağ eksen) */
        (() => {
          const W = 720, H = 300
          const padSol = 42, padSag = 56, padUst = 40, padAlt = 26
          const cizH = H - padUst - padAlt
          const cizW = W - padSol - padSag
          const adim = cizW / Math.max(1, aylikSeri.length)
          const bw = Math.min(18, adim * 0.26)
          const taban = padUst + cizH
          const yuzde = (i: number): number | null => {
            if (i === 0) return null
            const onc = aylikSeri[i - 1].tutar
            if (!onc) return null
            return Math.round(((aylikSeri[i].tutar - onc) / onc) * 100)
          }
          return (
            <div className="grid gap-2">
              {/* Legend — üçgen işaretli, profesyonel */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span style={{ color: TEAL }}>▲</span> İş adedi
                </span>
                <span className="flex items-center gap-1.5">
                  <span style={{ color: GOLD }}>▲</span> Kazanç ₺
                </span>
                <span className="text-[10.5px] opacity-80">üstteki % = bir önceki aya göre kazanç değişimi</span>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
                {/* Yatay ızgara + çift eksen (sol: adet teal, sağ: kazanç gold) */}
                {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                  const y = taban - f * cizH
                  return (
                    <g key={f}>
                      <line x1={padSol} y1={y} x2={W - padSag} y2={y} stroke="currentColor" strokeOpacity="0.08" />
                      <text x={padSol - 6} y={y + 3} textAnchor="end" fontSize="9" fill={TEAL} opacity="0.85">
                        {Math.round(maxAdet * f)}
                      </text>
                      <text x={W - padSag + 6} y={y + 3} textAnchor="start" fontSize="9" fill={GOLD} opacity="0.9">
                        {kisaSayi.format(maxTutar * f)}
                      </text>
                    </g>
                  )
                })}
                {/* Aylar: dikey ayraç + 2 sütun (adet + kazanç) + % değişim */}
                {aylikSeri.map((s, i) => {
                  const cx = padSol + adim * i + adim / 2
                  const adH = (s.adet / maxAdet) * cizH
                  const kzH = (s.tutar / maxTutar) * cizH
                  const y = yuzde(i)
                  return (
                    <g key={s.ad}>
                      {i > 0 && (
                        <line x1={padSol + adim * i} y1={padUst - 2} x2={padSol + adim * i} y2={taban} stroke="currentColor" strokeOpacity="0.06" />
                      )}
                      <rect x={cx - bw - 2} y={taban - adH} width={bw} height={Math.max(adH, s.adet > 0 ? 2 : 0)} rx={3} fill={TEAL}>
                        <title>{`${s.ad}: ${s.adet} iş`}</title>
                      </rect>
                      <rect x={cx + 2} y={taban - kzH} width={bw} height={Math.max(kzH, s.tutar > 0 ? 2 : 0)} rx={3} fill={GOLD}>
                        <title>{`${s.ad}: ${tamTutar.format(s.tutar)}`}</title>
                      </rect>
                      {y != null && (
                        <text x={cx} y={padUst - 8} textAnchor="middle" fontSize="10" fontWeight="800" fill={y >= 0 ? TEAL : KIRMIZI}>
                          {y >= 0 ? "+" : ""}{y}%
                        </text>
                      )}
                      <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">
                        {s.ad}
                      </text>
                    </g>
                  )
                })}
                {/* Taban çizgisi */}
                <line x1={padSol} y1={taban} x2={W - padSag} y2={taban} stroke="currentColor" strokeOpacity="0.28" />
              </svg>
            </div>
          )
        })()
      ) : tip === "pasta" ? (
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative shrink-0">
            <div className="size-[180px] rounded-full" style={{ background: pastaBg }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex size-[104px] flex-col items-center justify-center rounded-full bg-card shadow-[inset_0_0_0_1px_rgba(148,163,184,.2)]">
                <span className="font-mono text-lg font-semibold">
                  {metrik === "adet" ? dilimToplam : kisaSayi.format(dilimToplam)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {pencere === "son1" ? "bu ay" : "tüm aylar"} · {metrik === "adet" ? "iş" : "₺"}
                </span>
              </div>
            </div>
          </div>
          <div className="grid min-w-[220px] flex-1 gap-1.5">
            {dilimler.length === 0 && <p className="text-sm text-muted-foreground">Bu aralıkta veri yok.</p>}
            {dilimler.map((d, i) => (
              <div key={d.ad} className="flex items-center gap-2 text-[12.5px]">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: PALET[i % PALET.length] }} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.ad}</span>
                <span className="font-mono font-semibold">{uzunEtiket(d.deger)}</span>
                <span className="w-10 text-right text-muted-foreground">%{Math.round((d.deger / dilimToplam) * 100)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : tip === "balon" ? (
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
                ? "Tüm firmalar — küçükler büyüklerin etrafında"
                : "Büyük ortada · balonu sürükle (yerine döner) · «Diğer» → küçükleri çevreye ekle"}
            </span>
          </div>

          {balon.bos ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Bu aralıkta veri yok.</p>
          ) : (
            <svg
              ref={svgRef}
              viewBox={balon.vb}
              className="h-[330px] w-full touch-none select-none animate-[balonGir_.5s_ease-out]"
              preserveAspectRatio="xMidYMid meet"
            >
              {balon.bubbles.map((bb, i) => {
                const renk = bb.diger ? "#64748b" : PALET[i % PALET.length]
                const yaziGoster = bb.r >= 23
                const anaBoyut = Math.max(9, Math.min(14, bb.r * 0.42))
                const altBoyut = Math.max(7, Math.min(10.5, bb.r * 0.26))
                const suruklenen = surukle?.ad === bb.ad
                return (
                  <g key={bb.ad} transform={`translate(${bb.x} ${bb.y})`}>
                    <g
                      onPointerDown={bb.diger ? undefined : (e) => surukleBasla(bb.ad, e)}
                      onClick={bb.diger ? () => setDigerAcik(true) : undefined}
                      className={cn("hover:brightness-110", bb.diger ? "cursor-pointer" : "cursor-grab active:cursor-grabbing")}
                      style={{
                        animation: suruklenen ? "none" : `balonYuz ${(2.6 + (i % 4) * 0.5).toFixed(1)}s ease-in-out ${(i * 0.13).toFixed(2)}s infinite`,
                        transform: suruklenen ? `translate(${surukle!.dx}px, ${surukle!.dy}px)` : undefined,
                        transition: suruklenen && surukle!.birak ? "transform .42s cubic-bezier(.34,1.56,.64,1)" : "none",
                      }}
                    >
                      <circle r={bb.r} fill={renk} style={{ filter: "drop-shadow(0 3px 7px rgba(2,6,23,.22))" }} />
                      <circle cx={-bb.r * 0.3} cy={-bb.r * 0.34} r={bb.r * 0.3} fill="#ffffff" opacity="0.18" />
                      {yaziGoster && (
                        <>
                          <text textAnchor="middle" y={-1} fontSize={anaBoyut} fontWeight="800" fill="#fff" pointerEvents="none">
                            {bb.diger ? "Diğer" : etiket(bb.deger)}
                          </text>
                          <text textAnchor="middle" y={anaBoyut * 0.62 + 4} fontSize={altBoyut} fill="#fff" opacity="0.9" pointerEvents="none">
                            {bb.diger ? `${balon.kalanSayi} firma →` : bb.ad.length > 13 ? bb.ad.slice(0, 12) + "…" : bb.ad}
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
      ) : (
        /* Firmalar: tüm firmalar ince sütun */
        <svg viewBox="0 0 760 320" className="h-auto w-full">
          <line x1="8" y1="240" x2="752" y2="240" stroke="currentColor" strokeOpacity="0.15" />
          {firmaToplam.length === 0 && (
            <text x="380" y="130" textAnchor="middle" fontSize="13" fill="currentColor" opacity="0.5">Bu aralıkta veri yok</text>
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
                <text transform={`rotate(-45 ${x + bw / 2} ${y - 6})`} x={x + bw / 2} y={y - 6} textAnchor="start" fontSize="10" fontWeight="700" fill="currentColor">
                  {etiket(f.deger)}
                </text>
                <text transform={`rotate(-45 ${x + bw / 2} 254)`} x={x + bw / 2} y={254} textAnchor="end" fontSize="9.5" fill="currentColor" opacity="0.65">
                  {f.ad.length > 14 ? f.ad.slice(0, 13) + "…" : f.ad}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
