import ExcelJS from "exceljs"

// İş kaydı rapor/yedek Excel'i — ORİJİNAL çalışma dosyasıyla birebir:
// her firma kendi sayfasında, sayfaların sütun düzenleri orijinaldeki gibi
// (BOYTEKS: FİRMA STOK KODU, TCDD: ŞEHİR/KART NO/TEKNİK ETİKET, ...),
// satırlar SONUÇ (yoksa DURUM) değerine göre orijinal renklerle boyalı.
export type RaporSatir = {
  servis_no: string | null
  takip_no: string | null
  cihaz_adi: string
  seri_no: string | null
  gelis_tarihi: string | null
  gelis_saat: string | null
  cikis_tarihi: string | null
  ilgili_kisi: string | null
  telefon: string | null
  adres: string | null
  garanti_no: string | null
  kargo_takip_no: string | null
  fiyat_teklifi: number | null
  teklif_birim: string | null
  fatura_tutari: number | null
  fatura_tarihi: string | null
  aciklama: string | null
  musteri: { ad: string | null; sube_sehir: string | null } | null
  sube: { ad: string | null } | null
  durum: { ad: string | null } | null
  teknik_personel: { ad: string | null } | null
  fatura_durumu: { ad: string | null } | null
  grup: { ad: string | null; sira: number | null } | null
}

// Supabase select ifadesi (rapor + aylık yedek için ortak).
export const RAPOR_SELECT = `
  servis_no, takip_no, cihaz_adi, seri_no, gelis_tarihi, gelis_saat, cikis_tarihi,
  ilgili_kisi, telefon, adres, garanti_no, kargo_takip_no,
  fiyat_teklifi, teklif_birim, fatura_tutari, fatura_tarihi, aciklama,
  musteri:musteri_id ( ad, sube_sehir ),
  sube:sube_id ( ad ),
  durum:durum_id ( ad ),
  teknik_personel:teknik_personel_id ( ad ),
  fatura_durumu:fatura_durumu_id ( ad ),
  grup:grup_id ( ad, sira )
`

// ---------------------------------------------------------------------------
// Renkler: orijinal dosyadaki koşullu biçim kuralları (öncelik sırasıyla)
// ---------------------------------------------------------------------------
type RenkKural = { kaynak: "fatura" | "durum"; deger: string; bg: string; yazi: string }

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

function satirRengi(fatura: string, durum: string): RenkKural | null {
  for (const k of RENK_KURALLARI) {
    if (k.kaynak === "fatura" && fatura === k.deger) return k
    if (k.kaynak === "durum" && durum === k.deger) return k
  }
  return null
}

// ---------------------------------------------------------------------------
// Sayfa şablonları: orijinal dosyadaki başlık dizilişleri (fotoğraflar hariç)
// ---------------------------------------------------------------------------
type Alan =
  | "musteri" | "cihaz" | "gelis" | "cikis" | "durum" | "personel" | "sonuc"
  | "servis" | "seri" | "aciklama" | "teklif" | "tutar" | "ilgili"
  | "kartno" | "talepno" | "teklifno" | "etiket" | "tsnNot"
  // Sonradan eklenen alanlar (yalnız veri varsa sütun açılır)
  | "sube" | "gelisSaat" | "telefon" | "teklifBirim" | "faturaTarihi"

type Kolon = [baslik: string, alan: Alan]

