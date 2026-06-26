"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

import { createClient } from "@/lib/supabase/client"
import { fotoSil } from "@/app/actions/foto"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export type FotoOgesi = {
  id: string
  url: string
  dosyaYolu: string
}

const MAKS_BOYUT = 10 * 1024 * 1024 // 10 MB

function uzanti(dosya: File): string {
  const adParca = dosya.name.split(".").pop()?.toLowerCase()
  if (adParca && adParca.length <= 5) return adParca
  return dosya.type.split("/").pop() || "jpg"
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
      if (d.size > MAKS_BOYUT) {
        setHata(`"${d.name}" 10 MB sınırını aşıyor.`)
        return
      }
    }

    setYukleniyor(true)
    const supabase = createClient()
    let sira = fotograflar.length

    try {
      for (const dosya of dosyalar) {
        const yol = `${isKaydiId}/${crypto.randomUUID()}.${uzanti(dosya)}`

        const { error: yuklemeHatasi } = await supabase.storage
          .from("foto")
          .upload(yol, dosya, { contentType: dosya.type, upsert: false })
        if (yuklemeHatasi) {
          throw new Error("Yükleme başarısız: " + yuklemeHatasi.message)
        }

        const { error: satirHatasi } = await supabase
          .from("foto")
          .insert({ is_kaydi_id: isKaydiId, dosya_yolu: yol, sira: sira++ })
        if (satirHatasi) {
          // Satır eklenemezse yüklenen dosyayı geri al
          await supabase.storage.from("foto").remove([yol])
          throw new Error("Fotoğraf kaydedilemedi: " + satirHatasi.message)
        }
      }

      if (inputRef.current) inputRef.current.value = ""
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
          Telefonda doğrudan kameradan çekebilirsin. En fazla 10 MB/dosya.
        </p>
        {hata && <p className="text-sm text-destructive">{hata}</p>}
        <div>
          <Button type="submit" size="sm" disabled={yukleniyor}>
            {yukleniyor ? "Yükleniyor…" : "Yükle"}
          </Button>
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
