import { cn } from "@/lib/utils"

// Müdürün Excel "2026_GENEL" takibinin canlı hâli:
// satır = firma, sütun = 12 ay, hücre = o ay o firmadaki iş adedi.
export type MatrisSatir = {
  firma: string
  aylar: number[] // 12 eleman (Ocak..Aralık)
  toplam: number
  ort: number // ortalama ay (geçmiş ay sayısına bölünür)
}

const AY_KISA = ["OCA", "ŞUB", "MAR", "NİS", "MAY", "HAZ", "TEM", "AĞU", "EYL", "EKİ", "KAS", "ARA"]

export function FirmaAyMatris({
  yil,
  satirlar,
  aylikToplam,
  genelToplam,
  genelOrt,
  aktifAy, // 1-12 → o sütun vurgulanır (0 = yok)
}: {
  yil: number
  satirlar: MatrisSatir[]
  aylikToplam: number[]
  genelToplam: number
  genelOrt: number
  aktifAy: number
}) {
  const sayi = (n: number, dim = true) =>
    n > 0 ? (
      <span className="tabular-nums">{n}</span>
    ) : (
      <span className={cn("tabular-nums", dim && "text-muted-foreground/30")}>·</span>
    )

  const ayBaslik = (i: number) =>
    cn(
      "px-2 py-1.5 text-center text-[11px] font-semibold",
      aktifAy === i + 1 && "bg-primary/10 text-primary"
    )
  const ayHucre = (i: number) =>
    cn("px-2 py-1 text-center", aktifAy === i + 1 && "bg-primary/5")

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[13.5px] font-semibold">{yil} GENEL — Firma × Ay (iş adedi)</div>
        <div className="text-[11px] text-muted-foreground">
          Tüm yıl · geliş tarihine göre · Ort./ay = geçen aylara bölünür
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 z-10 bg-muted/40 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                Firma
              </th>
              {AY_KISA.map((a, i) => (
                <th key={a} className={ayBaslik(i)}>
                  {a}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase">Toplam</th>
              <th className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase text-muted-foreground">
                Ort./ay
              </th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s, r) => (
              <tr
                key={s.firma}
                className={cn(
                  "border-b border-border/60 last:border-0",
                  r % 2 === 1 && "bg-muted/20",
                  s.toplam === 0 && "opacity-50"
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 max-w-[170px] truncate px-2 py-1 text-left font-medium",
                    r % 2 === 1 ? "bg-[color-mix(in_oklab,var(--muted)_20%,var(--card))]" : "bg-card"
                  )}
                  title={s.firma}
                >
                  {s.firma}
                </th>
                {s.aylar.map((n, i) => (
                  <td key={i} className={ayHucre(i)}>
                    {sayi(n)}
                  </td>
                ))}
                <td className="px-2 py-1 text-center font-semibold tabular-nums">{s.toplam || "—"}</td>
                <td className="px-2 py-1 text-center tabular-nums text-muted-foreground">
                  {s.ort > 0 ? s.ort.toFixed(1) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/50 font-semibold">
              <th className="sticky left-0 z-10 bg-muted/50 px-2 py-1.5 text-left uppercase">
                Genel Toplam
              </th>
              {aylikToplam.map((n, i) => (
                <td key={i} className={cn("px-2 py-1.5 text-center tabular-nums", aktifAy === i + 1 && "bg-primary/10 text-primary")}>
                  {n || "·"}
                </td>
              ))}
              <td className="px-2 py-1.5 text-center tabular-nums text-primary">{genelToplam}</td>
              <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                {genelOrt > 0 ? genelOrt.toFixed(1) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
