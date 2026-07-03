import ExcelJS from "exceljs"

// İş kaydı rapor/yedek Excel'i — ORİJİNAL çalışma dosyasının düzeninde:
// her firma (grup) ayrı sayfa, satırlar SONUÇ/DURUM değerine göre boyalı.
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
  grup: { ad: string | null; sira: number | null } | null
}

// Supabase select ifadesi (rapor + aylık yedek için ortak).
export const RAPOR_SELECT = `
  servis_no, takip_no, cihaz_adi, seri_no, gelis_tarihi, cikis_tarihi,
  ilgili_kisi, adres, garanti_no, kargo_takip_no, fiyat_teklifi, fatura_tutari, aciklama,
  musteri:musteri_id ( ad, sube_sehir ),
  durum:durum_id ( ad ),
  teknik_personel:teknik_personel_id ( ad ),
  fatura_durumu:fatura_durumu_id ( ad ),
  grup:grup_id ( ad, sira )
`

// Orijinal dosyadaki koşullu biçim kuralları (DİĞER sayfasından, öncelik
// sırasıyla): önce SONUÇ (fatura durumu), araya BAKILMADI, sonra kalanlar.
type RenkKural = {
  kaynak: "fatura" | "durum"
  deger: string
  bg: string // ARGB
  yazi: string // ARGB
}

const RENK_KURALLARI: RenkKural[] = [
  { kaynak: "fatura", deger: "FATURA EDİLDİ", bg: "FF00FF00", yazi: "FF000000" },
  { kaynak: "fatura", deger: "SONUÇ BEKLİYOR", bg: "FFFFF2CC", yazi: "FF000000" },
  { kaynak: "fatura", deger: "İADE", bg: "FFFF0000", yazi: "FFFFFFFF" },
  { kaynak: "fatura", deger: "ÇALIŞMADI", bg: "FFFF0000", yazi: "FFFFFFFF" },
  { kaynak: "fatura", deger: "PEŞİN ALINDI", bg: "FF00FF00", yazi: "FF000000" },
  { kaynak: "fatura", deger: "GARANTİ", bg: "FF6FA8DC", yazi: "FFFFFFFF" },
  { kaynak: "durum", deger: "BAKILMADI", bg: "FF666666", yazi: "FFFFFFFF" },
  { kaynak: "fatura", deger: "FATURA EDİLECEK", bg: "FFFF00FF", yazi: "FFFFFFFF" },
  { kaynak: "fatura", deger: "TEKLİF VERİLECEK", bg: "FF00FFFF", yazi: "FF000000" },
  { kaynak: "fatura", deger: "TEKLİF VERİLDİ", bg: "FFFFFF00", yazi: "FFFF0000" },
  { kaynak: "fatura", deger: "SAĞLAM", bg: "FF6FA8DC", yazi: "FFFFFFFF" },
  { kaynak: "fatura", deger: "ARANILDI", bg: "FFF6B26B", yazi: "FF000000" },
  { kaynak: "fatura", deger: "ÜCRET ALINACAK", bg: "FF93C47D", yazi: "FF000000" },
  { kaynak: "fatura", deger: "BEDELSİZ", bg: "FF00FF00", yazi: "FFFF0000" },
  { kaynak: "fatura", deger: "CARİ İŞLENDİ", bg: "FF00FF00", yazi: "FF000000" },
  { kaynak: "fatura", deger: "TEKLİF HAZIRLANDI", bg: "FF0000FF", yazi: "FFFFFFFF" },
  { kaynak: "fatura", deger: "LİSTEYE AKTARILDI", bg: "FF5B0F00", yazi: "FFFFFFFF" },
  { kaynak: "fatura", deger: "BAKIM YAPILDI", bg: "FFFFF2CC", yazi: "FF000000" },
  { kaynak: "durum", deger: "GERİ GELEN", bg: "FF741B47", yazi: "FFFFFFFF" },
  { kaynak: "durum", deger: "SAĞLAM", bg: "FF6FA8DC", yazi: "FF000000" },
]

function satirRengi(k: RaporSatir): RenkKural | null {
  const fatura = k.fatura_durumu?.ad ?? ""
  const durum = k.durum?.ad ?? ""
  for (const kural of RENK_KURALLARI) {
    if (kural.kaynak === "fatura" && fatura === kural.deger) return kural
    if (kural.kaynak === "durum" && durum === kural.deger) return kural
  }
  return null
}

