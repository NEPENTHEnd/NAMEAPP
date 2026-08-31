"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"
import { yoneticilereBildir } from "@/lib/push"
import type {
  TablesInsert,
  TablesUpdate,
} from "@/lib/supabase/database.types"

// Tipli istemcide tanımlı olmayan RPC'ler için sade arayüz
type RpcIstemci = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

// useActionState ile kullanılan dönüş tipi
export type IsFormState = {
  error?: string
  fieldErrors?: Record<string, string>
  basari?: boolean
  id?: string // yeni oluşturulan iş id'si (foto yükleme + yönlendirme için)
}

// Boş string'i undefined'a çevir (opsiyonel alanlar için)
const bosNull = (v: unknown) => (v === "" || v == null ? undefined : v)

// Türkçe-duyarlı BÜYÜK harf (i→İ, ı→I). Girilen tüm metinler büyük harfe çevrilir.
const buyuk = (s: string) => s.toLocaleUpperCase("tr-TR")

// Sunucu UTC çalışır; fatura_tarihi "bugün"ü Türkiye gününe göre yaz.
const bugunTR = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })

// Verilen fatura durumu "FATURA EDİLDİ" mi? (fatura_tarihi otomatik atama kararı için)
async function faturaEdildiMi(
  supabase: Awaited<ReturnType<typeof createClient>>,
  faturaDurumuId: string | null | undefined
): Promise<boolean> {
  if (!faturaDurumuId) return false
  const { data } = await supabase
    .from("fatura_durumu")
    .select("ad")
    .eq("id", faturaDurumuId)
    .maybeSingle()
  return data?.ad?.toLocaleUpperCase("tr-TR") === "FATURA EDİLDİ"
}

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

// Metin + otomatik BÜYÜK harf (girilen tüm yazılar büyük harfe çevrilir)
const metinBuyuk = z.preprocess(
  bosNull,
  z
    .string()
    .trim()
    .transform((s) => buyuk(s))
    .optional()
)

const sema = z
  .object({
    musteri_id: z.preprocess(bosNull, z.string().uuid().optional()),
    yeni_musteri_adi: metinBuyuk,
    cihaz_adi: z
      .string()
      .trim()
      .min(1, "Cihaz adı zorunlu")
      .transform((s) => buyuk(s)),
    seri_no: metinBuyuk,
    servis_no: metinBuyuk,
    gelis_tarihi: z.preprocess(
      bosNull,
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geliş tarihi zorunlu")
    ),
    // Saat "HH:MM" (bazı tarayıcılar "HH:MM:SS" gönderir)
    gelis_saat: z.preprocess(
      bosNull,
      z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Geçerli bir saat girin")
        .optional()
    ),
    cikis_tarihi: tarih,
    durum_id: z.string().uuid("Durum seçin"),
    teknik_personel_id: z.preprocess(bosNull, z.string().uuid().optional()),
    fatura_durumu_id: z.preprocess(bosNull, z.string().uuid().optional()),
    ilgili_kisi: metinBuyuk,
    telefon: metin,
    adres: metinBuyuk,
    kargo_takip_no: metin,
    grup_id: z.preprocess(bosNull, z.string().uuid().optional()),
    sube_id: z.preprocess(bosNull, z.string().uuid().optional()),
    fiyat_teklifi: sayi,
    teklif_birim: z.preprocess(bosNull, z.enum(["TL", "USD", "EUR", "CHF"]).optional()),
    fatura_tutari: sayi,
    fatura_tarihi: tarih,
    garanti_no: metinBuyuk,
    talep_no: metinBuyuk,
    aciklama: metinBuyuk,
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
    gelis_saat: formData.get("gelis_saat"),
    cikis_tarihi: formData.get("cikis_tarihi"),
    durum_id: formData.get("durum_id"),
    teknik_personel_id: formData.get("teknik_personel_id"),
    fatura_durumu_id: formData.get("fatura_durumu_id"),
    ilgili_kisi: formData.get("ilgili_kisi"),
    telefon: formData.get("telefon"),
    adres: formData.get("adres"),
    kargo_takip_no: formData.get("kargo_takip_no"),
    grup_id: formData.get("grup_id"),
    sube_id: formData.get("sube_id"),
    fiyat_teklifi: formData.get("fiyat_teklifi"),
    teklif_birim: formData.get("teklif_birim"),
    fatura_tutari: formData.get("fatura_tutari"),
    fatura_tarihi: formData.get("fatura_tarihi"),
    garanti_no: formData.get("garanti_no"),
    talep_no: formData.get("talep_no"),
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
// Müşteri ADINI da döndürür (sol menü/şube adına göre otomatik atama için).
async function musteriIdCozumle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  veri: z.infer<typeof sema>
): Promise<{ id: string; ad: string } | { hata: string }> {
  if (veri.yeni_musteri_adi) {
    const { data, error } = await supabase
      .from("musteri")
      .insert({ ad: veri.yeni_musteri_adi })
      .select("id")
      .single()
    if (error || !data) return { hata: "Yeni müşteri oluşturulamadı." }
    return { id: data.id, ad: veri.yeni_musteri_adi }
  }
  const { data } = await supabase
    .from("musteri")
    .select("ad")
    .eq("id", veri.musteri_id!)
    .maybeSingle()
  return { id: veri.musteri_id!, ad: data?.ad ?? "" }
}

// Müşteri adından sol menü firmasını (grup) + şubesini bul.
// Önce ŞUBE adı eşleşmesi (ör. "COREAL" → HASÇELİK KABLO / COREAL şubesi),
// sonra FİRMA adı eşleşmesi (ör. "MEGA METAL" → MEGA METAL firması).
// Böylece personel müşteriyi seçince iş otomatik doğru klasöre düşer.
async function firmaSubeCozumle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  musteriAd: string
): Promise<{ grupId: string | null; subeId: string | null }> {
  const ad = musteriAd.trim()
  if (!ad) return { grupId: null, subeId: null }
  const { data: sb } = await supabase
    .from("sube")
    .select("id, grup_id")
    .ilike("ad", ad)
    .eq("aktif", true)
    .limit(1)
    .maybeSingle()
  if (sb) return { grupId: sb.grup_id, subeId: sb.id }
  const { data: g } = await supabase
    .from("grup")
    .select("id")
    .ilike("ad", ad)
    .eq("aktif", true)
    .limit(1)
    .maybeSingle()
  if (g) return { grupId: g.id, subeId: null }
  return { grupId: null, subeId: null }
}

