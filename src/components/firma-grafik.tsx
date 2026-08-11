"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"

export type GrafikNokta = {
  firma: string
  ayKey: string // "2026-07"
  ayAd: string // "Tem"
  adet: number
  tutar: number
  grupId?: string | null // firmaya tıklayınca İşler listesine gitmek için
}
export type SubeNokta = { firma: string; sube: string; ayKey: string; adet: number; tutar: number; subeId?: string }
export type DigerNokta = { musteri: string; ayKey: string; adet: number; tutar: number; musteriId?: string | null }

const GRUPSUZ_AD = "DİĞER" // gruba atanmamış işlerin firma etiketi (page.tsx ile aynı)

const PALET = [
  "#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444",
  "#06b6d4", "#eab308", "#ec4899", "#84cc16", "#f97316",
  "#6366f1", "#14b8a6", "#f43f5e", "#8b5cf6", "#22c55e",
]
const TEAL = "#0e7490"
const KIRMIZI = "#dc2626"

const tamTutar = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 })
const kisaSayi = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 })

type Tip = "aylik" | "yillik" | "balon" | "pasta" | "firmalar"
type Metrik = "adet" | "tutar"
type Pencere = "son1" | "tum"
type Drill = { tur: "kok" } | { tur: "diger" } | { tur: "grupsuz" } | { tur: "firma"; firma: string }

type Hedef = { tur: "grup" | "sube" | "musteri"; id: string }
type BalonHam = { ad: string; adet: number; tutar: number; diger?: boolean; altVar?: boolean; grupsuz?: boolean; hedef?: Hedef }
type Balon = BalonHam & { r: number; x: number; y: number }

