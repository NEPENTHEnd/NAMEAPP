"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

import { createClient } from "@/lib/supabase/client"
import { fotograflariYukle, MAKS_DOSYA_BOYUT } from "@/lib/foto-istemci"
import { fotoSil } from "@/app/actions/foto"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { KameraYakala } from "@/components/kamera-yakala"

export type FotoOgesi = {
  id: string
  url: string
  dosyaYolu: string
}

export function FotoBolumu({
  isKaydiId,
  fotograflar,
}: {
  isKaydiId: string
  fotograflar: FotoOgesi[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  async function yukle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setHata(null)

    const dosyalar = Array.from(inputRef.current?.files ?? [])
    if (dosyalar.length === 0) {
      setHata("Lütfen en az bir fotoğraf seçin.")
      return
    }
    for (const d of dosyalar) {
      if (!d.type.startsWith("image/")) {
        setHata(`"${d.name}" bir resim dosyası değil.`)
        return
      }
      if (d.size > MAKS_DOSYA_BOYUT) {
        setHata(`"${d.name}" çok büyük (25 MB sınırı).`)
        return
      }
    }

    setYukleniyor(true)
    const supabase = createClient()

    try {
      await fotograflariYukle(supabase, isKaydiId, dosyalar, fotograflar.length)
      if (inputRef.current) inputRef.current.value = ""
      router.refresh()
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Bilinmeyen hata")
    } finally {
      setYukleniyor(false)
    }
  }

  // Kameradan çekilen kareyi hemen yükle (detayda iş kaydı zaten var).
  async function kameradanYukle(dosya: File) {
    setHata(null)
    setYukleniyor(true)
    const supabase = createClient()
    try {
      await fotograflariYukle(supabase, isKaydiId, [dosya], fotograflar.length)
      router.refresh()
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Bilinmeyen hata")
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-semibold">
        Fotoğraflar{" "}
        <span className="text-muted-foreground">({fotograflar.length})</span>
      </h2>

      {fotograflar.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {fotograflar.map((f) => (
            <FotoKart key={f.id} isKaydiId={isKaydiId} foto={f} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Henüz fotoğraf yok.</p>
      )}

      <form onSubmit={yukle} className="grid gap-2">
        <Label htmlFor="dosya" className="text-sm">
          Fotoğraf ekle
        </Label>
        <input
          ref={inputRef}
          id="dosya"
          name="dosya"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Telefonda doğrudan kameradan çekebilirsin. Fotoğraflar yüklenirken
          otomatik küçültülür (yer tasarrufu).
        </p>
        {hata && <p className="text-sm text-destructive">{hata}</p>}
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={yukleniyor}>
            {yukleniyor ? "Yükleniyor…" : "Yükle"}
          </Button>
          <KameraYakala onCek={kameradanYukle} />
        </div>
      </form>
    </section>
  )
}

function FotoKart({
  isKaydiId,
  foto,
}: {
  isKaydiId: string
  foto: FotoOgesi
}) {
  const [pending, startTransition] = useTransition()
  const silAction = fotoSil.bind(null, isKaydiId, foto.id, foto.dosyaYolu)

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border">
      <a
        href={foto.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full w-full"
      >
        <Image
          src={foto.url}
          alt="İş fotoğrafı"
          fill
          sizes="(min-width:640px) 160px, 33vw"
          className="object-cover transition-transform group-hover:scale-105"
        />
      </a>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Bu fotoğrafı silmek istediğinize emin misiniz?")) {
            startTransition(() => silAction())
          }
        }}
        className="absolute top-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
        aria-label="Fotoğrafı sil"
      >
        {pending ? "…" : "Sil"}
      </button>
    </div>
  )
}
