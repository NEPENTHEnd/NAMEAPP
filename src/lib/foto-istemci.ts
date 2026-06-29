import { createClient } from "@/lib/supabase/client"

type Supabase = ReturnType<typeof createClient>

const MAKS_KENAR = 1600 // en uzun kenar (px)
const JPEG_KALITE = 0.72

function uzanti(dosya: File): string {
  const adParca = dosya.name.split(".").pop()?.toLowerCase()
  if (adParca && adParca.length <= 5) return adParca
  return dosya.type.split("/").pop() || "jpg"
}

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

// Yüklemeden önce küçült + JPEG'e çevir; olmazsa orijinali döndür.
export async function sikistir(
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
    if (blob.size >= dosya.size) {
      return { veri: dosya, ext: uzanti(dosya), tip: dosya.type }
    }
    return { veri: blob, ext: "jpg", tip: "image/jpeg" }
  } catch {
    return { veri: dosya, ext: uzanti(dosya), tip: dosya.type }
  }
}

export const MAKS_DOSYA_BOYUT = 25 * 1024 * 1024 // 25 MB (sıkıştırmadan önce)
export const FOTO_KOTA_BYTE = 512 * 1024 * 1024 // 0,5 GB fotoğraf deposu

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

// 'foto' deposunun toplam kullanımı (byte) + dosya sayısı
export async function fotoKullanim(
  supabase: Supabase
): Promise<{ toplamByte: number; adet: number }> {
  const rpc = supabase as unknown as RpcClient
  const { data } = await rpc.rpc("foto_kullanim")
  const satir = Array.isArray(data) ? data[0] : data
  const d = satir as { toplam_byte?: number; adet?: number } | null
  return { toplamByte: Number(d?.toplam_byte ?? 0), adet: Number(d?.adet ?? 0) }
}

// Seçilen fotoğrafları sıkıştırıp Storage'a yükler ve foto satırlarını ekler.
// Hata olursa Error fırlatır.
export async function fotograflariYukle(
  supabase: Supabase,
  isKaydiId: string,
  dosyalar: File[],
  baslangicSira: number
): Promise<void> {
  // Kota dolu mu? Doluysa yükleme engellenir.
  const { toplamByte } = await fotoKullanim(supabase)
  if (toplamByte >= FOTO_KOTA_BYTE) {
    throw new Error(
      "Fotoğraf deposu dolu (0,5 GB). Yöneticinin fotoğrafları arşivleyip silmesi gerekiyor."
    )
  }

  let sira = baslangicSira
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
      await supabase.storage.from("foto").remove([yol])
      throw new Error("Fotoğraf kaydedilemedi: " + satirHatasi.message)
    }
  }
}
