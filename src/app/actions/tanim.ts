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

// Türkçe-duyarlı BÜYÜK harf (uygulama genelinde metinler büyük harf)
const buyuk = (s: string) => s.toLocaleUpperCase("tr-TR")

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

// Müşteriyi kalıcı sil — işleri silinmez, "müşterisiz" olur (FK on delete set null)
export async function musteriSil(id: string) {
  const supabase = await yoneticiSupabase()
  if (!id) return
  await supabase.from("musteri").delete().eq("id", id)
  revalidatePath("/")
  bitir()
}

// ---- Firmalar (İşler ekranındaki sol menü) ----
export async function grupEkle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const ad = metin(formData, "ad")
  if (!ad) return
  // Yeni firma listenin sonuna eklenir
  const { data: son } = await supabase
    .from("grup")
    .select("sira")
    .order("sira", { ascending: false })
    .limit(1)
    .maybeSingle()
  await supabase.from("grup").insert({ ad, sira: (son?.sira ?? 0) + 1 })
  revalidatePath("/")
  bitir()
}

export async function grupDuzenle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const id = metin(formData, "id")
  const ad = metin(formData, "ad")
  if (!id || !ad) return
  await supabase.from("grup").update({ ad }).eq("id", id)
  revalidatePath("/")
  bitir()
}

export async function grupAktiflik(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const id = metin(formData, "id")
  if (!id) return
  await supabase
    .from("grup")
    .update({ aktif: metin(formData, "aktif") === "true" })
    .eq("id", id)
  revalidatePath("/")
  bitir()
}

// Firmayı kalıcı sil — işleri silinmez, DİĞER'e düşer (FK on delete set null)
export async function grupSil(id: string) {
  const supabase = await yoneticiSupabase()
  if (!id) return
  await supabase.from("grup").delete().eq("id", id)
  revalidatePath("/")
  bitir()
}

// Sürükle-bırak sıralama: verilen id dizisine göre sira = 1..n
export async function grupSirala(ids: string[]) {
  const supabase = await yoneticiSupabase()
  await Promise.all(
    ids.map((id, i) => supabase.from("grup").update({ sira: i + 1 }).eq("id", id))
  )
  revalidatePath("/")
  bitir()
}

// Sol menüye yeni firma: yalnız kayıtlı bir MÜŞTERİDEN eklenir (arayıp seç)
export async function grupMusteridenEkle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const musteriId = metin(formData, "musteri_id")
  if (!musteriId) return
  const { data: m } = await supabase
    .from("musteri")
    .select("ad")
    .eq("id", musteriId)
    .maybeSingle()
  if (!m) return
  // Aynı firma zaten menüde varsa tekrar ekleme
  const { data: mevcut } = await supabase
    .from("grup")
    .select("id")
    .ilike("ad", m.ad)
    .limit(1)
    .maybeSingle()
  if (mevcut) return
  const { data: son } = await supabase
    .from("grup")
    .select("sira")
    .order("sira", { ascending: false })
    .limit(1)
    .maybeSingle()
  await supabase
    .from("grup")
    .insert({ ad: buyuk(m.ad), musteri_id: musteriId, sira: (son?.sira ?? 0) + 1 })
  revalidatePath("/")
  bitir()
}

// ---- Şube (bir sol-menü firmasının alt firmaları) ----
export async function subeEkle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const grupId = metin(formData, "grup_id")
  const ad = metin(formData, "ad")
  if (!grupId || !ad) return
  const { data: son } = await supabase
    .from("sube")
    .select("sira")
    .eq("grup_id", grupId)
    .order("sira", { ascending: false })
    .limit(1)
    .maybeSingle()
  await supabase.from("sube").insert({
    grup_id: grupId,
    ad: buyuk(ad),
    ilgili_kisi: buyuk(metin(formData, "ilgili_kisi")) || null,
    telefon: metin(formData, "telefon") || null,
    sira: (son?.sira ?? 0) + 1,
  })
  revalidatePath("/")
  bitir()
}

export async function subeDuzenle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const id = metin(formData, "id")
  const ad = metin(formData, "ad")
  if (!id || !ad) return
  await supabase
    .from("sube")
    .update({
      ad: buyuk(ad),
      ilgili_kisi: buyuk(metin(formData, "ilgili_kisi")) || null,
      telefon: metin(formData, "telefon") || null,
    })
    .eq("id", id)
  revalidatePath("/")
  bitir()
}

// Şubeyi sil — işleri silinmez, şubesiz (ana firma) kalır (FK on delete set null)
export async function subeSil(id: string) {
  const supabase = await yoneticiSupabase()
  if (!id) return
  await supabase.from("sube").delete().eq("id", id)
  revalidatePath("/")
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
  const sira = Number(metin(formData, "sira")) || 100
  await supabase.from("fatura_durumu").insert({
    ad,
    sira,
    hizli: metin(formData, "hizli") === "on",
    renk: metin(formData, "renk") || null,
  })
  revalidatePath("/")
  bitir()
}

export async function faturaDuzenle(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const id = metin(formData, "id")
  const ad = metin(formData, "ad")
  if (!id || !ad) return
  const sira = Number(metin(formData, "sira")) || 100
  await supabase
    .from("fatura_durumu")
    .update({
      ad,
      sira,
      hizli: metin(formData, "hizli") === "on",
      renk: metin(formData, "renk") || null,
    })
    .eq("id", id)
  revalidatePath("/")
  bitir()
}

// ---- Davet kodu üret (tek kullanımlık) ----
// Yetki RPC içinde: teknisyen kodu -> yönetici; yönetici kodu -> yalnız sahip.
type RpcIstemci = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

// Kişinin sabit davet kodunu yeniler (sahip) — kod ele geçtiyse değiştirmek için
export async function davetKodYenile(formData: FormData) {
  const supabase = await yoneticiSupabase()
  const kisiId = metin(formData, "kisi_id")
  if (!kisiId) return
  const rpc = supabase as unknown as RpcIstemci
  await rpc.rpc("davet_kod_yenile", { p_kisi_id: kisiId })
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