// Her rolde yazılabilir temel alanlar (servis_no ve finansal HARİÇ).
function temelSatir(veri: z.infer<typeof sema>, musteriId: string) {
  return {
    musteri_id: musteriId,
    cihaz_adi: veri.cihaz_adi,
    seri_no: veri.seri_no ?? null,
    gelis_tarihi: veri.gelis_tarihi,
    gelis_saat: veri.gelis_saat ?? null,
    cikis_tarihi: veri.cikis_tarihi ?? null,
    durum_id: veri.durum_id,
    teknik_personel_id: veri.teknik_personel_id ?? null,
    ilgili_kisi: veri.ilgili_kisi ?? null,
    telefon: veri.telefon ?? null,
    adres: veri.adres ?? null,
    kargo_takip_no: veri.kargo_takip_no ?? null,
    aciklama: veri.aciklama ?? null,
  }
}

export async function isOlustur(
  _prev: IsFormState,
  formData: FormData
): Promise<IsFormState> {
  const kullanici = await getKullanici() // oturum yoksa /giris'e atar

  const parsed = sema.safeParse(formdanOku(formData))
  if (!parsed.success) return alanHatalari(parsed.error)

  const supabase = await createClient()
  const m = await musteriIdCozumle(supabase, parsed.data)
  if ("hata" in m) return { error: m.hata }

  const finansal = kullanici.rol === "yonetici"
  // Sol menü ataması: yönetici formda AÇIKÇA bir firma seçtiyse (ör. yeşil + ile
  // /yeni?grup=…) onu kullan; aksi halde MÜŞTERİ ADINDAN otomatik türet. Böylece
  // personel "MEGA METAL" seçince iş otomatik MEGA METAL klasörüne, "COREAL" seçince
  // HASÇELİK/COREAL şubesine düşer — DİĞER'de kaybolmaz.
  let grupId: string | null = null
  let subeId: string | null = null
  if (finansal && parsed.data.grup_id) {
    grupId = parsed.data.grup_id
    subeId = parsed.data.sube_id ?? null
  } else if (parsed.data.sube_id) {
    // Formda şube seçildi (personel de olabilir) → şubeden firmayı (grup) al
    const { data: sb } = await supabase
      .from("sube")
      .select("grup_id")
      .eq("id", parsed.data.sube_id)
      .maybeSingle()
    if (sb) {
      grupId = sb.grup_id
      subeId = parsed.data.sube_id
    } else {
      const c = await firmaSubeCozumle(supabase, m.ad)
      grupId = c.grupId
      subeId = c.subeId
    }
  } else {
    const c = await firmaSubeCozumle(supabase, m.ad)
    grupId = c.grupId
    subeId = c.subeId
  }
  const ekle: TablesInsert<"is_kaydi"> = {
    ...temelSatir(parsed.data, m.id),
    olusturan_id: kullanici.id,
    // Personelin eklediği iş yöneticiye "yeni" görünür; yöneticininki görüldü sayılır.
    yonetici_gordu: finansal,
    grup_id: grupId,
    sube_id: subeId,
  }
  // Fiş no HERKESE otomatik (ön eki olan kullanıcıda); yoksa form değeri/boş.
  // İSTİSNA: BOYTEKS grubuna girilen işlerde fiş no üretilmez — firmaya özel
  // stok kodu elle girilir.
  let otomatikFis = true
  if (ekle.grup_id) {
    const { data: g } = await supabase
      .from("grup")
      .select("ad")
      .eq("id", ekle.grup_id)
      .maybeSingle()
    if (g?.ad?.includes("BOYTEKS")) otomatikFis = false // ad "BOYTEKS TEKSTİL"
  }
  if (otomatikFis) {
    const rpc = supabase as unknown as RpcIstemci
    const { data: fis } = await rpc.rpc("fis_no_uret")
    ekle.servis_no =
      (typeof fis === "string" ? fis : null) ?? parsed.data.servis_no ?? null
  } else {
    ekle.servis_no = parsed.data.servis_no ?? null
  }
  if (finansal) {
    ekle.fatura_durumu_id = parsed.data.fatura_durumu_id ?? null
    ekle.fiyat_teklifi = parsed.data.fiyat_teklifi ?? null
    ekle.teklif_birim = parsed.data.teklif_birim ?? "TL"
    ekle.fatura_tutari = parsed.data.fatura_tutari ?? null
    ekle.fatura_tarihi = parsed.data.fatura_tarihi ?? null
    ekle.garanti_no = parsed.data.garanti_no ?? null
    ekle.talep_no = parsed.data.talep_no ?? null
    // FATURA EDİLDİ seçilip tarih girilmemişse otomatik bugün — hızlı düzenleme
    // yollarıyla tutarlı olsun; yoksa iş ciroya hiç girmez (gelir kaçağı).
    if (!ekle.fatura_tarihi && (await faturaEdildiMi(supabase, ekle.fatura_durumu_id))) {
      ekle.fatura_tarihi = bugunTR()
    }
  }

  // Adet: aynı üründen birden çok → tek fiş no, her biri AYRI satır (kendi seri no'su)
  const adet = Math.max(1, Math.min(50, Number(formData.get("adet")) || 1))
  let ilkId: string
  if (adet <= 1) {
    const { data, error } = await supabase
      .from("is_kaydi")
      .insert(ekle)
      .select("id")
      .single()
    if (error || !data) {
      return {
        error: "Kayıt oluşturulamadı: " + (error?.message ?? "bilinmeyen hata"),
      }
    }
    ilkId = data.id
  } else {
    const seriler = formData.getAll("seri_no").map((v) => String(v).trim())
    const satirlar = Array.from({ length: adet }).map((_, i) => ({
      ...ekle,
      seri_no: seriler[i] ? buyuk(seriler[i]) : null,
    }))
    const { data, error } = await supabase
      .from("is_kaydi")
      .insert(satirlar)
      .select("id")
    if (error || !data || data.length === 0) {
      return {
        error: "Kayıtlar oluşturulamadı: " + (error?.message ?? "bilinmeyen hata"),
      }
    }
    ilkId = data[0].id
  }

  // Personelin eklediği işte yöneticilere push bildirim gönder (hata olsa da akış sürer)
  if (!finansal) {
    await yoneticilereBildir(supabase, {
      baslik: "Yeni iş kaydı",
      govde:
        `${kullanici.ad}: ${parsed.data.cihaz_adi}` +
        (adet > 1 ? ` (${adet} adet)` : ""),
      url: `/is/${ilkId}`,
      tag: `is-${ilkId}`,
    })
  }

  revalidatePath("/")
  // Yönlendirme/foto yükleme client'ta yapılır (ilk satırın id'si döndürülür)
  return { basari: true, id: ilkId }
}

