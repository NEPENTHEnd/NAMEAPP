"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type Ozet = { sayfa: string; eklenecek: number; zatenVar: number; bosAtlanan: number }
type Ornek = {
  sayfa: string; musteri: string | null; cihaz: string
  gelis: string | null; seri: string | null; servis: string | null
}
type Sonuc = {
  mod?: string
  hata?: string
  toplamOkunan?: number
  toplamEklenecek?: number
  eklenen?: number
  ozet?: Ozet[]
  uyarilar?: string[]
  ornekler?: Ornek[]
}

export function ExcelYukle() {
  const router = useRouter()
  const [dosya, setDosya] = useState<File | null>(null)
  const [uzerinde, setUzerinde] = useState(false)
  const [yukleniyor, setYukleniyor] = useState<"onizleme" | "uygula" | null>(null)
  const [onizleme, setOnizleme] = useState<Sonuc | null>(null)
  const [bitti, setBitti] = useState<Sonuc | null>(null)
  const girisRef = useRef<HTMLInputElement>(null)

  async function gonder(f: File, mod: "onizleme" | "uygula") {
    setYukleniyor(mod)
    if (mod === "onizleme") { setOnizleme(null); setBitti(null) }
    try {
      const fd = new FormData()
      fd.set("dosya", f)
      fd.set("mod", mod)
      const r = await fetch("/api/ice-aktar", { method: "POST", body: fd })
      const j: Sonuc = await r.json()
      if (mod === "onizleme") setOnizleme(j)
      else {
        setBitti(j)
        if (!j.hata) router.refresh()
      }
    } catch {
      const h = { hata: "Sunucuya ulaşılamadı. Dosya çok büyük olabilir." }
      if (mod === "onizleme") setOnizleme(h)
      else setBitti(h)
    } finally {
      setYukleniyor(null)
    }
  }

  function dosyaSec(f: File | null) {
    if (!f) return
    setDosya(f)
    gonder(f, "onizleme")
  }

  function sifirla() {
    setDosya(null); setOnizleme(null); setBitti(null)
    if (girisRef.current) girisRef.current.value = ""
  }

  const eklenecek = onizleme?.toplamEklenecek ?? 0

  return (
    <div className="grid gap-4">
      {/* Sürükle-bırak alanı */}
      <div
        onDragOver={(e) => { e.preventDefault(); setUzerinde(true) }}
        onDragLeave={() => setUzerinde(false)}
        onDrop={(e) => {
          e.preventDefault()
          setUzerinde(false)
          dosyaSec(e.dataTransfer.files?.[0] ?? null)
        }}
        onClick={() => girisRef.current?.click()}
        className={cn(
          "grid cursor-pointer justify-items-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors",
          uzerinde
            ? "border-primary bg-accent"
            : "border-border bg-card hover:border-primary/50 hover:bg-muted/40"
        )}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5-5 5 5" /><path d="M12 5v12" />
        </svg>
        <div className="text-[15px] font-semibold">
          Excel dosyasını buraya sürükleyin
        </div>
        <div className="text-[12.5px] text-muted-foreground">
          ya da tıklayıp seçin — yalnız .xlsx
        </div>
        {dosya && (
          <div className="mt-1 rounded-lg bg-muted px-2.5 py-1 text-[12.5px] font-medium">
            {dosya.name} ({Math.round(dosya.size / 1024)} KB)
          </div>
        )}
        <input
          ref={girisRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => dosyaSec(e.target.files?.[0] ?? null)}
        />
      </div>

      {yukleniyor === "onizleme" && (
        <p className="text-sm text-muted-foreground">Excel okunuyor, karşılaştırılıyor…</p>
      )}

      {/* Hata */}
      {(onizleme?.hata || bitti?.hata) && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {onizleme?.hata ?? bitti?.hata}
        </div>
      )}

      {/* Sonuç */}
      {bitti && !bitti.hata && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="text-[15px] font-semibold text-emerald-700 dark:text-emerald-400">
            ✓ {bitti.eklenen} yeni kayıt eklendi
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Mevcut kayıtların hiçbiri değiştirilmedi.
          </p>
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={sifirla}>
            Yeni dosya yükle
          </Button>
        </div>
      )}

      {/* Önizleme */}
      {onizleme && !onizleme.hata && !bitti && (
        <div className="grid gap-3">
          {onizleme.uyarilar && onizleme.uyarilar.length > 0 && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3">
              <div className="mb-1 text-[13px] font-semibold text-amber-700 dark:text-amber-400">
                Dikkat ({onizleme.uyarilar.length})
              </div>
              <ul className="list-disc space-y-1 pl-5 text-[12.5px]">
                {onizleme.uyarilar.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[15px] font-semibold">
              {eklenecek > 0
                ? `${eklenecek} yeni kayıt eklenecek`
                : "Eklenecek yeni kayıt yok — her şey güncel"}
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Excel'de {onizleme.toplamOkunan} satır okundu. Mevcut kayıtlara
              dokunulmayacak, yalnız eksikler eklenecek.
            </p>

            {onizleme.ozet && onizleme.ozet.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Sekme</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Eklenecek</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Zaten var</th>
                      <th className="py-1.5 text-right font-medium">Boş satır</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onizleme.ozet.map((o) => (
                      <tr key={o.sayfa} className="border-b border-border/50">
                        <td className="py-1.5 pr-3 font-medium">{o.sayfa}</td>
                        <td className={cn("py-1.5 pr-3 text-right tabular-nums",
                          o.eklenecek > 0 && "font-semibold text-emerald-600 dark:text-emerald-400")}>
                          {o.eklenecek || "—"}
                        </td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                          {o.zatenVar || "—"}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                          {o.bosAtlanan || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {onizleme.ornekler && onizleme.ornekler.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[12.5px] font-medium text-primary">
                  Eklenecek kayıtlardan örnekler ({onizleme.ornekler.length})
                </summary>
                <ul className="mt-2 grid gap-1 text-[12px] text-muted-foreground">
                  {onizleme.ornekler.map((o, i) => (
                    <li key={i}>
                      <strong>{o.sayfa}</strong> · {o.musteri ?? "—"} · {o.cihaz}
                      {o.gelis ? ` · ${o.gelis}` : ""}
                      {o.seri ? ` · SN:${o.seri}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={eklenecek === 0 || yukleniyor === "uygula"}
                onClick={() => dosya && gonder(dosya, "uygula")}
              >
                {yukleniyor === "uygula"
                  ? "Ekleniyor…"
                  : `Onayla ve ${eklenecek} kaydı ekle`}
              </Button>
              <Button type="button" variant="ghost" onClick={sifirla}>
                Vazgeç
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
