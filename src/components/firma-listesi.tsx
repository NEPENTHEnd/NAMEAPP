"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { grupDuzenle, grupEkle, grupSil, grupSirala } from "@/app/actions/tanim"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Grup = { id: string; ad: string; sira: number }

// Tanımlar > Firmalar: sürükleyerek sırala, adını değiştir, sil, ekle.
export function FirmaListesi({ gruplar }: { gruplar: Grup[] }) {
  const router = useRouter()
  const [liste, setListe] = useState(gruplar)
  const [surukleIdx, setSurukleIdx] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  function siralamayiKaydet(yeni: Grup[]) {
    startTransition(async () => {
      await grupSirala(yeni.map((g) => g.id))
      router.refresh()
    })
  }

  function sil(g: Grup) {
    if (
      !window.confirm(
        `"${g.ad}" firması sol menüden KALICI olarak silinecek.\nİşleri silinmez, DİĞER'e taşınır. Emin misin?`
      )
    )
      return
    setListe((l) => l.filter((x) => x.id !== g.id))
    startTransition(async () => {
      await grupSil(g.id)
      router.refresh()
    })
  }

  return (
    <div className="grid max-w-xl gap-2">
      {/* Yeni firma ekle */}
      <form
        action={async (fd) => {
          await grupEkle(fd)
          router.refresh()
        }}
        className="flex flex-wrap gap-2"
      >
        <Input name="ad" placeholder="Yeni firma adı" required className="max-w-xs" />
        <Button type="submit" size="sm">Menüye ekle</Button>
      </form>

      <div className={cn("grid gap-1.5", pending && "opacity-60")}>
        {liste.map((g, i) => (
          <div
            key={g.id}
            draggable
            onDragStart={() => setSurukleIdx(i)}
            onDragOver={(e) => {
              e.preventDefault()
              if (surukleIdx === null || surukleIdx === i) return
              // sürüklenen öğeyi bu konuma taşı (canlı önizleme)
              setListe((l) => {
                const yeni = [...l]
                const [tasinan] = yeni.splice(surukleIdx, 1)
                yeni.splice(i, 0, tasinan)
                return yeni
              })
              setSurukleIdx(i)
            }}
            onDragEnd={() => {
              setSurukleIdx(null)
              siralamayiKaydet(liste)
            }}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-border bg-card p-2",
              surukleIdx === i && "border-primary ring-2 ring-primary/20"
            )}
          >
            {/* Tutma sapı */}
            <span
              title="Sürükleyerek sırala"
              className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground/60 active:cursor-grabbing"
            >
              <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                <circle cx="2.5" cy="2.5" r="1.4" /><circle cx="7.5" cy="2.5" r="1.4" />
                <circle cx="2.5" cy="8" r="1.4" /><circle cx="7.5" cy="8" r="1.4" />
                <circle cx="2.5" cy="13.5" r="1.4" /><circle cx="7.5" cy="13.5" r="1.4" />
              </svg>
            </span>
            <span className="w-6 text-right font-mono text-xs text-muted-foreground">
              {i + 1}
            </span>
            {/* Ad değiştir */}
            <form
              action={async (fd) => {
                await grupDuzenle(fd)
                router.refresh()
              }}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <input type="hidden" name="id" value={g.id} />
              <Input name="ad" defaultValue={g.ad} className="h-8 min-w-0 flex-1" required />
              <Button type="submit" size="sm" variant="ghost">Kaydet</Button>
            </form>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => sil(g)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Sil
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
