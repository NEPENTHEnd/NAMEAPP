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

const MAKS_BOYUT = 25 * 1024 * 1024 // 25 MB (sıkıştırmadan önceki orijinal sınırı)

function uzanti(dosya: File): string {
  const adParca = dosya.name.split(".").pop()?.toLowerCase()
  if (adParca && adParca.length <= 5) return adParca
  return dosya.type.split("/").pop() || "jpg"
}

const MAKS_KENAR = 1600 // en uzun kenar (px)
const JPEG_KALITE = 0.72

function gorselYukle(dosya: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(dosya)
    const img = document.createElement("img")
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("görsel yüklenemedi"))
    }
    img.src = url
  })
}

// Fotoğrafı yüklemeden önce küçült + JPEG'e çevir (depolama tasarrufu).
// Sıkıştırma yapılamazsa (örn. desteklenmeyen format) orijinali döndürür.
async function sikistir(
  dosya: File
): Promise<{ veri: Blob; ext: string; tip: string }> {
  if (!dosya.type.startsWith("image/")) {
    return { veri: dosya, ext: uzanti(dosya), tip: dosya.type }
  }
  try {
    const img = await gorselYukle(dosya)
    const olcek = Math.min(1, MAKS_KENAR / Math.max(img.width, img.height))
    const w = Math.round(img.width * olcek)
    const h = Math.round(img.height * olcek)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("canvas")
    ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", JPEG_KALITE)
    )
    if (!blob) throw new Error("blob")
    // Sıkıştırma orijinalden büyükse orijinali kullan
    if (blob.size >= dosya.size) {
      return { veri: dosya, ext: uzanti(dosya), tip: dosya.type }
    }
    return { veri: blob, ext: "jpg", tip: "image/jpeg" }
  } catch {
    return { veri: dosya, ext: uzanti(dosya), tip: dosya.type }
  }
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
        const { veri, ext, tip } = await sikistir(dosya)
        const yol = `${isKaydiId}/${crypto.randomUUID()}.${ext}`

        const { error: yuklemeHatasi } = await supabase.storage
          .from("foto")
          .upload(yol, veri, { contentType: tip, upsert: false })
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
          Telefonda doğrudan kameradan çekebilirsin. Fotoğraflar yüklenirken
          otomatik küçültülür (yer tasarrufu).
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