const SABLONLAR: Record<string, Kolon[]> = {
  "DİĞER": [
    ["FİRMA ADI", "musteri"], ["KARTIN ADI", "cihaz"], ["GELİŞ TARİHİ", "gelis"],
    ["ÇIKIŞ TARİHİ", "cikis"], ["DURUM", "durum"], ["TEKNİK PERSONEL", "personel"],
    ["SONUÇ", "sonuc"], ["İLGİLİ KİŞİ", "ilgili"], ["FİYAT TEKLİFİ", "teklif"],
    ["FATURA BİRİM TUTARI", "tutar"], ["FİŞ NO", "servis"], ["AÇIKLAMA / SERİ NO", "aciklama"],
  ],
  "ŞİRKİŞOĞLU": [
    ["ÜRÜNÜN ADI VEYA KODU", "cihaz"], ["GELİŞ TARİHİ", "gelis"], ["ÇIKIŞ TARİHİ", "cikis"],
    ["DURUM  BİLGİSİ", "durum"], ["TEKNİK PERSONEL", "personel"], ["SONUÇ", "sonuc"],
    ["TEKNİK SERVİS NO", "servis"], ["AÇIKLAMA", "aciklama"], ["FİYAT TEKLİFİ", "teklif"],
    ["FATURA BİRİM TUTARI", "tutar"], ["SERİ NO", "seri"],
  ],
  "BOYTEKS": [
    ["FİRMA STOK KODU", "servis"], ["ÜRÜNÜN ADI VEYA KODU", "cihaz"], ["GELİŞ TARİHİ", "gelis"],
    ["ÇIKIŞ TARİHİ", "cikis"], ["DURUM  BİLGİSİ", "durum"], ["TEKNİK PERSONEL", "personel"],
    ["SONUÇ", "sonuc"], ["TEKNİK SERVİS NO", "tsnNot"], ["TEKLİF NO", "teklifno"],
    ["TEKLİF BİRİM FİYAT", "teklif"], ["FATURA BİRİM TUTARI", "tutar"],
  ],
  "BOYDAK GRUP": [
    ["FİRMA ADI", "musteri"], ["ÜRÜNÜN ADI VEYA KODU", "cihaz"], ["GELİŞ TARİHİ", "gelis"],
    ["ÇIKIŞ TARİHİ", "cikis"], ["DURUM  BİLGİSİ", "durum"], ["TEKNİK PERSONEL", "personel"],
    ["SONUÇ", "sonuc"], ["TEKNİK SERVİS NO", "servis"], ["AÇIKLAMA", "aciklama"],
    ["TEKLİF FİYATI", "teklif"], ["FATURA BİRİM TUTARI", "tutar"],
  ],
  "BOYTAŞ-3": [
    ["ÜRÜNÜN ADI VEYA KODU", "cihaz"], ["GELİŞ TARİHİ", "gelis"], ["ÇIKIŞ TARİHİ", "cikis"],
    ["DURUM  BİLGİSİ", "durum"], ["TEKNİK PERSONEL", "personel"], ["SONUÇ", "sonuc"],
    ["TEKNİK SERVİS NO", "servis"], ["AÇIKLAMA", "aciklama"], ["TEKLİF FİYAT", "teklif"],
    ["FATURA BİRİM TUTARI", "tutar"],
  ],
  "HASÇELİK KABLO": [
    ["ŞUBE ADI", "musteri"], ["ÜRÜNÜN ADI VEYA KODU", "cihaz"], ["GELİŞ TARİHİ", "gelis"],
    ["ÇIKIŞ TARİHİ", "cikis"], ["DURUM  BİLGİSİ", "durum"], ["TEKNİK PERSONEL", "personel"],
    ["SONUÇ", "sonuc"], ["TEKNİK SERVİS NO", "servis"], ["ÜRÜN SERİ NO", "seri"],
    ["TEKLİF FİYATI", "teklif"], ["FATURA BİRİM TUTARI", "tutar"], ["AÇIKLAMA", "aciklama"],
  ],
  "HASÇELİK HALAT": [
    ["ŞUBE ADI", "musteri"], ["ÜRÜNÜN ADI VEYA KODU", "cihaz"], ["GELİŞ TARİHİ", "gelis"],
    ["ÇIKIŞ TARİHİ", "cikis"], ["DURUM  BİLGİSİ", "durum"], ["TEKNİK PERSONEL", "personel"],
    ["SONUÇ", "sonuc"], ["TEKNİK SERVİS NO", "servis"], ["AÇIKLAMA", "aciklama"],
    ["TEKLİF FİYATI", "teklif"], ["FATURA BİRİM TUTARI", "tutar"], ["ÜRÜN SERİ NO", "seri"],
  ],
  "TEXHONG": [
    ["ÜRÜNÜN ADI VEYA KODU", "cihaz"], ["GELİŞ TARİHİ", "gelis"], ["ÇIKIŞ TARİHİ", "cikis"],
    ["DURUM  BİLGİSİ", "durum"], ["TEKNİK PERSONEL", "personel"], ["SONUÇ", "sonuc"],
    ["TEKNİK SERVİS NO", "servis"], ["AÇIKLAMA", "aciklama"], ["TEKLİF FİYATI", "teklif"],
    ["FATURA BİRİM TUTARI", "tutar"],
  ],
  "MEGA METAL": [
    ["ÜRÜNÜN ADI VEYA KODU", "cihaz"], ["GELİŞ TARİHİ", "gelis"], ["ÇIKIŞ TARİHİ", "cikis"],
    ["DURUM  BİLGİSİ", "durum"], ["TEKNİK PERSONEL", "personel"], ["SONUÇ", "sonuc"],
    ["TEKNİK SERVİS NO", "servis"], ["AÇIKLAMA", "aciklama"], ["TEKLİF FİYATI", "teklif"],
    ["FATURA BİRİM TUTARI", "tutar"], ["TALEP NO", "talepno"],
  ],
  "ŞALT": [
    ["KARTIN ADI", "cihaz"], ["SERİ NO", "seri"], ["GELİŞ TARİHİ", "gelis"],
    ["ÇIKIŞ TARİHİ", "cikis"], ["DURUM", "durum"], ["FİŞ NO", "servis"],
    ["TEKNİK PERSONEL", "personel"], ["FATURA", "sonuc"], ["FİYAT TEKLİFİ", "teklif"],
    ["FATURA BİRİM TUTARI", "tutar"], ["AÇIKLAMA / SERİ NO", "aciklama"],
  ],
  "TCDD": [
    ["ŞEHİR", "musteri"], ["KARTIN ADI", "cihaz"], ["GELİŞ TARİHİ", "gelis"],
    ["ÇIKIŞ TARİHİ", "cikis"], ["DURUM", "durum"], ["TEKNİK PERSONEL", "personel"],
    ["FATURA", "sonuc"], ["KART NO", "kartno"], ["SERİ NO", "seri"],
    ["TEKNİK ETİKET", "etiket"], ["TEKLİF FİYAT", "teklif"], ["FATURA BİRİM TUTARI", "tutar"],
  ],
  "KİH": [
    ["KARTIN ADI", "cihaz"], ["GELİŞ TARİHİ", "gelis"], ["ÇIKIŞ TARİHİ", "cikis"],
    ["DURUM", "durum"], ["TEKNİK PERSONEL", "personel"], ["FATURA", "sonuc"],
    ["TEKNİK SERVİS NO", "servis"], ["KART NO", "kartno"], ["AÇIKLAMA", "aciklama"],
    ["TEKLİF FİYATI", "teklif"], ["FATURA BİRİM TUTARI", "tutar"], ["SERİ NUMARASI", "seri"],
  ],
  "SERSİM": [
    ["KARTIN ADI", "cihaz"], ["GELİŞ TARİHİ", "gelis"], ["ÇIKIŞ TARİHİ", "cikis"],
    ["DURUM", "durum"], ["TEKNİK PERSONEL", "personel"], ["FATURA", "sonuc"],
    ["KART NO", "kartno"], ["AÇIKLAMA", "aciklama"], ["TEKLİF FİYAT", "teklif"],
    ["FATURA BİRİM TUTARI", "tutar"], ["SERİ NO", "seri"],
  ],
  "BORSAN": [
    ["KARTIN ADI", "cihaz"], ["GELİŞ TARİHİ", "gelis"], ["ÇIKIŞ TARİHİ", "cikis"],
    ["DURUM", "durum"], ["TEKNİK PERSONEL", "personel"], ["FATURA", "sonuc"],
    ["AÇIKLAMA", "aciklama"], ["TEKLİF FİYAT", "teklif"], ["FATURA BİRİM TUTARI", "tutar"],
    ["TALEP NO", "talepno"],
  ],
  "BAŞYAZICIOĞLU": [
    ["ÜRÜNÜN ADI VEYA KODU", "cihaz"], ["GELİŞ TARİHİ", "gelis"], ["ÇIKIŞ TARİHİ", "cikis"],
    ["DURUM  BİLGİSİ", "durum"], ["TEKNİK PERSONEL", "personel"], ["SONUÇ", "sonuc"],
    ["TEKNİK SERVİS NO", "servis"], ["AÇIKLAMA", "aciklama"], ["TEKLİF FİYATI", "teklif"],
    ["FATURA BİRİM TUTARI", "tutar"], ["ÜRÜN SERİ NO", "seri"],
  ],
  "MES ET": [
    ["ÜRÜNÜN ADI VEYA KODU", "cihaz"], ["GELİŞ TARİHİ", "gelis"], ["ÇIKIŞ TARİHİ", "cikis"],
    ["DURUM  BİLGİSİ", "durum"], ["TEKNİK PERSONEL", "personel"], ["SONUÇ", "sonuc"],
    ["TEKNİK SERVİS NO", "servis"], ["AÇIKLAMA", "aciklama"], ["TEKLİF FİYATI", "teklif"],
    ["FATURA BİRİM TUTARI", "tutar"],
  ],
  "DOĞUŞ": [
    ["ŞUBE", "musteri"], ["KARTIN ADI", "cihaz"], ["GELİŞ TARİHİ", "gelis"],
    ["ÇIKIŞ TARİHİ", "cikis"], ["DURUM", "durum"], ["TEKNİK PERSONEL", "personel"],
    ["FATURA", "sonuc"], ["KART NO", "kartno"], ["AÇIKLAMA", "aciklama"],
    ["TEKLİF FİYAT", "teklif"], ["FATURA BİRİM TUTARI", "tutar"],
  ],
  "SİTAŞ": [
    ["KARTIN ADI", "cihaz"], ["GELİŞ TARİHİ", "gelis"], ["ÇIKIŞ TARİHİ", "cikis"],
    ["DURUM", "durum"], ["TEKNİK PERSONEL", "personel"], ["FATURA", "sonuc"],
    ["TEKNİK SERVİS NO", "servis"], ["AÇIKLAMA", "aciklama"], ["TEKLİF FİYAT", "teklif"],
    ["FATURA BİRİM TUTARI", "tutar"], ["SERİ NUMARASI", "seri"],
  ],
  "RES": [
    ["ŞUBE ADI", "musteri"], ["ÜRÜNÜN ADI VEYA KODU", "cihaz"], ["GELİŞ TARİHİ", "gelis"],
    ["ÇIKIŞ TARİHİ", "cikis"], ["DURUM  BİLGİSİ", "durum"], ["TEKNİK PERSONEL", "personel"],
    ["SONUÇ", "sonuc"], ["TEKNİK SERVİS NO", "servis"], ["AÇIKLAMA", "aciklama"],
    ["TEKLİF FİYATI", "teklif"], ["FATURA BİRİM TUTARI", "tutar"], ["ÜRÜN SERİ NO", "seri"],
  ],
  "K.B.Ş.B.": [
    ["KARTIN ADI", "cihaz"], ["GELİŞ TARİHİ", "gelis"], ["ÇIKIŞ TARİHİ", "cikis"],
    ["DURUM", "durum"], ["TEKNİK PERSONEL", "personel"], ["FATURA", "sonuc"],
    ["KART NO", "kartno"], ["AÇIKLAMA", "aciklama"], ["TEKLİF FİYAT", "teklif"],
    ["FATURA BİRİM TUTARI", "tutar"], ["SERİ NO", "seri"],
  ],
}

