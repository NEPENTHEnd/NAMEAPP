import ExcelJS from "exceljs"

// İş kaydı rapor/yedek Excel'i — tüm alanlar dahil ("her veri").
export type RaporSatir = {
  servis_no: string | null
  takip_no: string | null
  cihaz_adi: string
  seri_no: string | null
  gelis_tarihi: string | null
  cikis_tarihi: string | null
  ilgili_kisi: string | null
  adres: string | null
  garanti_no: string | null
  kargo_takip_no: string | null
  fiyat_teklifi: number | null
  fatura_tutari: number | null
  aciklama: string | null
  musteri: { ad: string | null; sube_sehir: string | null } | null
  durum: { ad: string | null } | null
  teknik_personel: { ad: string | null } | null
  fatura_durumu: { ad: string | null } | null
}

// Supabase select ifadesi (rapor + yedek için ortak).
export const RAPOR_SELECT = `
  servis_no, takip_no, cihaz_adi, seri_no, gelis_tarihi, cikis_tarihi,
  ilgili_kisi, adres, garanti_no, kargo_takip_no, fiyat_teklifi, fatura_tutari, aciklama,
  musteri:musteri_id ( ad, sube_sehir ),
  durum:durum_id ( ad ),
  teknik_personel:teknik_personel_id ( ad ),
  fatura_durumu:fatura_durumu_id ( ad )
`

function tarihTR(s: string | null): string {
  if (!s) return ""
  const [y, m, g] = s.split("-")
  return `${g}.${m}.${y}`
}

export async function raporExcelBuffer(satirlar: RaporSatir[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Name Teknik"
  const ws = wb.addWorksheet("İşler", { views: [{ state: "frozen", ySplit: 1 }] })

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
    { header: "Adres", key: "adres", width: 30 },
    { header: "Garanti No", key: "garanti", width: 16 },
    { header: "Kargo Takip No", key: "kargo", width: 18 },
    { header: "Fiyat Teklifi", key: "teklif", width: 14 },
    { header: "Fatura Tutarı", key: "tutar", width: 14 },
    { header: "Servis/Fiş No", key: "servis", width: 14 },
    { header: "Takip No", key: "takip", width: 12 },
    { header: "Açıklama", key: "aciklama", width: 40 },
  ]

  for (const k of satirlar) {
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
      adres: k.adres ?? "",
      garanti: k.garanti_no ?? "",
      kargo: k.kargo_takip_no ?? "",
      teklif: k.fiyat_teklifi ?? null,
      tutar: k.fatura_tutari ?? null,
      servis: k.servis_no ?? "",
      takip: k.takip_no ?? "",
      aciklama: k.aciklama ?? "",
    })
  }

  const baslik = ws.getRow(1)
  baslik.font = { bold: true, color: { argb: "FFFFFFFF" } }
  baslik.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } }
  baslik.alignment = { vertical: "middle" }
  baslik.height = 20
  ;["teklif", "tutar"].forEach((key) => {
    ws.getColumn(key).numFmt = "#,##0 ₺"
  })
  ws.autoFilter = { from: "A1", to: "R1" }

  const ab = await wb.xlsx.writeBuffer()
  return Buffer.from(ab)
}
