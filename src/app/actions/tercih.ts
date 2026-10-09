"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getYonetici } from "@/lib/auth"
import { hizliOgeler, ayarTemizle } from "@/lib/hizli-filtre"

// Kişisel hızlı filtre buton ayarı → kullanıcının kendi user_metadata'sı
// ("hizli_filtre"). Yalnız bilinen anahtarlar + geçerli renkler; varsayılana eşit
// değerler atılır. Başka kullanıcıları etkilemez.
export async function hizliFiltreKaydet(
  ham: unknown
): Promise<{ ok: true } | { ok: false; hata: string }> {
  await getYonetici()
  const supabase = await createClient()
  const [d, f] = await Promise.all([
    supabase.from("durum").select("id, ad, renk"),
    supabase.from("fatura_durumu").select("id, ad, renk, hizli"),
  ])
  const temiz = ayarTemizle(ham, hizliOgeler(d.data ?? [], f.data ?? []))
  const { error } = await supabase.auth.updateUser({ data: { hizli_filtre: temiz } })
  if (error) return { ok: false, hata: "Kaydedilemedi: " + error.message }
  revalidatePath("/")
  revalidatePath("/tanimlar")
  return { ok: true }
}
