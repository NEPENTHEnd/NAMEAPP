import { createClient } from "@/lib/supabase/server"

// İş formu ve filtreler için ortak liste verileri.
export async function getIsFormSecenekleri() {
  const supabase = await createClient()
  const [musteriler, durumlar, personeller, faturaDurumlari] =
    await Promise.all([
      supabase.from("musteri").select("id, ad").eq("aktif", true).order("ad"),
      supabase.from("durum").select("id, ad").order("sira"),
      supabase
        .from("teknik_personel")
        .select("id, ad")
        .eq("aktif", true)
        .order("ad"),
      supabase.from("fatura_durumu").select("id, ad").order("ad"),
    ])

  return {
    musteriler: musteriler.data ?? [],
    durumlar: durumlar.data ?? [],
    personeller: personeller.data ?? [],
    faturaDurumlari: faturaDurumlari.data ?? [],
  }
}
