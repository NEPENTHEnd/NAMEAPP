"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"

export type GrafikNokta = {
  firma: string
  ayKey: string // "2026-07"
  ayAd: string // "Tem"
  adet: number
  tutar: number
}
export type SubeNokta = { firma: string; sube: string; ayKey: string; adet: number; tutar: number }

const PALET = [
  "#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444",
  "#06b6d4", "#eab308", "#ec4899", "#84cc16", "#f97316",
  "#6366f1", "#14b8a6", "#f43f5e", "#8b5cf6", "#22c55e",
]
const TEAL = "#0e7490"
const GOLD = "#ca8a04"
const KIRMIZI = "#dc2626"

const tamTutar = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 })
const kisaSayi = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 })

type Tip = "aylik" | "balon" | "pasta" | "firmalar"
type Metrik = "adet" | "tutar"
type Pencere = "son1" | "tum"
type Drill = { tur: "kok" } | { tur: "diger" } | { tur: "firma"; firma: string }

type BalonHam = { ad: string; adet: number; tutar: number; diger?: boolean; altVar?: boolean }
type Balon = BalonHam & { r: number; x: number; y: number }

// Paketli yerleşim: adet'e göre büyük ORTADA (sabit), küçükler dışa doğru.
function balonYerlesim(items: BalonHam[]): { bubbles: Balon[]; vb: string } {
  if (!items.length) return { bubbles: [], vb: "0 0 200 160" }
  const sirali = [...items].sort((a, b) => b.adet - a.adet)
  const maks = Math.max(1, ...sirali.map((i) => i.adet))
  const rMin = 24
  const rMax = 94
  const b: Balon[] = sirali.map((it) => ({ ...it, r: rMin + (rMax - rMin) * Math.sqrt(it.adet / maks), x: 0, y: 0 }))
  const altin = Math.PI * (3 - Math.sqrt(5))
  b.forEach((bb, i) => {
    const rr = 42 * Math.sqrt(i)
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
        const min = b[i].r + b[j].r + 6
        if (d < min) {
          const p = min - d
          const ux = dx / d
          const uy = dy / d
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
        b[i].x *= 0.985
        b[i].y *= 0.985
      }
    }
    b[0].x = 0
    b[0].y = 0
  }
  const minX = Math.min(...b.map((x) => x.x - x.r))
  const maxX = Math.max(...b.map((x) => x.x + x.r))
  const minY = Math.min(...b.map((x) => x.y - x.r))
  const maxY = Math.max(...b.map((x) => x.y + x.r))
  const pad = 12
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
  return { bubbles: b, vb }
}

