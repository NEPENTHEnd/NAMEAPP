"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
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
  // Büyük görüntü (lightbox): açık olan fotoğrafın index'i
  const [acikIndex, setAcikIndex] = useState<number | null>(null)

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
          {fotograflar.map((f, i) => (
            <FotoKart
              key={f.id}
              isKaydiId={isKaydiId}
              foto={f}
              onAc={() => setAcikIndex(i)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Henüz fotoğraf yok.</p>
      )}

      {acikIndex !== null && (
        <FotoBuyuk
          fotograflar={fotograflar}
          index={acikIndex}
          setIndex={setAcikIndex}
        />
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
  onAc,
}: {
  isKaydiId: string
  foto: FotoOgesi
  onAc: () => void
}) {
  const [pending, startTransition] = useTransition()
  const silAction = fotoSil.bind(null, isKaydiId, foto.id, foto.dosyaYolu)

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={onAc}
        className="block h-full w-full"
        aria-label="Fotoğrafı büyüt"
      >
        <Image
          src={foto.url}
          alt="İş fotoğrafı"
          fill
          sizes="(min-width:640px) 160px, 33vw"
          className="object-cover transition-transform group-hover:scale-105"
        />
      </button>
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

// Tam ekran büyük görüntü: ileri/geri ok, klavye (←/→/Esc), parmakla kaydırma.
function FotoBuyuk({
  fotograflar,
  index,
  setIndex,
}: {
  fotograflar: FotoOgesi[]
  index: number
  setIndex: (i: number | null) => void
}) {
  const toplam = fotograflar.length
  const dokunusX = useRef<number | null>(null)

  const git = useCallback(
    (yon: number) => setIndex((((index + yon) % toplam) + toplam) % toplam),
    [index, toplam, setIndex]
  )

  useEffect(() => {
    function tus(e: KeyboardEvent) {
      if (e.key === "Escape") setIndex(null)
      else if (e.key === "ArrowRight") git(1)
      else if (e.key === "ArrowLeft") git(-1)
    }
    window.addEventListener("keydown", tus)
    return () => window.removeEventListener("keydown", tus)
  }, [git, setIndex])

  const foto = fotograflar[index]

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-3"
      onClick={() => setIndex(null)}
      onTouchStart={(e) => (dokunusX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (dokunusX.current == null) return
        const fark = e.changedTouches[0].clientX - dokunusX.current
        if (Math.abs(fark) > 40) git(fark < 0 ? 1 : -1)
        dokunusX.current = null
      }}
    >
      {/* Kapat */}
      <button
        type="button"
        onClick={() => setIndex(null)}
        aria-label="Kapat"
        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>

      {/* Görüntü */}
      <div
        className="relative h-[78vh] w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={foto.url}
          alt={`Fotoğraf ${index + 1}/${toplam}`}
          fill
          sizes="100vw"
          quality={90}
          className="object-contain"
          priority
        />
      </div>

      {/* İleri / geri (birden çok foto varsa) */}
      {toplam > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); git(-1) }}
            aria-label="Önceki"
            className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-4"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); git(1) }}
            aria-label="Sonraki"
            className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-4"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </>
      )}

      {/* Sayaç + yeni sekmede aç */}
      <div className="mt-3 flex items-center gap-4 text-sm text-white/80" onClick={(e) => e.stopPropagation()}>
        <span className="tabular-nums">{index + 1} / {toplam}</span>
        <a href={foto.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-white">
          Tam boyut aç
        </a>
      </div>
    </div>
  )
}
