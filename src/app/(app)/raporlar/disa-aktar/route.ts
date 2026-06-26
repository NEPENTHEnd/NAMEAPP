import ExcelJS from "exceljs"

import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"
import { filtreleriOku, aramaOrIfadesi } from "@/lib/isler-sorgu"

function tarihTR(s: string | null): string {
  if (!s) return ""
  const [y, m, g] = s.split("-")
  return `${g}.${m}.${y}`
}

export async function GET(request: Request) {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    return new Response("Bu işlem için yönetici yetkisi gerekir.", { status: 403 })
  }

  const sp = Object.fromEntries(new URL(request.url).searchParams.entries())
  const filtre = filtreleriOku(sp)

  const supabase = await createClient()
  let sorgu = supabase.from("is_kaydi").select(
    `
      servis_no, cihaz_adi, seri_no, gelis_tarihi, cikis_tarihi,
      ilgili_kisi, fiyat_teklifi, fatura_tutari, aciklama,
      musteri:musteri_id ( ad, sube_sehir ),
      durum:durum_id ( ad ),
      teknik_personel:teknik_personel_id ( ad ),
      fatura_durumu:fatura_durumu_id ( ad )
    `
  )
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

  // --- Excel oluştur (eski dosya düzenine yakın, biçimlendirilmiş) ---
  const wb = new ExcelJS.Workbook()
  wb.creator = "Name Teknik"
  const ws = wb.addWorksheet("İşler", {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  ws.columns = [
    { header: "Firma Adı", key: "musteri", width: 26 },
    { header: "Şube/Şehir", key: "sube", width: 14 },
    { header: "Cihaz / Kart", key: "cihaz", width: 36 },
    { header: "Seri No", key: "seri", width: 16 },
    { header: "Geliş", key: "gelis", width: 12 },
    { header: "Çıkış", key: "cikis", width: 12 },
    { header: "Durum", key: "durum", width: 14 },
    { header: "Teknik Personel", key: "personel", width: 16 },
    { header: "Fatura Durumu", key: "fatura", width: 18 },
    { header: "İlgili Kişi", key: "ilgili", width: 22 },
    { header: "Fiyat Teklifi", key: "teklif", width: 14 },
    { header: "Fatura Tutarı", key: "tutar", width: 14 },
    { header: "Servis/Fiş No", key: "servis", width: 14 },
    { header: "Açıklama", key: "aciklama", width: 40 },
  ]

  for (const k of data ?? []) {
    ws.addRow({
      musteri: k.musteri?.ad ?? "",
      sube: k.musteri?.sube_sehir ?? "",
      cihaz: k.cihaz_adi,
      seri: k.seri_no ?? "",
      gelis: tarihTR(k.gelis_tarihi),
      cikis: tarihTR(k.cikis_tarihi),
      durum: k.durum?.ad ?? "",
      personel: k.teknik_personel?.ad ?? "",
      fatura: k.fatura_durumu?.ad ?? "",
      ilgili: k.ilgili_kisi ?? "",
      teklif: k.fiyat_teklifi ?? null,
      tutar: k.fatura_tutari ?? null,
      servis: k.servis_no ?? "",
      aciklama: k.aciklama ?? "",
    })
  }

  // Başlık satırı stili
  const baslik = ws.getRow(1)
  baslik.font = { bold: true, color: { argb: "FFFFFFFF" } }
  baslik.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // slate-800
  }
  baslik.alignment = { vertical: "middle" }
  baslik.height = 20

  // Para sütunları biçimi
  ;["teklif", "tutar"].forEach((key) => {
    ws.getColumn(key).numFmt = "#,##0 ₺"
  })

  ws.autoFilter = { from: "A1", to: "N1" }

  const buffer = await wb.xlsx.writeBuffer()
  const bugun = new Date().toISOString().slice(0, 10)

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="name-teknik-rapor-${bugun}.xlsx"`,
    },
  })
}