export function FirmaGrafik({
  noktalar,
  firmalar,
  aylar,
  subeNoktalar = [],
}: {
  noktalar: GrafikNokta[]
  firmalar: string[]
  aylar: { key: string; ad: string }[]
  subeNoktalar?: SubeNokta[]
}) {
  const [firma, setFirma] = useState<string>("")
  const [tip, setTip] = useState<Tip>("balon")
  const [metrik, setMetrik] = useState<Metrik>("adet")
  const [pencere, setPencere] = useState<Pencere>("son1")
  const [drill, setDrill] = useState<Drill>({ tur: "kok" })
  const [surukle, setSurukle] = useState<{ ad: string; dx: number; dy: number; birak: boolean } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  const deger = (n: { adet: number; tutar: number }) => (metrik === "adet" ? n.adet : n.tutar)
  const etiket = (v: number) => (metrik === "adet" ? String(v) : kisaSayi.format(v) + " ₺")
  const uzunEtiket = (v: number) => (metrik === "adet" ? `${v} iş` : tamTutar.format(v))

  const sonAy = aylar[aylar.length - 1]?.key ?? ""
  const kapsamNokta = useMemo(
    () => (pencere === "son1" && sonAy ? noktalar.filter((n) => n.ayKey === sonAy) : noktalar),
    [noktalar, pencere, sonAy]
  )
  const kapsamSube = useMemo(
    () => (pencere === "son1" && sonAy ? subeNoktalar.filter((n) => n.ayKey === sonAy) : subeNoktalar),
    [subeNoktalar, pencere, sonAy]
  )

  // Aylık birleşik grafik verisi
  const aylikSeri = useMemo(
    () =>
      aylar.map((a) => {
        const uy = noktalar.filter((n) => n.ayKey === a.key && (!firma || n.firma === firma))
        return { ad: a.ad, adet: uy.reduce((t, n) => t + n.adet, 0), tutar: uy.reduce((t, n) => t + n.tutar, 0) }
      }),
    [noktalar, aylar, firma]
  )
  const maxAdet = Math.max(1, ...aylikSeri.map((s) => s.adet))
  const maxTutar = Math.max(1, ...aylikSeri.map((s) => s.tutar))

  // Firma toplamları (adet + tutar + şubesi var mı)
  const firmaToplam = useMemo(() => {
    const m = new Map<string, { adet: number; tutar: number }>()
    for (const n of kapsamNokta) {
      const v = m.get(n.firma) ?? { adet: 0, tutar: 0 }
      v.adet += n.adet
      v.tutar += n.tutar
      m.set(n.firma, v)
    }
    const subeli = new Set(kapsamSube.map((s) => s.firma))
    return [...m.entries()]
      .map(([ad, v]) => ({ ad, adet: v.adet, tutar: v.tutar, altVar: subeli.has(ad) }))
      .filter((x) => x.adet > 0)
      .sort((a, b) => b.adet - a.adet)
  }, [kapsamNokta, kapsamSube])
  const firmaMaks = Math.max(1, ...firmaToplam.map((f) => deger(f)))

  // Pasta
  const dilimler = useMemo(() => {
    let ham = firmaToplam.map((f) => ({ ad: f.ad, deger: deger(f) })).filter((x) => x.deger > 0)
    ham.sort((a, b) => b.deger - a.deger)
    if (ham.length > 10) {
      const kalan = ham.slice(9).reduce((t, x) => t + x.deger, 0)
      ham = [...ham.slice(0, 9), { ad: "Diğerleri", deger: kalan }]
    }
    return ham
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaToplam, metrik])
  const dilimToplam = Math.max(1, dilimler.reduce((t, d) => t + d.deger, 0))
  let acc = 0
  const stops: string[] = []
  dilimler.forEach((d, i) => {
    const from = (acc / dilimToplam) * 360
    acc += d.deger
    stops.push(`${PALET[i % PALET.length]} ${from}deg ${(acc / dilimToplam) * 360}deg`)
  })
  const pastaBg = stops.length ? `conic-gradient(${stops.join(",")})` : "conic-gradient(var(--muted) 0deg 360deg)"

  // Balon: drill'e göre öğeler
  const TOP = 16
  const balon = useMemo(() => {
    let items: BalonHam[] = []
    if (drill.tur === "firma") {
      const m = new Map<string, { adet: number; tutar: number }>()
      for (const n of kapsamSube) {
        if (n.firma !== drill.firma) continue
        const v = m.get(n.sube) ?? { adet: 0, tutar: 0 }
        v.adet += n.adet
        v.tutar += n.tutar
        m.set(n.sube, v)
      }
      items = [...m.entries()].map(([ad, v]) => ({ ad, adet: v.adet, tutar: v.tutar }))
    } else if (drill.tur === "diger") {
      // "Diğer": TÜM firmalar birlikte — küçükler büyüklerin ETRAFINI doldurur
      items = firmaToplam.map((f) => ({ ad: f.ad, adet: f.adet, tutar: f.tutar, altVar: f.altVar }))
    } else {
      items = firmaToplam.slice(0, TOP).map((f) => ({ ad: f.ad, adet: f.adet, tutar: f.tutar, altVar: f.altVar }))
      const kalan = firmaToplam.slice(TOP)
      if (kalan.length)
        items.push({
          ad: `Diğer (${kalan.length})`,
          adet: kalan.reduce((t, x) => t + x.adet, 0),
          tutar: kalan.reduce((t, x) => t + x.tutar, 0),
          diger: true,
        })
    }
    return { ...balonYerlesim(items), bos: items.length === 0 }
  }, [drill, firmaToplam, kapsamSube])

  // Görüntü viewBox (zoom + pan)
  const [bMinX, bMinY, bW, bH] = balon.vb.split(" ").map(Number)
  const dw = bW / zoom
  const dh = bH / zoom
  const cxV = bMinX + bW / 2 + pan.x
  const cyV = bMinY + bH / 2 + pan.y
  const goruntuVb = `${cxV - dw / 2} ${cyV - dh / 2} ${dw} ${dh}`

  function drilleGit(d: Drill) {
    setDrill(d)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Scroll ile zoom (non-passive)
  useEffect(() => {
    const el = svgRef.current
    if (!el || tip !== "balon") return
    const h = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => Math.min(6, Math.max(1, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12))))
    }
    el.addEventListener("wheel", h, { passive: false })
    return () => el.removeEventListener("wheel", h)
  }, [tip])

  // Balon sürükle (yaylanarak yerine döner)
  function surukleBasla(ad: string, e: React.PointerEvent) {
    if (!svgRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const ctm = svgRef.current.getScreenCTM()
    const ox = ctm && ctm.a ? 1 / ctm.a : 1
    const oy = ctm && ctm.d ? 1 / ctm.d : 1
    const bx = e.clientX
    const by = e.clientY
    setSurukle({ ad, dx: 0, dy: 0, birak: false })
    const move = (ev: PointerEvent) => setSurukle({ ad, dx: (ev.clientX - bx) * ox, dy: (ev.clientY - by) * oy, birak: false })
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      setSurukle({ ad, dx: 0, dy: 0, birak: true })
      window.setTimeout(() => setSurukle((s) => (s && s.ad === ad ? null : s)), 420)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  // Boş alanda pan (zoom'luyken kaydır)
  function panBasla(e: React.PointerEvent) {
    if (!svgRef.current) return
    const ctm = svgRef.current.getScreenCTM()
    const ox = ctm && ctm.a ? 1 / ctm.a : 1
    const oy = ctm && ctm.d ? 1 / ctm.d : 1
    const bx = e.clientX
    const by = e.clientY
    const p0 = { ...pan }
    const move = (ev: PointerEvent) => setPan({ x: p0.x - (ev.clientX - bx) * ox, y: p0.y - (ev.clientY - by) * oy })
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const secBtn = (aktif: boolean) =>
    cn(
      "rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors",
      aktif ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"
    )

  const drillBaslik =
    drill.tur === "firma" ? `${drill.firma} › şubeler` : drill.tur === "diger" ? "Tüm firmalar" : ""

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
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => setTip("aylik")} className={secBtn(tip === "aylik")}>Aylık</button>
          <button type="button" onClick={() => setTip("balon")} className={secBtn(tip === "balon")}>Balon</button>
          <button type="button" onClick={() => setTip("pasta")} className={secBtn(tip === "pasta")}>Pasta</button>
          <button type="button" onClick={() => setTip("firmalar")} className={secBtn(tip === "firmalar")}>Firmalar</button>
        </div>
        {tip !== "aylik" && tip !== "balon" && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMetrik("adet")} className={secBtn(metrik === "adet")}>İş adedi</button>
            <button type="button" onClick={() => setMetrik("tutar")} className={secBtn(metrik === "tutar")}>Kazanç ₺</button>
          </div>
        )}
        {tip !== "aylik" && (
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setPencere("son1")} className={secBtn(pencere === "son1")}>Bu ay</button>
            <button type="button" onClick={() => setPencere("tum")} className={secBtn(pencere === "tum")}>Tüm aylar</button>
          </div>
        )}
      </div>

      {/* GRAFİK */}
      {tip === "aylik" ? (
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
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span style={{ color: TEAL }}>▲</span> İş adedi</span>
                <span className="flex items-center gap-1.5"><span style={{ color: GOLD }}>▲</span> Kazanç ₺</span>
                <span className="text-[10.5px] opacity-80">üstteki % = bir önceki aya göre kazanç değişimi</span>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
                {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                  const y = taban - f * cizH
                  return (
                    <g key={f}>
                      <line x1={padSol} y1={y} x2={W - padSag} y2={y} stroke="currentColor" strokeOpacity="0.08" />
                      <text x={padSol - 6} y={y + 3} textAnchor="end" fontSize="9" fill={TEAL} opacity="0.85">{Math.round(maxAdet * f)}</text>
                      <text x={W - padSag + 6} y={y + 3} textAnchor="start" fontSize="9" fill={GOLD} opacity="0.9">{kisaSayi.format(maxTutar * f)}</text>
                    </g>
                  )
                })}
                {aylikSeri.map((s, i) => {
                  const cx = padSol + adim * i + adim / 2
                  const adH = (s.adet / maxAdet) * cizH
                  const kzH = (s.tutar / maxTutar) * cizH
                  const y = yuzde(i)
                  return (
                    <g key={s.ad}>
                      {i > 0 && <line x1={padSol + adim * i} y1={padUst - 2} x2={padSol + adim * i} y2={taban} stroke="currentColor" strokeOpacity="0.06" />}
                      <rect x={cx - bw - 2} y={taban - adH} width={bw} height={Math.max(adH, s.adet > 0 ? 2 : 0)} rx={3} fill={TEAL}><title>{`${s.ad}: ${s.adet} iş`}</title></rect>
                      <rect x={cx + 2} y={taban - kzH} width={bw} height={Math.max(kzH, s.tutar > 0 ? 2 : 0)} rx={3} fill={GOLD}><title>{`${s.ad}: ${tamTutar.format(s.tutar)}`}</title></rect>
                      {y != null && <text x={cx} y={padUst - 8} textAnchor="middle" fontSize="10" fontWeight="800" fill={y >= 0 ? TEAL : KIRMIZI}>{y >= 0 ? "+" : ""}{y}%</text>}
                      <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">{s.ad}</text>
                    </g>
                  )
                })}
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
                <span className="font-mono text-lg font-semibold">{metrik === "adet" ? dilimToplam : kisaSayi.format(dilimToplam)}</span>
                <span className="text-[10px] text-muted-foreground">{pencere === "son1" ? "bu ay" : "tüm aylar"} · {metrik === "adet" ? "iş" : "₺"}</span>
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
            {drill.tur !== "kok" && (
              <button type="button" onClick={() => drilleGit({ tur: "kok" })} className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted">
                ‹ Geri
              </button>
            )}
            <span className="text-[11.5px] text-muted-foreground">
              {drill.tur !== "kok"
                ? drillBaslik
                : "Sürükle (yerine döner) · scroll = yakınlaştır · «Diğer» ya da şubeli firmaya tıkla"}
            </span>
            {zoom > 1.01 && (
              <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="ml-auto rounded-lg border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">
                %{Math.round(zoom * 100)} · sıfırla
              </button>
            )}
          </div>

          {balon.bos ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Bu aralıkta veri yok.</p>
          ) : (
            <svg
              ref={svgRef}
              viewBox={goruntuVb}
              onPointerDown={panBasla}
              className="h-[360px] w-full cursor-grab touch-none select-none animate-[balonGir_.5s_ease-out] active:cursor-grabbing"
              preserveAspectRatio="xMidYMid meet"
            >
              {balon.bubbles.map((bb, i) => {
                const renk = bb.diger ? "#64748b" : PALET[i % PALET.length]
                const acilir = bb.diger || bb.altVar
                const suruklenen = surukle?.ad === bb.ad
                const buyuk = bb.r >= 40
                const orta = bb.r >= 26
                const anaBoyut = Math.max(10, Math.min(18, bb.r * 0.34))
                const altBoyut = Math.max(8, Math.min(12, bb.r * 0.22))
                const adBoyut = Math.max(8, Math.min(11, bb.r * 0.2))
                return (
                  <g key={bb.ad} transform={`translate(${bb.x} ${bb.y})`}>
                    <g
                      onPointerDown={acilir ? (e) => e.stopPropagation() : (e) => surukleBasla(bb.ad, e)}
                      onClick={acilir ? () => drilleGit(bb.diger ? { tur: "diger" } : { tur: "firma", firma: bb.ad }) : undefined}
                      className={cn("hover:brightness-110", acilir ? "cursor-pointer" : "cursor-grab active:cursor-grabbing")}
                      style={{
                        animation: suruklenen ? "none" : `balonYuz ${(2.6 + (i % 4) * 0.5).toFixed(1)}s ease-in-out ${(i * 0.11).toFixed(2)}s infinite`,
                        transform: suruklenen ? `translate(${surukle!.dx}px, ${surukle!.dy}px)` : undefined,
                        transition: suruklenen && surukle!.birak ? "transform .42s cubic-bezier(.34,1.56,.64,1)" : "none",
                      }}
                    >
                      <circle r={bb.r} fill={renk} style={{ filter: "drop-shadow(0 4px 9px rgba(2,6,23,.24))" }} />
                      <circle cx={-bb.r * 0.3} cy={-bb.r * 0.34} r={bb.r * 0.3} fill="#ffffff" opacity="0.18" />
                      {/* Şubeli firma: kesikli halka + hint */}
                      {bb.altVar && <circle r={bb.r - 4} fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="4 4" />}
                      {orta && (
                        <g pointerEvents="none">
                          {bb.diger ? (
                            <>
                              <text textAnchor="middle" y={-2} fontSize={anaBoyut} fontWeight="800" fill="#fff">Diğer</text>
                              <text textAnchor="middle" y={anaBoyut * 0.7 + 4} fontSize={altBoyut} fill="#fff" opacity="0.9">firmalar →</text>
                            </>
                          ) : (
                            <>
                              {buyuk && (
                                <text textAnchor="middle" y={-bb.r * 0.32} fontSize={adBoyut} fontWeight="600" fill="#fff" opacity="0.92">
                                  {bb.ad.length > 15 ? bb.ad.slice(0, 14) + "…" : bb.ad}
                                </text>
                              )}
                              <text textAnchor="middle" y={buyuk ? 0 : -1} fontSize={anaBoyut} fontWeight="800" fill="#fff">{bb.adet} iş</text>
                              {buyuk && bb.tutar > 0 && (
                                <text textAnchor="middle" y={bb.r * 0.3} fontSize={altBoyut} fill="#fff" opacity="0.9">{kisaSayi.format(bb.tutar)} ₺</text>
                              )}
                              {bb.altVar && (
                                <text textAnchor="middle" y={buyuk ? bb.r * 0.54 : anaBoyut * 0.7 + 4} fontSize={altBoyut} fill="#fff" opacity="0.85">▸ şubeler</text>
                              )}
                            </>
                          )}
                        </g>
                      )}
                      <title>{`${bb.ad}: ${bb.adet} iş · ${tamTutar.format(bb.tutar)}${bb.altVar ? " · tıkla → şubeler" : ""}`}</title>
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
        <svg viewBox="0 0 760 320" className="h-auto w-full">
          <line x1="8" y1="240" x2="752" y2="240" stroke="currentColor" strokeOpacity="0.15" />
          {firmaToplam.length === 0 && <text x="380" y="130" textAnchor="middle" fontSize="13" fill="currentColor" opacity="0.5">Bu aralıkta veri yok</text>}
          {firmaToplam.map((f, i) => {
            const adim = 744 / Math.max(1, firmaToplam.length)
            const bw = Math.min(26, adim * 0.6)
            const x = 8 + adim * i + (adim - bw) / 2
            const bh = Math.round((deger(f) / firmaMaks) * 195)
            const y = 240 - bh
            return (
              <g key={f.ad}>
                <rect x={x} y={y} width={bw} height={Math.max(bh, 3)} rx={4} fill={PALET[i % PALET.length]}><title>{`${f.ad}: ${uzunEtiket(deger(f))}`}</title></rect>
                <text transform={`rotate(-45 ${x + bw / 2} ${y - 6})`} x={x + bw / 2} y={y - 6} textAnchor="start" fontSize="10" fontWeight="700" fill="currentColor">{etiket(deger(f))}</text>
                <text transform={`rotate(-45 ${x + bw / 2} 254)`} x={x + bw / 2} y={254} textAnchor="end" fontSize="9.5" fill="currentColor" opacity="0.65">{f.ad.length > 14 ? f.ad.slice(0, 13) + "…" : f.ad}</text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
