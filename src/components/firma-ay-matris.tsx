// Müdürün Excel "2026_GENEL" takibinin canlı, RENKLİ hâli:
// satır = firma, sütun = 12 ay, hücre = iş adedi. Excel paleti (teal-yeşil başlık
// #356854 + ısı haritası). Temadan bağımsız açık "gömülü sayfa" görünümü.

export type MatrisSatir = {
  firma: string
  aylar: number[] // 12 eleman (Ocak..Aralık)
  toplam: number
  ort: number
}

const AY_KISA = ["OCA", "ŞUB", "MAR", "NİS", "MAY", "HAZ", "TEM", "AĞU", "EYL", "EKİ", "KAS", "ARA"]

// Excel teal-yeşil ailesi
const TEAL = "#356854" // başlık / toplam satırı
const TEAL_KOYU = "#274d3e"
const ZEBRA = "#f6f8f9"
const CIZGI = "#dfe7e3"

// Isı haritası: açık teal → koyu teal (Excel ailesi). Küçük değerler de görünür.
function isi(n: number, maks: number): { bg: string; fg: string } {
  if (n <= 0) return { bg: ZEBRA, fg: "#b6c2bd" }
  const t = 0.16 + 0.84 * Math.sqrt(n / Math.max(1, maks))
  const a = [225, 245, 238] // #E1F5EE
  const b = [15, 110, 86] // #0F6E56
  const c = a.map((av, i) => Math.round(av + (b[i] - av) * t))
  return { bg: `rgb(${c[0]},${c[1]},${c[2]})`, fg: t > 0.52 ? "#ffffff" : "#0a3d30" }
}

export function FirmaAyMatris({
  yil,
  satirlar,
  aylikToplam,
  genelToplam,
  genelOrt,
  aktifAy, // 1-12 → o sütun işaretlenir
}: {
  yil: number
  satirlar: MatrisSatir[]
  aylikToplam: number[]
  genelToplam: number
  genelOrt: number
  aktifAy: number
}) {
  const maks = Math.max(1, ...satirlar.flatMap((s) => s.aylar))

  const thBase: React.CSSProperties = {
    background: TEAL,
    color: "#fff",
    fontWeight: 600,
    padding: "7px 5px",
    textAlign: "center",
    fontSize: 11,
    letterSpacing: ".02em",
    whiteSpace: "nowrap",
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[13.5px] font-semibold" style={{ color: TEAL }}>
          {yil} GENEL — Firma × Ay (iş adedi)
        </div>
        <div className="text-[11px] text-muted-foreground">
          Renk koyulaştıkça iş yoğun · sarı çizgi = bu ay · Ort./ay = geçen aylara bölünür
        </div>
      </div>

      {/* Gömülü "Excel sayfası": sabit açık palet, temadan bağımsız */}
      <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${TEAL}`, background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5, color: "#0a3d30" }}>
          <caption className="sr-only">{yil} firma × ay iş adedi matrisi</caption>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: "left", position: "sticky", left: 0, zIndex: 2, minWidth: 128 }}>
                FİRMA
              </th>
              {AY_KISA.map((a, i) => (
                <th
                  key={a}
                  style={{
                    ...thBase,
                    background: aktifAy === i + 1 ? TEAL_KOYU : TEAL,
                    borderBottom: aktifAy === i + 1 ? "2px solid #f5b400" : undefined,
                  }}
                >
                  {a}
                </th>
              ))}
              <th style={{ ...thBase, background: TEAL_KOYU }}>TOP</th>
              <th style={{ ...thBase, background: TEAL_KOYU }}>ORT/AY</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s, r) => {
              const zebra = r % 2 === 1 ? ZEBRA : "#fff"
              return (
                <tr key={s.firma} style={{ opacity: s.toplam === 0 ? 0.55 : 1 }}>
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
                      padding: "4px 8px",
                      maxWidth: 150,
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
                    return (
                      <td
                        key={i}
                        style={{
                          background: bg,
                          color: fg,
                          textAlign: "center",
                          padding: "4px 5px",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: n > 0 ? 600 : 400,
                          borderBottom: `1px solid ${CIZGI}`,
                          boxShadow: aktifAy === i + 1 ? "inset 2px 0 0 rgba(245,180,0,.6), inset -2px 0 0 rgba(245,180,0,.6)" : undefined,
                        }}
                      >
                        {n > 0 ? n : "·"}
                      </td>
                    )
                  })}
                  <td
                    style={{
                      textAlign: "center",
                      padding: "4px 6px",
                      fontWeight: 700,
                      background: "#e7f2ec",
                      color: TEAL_KOYU,
                      fontVariantNumeric: "tabular-nums",
                      borderBottom: `1px solid ${CIZGI}`,
                      borderLeft: `2px solid ${TEAL}`,
                    }}
                  >
                    {s.toplam || "—"}
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      padding: "4px 6px",
                      background: zebra,
                      color: "#5f7169",
                      fontVariantNumeric: "tabular-nums",
                      borderBottom: `1px solid ${CIZGI}`,
                    }}
                  >
                    {s.ort > 0 ? s.ort.toFixed(1) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                style={{
                  position: "sticky",
                  left: 0,
                  zIndex: 1,
                  background: TEAL,
                  color: "#fff",
                  fontWeight: 700,
                  textAlign: "left",
                  padding: "6px 8px",
                  whiteSpace: "nowrap",
                }}
              >
                GENEL TOPLAM
              </th>
              {aylikToplam.map((n, i) => (
                <td
                  key={i}
                  style={{
                    background: aktifAy === i + 1 ? TEAL_KOYU : TEAL,
                    color: "#fff",
                    fontWeight: 700,
                    textAlign: "center",
                    padding: "6px 5px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {n || "·"}
                </td>
              ))}
              <td style={{ background: TEAL_KOYU, color: "#fff", fontWeight: 700, textAlign: "center", padding: "6px 6px", fontVariantNumeric: "tabular-nums" }}>
                {genelToplam}
              </td>
              <td style={{ background: TEAL_KOYU, color: "#d7ede4", fontWeight: 700, textAlign: "center", padding: "6px 6px", fontVariantNumeric: "tabular-nums" }}>
                {genelOrt > 0 ? genelOrt.toFixed(1) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
