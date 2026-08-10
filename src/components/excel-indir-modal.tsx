"use client"

import { useEffect, useState } from "react"

type Secenek = { id: string; ad: string }
type Ay = { key: string; label: string }

// "Firmaya/aya/duruma özel Excel" — küçük tuş + filtre penceresi.
// Querystring YALNIZ bu penceredeki 4 alandan kurulur (sayfa filtreleri sızmaz).
export function ExcelIndirModal({
  gruplar,
  durumlar,
  faturaDurumlari,
  aylar,
  defGrup = "",
  defAy = "",
  defDurum = "",
  defFatura = "",
}: {
  gruplar: Secenek[]
  durumlar: Secenek[]
  faturaDurumlari: Secenek[]
  aylar: Ay[]
  defGrup?: string
  defAy?: string
  defDurum?: string
  defFatura?: string
}) {
  const [acik, setAcik] = useState(false)
  const [grup, setGrup] = useState(defGrup)
  const [ay, setAy] = useState(defAy)
  const [durum, setDurum] = useState(defDurum)
  const [fatura, setFatura] = useState(defFatura)

  // Açılışta güncel görünümün filtrelerini varsayılan al
  useEffect(() => {
    if (acik) {
      setGrup(defGrup)
      setAy(defAy)
      setDurum(defDurum)
      setFatura(defFatura)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik])

  // Esc ile kapat
  useEffect(() => {
    if (!acik) return
    const h = (e: KeyboardEvent) => e.key === "Escape" && setAcik(false)
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [acik])

  function indir() {
    const p = new URLSearchParams()
    if (grup) p.set("grup", grup)
    if (ay) p.set("ay", ay)
    if (durum) p.set("durum", durum)
    if (fatura) p.set("fatura", fatura)
    const qs = p.toString()
    window.location.href = `/raporlar/disa-aktar${qs ? `?${qs}` : ""}`
    setAcik(false)
  }

  const selCls =
    "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none transition focus:border-primary"

  const firmaAd = grup === "diger" ? "DİĞER" : gruplar.find((g) => g.id === grup)?.ad ?? "Tüm firmalar"

  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(true)}
        title="Firmaya/aya/duruma özel Excel indir"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300/60 bg-card px-2.5 text-[12.5px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        Excel
      </button>

      {acik && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAcik(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Excel indir</h2>
              <button
                type="button"
                onClick={() => setAcik(false)}
                title="Kapat"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="mb-4 text-[11.5px] text-muted-foreground">
              Sadece seçtiklerin iner. Boş bırakılan = tümü.
            </p>

            <div className="grid gap-3">
              <label className="grid gap-1 text-[12px] font-medium text-muted-foreground">
                Firma
                <select className={selCls} value={grup} onChange={(e) => setGrup(e.target.value)}>
                  <option value="">Tüm firmalar</option>
                  <option value="diger">DİĞER (grupsuz)</option>
                  {gruplar.map((g) => (
                    <option key={g.id} value={g.id}>{g.ad}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-[12px] font-medium text-muted-foreground">
                Ay
                <select className={selCls} value={ay} onChange={(e) => setAy(e.target.value)}>
                  <option value="">Tüm aylar</option>
                  {aylar.map((a) => (
                    <option key={a.key} value={a.key}>{a.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-[12px] font-medium text-muted-foreground">
                Durum
                <select className={selCls} value={durum} onChange={(e) => setDurum(e.target.value)}>
                  <option value="">Tüm durumlar</option>
                  {durumlar.map((d) => (
                    <option key={d.id} value={d.id}>{d.ad}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-[12px] font-medium text-muted-foreground">
                Fatura durumu
                <select className={selCls} value={fatura} onChange={(e) => setFatura(e.target.value)}>
                  <option value="">Tüm fatura durumları</option>
                  {faturaDurumlari.map((f) => (
                    <option key={f.id} value={f.id}>{f.ad}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">
                {firmaAd}
                {ay ? ` · ${aylar.find((a) => a.key === ay)?.label ?? ay}` : ""}
              </span>
              <button
                type="button"
                onClick={indir}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                İndir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
