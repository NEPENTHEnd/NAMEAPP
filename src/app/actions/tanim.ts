"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getYonetici } from "@/lib/auth"

// Tüm tanım işlemleri yalnız yöneticiye açıktır (RLS de ayrıca zorunlu kılar).
async function yoneticiSupabase() {
  await getYonetici()
  return createClient()
}

function metin(formData: FormData, ad: string): string {
  return String(formData.get(ad) ?? "").trim()
}

function bitir() {
  revalidatePath("/tanimlar")
}

// ---- Müşteri ----
export async function musteriEkle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const ad = metin(formData, "ad")
  if (!ad) return
  await supabase.from("musteri").insert({
    ad,
    sube_sehir: metin(formData, "sube_sehir") || null,
  })
  bitir()
}

export async function musteriDuzenle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const id = metin(formData, "id")
  const ad = metin(formData, "ad")
  if (!id || !ad) return
  await supabase
    .from("musteri")
    .update({ ad, sube_sehir: metin(formData, "sube_sehir") || null })
    .eq("id", id)
  bitir()
}

export async function musteriAktiflik(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const id = metin(formData, "id")
  if (!id) return
  await supabase
    .from("musteri")
    .update({ aktif: metin(formData, "aktif") === "true" })
    .eq("id", id)
  bitir()
}

// ---- Teknik personel ----
export async function personelEkle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const ad = metin(formData, "ad")
  if (!ad) return
  await supabase.from("teknik_personel").insert({ ad })
  bitir()
}

export async function personelDuzenle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const id = metin(formData, "id")
  const ad = metin(formData, "ad")
  if (!id || !ad) return
  await supabase.from("teknik_personel").update({ ad }).eq("id", id)
  bitir()
}

export async function personelAktiflik(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const id = metin(formData, "id")
  if (!id) return
  await supabase
    .from("teknik_personel")
    .update({ aktif: metin(formData, "aktif") === "true" })
    .eq("id", id)
  bitir()
}

// ---- Durum ----
export async function durumEkle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const ad = metin(formData, "ad")
  if (!ad) return
  await supabase.from("durum").insert({
    ad,
    sira: Number(metin(formData, "sira")) || 0,
    renk: metin(formData, "renk") || null,
  })
  bitir()
}

export async function durumDuzenle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const id = metin(formData, "id")
  const ad = metin(formData, "ad")
  if (!id || !ad) return
  await supabase
    .from("durum")
    .update({
      ad,
      sira: Number(metin(formData, "sira")) || 0,
      renk: metin(formData, "renk") || null,
    })
    .eq("id", id)
  bitir()
}

// ---- Fatura durumu ----
export async function faturaEkle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const ad = metin(formData, "ad")
  if (!ad) return
  await supabase.from("fatura_durumu").insert({ ad })
  bitir()
}

export async function faturaDuzenle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const id = metin(formData, "id")
  const ad = metin(formData, "ad")
  if (!id || !ad) return
  await supabase.from("fatura_durumu").update({ ad }).eq("id", id)
  bitir()
}

// ---- Kullanıcı rolü ----
export async function rolDuzenle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const id = metin(formData, "id")
  const rol = metin(formData, "rol")
  if (!id || (rol !== "teknisyen" && rol !== "yonetici")) return
  await supabase.from("kullanici_profil").update({ rol }).eq("id", id)
  bitir()
}