// Orijinalde olmayan (sonradan eklenen) firmalar için genel düzen
const VARSAYILAN_SABLON: Kolon[] = [
  ["FİRMA ADI", "musteri"], ["ÜRÜNÜN ADI VEYA KODU", "cihaz"], ["GELİŞ TARİHİ", "gelis"],
  ["ÇIKIŞ TARİHİ", "cikis"], ["DURUM  BİLGİSİ", "durum"], ["TEKNİK PERSONEL", "personel"],
  ["SONUÇ", "sonuc"], ["TEKNİK SERVİS NO", "servis"], ["AÇIKLAMA", "aciklama"],
  ["TEKLİF FİYATI", "teklif"], ["FATURA BİRİM TUTARI", "tutar"], ["SERİ NO", "seri"],
]

const GENISLIK: Record<Alan, number> = {
  musteri: 22, cihaz: 38, gelis: 13, cikis: 13, durum: 13, personel: 17,
  sonuc: 17, servis: 15, seri: 16, aciklama: 42, teklif: 13, tutar: 15,
  ilgili: 22, kartno: 14, talepno: 17, teklifno: 12, etiket: 14, tsnNot: 15,
  sube: 20, gelisSaat: 11, telefon: 16, teklifBirim: 11, faturaTarihi: 14,
}