export async function isGuncelle(
  id: string,
  _prev: IsFormState,
  formData: FormData
): Promise<IsFormState> {
  const kullanici = await getKullanici()

  const parsed = sema.safeParse(formdanOku(formData))
  if (!parsed.success) return alanHatalari(parsed.error)

  const supabase = await createClient()
  const m = await musteriIdCozumle(supabase, parsed.data)
  if ("hata" in m) return { error: m.hata }

  const finansal = kullanici.rol === "yonetici"
  const guncelle: TablesUpdate<"is_kaydi"> = temelSatir(parsed.data, m.id)
  // Fiş no değişmez (otomatik). Yalnız yönetici finansal alanları + şubeyi değiştirir.
  if (finansal) {
    guncelle.fatura_durumu_id = parsed.data.fatura_durumu_id ?? null
    guncelle.fiyat_teklifi = parsed.data.fiyat_teklifi ?? null
    guncelle.teklif_birim = parsed.data.teklif_birim ?? "TL"
    guncelle.fatura_tutari = parsed.data.fatura_tutari ?? null
    guncelle.fatura_tarihi = parsed.data.fatura_tarihi ?? null
    guncelle.garanti_no = parsed.data.garanti_no ?? null
    guncelle.talep_no = parsed.data.talep_no ?? null
    guncelle.sube_id = parsed.data.sube_id ?? null
    // FATURA EDİLDİ seçilip tarih boşsa otomatik bugün (hızlı düzenlemeyle tutarlı)
    if (!guncelle.fatura_tarihi && (await faturaEdildiMi(supabase, guncelle.fatura_durumu_id))) {
      guncelle.fatura_tarihi = bugunTR()
    }
  }

  const { error } = await supabase
    .from("is_kaydi")
    .update(guncelle)
    .eq("id", id)

  if (error) {
    return { error: "Kayıt güncellenemedi: " + error.message }
  }

  revalidatePath("/")
  revalidatePath(`/is/${id}`)
  return { basari: true } // sayfada kal, yeşil tik göster
}

