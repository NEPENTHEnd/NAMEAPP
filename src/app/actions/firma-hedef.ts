"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getYonetici } from "@/lib/auth"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"

const ALANLAR = ["ort_gecen_adet", "ort_hedef_adet", "ort_gecen_para", "ort_hedef_para"] as const
export type HedefAlan = (typeof ALANLAR)[number]

// Firma × yıl için elle girilen ortalama/hedef değerini kaydeder.
// grupId null = DİĞER (grupsuz). Yalnız yönetici.
export async function firmaHedefKaydet(
  grupId: string | null,
  yil: number,
  alan: HedefAlan,
  deger: number | null
) {
  await getYonetici()
  if (!ALANLAR.includes(alan)) return { ok: false as const, hata: "Geçersiz alan" }
  const supabase = await createClient()

  let bul = supabase.from("firma_hedef").select("id").eq("yil", yil)
  bul = grupId ? bul.eq("grup_id", grupId) : bul.is("grup_id", null)
  const { data: mevcut } = await bul.maybeSingle()

  if (mevcut) {
    const yama = { [alan]: deger, updated_at: new Date().toISOString() } as TablesUpdate<"firma_hedef">
    await supabase.from("firma_hedef").update(yama).eq("id", mevcut.id)
  } else {
    const yeni = { grup_id: grupId, yil, [alan]: deger } as TablesInsert<"firma_hedef">
    await supabase.from("firma_hedef").insert(yeni)
  }

  revalidatePath("/raporlar")
  return { ok: true as const }
}