function tarihTR(s: string | null): string {
  if (!s) return ""
  const [y, m, g] = s.split("-")
  return `${g}.${m}.${y}`
}

// "16:52:00" -> "16:52"
function saatTR(s: string | null): string {
  return s ? s.slice(0, 5) : ""
}

// Sonradan eklenen alanları orijinal düzeni bozmadan yerleştir.
// ÖNEMLİ: bir sütun YALNIZCA o sayfada gerçekten veri varsa açılır — böylece
// veri girilmemiş firmaların sayfaları orijinaliyle birebir aynı kalır.
function sablonuGenislet(sablon: Kolon[], rows: RaporSatir[]): Kolon[] {
  const subeVar = rows.some((r) => r.sube?.ad)
  const saatVar = rows.some((r) => r.gelis_saat)
  const telefonVar = rows.some((r) => r.telefon)
  const faturaTarihiVar = rows.some((r) => r.fatura_tarihi)
  // Para birimi sütunu yalnız TL DIŞI teklif varsa (hepsi TL ise zaten belirsizlik yok)
  const dovizVar = rows.some(
    (r) => r.fiyat_teklifi != null && (r.teklif_birim ?? "TL") !== "TL"
  )
  const musteriVar = sablon.some(([, a]) => a === "musteri")
  const ilgiliVar = sablon.some(([, a]) => a === "ilgili")
  const teklifVar = sablon.some(([, a]) => a === "teklif")

  const cikti: Kolon[] = []
  // Firma sütunu olmayan (tek firmalı) sayfalarda şube en başa
  if (subeVar && !musteriVar) cikti.push(["ŞUBE", "sube"])
  for (const kolon of sablon) {
    cikti.push(kolon)
    const [, alan] = kolon
    if (alan === "musteri" && subeVar) cikti.push(["ŞUBE", "sube"])
    if (alan === "gelis" && saatVar) cikti.push(["GELİŞ SAATİ", "gelisSaat"])
    if (alan === "teklif" && dovizVar) cikti.push(["PARA BİRİMİ", "teklifBirim"])
    if (alan === "ilgili" && telefonVar) cikti.push(["TELEFON", "telefon"])
  }
  // Şablonunda ilgili kişi olmayan sayfalarda ad+telefonu sona ekle
  if (telefonVar && !ilgiliVar)
    cikti.push(["İLGİLİ KİŞİ", "ilgili"], ["TELEFON", "telefon"])
  // Teklif sütunu olmayan sayfada döviz varsa yine de göster
  if (dovizVar && !teklifVar) cikti.push(["PARA BİRİMİ", "teklifBirim"])
  if (faturaTarihiVar) cikti.push(["FATURA TARİHİ", "faturaTarihi"])
  return cikti
}