// Yönetici: işler listesi önizleme panelinden hızlı finansal güncelleme
export async function isFinansalGuncelle(
  id: string,
  _prev: IsFormState,
  formData: FormData
): Promise<IsFormState> {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    return { error: "Bu işlem için yönetici yetkisi gerekir." }
  }

  const sayiCevir = (v: FormDataEntryValue | null): number | null => {
    const s = String(v ?? "").trim()
    if (!s) return null
    const n = Number(s.replace(",", "."))
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  const birimSec = (v: FormDataEntryValue | null): "TL" | "USD" | "EUR" | "CHF" => {
    const s = String(v ?? "").toUpperCase()
    return s === "USD" || s === "EUR" || s === "CHF" ? s : "TL"
  }
  const tarihSec = (v: FormDataEntryValue | null): string | null => {
    const s = String(v ?? "").trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
  }

  const supabase = await createClient()
  const faturaDurumuId = (formData.get("fatura_durumu_id") as string) || null
  let faturaTarihi = tarihSec(formData.get("fatura_tarihi"))
  // "FATURA EDİLDİ" seçilip tarih girilmemişse fatura tarihi otomatik bugün
  if (!faturaTarihi && faturaDurumuId) {
    const { data: fd } = await supabase
      .from("fatura_durumu")
      .select("ad")
      .eq("id", faturaDurumuId)
      .maybeSingle()
    if (fd?.ad?.toLocaleUpperCase("tr-TR") === "FATURA EDİLDİ") {
      faturaTarihi = new Date().toLocaleDateString("en-CA", {
        timeZone: "Europe/Istanbul",
      })
    }
  }
  const { error } = await supabase
    .from("is_kaydi")
    .update({
      fatura_durumu_id: faturaDurumuId,
      fiyat_teklifi: sayiCevir(formData.get("fiyat_teklifi")),
      teklif_birim: birimSec(formData.get("teklif_birim")),
      fatura_tutari: sayiCevir(formData.get("fatura_tutari")),
      fatura_tarihi: faturaTarihi,
      garanti_no:
        buyuk((formData.get("garanti_no") as string)?.trim() ?? "") || null,
      talep_no:
        buyuk((formData.get("talep_no") as string)?.trim() ?? "") || null,
    })
    .eq("id", id)

  if (error) return { error: "Kaydedilemedi: " + error.message }

  revalidatePath("/")
  revalidatePath(`/is/${id}`)
  return { basari: true }
}

