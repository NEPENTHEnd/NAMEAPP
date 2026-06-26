"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

// Oturumu kapatır ve giriş sayfasına yönlendirir.
export async function cikisYap() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/giris")
}