// İçe aktarmada açıklamaya " · " ile eklenen etiketli notları geri ayıkla
// (KART NO / TALEP NO / TEKLİF NO / TEKNİK ETİKET / SERVİS NO) — böylece
// orijinaldeki gibi kendi sütunlarına yazılabilirler.
function notlariAyikla(aciklama: string | null): {
  aciklama: string
  notlar: Record<string, string>
} {
  const notlar: Record<string, string> = {}
  const kalan: string[] = []
  for (const parca of (aciklama ?? "").split(" · ")) {
    const t = parca.trim()
    if (!t) continue
    const m = t.match(/^(KART NO|TALEP NO|TEKLİF NO|TEKNİK ETİKET|SERVİS NO)\s*:?\s*(.+)$/)
    if (m) notlar[m[1]] = m[2].trim()
    else kalan.push(t)
  }
  return { aciklama: kalan.join(" · "), notlar }
}

function hucreDegeri(
  alan: Alan,
  k: RaporSatir,
  ayiklanmis: { aciklama: string; notlar: Record<string, string> }
): string | number | null {
  switch (alan) {
    case "musteri": return k.musteri?.ad ?? ""
    case "cihaz": return k.cihaz_adi
    case "gelis": return tarihTR(k.gelis_tarihi)
    case "cikis": return tarihTR(k.cikis_tarihi)
    case "durum": return k.durum?.ad ?? ""
    case "personel": return k.teknik_personel?.ad ?? ""
    case "sonuc": return k.fatura_durumu?.ad ?? ""
    case "servis": return k.servis_no ?? ""
    case "seri": return k.seri_no ?? ""
    case "aciklama": return ayiklanmis.aciklama
    case "teklif": return k.fiyat_teklifi ?? null
    case "tutar": return k.fatura_tutari ?? null
    case "ilgili": return k.ilgili_kisi ?? ""
    case "kartno": return ayiklanmis.notlar["KART NO"] ?? ""
    case "talepno": return ayiklanmis.notlar["TALEP NO"] ?? ""
    case "teklifno": return ayiklanmis.notlar["TEKLİF NO"] ?? ""
    case "etiket": return ayiklanmis.notlar["TEKNİK ETİKET"] ?? ""
    case "tsnNot": return ayiklanmis.notlar["SERVİS NO"] ?? ""
    case "sube": return k.sube?.ad ?? ""
    case "gelisSaat": return saatTR(k.gelis_saat)
    case "telefon": return k.telefon ?? ""
    // Tutar hep TL; birim yalnız fiyat teklifi içindir
    case "teklifBirim": return k.fiyat_teklifi != null ? (k.teklif_birim ?? "TL") : ""
    case "faturaTarihi": return tarihTR(k.fatura_tarihi)
  }
}

