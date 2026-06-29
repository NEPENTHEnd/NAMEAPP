"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"
import { ayAraligi } from "@/lib/aylar"

// Not: Fotoğraf YÜKLEME, Server Action gövde limitini (1 MB) aşmamak ve
// sunucu yükünü azaltmak için tarayıcıdan doğrudan Supabase Storage'a yapılır
// (bkz. components/foto-bolumu.tsx). Burada yalnız silme var.

// Yönetici: (varsa o aya ait) tüm fotoğrafları Storage + DB'den siler.
// Arşivledikten (ZIP indirdikten) sonra depoyu boşaltmak için.
export async function fotolariSil(ay: string) {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    throw new Error("Bu işlem için yönetici yetkisi gerekir.")
  }

  const supabase = await createClient()
  const { data: fotolar } = await supabase
    .from("foto")
    .select("id, dosya_yolu, is_kaydi:is_kaydi_id ( gelis_tarihi )")

  const aralik = ay ? ayAraligi(ay) : null
  const secili = (fotolar ?? []).filter((f) => {
    if (!aralik) return true
    const g = f.is_kaydi?.gelis_tarihi
    return g ? g >= aralik.baslangic && g <= aralik.bitis : false
  })
  if (secili.length === 0) return

  const yollar = secili.map((f) => f.dosya_yolu)
  for (let i = 0; i < yollar.length; i += 500) {
    await supabase.storage.from("foto").remove(yollar.slice(i, i + 500))
  }
  const idler = secili.map((f) => f.id)
  for (let i = 0; i < idler.length; i += 500) {
    await supabase.from("foto").delete().in("id", idler.slice(i, i + 500))
  }

  revalidatePath("/raporlar")
  revalidatePath("/")
}

export async function fotoSil(
  isKaydiId: string,
  fotoId: string,
  dosyaYolu: string
) {
  await getKullanici()

  const supabase = await createClient()

  await supabase.storage.from("foto").remove([dosyaYolu])
  const { error } = await supabase.from("foto").delete().eq("id", fotoId)

  if (error) {
    throw new Error("Fotoğraf silinemedi: " + error.message)
  }

  revalidatePath(`/is/${isKaydiId}`)
}
