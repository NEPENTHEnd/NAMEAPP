import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"
import { filtreleriOku, aramaOrIfadesi } from "@/lib/isler-sorgu"
import { raporExcelBuffer, RAPOR_SELECT, type RaporSatir } from "@/lib/rapor-excel"

export async function GET(request: Request) {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    return new Response("Bu işlem için yönetici yetkisi gerekir.", { status: 403 })
  }

  const sp = Object.fromEntries(new URL(request.url).searchParams.entries())
  const filtre = filtreleriOku(sp)

  const supabase = await createClient()
  let sorgu = supabase.from("is_kaydi").select(RAPOR_SELECT)
  if (filtre.durum) sorgu = sorgu.eq("durum_id", filtre.durum)
  if (filtre.personel) sorgu = sorgu.eq("teknik_personel_id", filtre.personel)
  if (filtre.fatura) sorgu = sorgu.eq("fatura_durumu_id", filtre.fatura)
  if (filtre.musteri) sorgu = sorgu.eq("musteri_id", filtre.musteri)
  if (filtre.baslangic) sorgu = sorgu.gte("gelis_tarihi", filtre.baslangic)
  if (filtre.bitis) sorgu = sorgu.lte("gelis_tarihi", filtre.bitis)
  const orStr = await aramaOrIfadesi(supabase, filtre.q)
  if (orStr) sorgu = sorgu.or(orStr)

  const { data, error } = await sorgu
    .order("gelis_tarihi", { ascending: false })
    .range(0, 9999)

  if (error) {
    return new Response("Veri alınamadı: " + error.message, { status: 500 })
  }

  const buffer = await raporExcelBuffer((data ?? []) as unknown as RaporSatir[])
  const bugun = new Date().toISOString().slice(0, 10)

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="name-teknik-rapor-${bugun}.xlsx"`,
    },
  })
}
