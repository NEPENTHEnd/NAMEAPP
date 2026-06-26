"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"

// Not: Fotoğraf YÜKLEME, Server Action gövde limitini (1 MB) aşmamak ve
// sunucu yükünü azaltmak için tarayıcıdan doğrudan Supabase Storage'a yapılır
// (bkz. components/foto-bolumu.tsx). Burada yalnız silme var.

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