// Bildirimleri temizle: okunmamış tüm işleri "görüldü" işaretle (yönetici).
export async function bildirimleriOkunduIsaretle() {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    return { ok: false, error: "Bu işlem için yönetici yetkisi gerekir." }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("is_kaydi")
    .update({ yonetici_gordu: true })
    .eq("yonetici_gordu", false)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/")
  return { ok: true }
}

// Sürükle-bırak: yönetici işi bir gruba (ya da null=DİĞER) atar.
export async function isGrupAta(id: string, grupId: string | null) {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    return { ok: false, error: "Bu işlem için yönetici yetkisi gerekir." }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("is_kaydi")
    .update({ grup_id: grupId })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/")
  return { ok: true }
}

// Geri al: taşımadan önceki firma/şube değerlerini geri yazar.
// Her iş kendi eski yerine döner (farklı yerlerden gelmiş olabilirler).
export async function isGeriAl(
  oncekiler: { id: string; grup_id: string | null; sube_id: string | null }[]
) {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    return { ok: false, error: "Bu işlem için yönetici yetkisi gerekir." }
  }
  if (oncekiler.length === 0) return { ok: true }
  const supabase = await createClient()
  // Aynı (grup, şube) çiftine dönecekleri tek sorguda topla
  const kumeler = new Map<string, string[]>()
  for (const o of oncekiler) {
    const anahtar = `${o.grup_id ?? ""}|${o.sube_id ?? ""}`
    const l = kumeler.get(anahtar) ?? []
    l.push(o.id)
    kumeler.set(anahtar, l)
  }
  for (const [anahtar, ids] of kumeler) {
    const [g, s] = anahtar.split("|")
    const { error } = await supabase
      .from("is_kaydi")
      .update({ grup_id: g || null, sube_id: s || null })
      .in("id", ids)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath("/")
  return { ok: true }
}

// Sürükle-bırak (çoklu): yönetici bir veya çok işi firmaya + şubeye taşır.
// grupId=null → DİĞER; subeId=null → ana firma (şubesiz).
export async function isTasima(
  ids: string[],
  grupId: string | null,
  subeId: string | null
) {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    return { ok: false, error: "Bu işlem için yönetici yetkisi gerekir." }
  }
  if (ids.length === 0) return { ok: true }
  const supabase = await createClient()
  const { error } = await supabase
    .from("is_kaydi")
    .update({ grup_id: grupId, sube_id: subeId })
    .in("id", ids)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/")
  return { ok: true }
}

// Excel gibi hücre-içi düzenleme. Bu alanlar YALNIZ yönetici tarafından değiştirilir.
const FINANSAL_ALAN = new Set([
  "fatura_durumu_id",
  "fatura_tarihi",
  "garanti_no",
  "talep_no",
  "teklif_no",
  "fiyat_teklifi",
  "teklif_birim",
  "fatura_tutari",
  "servis_no", // fiş no / firma stok kodu elle düzeltme
  "teknik_personel_id", // tekniker atama (personel yapamaz)
])

