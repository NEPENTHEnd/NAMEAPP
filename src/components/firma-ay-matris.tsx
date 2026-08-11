"use client"

import { useState } from "react"

// Müdürün Excel "2026_GENEL" takibinin canlı, RENKLİ hâli — Adet / ₺ (ciro) geçişli.
// satır = firma, sütun = 12 ay + özet sütunlar. Excel teal-yeşil paleti + ısı haritası.
// Bu ay AMBER ile öne çıkar. Temadan bağımsız açık "gömülü sayfa" görünümü.

export type MatrisSatir = {
  firma: string
  // Adet (geliş ayına göre)
  aylar: number[]
  toplam: number
  ort: number
  ort2025: number
  degisim: number | null
  // ₺ ciro (fatura ayına göre — yalnız faturalı işler)
  aylarPara: number[]
  toplamPara: number
  ortPara: number
  ort2025Para: number
  degisimPara: number | null
}

const AY_KISA = ["OCA", "ŞUB", "MAR", "NİS", "MAY", "HAZ", "TEM", "AĞU", "EYL", "EKİ", "KAS", "ARA"]

const TEAL = "#356854"
const TEAL_KOYU = "#274d3e"
const ZEBRA = "#f6f8f9"
const CIZGI = "#dfe7e3"
const AMBER = "#f2a900"
const AMBER_KOYU = "#8a5a00"

const tamTutar = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 })
const kisaTutar = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 })

