"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { firmaHedefKaydet, type HedefAlan } from "@/app/actions/firma-hedef"

// Müdürün Excel "2026_GENEL" takibinin canlı, RENKLİ hâli — Adet / ₺ (ciro) geçişli.
// ORTALAMA (önceki yıl) ve ORTALAMA HEDEF elle girilir (mod başına); diğer 3 sütun türetilir.

export type HedefDeger = {
  ort_gecen_adet: number | null
  ort_hedef_adet: number | null
  ort_gecen_para: number | null
  ort_hedef_para: number | null
}
export type MatrisSatir = {
  firma: string
  grupId: string | null // null = DİĞER
  aylar: number[]
  toplam: number
  ort: number
  aylarPara: number[]
  toplamPara: number
  ortPara: number
  hedef: HedefDeger
}

const AY_KISA = ["OCA", "ŞUB", "MAR", "NİS", "MAY", "HAZ", "TEM", "AĞU", "EYL", "EKİ", "KAS", "ARA"]

const TEAL = "#356854"
const TEAL_KOYU = "#274d3e"
const ZEBRA = "#f6f8f9"
const CIZGI = "#dfe7e3"
const AMBER = "#f2a900"
const AMBER_KOYU = "#8a5a00"

const tamSayi = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 })
const tamTutar = { format: (v: number) => `${tamSayi.format(v)} TL` }
const kisaTutar = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 })

function isi(n: number, maks: number): { bg: string; fg: string } {
  if (n <= 0) return { bg: ZEBRA, fg: "#b6c2bd" }
  const t = 0.16 + 0.84 * Math.sqrt(n / Math.max(1, maks))
  const a = [225, 245, 238]
  const b = [15, 110, 86]
  const c = a.map((av, i) => Math.round(av + (b[i] - av) * t))
  return { bg: `rgb(${c[0]},${c[1]},${c[2]})`, fg: t > 0.52 ? "#ffffff" : "#0a3d30" }
}

