"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"

// useActionState ile kullanılan dönüş tipi
export type IsFormState = {
  error?: string
  fieldErrors?: Record<string, string>
}

// Boş string'i undefined'a çevir (opsiyonel alanlar için)
const bosNull = (v: unknown) => (v === "" || v == null ? undefined : v)

const sayi = z.preprocess(
  bosNull,
  z.coerce.number({ message: "Geçerli bir sayı girin" }).nonnegative().optional()
)

const tarih = z.preprocess(
  bosNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih girin")
    .optional()
)

const metin = z.preprocess(bosNull, z.string().trim().optional())

const sema = z
  .object({
    musteri_id: z.preprocess(bosNull, z.string().uuid().optional()),
    yeni_musteri_adi: metin,
    cihaz_adi: z.string().trim().min(1, "Cihaz adı zorunlu"),
    seri_no: metin,
    servis_no: metin,
    gelis_tarihi: z.preprocess(
      bosNull,
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geliş tarihi zorunlu")
    ),
    cikis_tarihi: tarih,
    durum_id: z.string().uuid("Durum seçin"),
    teknik_personel_id: z.preprocess(bosNull, z.string().uuid().optional()),
    fatura_durumu_id: z.preprocess(bosNull, z.string().uuid().optional()),
    ilgili_kisi: metin,
    fiyat_teklifi: sayi,
    fatura_tutari: sayi,
    aciklama: metin,
  })
  .refine((d) => !!d.musteri_id || !!d.yeni_musteri_adi, {
    message: "Müşteri seçin ya da yeni müşteri adı girin",
    path: ["musteri_id"],
  })

function formdanOku(formData: FormData) {
  return {
    musteri_id: formData.get("musteri_id"),
    yeni_musteri_adi: formData.get("yeni_musteri_adi"),
    cihaz_adi: formData.get("cihaz_adi"),
    seri_no: formData.get("seri_no"),
    servis_no: formData.get("servis_no"),
    gelis_tarihi: formData.get("gelis_tarihi"),
    cikis_tarihi: formData.get("cikis_tarihi"),
    durum_id: formData.get("durum_id"),
    teknik_personel_id: formData.get("teknik_personel_id"),
    fatura_durumu_id: formData.get("fatura_durumu_id"),
    ilgili_kisi: formData.get("ilgili_kisi"),
    fiyat_teklifi: formData.get("fiyat_teklifi"),
    fatura_tutari: formData.get("fatura_tutari"),
    aciklama: formData.get("aciklama"),
  }
}

function alanHatalari(parsed: z.ZodError): IsFormState {
  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.issues) {
    const key = String(issue.path[0] ?? "")
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return { error: "Lütfen formdaki hataları düzeltin.", fieldErrors }
}

// Doğrulanmış veriyi DB satırına dönüştür; gerekirse yeni müşteri oluştur.
async function musteriIdCozumle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  veri: z.infer<typeof sema>
): Promise<{ id: string } | { hata: string }> {
  if (veri.yeni_musteri_adi) {
    const { data, error } = await supabase
      .from("musteri")
      .insert({ ad: veri.yeni_musteri_adi })
      .select("id")
      .single()
    if (error || !data) return { hata: "Yeni müşteri oluşturulamadı." }
    return { id: data.id }
  }
  return { id: veri.musteri_id! }
}

function dbSatiri(veri: z.infer<typeof sema>, musteriId: string) {
  return {
    musteri_id: musteriId,
    cihaz_adi: veri.cihaz_adi,
    seri_no: veri.seri_no ?? null,
    servis_no: veri.servis_no ?? null,
    gelis_tarihi: veri.gelis_tarihi,
    cikis_tarihi: veri.cikis_tarihi ?? null,
    durum_id: veri.durum_id,
    teknik_personel_id: veri.teknik_personel_id ?? null,
    fatura_durumu_id: veri.fatura_durumu_id ?? null,
    ilgili_kisi: veri.ilgili_kisi ?? null,
    fiyat_teklifi: veri.fiyat_teklifi ?? null,
    fatura_tutari: veri.fatura_tutari ?? null,
    aciklama: veri.aciklama ?? null,
  }
}

export async function isOlustur(
  _prev: IsFormState,
  formData: FormData
): Promise<IsFormState> {
  await getKullanici() // oturum yoksa /giris'e atar

  const parsed = sema.safeParse(formdanOku(formData))
  if (!parsed.success) return alanHatalari(parsed.error)

  const supabase = await createClient()
  const m = await musteriIdCozumle(supabase, parsed.data)
  if ("hata" in m) return { error: m.hata }

  const { data, error } = await supabase
    .from("is_kaydi")
    .insert(dbSatiri(parsed.data, m.id))
    .select("id")
    .single()

  if (error || !data) {
    return { error: "Kayıt oluşturulamadı: " + (error?.message ?? "bilinmeyen hata") }
  }

  revalidatePath("/")
  redirect(`/is/${data.id}`)
}

export async function isGuncelle(
  id: string,
  _prev: IsFormState,
  formData: FormData
): Promise<IsFormState> {
  await getKullanici()

  const parsed = sema.safeParse(formdanOku(formData))
  if (!parsed.success) return alanHatalari(parsed.error)

  const supabase = await createClient()
  const m = await musteriIdCozumle(supabase, parsed.data)
  if ("hata" in m) return { error: m.hata }

  const { error } = await supabase
    .from("is_kaydi")
    .update(dbSatiri(parsed.data, m.id))
    .eq("id", id)

  if (error) {
    return { error: "Kayıt güncellenemedi: " + error.message }
  }

  revalidatePath("/")
  revalidatePath(`/is/${id}`)
  redirect(`/is/${id}`)
}

export async function isSil(id: string) {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    throw new Error("Bu işlem için yönetici yetkisi gerekir.")
  }

  const supabase = await createClient()
  const { error } = await supabase.from("is_kaydi").delete().eq("id", id)
  if (error) {
    throw new Error("Kayıt silinemedi: " + error.message)
  }

  revalidatePath("/")
  redirect("/")
}