// Excel sayfa adı kuralları: 31 karakter, []:*?/\ yasak
function sayfaAdi(ad: string): string {
  return ad.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sayfa"
}

export async function raporExcelBuffer(satirlar: RaporSatir[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Name Teknik"

  // Firma (grup) bazında böl — önce DİĞER, sonra menü sırası
  const gruplu = new Map<string, { sira: number; satirlar: RaporSatir[] }>()
  for (const k of satirlar) {
    const ad = k.grup?.ad ?? "DİĞER"
    const sira = k.grup ? (k.grup.sira ?? 999) : -1
    const g = gruplu.get(ad) ?? { sira, satirlar: [] }
    g.satirlar.push(k)
    gruplu.set(ad, g)
  }
  const sayfalar = [...gruplu.entries()].sort((a, b) => a[1].sira - b[1].sira)

  const kullanilanAdlar = new Set<string>()
  for (const [grupAd, { satirlar: rows }] of sayfalar) {
    let ad = sayfaAdi(grupAd)
    while (kullanilanAdlar.has(ad)) ad = (ad + " 2").slice(0, 31)
    kullanilanAdlar.add(ad)

    const ws = wb.addWorksheet(ad, { views: [{ state: "frozen", ySplit: 1 }] })
    // Orijinal düzen + o sayfada verisi olan yeni alanlar (şube, saat, telefon, döviz…)
    const sablon = sablonuGenislet(SABLONLAR[grupAd] ?? VARSAYILAN_SABLON, rows)

    ws.columns = sablon.map(([baslik, alan]) => ({
      header: baslik,
      width: GENISLIK[alan],
    }))

    for (const k of rows) {
      const ayiklanmis = notlariAyikla(k.aciklama)
      const satir = ws.addRow(sablon.map(([, alan]) => hucreDegeri(alan, k, ayiklanmis)))
      const renk = satirRengi(k.fatura_durumu?.ad ?? "", k.durum?.ad ?? "")
      if (renk) {
        for (let c = 1; c <= sablon.length; c++) {
          const hucre = satir.getCell(c)
          hucre.fill = { type: "pattern", pattern: "solid", fgColor: { argb: renk.bg } }
          hucre.font = { color: { argb: renk.yazi } }
        }
      }
    }

    // Başlık satırı: orijinaldeki gibi kalın, dolgu yok
    const baslik = ws.getRow(1)
    baslik.font = { bold: true, size: 11 }
    baslik.alignment = { vertical: "middle" }
    baslik.height = 20
    // Para sütunları
    sablon.forEach(([, alan], i) => {
      if (alan === "teklif" || alan === "tutar") {
        ws.getColumn(i + 1).numFmt = "#,##0"
      }
    })
  }

  const ab = await wb.xlsx.writeBuffer()
  return Buffer.from(ab)
}
