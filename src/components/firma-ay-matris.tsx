// Müdürün Excel "2026_GENEL" takibinin canlı, RENKLİ hâli:
// satır = firma, sütun = 12 ay + özet sütunlar. Excel teal-yeşil paleti + ısı haritası.
// Bu ay AMBER ile öne çıkar. Temadan bağımsız açık "gömülü sayfa" görünümü.

export type MatrisSatir = {
  firma: string
  aylar: number[] // 12 eleman (Ocak..Aralık)
  toplam: number // GENEL TOPLAM 2026
  ort: number // ORTALAMA 2026 (geçen aylara bölünür)
  ort2025: number // ORTALAMA 2025 (kısmi veri)
  degisim: number | null // % değişim 2026 vs 2025 (null → yeni)
}

const AY_KISA = ["OCA", "ŞUB", "MAR", "NİS", "MAY", "HAZ", "TEM", "AĞU", "EYL", "EKİ", "KAS", "ARA"]

// Excel teal-yeşil ailesi + amber (bu ay)
const TEAL = "#356854"
const TEAL_KOYU = "#274d3e"
const ZEBRA = "#f6f8f9"
const CIZGI = "#dfe7e3"
const AMBER = "#f2a900"
const AMBER_KOYU = "#8a5a00"

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
  aktifAy, // 1-12 → o sütun AMBER ile işaretlenir
}: {
  yil: number
  satirlar: MatrisSatir[]
  aylikToplam: number[]
  genelToplam: number
  genelOrt: number
  aktifAy: number
}) {
  const maks = Math.max(1, ...satirlar.flatMap((s) => s.aylar))
  const tabanFont: React.CSSProperties = {
    fontFamily: "'Inter', ui-sans-serif, system-ui, 'Segoe UI', Roboto, Arial, sans-serif",
    fontFeatureSettings: '"tnum" 1, "cv01" 1',
  }
  const thBase: React.CSSProperties = {
    background: TEAL,
    color: "#fff",
    fontWeight: 600,
    padding: "8px 5px",
    textAlign: "center",
    fontSize: 11,
    letterSpacing: ".03em",
    whiteSpace: "nowrap",
  }
  const ozetTh: React.CSSProperties = { ...thBase, background: TEAL_KOYU }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[13.5px] font-semibold" style={{ color: TEAL }}>
          {yil} GENEL — Firma × Ay iş adedi
        </div>
        <div className="text-[11px] text-muted-foreground">
          Renk koyulaştıkça yoğun · <span style={{ color: AMBER_KOYU, fontWeight: 600 }}>amber</span> = bu ay ·
          % değişim 2026↔2025
        </div>
      </div>

      {/* Gömülü "Excel sayfası": sabit açık palet, temadan bağımsız */}
      <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${TEAL}`, background: "#fff" }}>
        <table style={{ ...tabanFont, borderCollapse: "collapse", width: "100%", fontSize: 12, color: "#0a3d30" }}>
          <caption className="sr-only">{yil} firma × ay iş adedi matrisi</caption>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: "left", position: "sticky", left: 0, zIndex: 2, minWidth: 132, paddingLeft: 10 }}>
                FİRMA
              </th>
              {AY_KISA.map((a, i) => {
                const bu = aktifAy === i + 1
                return (
                  <th
                    key={a}
                    style={{
                      ...thBase,
                      background: bu ? AMBER : TEAL,
                      color: bu ? "#3d2800" : "#fff",
                      fontWeight: bu ? 800 : 600,
                    }}
                  >
                    {a}
                  </th>
                )
              })}
              <th style={{ ...ozetTh, minWidth: 64, whiteSpace: "normal" }}>GENEL TOPLAM 2026</th>
              <th style={{ ...ozetTh, minWidth: 60, whiteSpace: "normal" }}>ORTALAMA 2026</th>
              <th style={{ ...ozetTh, minWidth: 60, whiteSpace: "normal" }}>ORTALAMA 2025</th>
              <th style={{ ...ozetTh, minWidth: 64, whiteSpace: "normal" }}>ORTALAMA HEDEF 2026</th>
              <th style={{ ...ozetTh, minWidth: 62, whiteSpace: "normal" }}>YÜZDESEL DEĞİŞİM</th>
              <th style={{ ...ozetTh, minWidth: 60, whiteSpace: "normal" }}>2026 HEDEF ARTIŞ</th>
              <th style={{ ...ozetTh, minWidth: 58, whiteSpace: "normal" }}>HEDEF FARKI</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s, r) => {
              const zebra = r % 2 === 1 ? ZEBRA : "#fff"
              const degRenk = s.degisim == null ? "#9a8748" : s.degisim >= 0 ? "#0a7a4f" : "#b3261e"
              return (
                <tr key={s.firma} style={{ opacity: s.toplam === 0 ? 0.5 : 1 }}>
                  <th
                    scope="row"
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 1,
                      background: zebra,
                      color: TEAL_KOYU,
                      fontWeight: 600,
                      textAlign: "left",
                      padding: "5px 10px",
                      maxWidth: 160,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      borderRight: `2px solid ${TEAL}`,
                      borderBottom: `1px solid ${CIZGI}`,
                    }}
                    title={s.firma}
                  >
                    {s.firma}
                  </th>
                  {s.aylar.map((n, i) => {
                    const { bg, fg } = isi(n, maks)
                    const bu = aktifAy === i + 1
                    return (
                      <td
                        key={i}
                        style={{
                          background: bg,
                          color: fg,
                          textAlign: "center",
                          padding: "5px 6px",
                          fontWeight: n > 0 ? 700 : 400,
                          borderBottom: `1px solid ${CIZGI}`,
                          boxShadow: bu ? `inset 2.5px 0 0 ${AMBER}, inset -2.5px 0 0 ${AMBER}` : undefined,
                        }}
                      >
                        {n > 0 ? n : "·"}
                      </td>
                    )
                  })}
                  {/* N: GENEL TOPLAM 2026 */}
                  <td style={{ textAlign: "center", padding: "5px 7px", fontWeight: 800, background: "#e7f2ec", color: TEAL_KOYU, borderBottom: `1px solid ${CIZGI}`, borderLeft: `2px solid ${TEAL}` }}>
                    {s.toplam || "—"}
                  </td>
                  {/* O: ORTALAMA 2026 */}
                  <td style={{ textAlign: "center", padding: "5px 7px", fontWeight: 600, background: zebra, color: "#3f5148", borderBottom: `1px solid ${CIZGI}` }}>
                    {s.ort > 0 ? s.ort.toFixed(1) : "—"}
                  </td>
                  {/* P: ORTALAMA 2025 */}
                  <td style={{ textAlign: "center", padding: "5px 7px", background: zebra, color: "#85938c", borderBottom: `1px solid ${CIZGI}` }}>
                    {s.ort2025 > 0 ? s.ort2025.toFixed(1) : "—"}
                  </td>
                  {/* Q: ORTALAMA HEDEF 2026 (müdür elle doldurur — Excel'de de boş) */}
                  <td style={{ textAlign: "center", padding: "5px 7px", background: "#fbfbf8", color: "#c2c7c4", borderBottom: `1px solid ${CIZGI}` }}>—</td>
                  {/* R: YÜZDESEL DEĞİŞİM */}
                  <td style={{ textAlign: "center", padding: "5px 7px", background: zebra, color: degRenk, fontWeight: 600, borderBottom: `1px solid ${CIZGI}`, whiteSpace: "nowrap" }}>
                    {s.degisim == null ? "yeni" : `${s.degisim >= 0 ? "+" : ""}${Math.round(s.degisim)}%`}
                  </td>
                  {/* S: 2026 HEDEF ARTIŞ (Excel'de boş) */}
                  <td style={{ textAlign: "center", padding: "5px 7px", background: "#fbfbf8", color: "#c2c7c4", borderBottom: `1px solid ${CIZGI}` }}>—</td>
                  {/* T: HEDEF FARKI (Excel'de boş) */}
                  <td style={{ textAlign: "center", padding: "5px 7px", background: "#fbfbf8", color: "#c2c7c4", borderBottom: `1px solid ${CIZGI}` }}>—</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" style={{ position: "sticky", left: 0, zIndex: 1, background: TEAL, color: "#fff", fontWeight: 800, textAlign: "left", padding: "7px 10px", whiteSpace: "nowrap" }}>
                GENEL TOPLAM
              </th>
              {aylikToplam.map((n, i) => {
                const bu = aktifAy === i + 1
                return (
                  <td key={i} style={{ background: bu ? AMBER : TEAL, color: bu ? "#3d2800" : "#fff", fontWeight: 800, textAlign: "center", padding: "7px 5px" }}>
                    {n || "·"}
                  </td>
                )
              })}
              <td style={{ background: TEAL_KOYU, color: "#fff", fontWeight: 800, textAlign: "center", padding: "7px 7px" }}>{genelToplam}</td>
              <td style={{ background: TEAL_KOYU, color: "#d7ede4", fontWeight: 700, textAlign: "center", padding: "7px 7px" }}>{genelOrt > 0 ? genelOrt.toFixed(1) : "—"}</td>
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