export function FirmaAyMatris({
  yil,
  satirlar,
  aylikToplam,
  genelToplam,
  genelOrt,
  aylikToplamPara,
  genelToplamPara,
  genelOrtPara,
  aktifAy,
}: {
  yil: number
  satirlar: MatrisSatir[]
  aylikToplam: number[]
  genelToplam: number
  genelOrt: number
  aylikToplamPara: number[]
  genelToplamPara: number
  genelOrtPara: number
  aktifAy: number
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [mod, setMod] = useState<"adet" | "para">("para")
  const para = mod === "para"

  // Elle girilen hedef değerleri — yerel state (anında hesap), server'a da yazılır
  const [yerel, setYerel] = useState<Record<string, HedefDeger>>({})
  useEffect(() => {
    const o: Record<string, HedefDeger> = {}
    for (const s of satirlar) o[s.firma] = { ...s.hedef }
    setYerel(o)
  }, [satirlar])

  const gecenAlan: HedefAlan = para ? "ort_gecen_para" : "ort_gecen_adet"
  const hedefAlan: HedefAlan = para ? "ort_hedef_para" : "ort_hedef_adet"
  const oku = (firma: string, alan: HedefAlan): number | null => yerel[firma]?.[alan] ?? null
  function yaz(firma: string, alan: HedefAlan, str: string) {
    const t = str.trim().replace(/\./g, "").replace(",", ".")
    const v = t === "" ? null : Number(t)
    setYerel((p) => ({
      ...p,
      [firma]: { ...(p[firma] ?? { ort_gecen_adet: null, ort_hedef_adet: null, ort_gecen_para: null, ort_hedef_para: null }), [alan]: v == null || isNaN(v) ? null : v },
    }))
  }
  function kaydet(s: MatrisSatir, alan: HedefAlan) {
    const yeni = oku(s.firma, alan)
    if (yeni === (s.hedef[alan] ?? null)) return // değişmedi
    startTransition(async () => {
      await firmaHedefKaydet(s.grupId, yil, alan, yeni)
      router.refresh()
    })
  }

  // Aktif metrik erişimcileri
  const satirAylar = (s: MatrisSatir) => (para ? s.aylarPara : s.aylar)
  const satirToplam = (s: MatrisSatir) => (para ? s.toplamPara : s.toplam)
  const satirOrt = (s: MatrisSatir) => (para ? s.ortPara : s.ort)
  const ayTop = para ? aylikToplamPara : aylikToplam
  const gTop = para ? genelToplamPara : genelToplam
  const gOrt = para ? genelOrtPara : genelOrt

  const hucre = (v: number) => (v > 0 ? (para ? kisaTutar.format(v) : String(v)) : "·")
  const buyuk = (v: number) => (v > 0 ? (para ? tamTutar.format(v) : String(v)) : "—")
  const ortBic = (v: number | null) => (v != null && v > 0 ? (para ? kisaTutar.format(v) : v.toFixed(1)) : "—")
  const bicimSayi = (v: number) => (para ? kisaTutar.format(v) : Number.isInteger(v) ? String(v) : v.toFixed(1))
  const yuzde = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${Math.round(v)}%`)

  const maks = Math.max(1, ...satirlar.flatMap((s) => satirAylar(s)))
  const ayN = aktifAy >= 1 && aktifAy <= 12 ? aktifAy : 12 // yalnız Ocak..bu ay
  const gorunenAylar = AY_KISA.slice(0, ayN)

  const thBase: React.CSSProperties = {
    background: TEAL, color: "#fff", fontWeight: 600, padding: "8px 5px",
    textAlign: "center", fontSize: 11, letterSpacing: ".03em", whiteSpace: "nowrap",
  }
  const ozetTh: React.CSSProperties = { ...thBase, background: TEAL_KOYU }
  const modBtn = (aktif: boolean) =>
    `rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors ${
      aktif ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"
    }`
  const tdBase: React.CSSProperties = { textAlign: "center", padding: "5px 7px", borderBottom: `1px solid ${CIZGI}`, whiteSpace: "nowrap" }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13.5px] font-semibold" style={{ color: TEAL }}>
          {yil} GENEL — Firma × Ay {para ? "(₺ ciro)" : "(iş adedi)"}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMod("adet")} className={modBtn(!para)}>İş adedi</button>
          <button type="button" onClick={() => setMod("para")} className={modBtn(para)}>₺ Ciro</button>
        </div>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        <span style={{ color: AMBER_KOYU, fontWeight: 600 }}>amber</span> = bu ay ·
        {para ? " ay = FATURA kesim ayı (yalnız faturalanan)" : " ay = GELİŞ ayı"} · <b>Ortalama {yil - 1}</b> ve <b>Hedef {yil}</b> hücrelerine
        tıklayıp elle gir ({para ? "₺" : "adet"}); diğer sütunlar otomatik hesaplanır.
      </p>

      <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${TEAL}`, background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, color: "#0a3d30", fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif", fontVariantNumeric: "tabular-nums" }}>
          <caption className="sr-only">{yil} firma × ay {para ? "ciro" : "iş adedi"} matrisi</caption>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: "left", position: "sticky", left: 0, zIndex: 2, minWidth: 132, paddingLeft: 10 }}>FİRMA</th>
              {gorunenAylar.map((a, i) => {
                const bu = aktifAy === i + 1
                return <th key={a} style={{ ...thBase, background: bu ? AMBER : TEAL, color: bu ? "#3d2800" : "#fff", fontWeight: bu ? 800 : 600 }}>{a}</th>
              })}
              <th style={{ ...ozetTh, minWidth: 64, whiteSpace: "normal" }}>GENEL TOPLAM {yil}</th>
              <th style={{ ...ozetTh, minWidth: 60, whiteSpace: "normal" }}>ORTALAMA {yil}</th>
              <th style={{ ...ozetTh, minWidth: 74, whiteSpace: "normal" }}>ORTALAMA {yil - 1} ✎</th>
              <th style={{ ...ozetTh, minWidth: 76, whiteSpace: "normal" }}>ORTALAMA HEDEF {yil} ✎</th>
              <th style={{ ...ozetTh, minWidth: 62, whiteSpace: "normal" }}>YÜZDESEL DEĞİŞİM</th>
              <th style={{ ...ozetTh, minWidth: 62, whiteSpace: "normal" }}>{yil} HEDEF ARTIŞ</th>
              <th style={{ ...ozetTh, minWidth: 58, whiteSpace: "normal" }}>HEDEF FARKI</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s, r) => {
              const zebra = r % 2 === 1 ? ZEBRA : "#fff"
              const aylar = satirAylar(s)
              const top = satirToplam(s)
              const gercekOrt = satirOrt(s)
              const gecen = oku(s.firma, gecenAlan)
              const hedef = oku(s.firma, hedefAlan)
              const yuzdeDeg = gecen != null && gecen !== 0 && hedef != null ? ((hedef - gecen) / gecen) * 100 : null
              const hedefArtis = gecen != null && hedef != null ? hedef - gecen : null
              const hedefFarki = hedef != null && hedef !== 0 ? ((gercekOrt - hedef) / hedef) * 100 : null
              const degR = (v: number | null) => (v == null ? "#9a8748" : v >= 0 ? "#0a7a4f" : "#b3261e")
              const inputStil: React.CSSProperties = { width: "100%", background: "transparent", border: "none", outline: "none", textAlign: "center", color: "#0a3d30", fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }
              return (
                <tr key={s.firma} style={{ opacity: top === 0 && gecen == null && hedef == null ? 0.5 : 1 }}>
                  <th scope="row" style={{ position: "sticky", left: 0, zIndex: 1, background: zebra, color: TEAL_KOYU, fontWeight: 600, textAlign: "left", padding: "5px 10px", maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderRight: `2px solid ${TEAL}`, borderBottom: `1px solid ${CIZGI}` }} title={s.firma}>
                    {s.firma}
                  </th>
                  {aylar.slice(0, ayN).map((n, i) => {
                    const { bg, fg } = isi(n, maks)
                    const bu = aktifAy === i + 1
                    return (
                      <td key={i} style={{ background: bg, color: fg, textAlign: "center", padding: "5px 6px", fontWeight: n > 0 ? 700 : 400, borderBottom: `1px solid ${CIZGI}`, boxShadow: bu ? `inset 2.5px 0 0 ${AMBER}, inset -2.5px 0 0 ${AMBER}` : undefined }}>
                        {hucre(n)}
                      </td>
                    )
                  })}
                  {/* N: GENEL TOPLAM */}
                  <td style={{ ...tdBase, fontWeight: 800, background: "#e7f2ec", color: TEAL_KOYU, borderLeft: `2px solid ${TEAL}` }}>{buyuk(top)}</td>
                  {/* O: ORTALAMA (gerçekleşen) */}
                  <td style={{ ...tdBase, fontWeight: 600, background: zebra, color: "#3f5148" }}>{ortBic(gercekOrt)}</td>
                  {/* P: ORTALAMA {yıl-1} — ELLE */}
                  <td style={{ ...tdBase, padding: 0, background: "#fffdf5" }}>
                    <input inputMode="decimal" value={gecen == null ? "" : String(gecen)} placeholder="gir"
                      onChange={(e) => yaz(s.firma, gecenAlan, e.target.value)}
                      onBlur={() => kaydet(s, gecenAlan)}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                      style={{ ...inputStil, padding: "5px 4px" }} />
                  </td>
                  {/* Q: ORTALAMA HEDEF — ELLE */}
                  <td style={{ ...tdBase, padding: 0, background: "#fffdf5" }}>
                    <input inputMode="decimal" value={hedef == null ? "" : String(hedef)} placeholder="gir"
                      onChange={(e) => yaz(s.firma, hedefAlan, e.target.value)}
                      onBlur={() => kaydet(s, hedefAlan)}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                      style={{ ...inputStil, padding: "5px 4px", color: TEAL_KOYU, fontWeight: 700 }} />
                  </td>
                  {/* R: YÜZDESEL DEĞİŞİM (hedef vs geçen) */}
                  <td style={{ ...tdBase, background: zebra, color: degR(yuzdeDeg), fontWeight: 600 }}>{yuzde(yuzdeDeg)}</td>
                  {/* S: HEDEF ARTIŞ (hedef − geçen, ham) */}
                  <td style={{ ...tdBase, background: zebra, color: "#3f5148" }}>{hedefArtis == null ? "—" : bicimSayi(hedefArtis)}</td>
                  {/* T: HEDEF FARKI (gerçek vs hedef) */}
                  <td style={{ ...tdBase, background: zebra, color: degR(hedefFarki), fontWeight: 600 }}>{yuzde(hedefFarki)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" style={{ position: "sticky", left: 0, zIndex: 1, background: TEAL, color: "#fff", fontWeight: 800, textAlign: "left", padding: "7px 10px", whiteSpace: "nowrap" }}>GENEL TOPLAM</th>
              {ayTop.slice(0, ayN).map((n, i) => {
                const bu = aktifAy === i + 1
                return <td key={i} style={{ background: bu ? AMBER : TEAL, color: bu ? "#3d2800" : "#fff", fontWeight: 800, textAlign: "center", padding: "7px 5px", whiteSpace: "nowrap" }}>{n > 0 ? (para ? kisaTutar.format(n) : n) : "·"}</td>
              })}
              <td style={{ background: TEAL_KOYU, color: "#fff", fontWeight: 800, textAlign: "center", padding: "7px 7px", whiteSpace: "nowrap" }}>{para ? tamTutar.format(gTop) : gTop}</td>
              <td style={{ background: TEAL_KOYU, color: "#d7ede4", fontWeight: 700, textAlign: "center", padding: "7px 7px", whiteSpace: "nowrap" }}>{gOrt > 0 ? (para ? kisaTutar.format(gOrt) : gOrt.toFixed(1)) : "—"}</td>
              <td style={{ background: TEAL_KOYU, color: "#9fbdb0", textAlign: "center", padding: "7px 7px" }}>—</td>
              <td style={{ background: TEAL_KOYU, color: "#9fbdb0", textAlign: "center", padding: "7px 7px" }}>—</td>
              <td style={{ background: TEAL_KOYU, color: "#9fbdb0", textAlign: "center", padding: "7px 7px" }}>—</td>
              <td style={{ background: TEAL_KOYU, color: "#9fbdb0", textAlign: "center", padding: "7px 7px" }}>—</td>
              <td style={{ background: TEAL_KOYU, color: "#9fbdb0", textAlign: "center", padding: "7px 7px" }}>—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