// Isı haritası: açık teal → koyu teal. Küçük değerler de görünür.
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
  const [mod, setMod] = useState<"adet" | "para">("adet")
  const para = mod === "para"

  // Aktif metrik erişimcileri
  const satirAylar = (s: MatrisSatir) => (para ? s.aylarPara : s.aylar)
  const satirToplam = (s: MatrisSatir) => (para ? s.toplamPara : s.toplam)
  const satirOrt = (s: MatrisSatir) => (para ? s.ortPara : s.ort)
  const satirOrt25 = (s: MatrisSatir) => (para ? s.ort2025Para : s.ort2025)
  const satirDeg = (s: MatrisSatir) => (para ? s.degisimPara : s.degisim)
  const ayTop = para ? aylikToplamPara : aylikToplam
  const gTop = para ? genelToplamPara : genelToplam
  const gOrt = para ? genelOrtPara : genelOrt

  // Hücre / özet biçimi
  const hucre = (v: number) => (v > 0 ? (para ? kisaTutar.format(v) : String(v)) : "·")
  const buyuk = (v: number) => (v > 0 ? (para ? tamTutar.format(v) : String(v)) : "—")
  const ortBic = (v: number) => (v > 0 ? (para ? kisaTutar.format(v) : v.toFixed(1)) : "—")

  const maks = Math.max(1, ...satirlar.flatMap((s) => satirAylar(s)))

  const thBase: React.CSSProperties = {
    background: TEAL, color: "#fff", fontWeight: 600, padding: "8px 5px",
    textAlign: "center", fontSize: 11, letterSpacing: ".03em", whiteSpace: "nowrap",
  }
  const ozetTh: React.CSSProperties = { ...thBase, background: TEAL_KOYU }
  const modBtn = (aktif: boolean) =>
    `rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors ${
      aktif ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"
    }`

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
        Renk koyulaştıkça {para ? "yüksek ciro" : "yoğun"} · <span style={{ color: AMBER_KOYU, fontWeight: 600 }}>amber</span> = bu ay
        {para ? " · ay = FATURA ayı, yalnız faturalanan işler" : " · ay = GELİŞ ayı"}
      </p>

      <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${TEAL}`, background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, color: "#0a3d30", fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif", fontVariantNumeric: "tabular-nums" }}>
          <caption className="sr-only">{yil} firma × ay {para ? "ciro" : "iş adedi"} matrisi</caption>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: "left", position: "sticky", left: 0, zIndex: 2, minWidth: 132, paddingLeft: 10 }}>FİRMA</th>
              {AY_KISA.map((a, i) => {
                const bu = aktifAy === i + 1
                return (
                  <th key={a} style={{ ...thBase, background: bu ? AMBER : TEAL, color: bu ? "#3d2800" : "#fff", fontWeight: bu ? 800 : 600 }}>{a}</th>
                )
              })}
              <th style={{ ...ozetTh, minWidth: 64, whiteSpace: "normal" }}>GENEL TOPLAM {yil}</th>
              <th style={{ ...ozetTh, minWidth: 60, whiteSpace: "normal" }}>ORTALAMA {yil}</th>
              <th style={{ ...ozetTh, minWidth: 60, whiteSpace: "normal" }}>ORTALAMA {yil - 1}</th>
              <th style={{ ...ozetTh, minWidth: 64, whiteSpace: "normal" }}>ORTALAMA HEDEF {yil}</th>
              <th style={{ ...ozetTh, minWidth: 62, whiteSpace: "normal" }}>YÜZDESEL DEĞİŞİM</th>
              <th style={{ ...ozetTh, minWidth: 60, whiteSpace: "normal" }}>{yil} HEDEF ARTIŞ</th>
              <th style={{ ...ozetTh, minWidth: 58, whiteSpace: "normal" }}>HEDEF FARKI</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s, r) => {
              const zebra = r % 2 === 1 ? ZEBRA : "#fff"
              const aylar = satirAylar(s)
              const top = satirToplam(s)
              const deg = satirDeg(s)
              const degRenk = deg == null ? "#9a8748" : deg >= 0 ? "#0a7a4f" : "#b3261e"
              return (
                <tr key={s.firma} style={{ opacity: top === 0 ? 0.5 : 1 }}>
                  <th scope="row" style={{ position: "sticky", left: 0, zIndex: 1, background: zebra, color: TEAL_KOYU, fontWeight: 600, textAlign: "left", padding: "5px 10px", maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderRight: `2px solid ${TEAL}`, borderBottom: `1px solid ${CIZGI}` }} title={s.firma}>
                    {s.firma}
                  </th>
                  {aylar.map((n, i) => {
                    const { bg, fg } = isi(n, maks)
                    const bu = aktifAy === i + 1
                    return (
                      <td key={i} style={{ background: bg, color: fg, textAlign: "center", padding: "5px 6px", fontWeight: n > 0 ? 700 : 400, borderBottom: `1px solid ${CIZGI}`, boxShadow: bu ? `inset 2.5px 0 0 ${AMBER}, inset -2.5px 0 0 ${AMBER}` : undefined }}>
                        {hucre(n)}
                      </td>
                    )
                  })}
                  <td style={{ textAlign: "center", padding: "5px 7px", fontWeight: 800, background: "#e7f2ec", color: TEAL_KOYU, borderBottom: `1px solid ${CIZGI}`, borderLeft: `2px solid ${TEAL}`, whiteSpace: "nowrap" }}>{buyuk(top)}</td>
                  <td style={{ textAlign: "center", padding: "5px 7px", fontWeight: 600, background: zebra, color: "#3f5148", borderBottom: `1px solid ${CIZGI}`, whiteSpace: "nowrap" }}>{ortBic(satirOrt(s))}</td>
                  <td style={{ textAlign: "center", padding: "5px 7px", background: zebra, color: "#85938c", borderBottom: `1px solid ${CIZGI}`, whiteSpace: "nowrap" }}>{ortBic(satirOrt25(s))}</td>
                  <td style={{ textAlign: "center", padding: "5px 7px", background: "#fbfbf8", color: "#c2c7c4", borderBottom: `1px solid ${CIZGI}` }}>—</td>
                  <td style={{ textAlign: "center", padding: "5px 7px", background: zebra, color: degRenk, fontWeight: 600, borderBottom: `1px solid ${CIZGI}`, whiteSpace: "nowrap" }}>
                    {deg == null ? "yeni" : `${deg >= 0 ? "+" : ""}${Math.round(deg)}%`}
                  </td>
                  <td style={{ textAlign: "center", padding: "5px 7px", background: "#fbfbf8", color: "#c2c7c4", borderBottom: `1px solid ${CIZGI}` }}>—</td>
                  <td style={{ textAlign: "center", padding: "5px 7px", background: "#fbfbf8", color: "#c2c7c4", borderBottom: `1px solid ${CIZGI}` }}>—</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" style={{ position: "sticky", left: 0, zIndex: 1, background: TEAL, color: "#fff", fontWeight: 800, textAlign: "left", padding: "7px 10px", whiteSpace: "nowrap" }}>GENEL TOPLAM</th>
              {ayTop.map((n, i) => {
                const bu = aktifAy === i + 1
                return (
                  <td key={i} style={{ background: bu ? AMBER : TEAL, color: bu ? "#3d2800" : "#fff", fontWeight: 800, textAlign: "center", padding: "7px 5px", whiteSpace: "nowrap" }}>{n > 0 ? (para ? kisaTutar.format(n) : n) : "·"}</td>
                )
              })}
              <td style={{ background: TEAL_KOYU, color: "#fff", fontWeight: 800, textAlign: "center", padding: "7px 7px", whiteSpace: "nowrap" }}>{para ? tamTutar.format(gTop) : gTop}</td>
              <td style={{ background: TEAL_KOYU, color: "#d7ede4", fontWeight: 700, textAlign: "center", padding: "7px 7px", whiteSpace: "nowrap" }}>{gOrt > 0 ? (para ? kisaTutar.format(gOrt) : gOrt.toFixed(1)) : "—"}</td>
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