// Paketli yerleşim: adet'e göre büyük ORTADA (sabit), küçükler dışa doğru.
function balonYerlesim(items: BalonHam[]): { bubbles: Balon[]; vb: string } {
  if (!items.length) return { bubbles: [], vb: "0 0 200 160" }
  const sirali = [...items].sort((a, b) => b.adet - a.adet)
  const maks = Math.max(1, ...sirali.map((i) => i.adet))
  const rMin = 32
  const rMax = 98
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
  aylar,
  subeNoktalar = [],
  digerNoktalar = [],
}: {
  noktalar: GrafikNokta[]
  aylar: { key: string; ad: string }[]
  subeNoktalar?: SubeNokta[]
  digerNoktalar?: DigerNokta[]
}) {
  const router = useRouter()
  const [tip, setTip] = useState<Tip>("balon")
  const [metrik, setMetrik] = useState<Metrik>("adet")
  const [pencere, setPencere] = useState<Pencere>("son1")
  const [drill, setDrill] = useState<Drill>({ tur: "kok" })
  const [surukle, setSurukle] = useState<{ ad: string; dx: number; dy: number; birak: boolean } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  const deger = (n: { adet: number; tutar: number }) => (metrik === "adet" ? n.adet : n.tutar)
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
  const kapsamDiger = useMemo(
    () => (pencere === "son1" && sonAy ? digerNoktalar.filter((n) => n.ayKey === sonAy) : digerNoktalar),
    [digerNoktalar, pencere, sonAy]
  )

  // Aylık YIĞIN grafik: her ay bir sütun, sütun içi firmalara göre renkli dilimler.
  // "Her şey burada ama düzenli" — tüm firmalar tek bakışta, aya göre.
  const AYLIK_TOP = 9
  const aylikYigin = useMemo(() => {
    const ol = (n: GrafikNokta) => (metrik === "adet" ? n.adet : n.tutar)
    const gorunur = noktalar.filter((n) => aylar.some((a) => a.key === n.ayKey))
    // Firma toplamları (tüm görünen aylar) → en büyük AYLIK_TOP firma + "Diğer"
    const tot = new Map<string, number>()
    for (const n of gorunur) tot.set(n.firma, (tot.get(n.firma) ?? 0) + ol(n))
    const sirali = [...tot.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    const ustAdlar = sirali.slice(0, AYLIK_TOP).map(([ad]) => ad)
    const digerVar = sirali.length > AYLIK_TOP
    const renkMap = new Map(ustAdlar.map((ad, i) => [ad, PALET[i % PALET.length]]))
    const DIGER_RENK = "#94a3b8"
    // Her ay için dilimler (büyük firma altta)
    const kolonlar = aylar.map((a) => {
      const seg: { ad: string; deger: number; renk: string }[] = []
      for (const ad of ustAdlar) {
        const d = gorunur.filter((n) => n.firma === ad && n.ayKey === a.key).reduce((t, n) => t + ol(n), 0)
        if (d > 0) seg.push({ ad, deger: d, renk: renkMap.get(ad) as string })
      }
      if (digerVar) {
        const d = gorunur
          .filter((n) => n.ayKey === a.key && !ustAdlar.includes(n.firma))
          .reduce((t, n) => t + ol(n), 0)
        if (d > 0) seg.push({ ad: "Diğer", deger: d, renk: DIGER_RENK })
      }
      return { ad: a.ad, seg, toplam: seg.reduce((t, s) => t + s.deger, 0) }
    })
    const maxToplam = Math.max(1, ...kolonlar.map((k) => k.toplam))
    const legend = [
      ...ustAdlar.map((ad) => ({ ad, renk: renkMap.get(ad) as string })),
      ...(digerVar ? [{ ad: "Diğer", renk: DIGER_RENK }] : []),
    ]
    return { kolonlar, maxToplam, legend }
  }, [noktalar, aylar, metrik])

  // Yıllık: FİRMA satır, AYLAR renkli yığın (müdür Excel'inin alttaki grafiği).
  // Her firma bir çubuk; içindeki renkli dilimler o firmanın aylık dağılımı.
  const yillikFirma = useMemo(() => {
    const ol = (n: GrafikNokta) => (metrik === "adet" ? n.adet : n.tutar)
    const ayIdx = new Map(aylar.map((a, i) => [a.key, i]))
    const m = new Map<string, number[]>()
    for (const n of noktalar) {
      const i = ayIdx.get(n.ayKey)
      if (i == null) continue
      const arr = m.get(n.firma) ?? new Array(aylar.length).fill(0)
      arr[i] += ol(n)
      m.set(n.firma, arr)
    }
    const list = [...m.entries()]
      .map(([firma, dizi]) => ({ firma, dizi, toplam: dizi.reduce((a, b) => a + b, 0) }))
      .filter((x) => x.toplam > 0)
      .sort((a, b) => b.toplam - a.toplam)
    const maxTot = Math.max(1, ...list.map((x) => x.toplam))
    const ayRenk = aylar.map((_, i) => PALET[i % PALET.length])
    return { list, maxTot, ayRenk }
  }, [noktalar, aylar, metrik])

  // Firma toplamları (adet + tutar + şubesi var mı + grup id)
  const firmaToplam = useMemo(() => {
    const m = new Map<string, { adet: number; tutar: number; grupId: string | null }>()
    for (const n of kapsamNokta) {
      const v = m.get(n.firma) ?? { adet: 0, tutar: 0, grupId: n.grupId ?? null }
      v.adet += n.adet
      v.tutar += n.tutar
      m.set(n.firma, v)
    }
    const subeli = new Set(kapsamSube.map((s) => s.firma))
    const grupsuzVar = kapsamDiger.length > 0
    return [...m.entries()]
      .map(([ad, v]) => ({
        ad,
        adet: v.adet,
        tutar: v.tutar,
        grupId: v.grupId,
        altVar: subeli.has(ad),
        musteriVar: ad === GRUPSUZ_AD && grupsuzVar, // DİĞER içi müşterilere açılır
      }))
      .filter((x) => x.adet > 0)
      .sort((a, b) => b.adet - a.adet)
  }, [kapsamNokta, kapsamSube, kapsamDiger])

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
    // Firma balonu → yaprak mı? (şubesi/müşteri drill'i yoksa) İşler listesine gider
    const firmaItem = (f: (typeof firmaToplam)[number]): BalonHam => ({
      ad: f.ad,
      adet: f.adet,
      tutar: f.tutar,
      altVar: f.altVar,
      grupsuz: f.musteriVar,
      hedef: !f.altVar && !f.musteriVar && f.grupId ? { tur: "grup", id: f.grupId } : undefined,
    })
    if (drill.tur === "firma") {
      const m = new Map<string, { adet: number; tutar: number; subeId?: string }>()
      for (const n of kapsamSube) {
        if (n.firma !== drill.firma) continue
        const v = m.get(n.sube) ?? { adet: 0, tutar: 0, subeId: n.subeId }
        v.adet += n.adet
        v.tutar += n.tutar
        m.set(n.sube, v)
      }
      items = [...m.entries()].map(([ad, v]) => ({
        ad, adet: v.adet, tutar: v.tutar,
        hedef: v.subeId ? { tur: "sube", id: v.subeId } : undefined,
      }))
    } else if (drill.tur === "grupsuz") {
      // DİĞER içi: gruba atanmamış işlerin tek tek MÜŞTERİleri
      const m = new Map<string, { adet: number; tutar: number; musteriId?: string | null }>()
      for (const n of kapsamDiger) {
        const v = m.get(n.musteri) ?? { adet: 0, tutar: 0, musteriId: n.musteriId ?? null }
        v.adet += n.adet
        v.tutar += n.tutar
        m.set(n.musteri, v)
      }
      items = [...m.entries()].map(([ad, v]) => ({
        ad, adet: v.adet, tutar: v.tutar,
        hedef: v.musteriId ? { tur: "musteri", id: v.musteriId } : undefined,
      }))
    } else if (drill.tur === "diger") {
      // "Diğer": TÜM firmalar birlikte — küçükler büyüklerin ETRAFINI doldurur
      items = firmaToplam.map(firmaItem)
    } else {
      items = firmaToplam.slice(0, TOP).map(firmaItem)
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
  }, [drill, firmaToplam, kapsamSube, kapsamDiger])

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

  // Yaprak balon → o firma/şube/müşterinin İşler listesine git (dönem korunur)
  function yaprakGit(hedef: Hedef) {
    const p = new URLSearchParams()
    p.set(hedef.tur, hedef.id) // grup | sube | musteri
    if (pencere === "son1" && sonAy) p.set("ay", sonAy)
    router.push(`/?${p.toString()}`)
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

  // Balon: TEK dokunuş = aç (Diğer/şubeli firma), SÜRÜKLE = taşı + yaylanarak yerine dön.
  function bubbleBasla(bb: Balon, e: React.PointerEvent) {
    if (!svgRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const ctm = svgRef.current.getScreenCTM()
    const ox = ctm && ctm.a ? 1 / ctm.a : 1
    const oy = ctm && ctm.d ? 1 / ctm.d : 1
    const bx = e.clientX
    const by = e.clientY
    let hareket = 0
    setSurukle({ ad: bb.ad, dx: 0, dy: 0, birak: false })
    const move = (ev: PointerEvent) => {
      hareket = Math.max(hareket, Math.hypot(ev.clientX - bx, ev.clientY - by))
      setSurukle({ ad: bb.ad, dx: (ev.clientX - bx) * ox, dy: (ev.clientY - by) * oy, birak: false })
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      const acilir = bb.diger || bb.altVar || bb.grupsuz
      if (hareket < 6 && acilir) {
        // neredeyse hiç hareket yok → TIKLAMA → aç (drill)
        setSurukle(null)
        drilleGit(
          bb.diger ? { tur: "diger" } : bb.grupsuz ? { tur: "grupsuz" } : { tur: "firma", firma: bb.ad }
        )
      } else if (hareket < 6 && bb.hedef) {
        // yaprak balon → o işlerin listesine git
        setSurukle(null)
        yaprakGit(bb.hedef)
      } else {
        setSurukle({ ad: bb.ad, dx: 0, dy: 0, birak: true })
        window.setTimeout(() => setSurukle((s) => (s && s.ad === bb.ad ? null : s)), 420)
      }
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
    drill.tur === "firma"
      ? `${drill.firma} › şubeler`
      : drill.tur === "grupsuz"
        ? "DİĞER › müşteriler"
        : drill.tur === "diger"
          ? "Tüm firmalar"
          : ""

  return (
    <div className="grid gap-4">
      {/* Kontroller */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => setTip("aylik")} className={secBtn(tip === "aylik")}>Aylık</button>
          <button type="button" onClick={() => setTip("yillik")} className={secBtn(tip === "yillik")}>Yıllık</button>
          <button type="button" onClick={() => setTip("balon")} className={secBtn(tip === "balon")}>Balon</button>
          <button type="button" onClick={() => setTip("pasta")} className={secBtn(tip === "pasta")}>Pasta</button>
          <button type="button" onClick={() => setTip("firmalar")} className={secBtn(tip === "firmalar")}>Firmalar</button>
        </div>
        {(tip === "pasta" || tip === "aylik" || tip === "yillik") && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMetrik("adet")} className={secBtn(metrik === "adet")}>İş adedi</button>
            <button type="button" onClick={() => setMetrik("tutar")} className={secBtn(metrik === "tutar")}>Kazanç ₺</button>
          </div>
        )}
        {tip !== "aylik" && tip !== "yillik" && (
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setPencere("son1")} className={secBtn(pencere === "son1")}>Bu ay</button>
            <button type="button" onClick={() => setPencere("tum")} className={secBtn(pencere === "tum")}>Tüm aylar</button>
          </div>
        )}
      </div>

      {/* GRAFİK */}
      {tip === "aylik" ? (
        (() => {
          const W = 760, H = 340
          const padSol = 44, padSag = 16, padUst = 30, padAlt = 30
          const cizH = H - padUst - padAlt
          const cizW = W - padSol - padSag
          const n = aylikYigin.kolonlar.length
          const adim = cizW / Math.max(1, n)
          const bw = Math.min(58, adim * 0.6)
          const taban = padUst + cizH
          const maxT = aylikYigin.maxToplam
          const yEksen = (v: number) => taban - (v / maxT) * cizH
          const eksenEtiket = (v: number) => (metrik === "adet" ? String(Math.round(v)) : kisaSayi.format(v))
          const yuzde = (i: number): number | null => {
            if (i === 0) return null
            const onc = aylikYigin.kolonlar[i - 1].toplam
            if (!onc) return null
            return Math.round(((aylikYigin.kolonlar[i].toplam - onc) / onc) * 100)
          }
          return (
            <div className="grid gap-3">
              {/* Legend — hangi renk hangi firma */}
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11.5px]">
                {aylikYigin.legend.map((l) => (
                  <span key={l.ad} className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: l.renk }} />
                    <span className="max-w-[140px] truncate">{l.ad}</span>
                  </span>
                ))}
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
                {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                  const y = taban - f * cizH
                  return (
                    <g key={f}>
                      <line x1={padSol} y1={y} x2={W - padSag} y2={y} stroke="currentColor" strokeOpacity="0.08" />
                      <text x={padSol - 6} y={y + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.55">{eksenEtiket(maxT * f)}</text>
                    </g>
                  )
                })}
                {aylikYigin.kolonlar.map((k, i) => {
                  const cx = padSol + adim * i + adim / 2
                  const x = cx - bw / 2
                  const p = yuzde(i)
                  let yUst = taban
                  return (
                    <g key={k.ad}>
                      {k.seg.map((s, si) => {
                        const h = (s.deger / maxT) * cizH
                        yUst -= h
                        return (
                          <rect key={s.ad + si} x={x} y={yUst} width={bw} height={Math.max(h, 0)} fill={s.renk} rx={si === k.seg.length - 1 ? 3 : 0} stroke="var(--card)" strokeWidth="0.75">
                            <title>{`${s.ad} · ${k.ad}: ${metrik === "adet" ? `${s.deger} iş` : tamTutar.format(s.deger)}`}</title>
                          </rect>
                        )
                      })}
                      {k.toplam > 0 && (
                        <text x={cx} y={yEksen(k.toplam) - 5} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="currentColor" opacity="0.8">
                          {metrik === "adet" ? k.toplam : kisaSayi.format(k.toplam)}
                        </text>
                      )}
                      {p != null && (
                        <text x={cx} y={yEksen(k.toplam) - 18} textAnchor="middle" fontSize="9" fontWeight="800" fill={p >= 0 ? TEAL : KIRMIZI}>
                          {p >= 0 ? "+" : ""}{p}%
                        </text>
                      )}
                      <text x={cx} y={H - 10} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">{k.ad}</text>
                    </g>
                  )
                })}
                <line x1={padSol} y1={taban} x2={W - padSag} y2={taban} stroke="currentColor" strokeOpacity="0.28" />
              </svg>
              <p className="text-[10.5px] text-muted-foreground">
                Her sütun bir ay; renkli dilimler firmalar (küçükler «Diğer»). Üstteki % = önceki aya göre toplam değişim · ölçü: {metrik === "adet" ? "iş adedi" : "kazanç ₺"}.
              </p>
            </div>
          )
        })()
      ) : tip === "yillik" ? (
        /* Yıllık: FİRMA çubukları, içleri AYLARA göre renkli (müdür Excel'inin alt grafiği) */
        <div className="grid gap-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {aylar.map((a, i) => (
              <span key={a.key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px]" style={{ background: yillikFirma.ayRenk[i] }} />
                {a.ad}
              </span>
            ))}
          </div>
          {yillikFirma.list.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Bu yıl veri yok.</p>
          )}
          {yillikFirma.list.map((f) => (
            <div
              key={f.firma}
              className="flex items-center gap-2.5 text-[12.5px]"
              title={`${f.firma}: ${metrik === "adet" ? `${f.toplam} iş` : tamTutar.format(f.toplam)}`}
            >
              <span className="w-36 shrink-0 truncate text-right font-medium">{f.firma}</span>
              <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted/40">
                <div className="flex h-full" style={{ width: `${Math.max(2, (f.toplam / yillikFirma.maxTot) * 100)}%` }}>
                  {f.dizi.map((n, i) =>
                    n > 0 ? (
                      <div
                        key={i}
                        style={{ width: `${(n / f.toplam) * 100}%`, background: yillikFirma.ayRenk[i] }}
                        title={`${aylar[i].ad}: ${metrik === "adet" ? `${n} iş` : tamTutar.format(n)}`}
                      />
                    ) : null
                  )}
                </div>
              </div>
              <span className="w-14 shrink-0 text-right font-semibold tabular-nums">
                {metrik === "adet" ? f.toplam : kisaSayi.format(f.toplam)}
              </span>
            </div>
          ))}
          <p className="text-[10.5px] text-muted-foreground">
            Her çubuk bir firma; renkli dilimler aylar (tüm yıl). Ölçü: {metrik === "adet" ? "iş adedi" : "kazanç ₺"}.
          </p>
        </div>
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
            {drill.tur !== "kok" && (
              <span className="text-[11.5px] text-muted-foreground">{drillBaslik}</span>
            )}
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
              className="h-[520px] w-full cursor-grab touch-none select-none animate-[balonGir_.5s_ease-out] active:cursor-grabbing"
              preserveAspectRatio="xMidYMid meet"
            >
              {balon.bubbles.map((bb, i) => {
                const renk = bb.diger ? "#64748b" : PALET[i % PALET.length]
                const acilir = bb.diger || bb.altVar || bb.grupsuz
                const suruklenen = surukle?.ad === bb.ad
                const buyuk = bb.r >= 40
                const orta = bb.r >= 20
                const anaBoyut = Math.max(9, Math.min(18, bb.r * 0.32))
                const altBoyut = Math.max(7, Math.min(12, bb.r * 0.2))
                const adBoyut = Math.max(7, Math.min(11, bb.r * 0.19))
                const adUzun = Math.max(6, Math.floor(bb.r / 5)) // sığacak isim uzunluğu
                return (
                  <g key={bb.ad} transform={`translate(${bb.x} ${bb.y})`}>
                    <g
                      onPointerDown={(e) => bubbleBasla(bb, e)}
                      className={cn("hover:brightness-110", acilir || bb.hedef ? "cursor-pointer" : "cursor-grab active:cursor-grabbing")}
                      style={{
                        animation: suruklenen ? "none" : `balonYuz ${(2.6 + (i % 4) * 0.5).toFixed(1)}s ease-in-out ${(i * 0.11).toFixed(2)}s infinite`,
                        transform: suruklenen ? `translate(${surukle!.dx}px, ${surukle!.dy}px)` : undefined,
                        transition: suruklenen && surukle!.birak ? "transform .42s cubic-bezier(.34,1.56,.64,1)" : "none",
                      }}
                    >
                      <circle r={bb.r} fill={renk} style={{ filter: "drop-shadow(0 4px 9px rgba(2,6,23,.24))" }} />
                      <circle cx={-bb.r * 0.3} cy={-bb.r * 0.34} r={bb.r * 0.3} fill="#ffffff" opacity="0.18" />
                      {/* Şubeli firma / DİĞER: kesikli halka = "içi açılır" */}
                      {(bb.altVar || bb.grupsuz) && <circle r={bb.r - 4} fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="4 4" />}
                      {orta && (
                        <g pointerEvents="none">
                          {bb.diger ? (
                            <>
                              <text textAnchor="middle" y={-2} fontSize={anaBoyut} fontWeight="800" fill="#fff">Diğer</text>
                              <text textAnchor="middle" y={anaBoyut * 0.7 + 4} fontSize={altBoyut} fill="#fff" opacity="0.9">firmalar →</text>
                            </>
                          ) : (
                            <>
                              {/* İSİM — her balonda (küçükte kısaltılır) */}
                              <text textAnchor="middle" y={-bb.r * 0.34} fontSize={adBoyut} fontWeight="600" fill="#fff" opacity="0.95">
                                {bb.ad.length > adUzun ? bb.ad.slice(0, adUzun - 1) + "…" : bb.ad}
                              </text>
                              <text textAnchor="middle" y={-bb.r * 0.02} fontSize={anaBoyut} fontWeight="800" fill="#fff">{bb.adet} iş</text>
                              {buyuk && bb.tutar > 0 && (
                                <text textAnchor="middle" y={bb.r * 0.28} fontSize={altBoyut} fill="#fff" opacity="0.9">{kisaSayi.format(bb.tutar)} ₺</text>
                              )}
                              {/* İpucu — şubeli/DİĞER içine açılır; yaprak → işlere gider */}
                              {(bb.grupsuz || bb.altVar || bb.hedef) && (
                                <text textAnchor="middle" y={bb.r * 0.52} fontSize={altBoyut} fill="#fff" opacity="0.85">
                                  ▸ {bb.grupsuz ? "müşteriler" : bb.altVar ? "şubeler" : "işler"}
                                </text>
                              )}
                            </>
                          )}
                        </g>
                      )}
                      <title>{`${bb.ad}: ${bb.adet} iş · ${tamTutar.format(bb.tutar)}${bb.altVar ? " · tıkla → şubeler" : bb.grupsuz ? " · tıkla → müşteriler" : bb.hedef ? " · tıkla → işleri gör" : ""}`}</title>
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
        /* Tüm firmalar — yatay bar, iş adedi + kazanç birlikte (profesyonel, okunur) */
        <div className="grid gap-1.5">
          {firmaToplam.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Bu aralıkta veri yok.</p>}
          {firmaToplam.map((f, i) => {
            const w = Math.max(3, (f.adet / (firmaToplam[0]?.adet || 1)) * 100)
            return (
              <div key={f.ad} className="flex items-center gap-2.5 text-[12.5px]" title={`${f.ad}: ${f.adet} iş · ${tamTutar.format(f.tutar)}`}>
                <span className="flex w-36 shrink-0 items-center justify-end gap-1 truncate text-right font-medium">
                  {f.altVar && <span className="text-[10px] text-primary">▸</span>}
                  <span className="truncate">{f.ad}</span>
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted/50">
                  <div className="h-full rounded-md transition-all" style={{ width: `${w}%`, background: PALET[i % PALET.length] }} />
                </div>
                <span className="w-14 shrink-0 text-right font-semibold tabular-nums">{f.adet} iş</span>
                <span className="w-20 shrink-0 text-right font-mono text-[11.5px] tabular-nums text-muted-foreground">
                  {f.tutar > 0 ? kisaSayi.format(f.tutar) + " ₺" : "—"}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