function tarihTR(s: string | null): string {
  if (!s) return ""
  const [y, m, g] = s.split("-")
  return `${g}.${m}.${y}`
}

// Excel sayfa adı kuralları: 31 karakter, []:*?/\ yasak
function sayfaAdi(ad: string): string {
  return ad.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sayfa"
}

export async function raporExcelBuffer(satirlar: RaporSatir[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Name Teknik"

  // Firma (grup) bazında böl — orijinaldeki gibi: önce DİĞER, sonra sıraya göre
  const gruplu = new Map<string, { sira: number; satirlar: RaporSatir[] }>()
  for (const k of satirlar) {
    const ad = k.grup?.ad ?? "DİĞER"
    const sira = k.grup ? (k.grup.sira ?? 999) : -1 // DİĞER en başta
    const g = gruplu.get(ad) ?? { sira, satirlar: [] }
    g.satirlar.push(k)
    gruplu.set(ad, g)
  }
  const sayfalar = [...gruplu.entries()].sort((a, b) => a[1].sira - b[1].sira)

  for (const [grupAd, { satirlar: rows }] of sayfalar) {
    const ws = wb.addWorksheet(sayfaAdi(grupAd), {
      views: [{ state: "frozen", ySplit: 1 }],
    })
    const boyteks = grupAd === "BOYTEKS"

    // Orijinal DİĞER sayfası düzeni (fotoğraf sütunları hariç)
    ws.columns = [
      { header: "FİRMA ADI", key: "musteri", width: 24 },
      { header: "ÜRÜNÜN ADI VEYA KODU", key: "cihaz", width: 38 },
      { header: "GELİŞ TARİHİ", key: "gelis", width: 13 },
      { header: "ÇIKIŞ TARİHİ", key: "cikis", width: 13 },
      { header: "DURUM", key: "durum", width: 13 },
      { header: "TEKNİK PERSONEL", key: "personel", width: 17 },
      { header: "SONUÇ", key: "sonuc", width: 17 },
      { header: "İLGİLİ KİŞİ", key: "ilgili", width: 22 },
      { header: "FİYAT TEKLİFİ", key: "teklif", width: 13 },
      { header: "FATURA BİRİM TUTARI", key: "tutar", width: 14 },
      { header: boyteks ? "FİRMA STOK KODU" : "FİŞ NO", key: "servis", width: 15 },
      { header: "SERİ NO", key: "seri", width: 16 },
      { header: "AÇIKLAMA", key: "aciklama", width: 44 },
    ]

    for (const k of rows) {
      const satir = ws.addRow({
        musteri: k.musteri?.ad ?? "",
        cihaz: k.cihaz_adi,
        gelis: tarihTR(k.gelis_tarihi),
        cikis: tarihTR(k.cikis_tarihi),
        durum: k.durum?.ad ?? "",
        personel: k.teknik_personel?.ad ?? "",
        sonuc: k.fatura_durumu?.ad ?? "",
        ilgili: k.ilgili_kisi ?? "",
        teklif: k.fiyat_teklifi ?? null,
        tutar: k.fatura_tutari ?? null,
        servis: k.servis_no ?? "",
        seri: k.seri_no ?? "",
        aciklama: k.aciklama ?? "",
      })
      // Orijinaldeki koşullu renk: SONUÇ öncelikli, yoksa DURUM
      const renk = satirRengi(k)
      if (renk) {
        for (let c = 1; c <= 13; c++) {
          const hucre = satir.getCell(c)
          hucre.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: renk.bg },
          }
          hucre.font = { ...hucre.font, color: { argb: renk.yazi } }
        }
      }
    }

    // Başlık satırı: orijinaldeki gibi kalın (dolgu yok)
    const baslik = ws.getRow(1)
    baslik.font = { bold: true, size: 11, name: "Montserrat" }
    baslik.alignment = { vertical: "middle" }
    baslik.height = 20
    ;["teklif", "tutar"].forEach((key) => {
      ws.getColumn(key).numFmt = "#,##0"
    })
    ws.autoFilter = { from: "A1", to: "M1" }
  }

  const ab = await wb.xlsx.writeBuffer()
  return Buffer.from(ab)
}
