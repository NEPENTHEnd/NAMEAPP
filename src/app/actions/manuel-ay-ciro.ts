"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getYonetici } from "@/lib/auth"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"

export type ManuelAlan = "tutar" | "adet"

// Matriste GEÇMİŞ bir ayın ciro (tutar) / iş adedi (adet) değerini müdür elle girer.
// grupId null = DİĞER (grupsuz). Yalnız yönetici. Sistemde verisi olan aylar
// düzenlenemez (istemci tarafında kilitli); burada da yalnız (grup, yıl, ay) upsert.
export async function manuelAyCiroKaydet(
  grupId: string | null,
  yil: number,
  ay: number,
  alan: ManuelAlan,
  deger: number | null
) {
  await getYonetici()
  if (alan !== "tutar" && alan !== "adet") return { ok: false as const, hata: "Geçersiz alan" }
  if (!Number.isInteger(ay) || ay < 1 || ay > 12) return { ok: false as const, hata: "Geçersiz ay" }
  // adet tam sayı olmalı ("12,5" -> 13 değil, kırp); negatif değerleri 0'a çek
  let v = deger
  if (v != null) {
    if (!Number.isFinite(v)) v = null
    else {
      if (v < 0) v = 0
      if (alan === "adet") v = Math.round(v)
    }
  }
  const supabase = await createClient()

  let bul = supabase.from("manuel_ay_ciro").select("id").eq("yil", yil).eq("ay", ay)
  bul = grupId ? bul.eq("grup_id", grupId) : bul.is("grup_id", null)
  const { data: mevcut } = await bul.maybeSingle()

  if (mevcut) {
    const yama = { [alan]: v, updated_at: new Date().toISOString() } as TablesUpdate<"manuel_ay_ciro">
    await supabase.from("manuel_ay_ciro").update(yama).eq("id", mevcut.id)
  } else {
    const yeni = { grup_id: grupId, yil, ay, [alan]: v } as TablesInsert<"manuel_ay_ciro">
    await supabase.from("manuel_ay_ciro").insert(yeni)
  }

  revalidatePath("/raporlar")
  return { ok: true as const }
}
