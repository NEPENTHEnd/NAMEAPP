"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { tint } from "@/components/rozet"
import { cozumle, ustYaziRengi, type HizliAyar, type HizliOge } from "@/lib/hizli-filtre"
import { hizliFiltreKaydet } from "@/app/actions/tercih"

type Satir = { buton: boolean; renk: string }

const GRUPLAR: { tur: HizliOge["tur"]; baslik: string }[] = [
  { tur: "durum", baslik: "İş durumları" },
  { tur: "ozel", baslik: "Özel filtreler" },
  { tur: "fatura", baslik: "Fatura durumları" },
]

// Ayarlar → Filtre Butonları: her yönetici kendi iş listesi şeridini ayarlar.
// "Buton" = üst şeritte görünür; "Filtre içinde" = Filtre tuşunun panelinde durur.
// Renk varsayılanı durumun kendi rengi (tablodaki rozetle aynı).
export function HizliFiltreAyari({ ogeler, ayar }: { ogeler: HizliOge[]; ayar: HizliAyar | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mesaj, setMesaj] = useState<{ ok: boolean; metin: string } | null>(null)

  const baslangic = useMemo(() => {
    const o: Record<string, Satir> = {}
    for (const og of ogeler) o[og.anahtar] = cozumle(og, ayar)
    return o
  }, [ogeler, ayar])
  const [durum, setDurum] = useState<Record<string, Satir>>(baslangic)
  const degisti = ogeler.some(
    (o) => durum[o.anahtar].buton !== baslangic[o.anahtar].buton || durum[o.anahtar].renk !== baslangic[o.anahtar].renk
  )

  function guncelle(anahtar: string, yama: Partial<Satir>) {
    setMesaj(null)
    setDurum((p) => ({ ...p, [anahtar]: { ...p[anahtar], ...yama } }))
  }

  function kaydet(yeni: Record<string, Satir>) {
    setMesaj(null)
    startTransition(async () => {
      const s = await hizliFiltreKaydet(yeni)
      setMesaj(s.ok ? { ok: true, metin: "Kaydedildi. İş listesi artık bu düzende görünecek." } : { ok: false, metin: s.hata })
      router.refresh()
    })
  }

  function varsayilan() {
    if (!confirm("Tüm filtre butonları varsayılana (görünürlük + orijinal renkler) dönsün mü?")) return
    const o: Record<string, Satir> = {}
    for (const og of ogeler) o[og.anahtar] = { buton: og.varsayilanButon, renk: og.varsayilanRenk }
    setDurum(o)
    kaydet(o)
  }

  const butonSayisi = ogeler.filter((o) => durum[o.anahtar].buton).length

  return (
    <section className="grid gap-4">
      <p className="text-xs text-muted-foreground">
        İş listesinin üstündeki hızlı filtreleri <strong>kendine göre</strong> düzenle: hangisi
        buton olarak görünsün, hangisi <strong>Filtre</strong> tuşunun içinde dursun ve hangi
        renkte olsun. Renkler başlangıçta durumun kendi rengiyle gelir. Bu ayar yalnız{" "}
        <strong>senin</strong> ekranını değiştirir. Şu an <strong>{butonSayisi}</strong> buton
        görünüyor.
      </p>

      {GRUPLAR.map((g) => {
        const liste = ogeler.filter((o) => o.tur === g.tur)
        if (liste.length === 0) return null
        return (
          <div key={g.tur} className="grid gap-2">
            <h2 className="text-sm font-semibold">{g.baslik}</h2>
            {liste.map((o) => {
              const s = durum[o.anahtar]
              const ozel = s.renk.toLowerCase() !== o.varsayilanRenk.toLowerCase()
              return (
                <div
                  key={o.anahtar}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-2.5"
                >
                  {/* Önizleme: pasif + aktif hâli */}
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold" style={tint(s.renk)}>
                      {o.etiket}
                    </span>
                    <span
                      className="hidden rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold sm:inline"
                      style={{ background: s.renk, borderColor: s.renk, color: ustYaziRengi(s.renk) }}
                      title="Seçiliyken böyle görünür"
                    >
                      seçili
                    </span>
                  </span>

                  {/* Buton / Filtre içinde */}
                  <span className="inline-flex overflow-hidden rounded-lg border border-border text-[12px]">
                    <button
                      type="button"
                      onClick={() => guncelle(o.anahtar, { buton: true })}
                      className={cn("px-2.5 py-1.5 font-medium", s.buton ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}
                    >
                      Buton
                    </button>
                    <button
                      type="button"
                      onClick={() => guncelle(o.anahtar, { buton: false })}
                      className={cn("border-l border-border px-2.5 py-1.5 font-medium", !s.buton ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}
                    >
                      Filtre içinde
                    </button>
                  </span>

                  {/* Renk */}
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Renk
                    <input
                      type="color"
                      value={s.renk}
                      onChange={(e) => guncelle(o.anahtar, { renk: e.target.value })}
                      className="h-8 w-10 cursor-pointer rounded border border-input bg-card"
                      aria-label={`${o.etiket} rengi`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => guncelle(o.anahtar, { renk: o.varsayilanRenk })}
                    disabled={!ozel}
                    className="text-[11.5px] text-primary hover:underline disabled:invisible"
                  >
                    orijinal renk
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}

      <div className="sticky bottom-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-2.5 shadow-sm backdrop-blur">
        <Button type="button" onClick={() => kaydet(durum)} disabled={pending || !degisti}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <Button type="button" variant="ghost" onClick={varsayilan} disabled={pending}>
          Tümünü varsayılana döndür
        </Button>
        {mesaj && (
          <span className={cn("text-[12.5px]", mesaj.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive")}>
            {mesaj.metin}
          </span>
        )}
      </div>
    </section>
  )
}