export async function isHucreGuncelle(
  id: string,
  alan: string,
  deger: string
): Promise<{ ok: boolean; error?: string }> {
  const kullanici = await getKullanici()
  const finansal = kullanici.rol === "yonetici"
  if (FINANSAL_ALAN.has(alan) && !finansal) {
    return { ok: false, error: "Bu alan için yönetici yetkisi gerekir." }
  }

  const supabase = await createClient()
  const t = deger.trim()
  const guncelle: TablesUpdate<"is_kaydi"> = {}

  switch (alan) {
    case "cihaz_adi":
      if (!t) return { ok: false, error: "Cihaz adı boş olamaz." }
      guncelle.cihaz_adi = buyuk(t)
      break
    case "kargo_takip_no":
    case "telefon":
      // Telefon rakam olduğundan büyük harf çevirmesi yok
      guncelle[alan] = t || null
      break
    case "seri_no":
    case "garanti_no":
    case "talep_no":
    case "teklif_no":
    case "servis_no":
    case "aciklama":
      guncelle[alan] = t ? buyuk(t) : null
      break
    case "teknik_personel_id":
      guncelle.teknik_personel_id = t || null
      break
    case "gelis_tarihi":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t))
        return { ok: false, error: "Geçerli tarih girin." }
      guncelle.gelis_tarihi = t
      break
    case "gelis_saat":
      if (t && !/^\d{2}:\d{2}(:\d{2})?$/.test(t))
        return { ok: false, error: "Geçerli saat girin." }
      guncelle.gelis_saat = t || null
      break
    case "cikis_tarihi":
    case "fatura_tarihi":
      if (t && !/^\d{4}-\d{2}-\d{2}$/.test(t))
        return { ok: false, error: "Geçerli tarih girin." }
      guncelle[alan] = t || null
      break
    case "fiyat_teklifi":
    case "fatura_tutari": {
      if (!t) {
        guncelle[alan] = null
      } else {
        const n = Number(t.replace(",", "."))
        if (!Number.isFinite(n) || n < 0)
          return { ok: false, error: "Geçerli tutar girin." }
        guncelle[alan] = n
      }
      break
    }
    case "durum_id":
      if (!t) return { ok: false, error: "Durum seçin." }
      guncelle.durum_id = t
      break
    case "fatura_durumu_id": {
      guncelle.fatura_durumu_id = t || null
      // "FATURA EDİLDİ" seçilince fatura tarihi otomatik bugün (yalnız boşsa — mevcut tarihi ezme)
      if (t) {
        const { data: fd } = await supabase
          .from("fatura_durumu")
          .select("ad")
          .eq("id", t)
          .maybeSingle()
        if (fd?.ad?.toLocaleUpperCase("tr-TR") === "FATURA EDİLDİ") {
          const { data: mevcut } = await supabase
            .from("is_kaydi")
            .select("fatura_tarihi")
            .eq("id", id)
            .maybeSingle()
          if (!mevcut?.fatura_tarihi) {
            guncelle.fatura_tarihi = new Date().toLocaleDateString("en-CA", {
              timeZone: "Europe/Istanbul",
            })
          }
        }
      }
      break
    }
    case "teklif_birim": {
      const b = t.toUpperCase()
      if (b !== "TL" && b !== "USD" && b !== "EUR" && b !== "CHF")
        return { ok: false, error: "Geçersiz para birimi." }
      guncelle.teklif_birim = b
      break
    }
    case "musteri": {
      // İsme göre müşteri bul ya da oluştur (Excel gibi elle firma girişi).
      if (!t) return { ok: false, error: "Firma adı boş olamaz." }
      const ad = buyuk(t)
      const { data: mevcut } = await supabase
        .from("musteri")
        .select("id")
        .ilike("ad", ad)
        .limit(1)
        .maybeSingle()
      let mid = mevcut?.id
      if (!mid) {
        const { data: yeni, error: mErr } = await supabase
          .from("musteri")
          .insert({ ad })
          .select("id")
          .single()
        if (mErr || !yeni) return { ok: false, error: "Firma oluşturulamadı." }
        mid = yeni.id
      }
      guncelle.musteri_id = mid
      break
    }
    default:
      return { ok: false, error: "Geçersiz alan." }
  }

  const { error } = await supabase.from("is_kaydi").update(guncelle).eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/")
  revalidatePath(`/is/${id}`)
  return { ok: true }
}

export async function isSil(id: string) {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    throw new Error("Bu işlem için yönetici yetkisi gerekir.")
  }

  const supabase = await createClient()
  // Önce depodaki fotoğrafları temizle (kota boşuna dolmasın)
  const { data: fotolar } = await supabase
    .from("foto")
    .select("dosya_yolu")
    .eq("is_kaydi_id", id)
  if (fotolar && fotolar.length > 0) {
    await supabase.storage.from("foto").remove(fotolar.map((f) => f.dosya_yolu))
  }
  const { error } = await supabase.from("is_kaydi").delete().eq("id", id)
  if (error) {
    throw new Error("Kayıt silinemedi: " + error.message)
  }

  revalidatePath("/")
  redirect("/")
}
