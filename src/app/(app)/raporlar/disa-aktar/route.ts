import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"
import { filtreleriOku, aramaOrIfadesi } from "@/lib/isler-sorgu"
import { ayAraligi } from "@/lib/aylar"
import { raporExcelBuffer, RAPOR_SELECT, type RaporSatir } from "@/lib/rapor-excel"

// Türkçe karakterleri ASCII'ye indir (Content-Disposition latin-1 dışını sevmez)
function asciiTr(s: string): string {
  const harita: Record<string, string> = {
    Ş: "S", ş: "s", İ: "I", ı: "i", Ğ: "G", ğ: "g",
    Ü: "U", ü: "u", Ö: "O", ö: "o", Ç: "C", ç: "c",
  }
  return s
    .replace(/[ŞşİıĞğÜüÖöÇç]/g, (m) => harita[m] ?? m)
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function GET(request: Request) {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    return new Response("Bu işlem için yönetici yetkisi gerekir.", { status: 403 })
  }

  const sp = Object.fromEntries(new URL(request.url).searchParams.entries())
  const filtre = filtreleriOku(sp)
  const grup = sp.grup ?? "" // "" | "diger" | grup id
  const ay = sp.ay ?? "" // "2026-08" gibi

  const supabase = await createClient()
  let sorgu = supabase.from("is_kaydi").select(RAPOR_SELECT)
  // Firma (grup): "diger" = grupsuz, aksi halde grup id
  if (grup === "diger") sorgu = sorgu.is("grup_id", null)
  else if (grup) sorgu = sorgu.eq("grup_id", grup)
  if (filtre.durum) sorgu = sorgu.eq("durum_id", filtre.durum)
  if (filtre.personel) sorgu = sorgu.eq("teknik_personel_id", filtre.personel)
  if (filtre.fatura) sorgu = sorgu.eq("fatura_durumu_id", filtre.fatura)
  if (filtre.musteri) sorgu = sorgu.eq("musteri_id", filtre.musteri)
  // Ay: o ay GELEN işler (geliş tarihi o ayda). İndirme bir İŞ LİSTESİ olduğundan
  // "Ağustos" = Ağustos'ta gelen işler ("Ağustos'ta faturalanan" değil). Ciro
  // raporları (matris/balon/pano/aylık özet) ayrıca fatura ayına göre çalışır.
  const ar = ay ? ayAraligi(ay) : null
  if (ar) {
    sorgu = sorgu.gte("gelis_tarihi", ar.baslangic).lte("gelis_tarihi", ar.bitis)
  } else {
    if (filtre.baslangic) sorgu = sorgu.gte("gelis_tarihi", filtre.baslangic)
    if (filtre.bitis) sorgu = sorgu.lte("gelis_tarihi", filtre.bitis)
  }
  const orStr = await aramaOrIfadesi(supabase, filtre.q)
  if (orStr) sorgu = sorgu.or(orStr)

  const { data, error } = await sorgu
    .order("gelis_tarihi", { ascending: false })
    .range(0, 9999)

  if (error) {
    return new Response("Veri alınamadı: " + error.message, { status: 500 })
  }

  // Dosya adı: firma + ay (varsa) — güvenli ASCII
  let firmaEtiket = "tum-firmalar"
  if (grup === "diger") firmaEtiket = "DIGER"
  else if (grup) {
    const { data: g } = await supabase.from("grup").select("ad").eq("id", grup).maybeSingle()
    if (g?.ad) firmaEtiket = asciiTr(g.ad)
  }
  const ayEtiket = ay ? `-${ay}` : ""
  const bugun = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })
  const dosyaAdi = `name-teknik-${firmaEtiket}${ayEtiket}-${bugun}.xlsx`

  const buffer = await raporExcelBuffer((data ?? []) as unknown as RaporSatir[])

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${dosyaAdi}"`,
    },
  })
}
