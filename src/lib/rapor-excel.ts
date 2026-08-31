import ExcelJS from "exceljs"

// İş kaydı rapor/yedek Excel'i — ORİJİNAL çalışma dosyasıyla birebir:
// her firma kendi sayfasında, sayfaların sütun düzenleri orijinaldeki gibi
// (BOYTEKS: FİRMA STOK KODU, TCDD: ŞEHİR/KART NO/TEKNİK ETİKET, ...),
// satırlar SONUÇ (yoksa DURUM) değerine göre orijinal renklerle boyalı.
export type RaporSatir = {
  servis_no: string | null
  takip_no: string | null
  talep_no: string | null
  teklif_no: string | null
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
  servis_no, takip_no, talep_no, teklif_no, cihaz_adi, seri_no, gelis_tarihi, gelis_saat, cikis_tarihi,
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
  | "takipno" | "kargo" | "adres"

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
  "BOYTEKS TEKSTİL": [
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
  // NOT: firma adı "KŞH" (eskiden yanlışlıkla "KİH" yazılmıştı → şablon tutmuyordu)
  "KŞH": [
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
  // NOT: firma adı "SÜTAŞ" (eskiden yanlışlıkla "SİTAŞ" yazılmıştı → şablon tutmuyordu)
  "SÜTAŞ": [
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

// Yeni (orijinalde olmayan) sütunlar için yedek genişlik
const GENISLIK: Record<Alan, number> = {
  musteri: 22, cihaz: 38, gelis: 13, cikis: 13, durum: 13, personel: 17,
  sonuc: 17, servis: 15, seri: 16, aciklama: 42, teklif: 13, tutar: 15,
  ilgili: 22, kartno: 14, talepno: 17, teklifno: 12, etiket: 14, tsnNot: 15,
  sube: 20, gelisSaat: 11, telefon: 16, teklifBirim: 11, faturaTarihi: 14,
  takipno: 16, kargo: 18, adres: 30,
}

// ---------------------------------------------------------------------------
// Sayfa biçimleri — ORİJİNAL çalışma dosyasından ÖLÇÜLDÜ (yazı tipi, punto,
// satır yükseklikleri, sütun genişlikleri). Her firma sayfası farklı: kimi
// Montserrat, kimi Nunito, TCDD Trebuchet MS; TCDD'de veri kalın DEĞİL vb.
// Genişlikler BAŞLIK ADINA göre eşlenir (sütun sırası değişse de tutar).
// ---------------------------------------------------------------------------
type SayfaBicim = {
  font: string
  baslikBoyut: number
  baslikYuk: number
  veriBoyut: number
  veriKalin: boolean
  veriYuk: number
  kaydir: boolean
  bosIlkSatir: boolean // orijinalde başlık 2. satırda, 1. satır boş
  ilkSatirYuk: number | null
  genislik: Record<string, number>
}

const SAYFA_BICIM: Record<string, SayfaBicim> = {
  "DİĞER": {"font": "Montserrat", "baslikBoyut": 12.0, "baslikYuk": 52.5, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 26.25, "kaydir": true, "bosIlkSatir": true, "ilkSatirYuk": 37.5, "genislik": {"FİRMA ADI": 36.4, "KARTIN ADI": 54.1, "GELİŞ TARİHİ": 17.6, "ÇIKIŞ TARİHİ": 20.0, "DURUM": 18.7, "TEKNİK PERSONEL": 18.3, "SONUÇ": 24.1, "İLGİLİ KİŞİ": 29.9, "FİYAT TEKLİFİ": 15.1, "FATURA BİRİM TUTARI": 19.0, "FİŞ NO": 18.9, "AÇIKLAMA / SERİ NO": 30.1, "RESİM-1": 17.0, "RESİM-2": 13.0}},
  "ŞİRİKÇİOĞLU": {"font": "Montserrat", "baslikBoyut": 12.0, "baslikYuk": 61.5, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": 25.5, "genislik": {"ÜRÜNÜN ADI VEYA KODU": 61.9, "GELİŞ TARİHİ": 16.4, "ÇIKIŞ TARİHİ": 16.9, "DURUM  BİLGİSİ": 17.6, "TEKNİK PERSONEL": 20.3, "SONUÇ": 22.7, "TEKNİK SERVİS NO": 15.3, "AÇIKLAMA": 18.9, "FİYAT TEKLİFİ": 16.9, "FATURA BİRİM TUTARI": 18.3, "RESİM-1": 16.6, "RESİM-2": 17.6, "SERİ NO": 30.9}},
  "BOYTEKS TEKSTİL": {"font": "Montserrat", "baslikBoyut": 12.0, "baslikYuk": 54.0, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": 22.5, "genislik": {"FİRMA STOK KODU": 18.7, "ÜRÜNÜN ADI VEYA KODU": 67.3, "GELİŞ TARİHİ": 18.1, "ÇIKIŞ TARİHİ": 13.0, "DURUM  BİLGİSİ": 18.0, "TEKNİK PERSONEL": 20.9, "SONUÇ": 21.9, "TEKNİK SERVİS NO": 17.7, "TEKLİF NO": 13.1, "TEKLİF BİRİM FİYAT": 17.0, "FATURA BİRİM TUTARI": 18.1, "RESİM-1": 14.0, "RESİM-2": 13.3}},
  "BOYDAK GRUP": {"font": "Montserrat", "baslikBoyut": 12.0, "baslikYuk": 54.0, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": 19.5, "genislik": {"FİRMA ADI": 27.3, "ÜRÜNÜN ADI VEYA KODU": 56.4, "GELİŞ TARİHİ": 16.3, "ÇIKIŞ TARİHİ": 13.0, "DURUM  BİLGİSİ": 18.7, "TEKNİK PERSONEL": 18.6, "SONUÇ": 22.9, "TEKNİK SERVİS NO": 15.1, "AÇIKLAMA": 26.9, "TEKLİF FİYATI": 16.4, "FATURA BİRİM TUTARI": 19.1, "RESİM-1": 15.1, "RESİM-2": 14.7}},
  "BOYTAŞ-3": {"font": "Nunito", "baslikBoyut": 12.0, "baslikYuk": 49.5, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": 18.75, "genislik": {"ÜRÜNÜN ADI VEYA KODU": 52.1, "GELİŞ TARİHİ": 16.9, "ÇIKIŞ TARİHİ": 13.0, "DURUM  BİLGİSİ": 17.6, "TEKNİK PERSONEL": 19.4, "SONUÇ": 22.9, "TEKNİK SERVİS NO": 13.6, "AÇIKLAMA": 24.7, "TEKLİF FİYAT": 16.7, "FATURA BİRİM TUTARI": 17.0, "RESİM-1": 14.0, "RESİM-2": 13.0}},
  "HASÇELİK KABLO": {"font": "Montserrat", "baslikBoyut": 12.0, "baslikYuk": 56.25, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": 30.0, "genislik": {"ŞUBE ADI": 25.0, "ÜRÜNÜN ADI VEYA KODU": 49.3, "GELİŞ TARİHİ": 16.3, "ÇIKIŞ TARİHİ": 13.0, "DURUM  BİLGİSİ": 17.4, "TEKNİK PERSONEL": 20.6, "SONUÇ": 13.0, "TEKNİK SERVİS NO": 17.9, "ÜRÜN SERİ NO": 23.4, "TEKLİF FİYATI": 17.3, "FATURA BİRİM TUTARI": 17.0, "AÇIKLAMA": 25.1, "RESİM-1": 16.0, "RESİM-2": 13.0}},
  "HASÇELİK HALAT": {"font": "Montserrat", "baslikBoyut": 12.0, "baslikYuk": 52.5, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": 23.25, "genislik": {"ŞUBE ADI": 20.0, "ÜRÜNÜN ADI VEYA KODU": 54.4, "GELİŞ TARİHİ": 18.7, "ÇIKIŞ TARİHİ": 16.4, "DURUM  BİLGİSİ": 17.4, "TEKNİK PERSONEL": 19.6, "SONUÇ": 20.1, "TEKNİK SERVİS NO": 15.9, "AÇIKLAMA": 24.1, "TEKLİF FİYATI": 16.3, "FATURA BİRİM TUTARI": 17.3, "ÜRÜN SERİ NO": 25.0, "RESİM-1": 16.6, "RESİM-2": 13.0}},
  "TEXHONG": {"font": "Montserrat", "baslikBoyut": 11.0, "baslikYuk": 60.75, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": 24.0, "genislik": {"ÜRÜNÜN ADI VEYA KODU": 50.7, "GELİŞ TARİHİ": 18.7, "ÇIKIŞ TARİHİ": 13.0, "DURUM  BİLGİSİ": 13.0, "TEKNİK PERSONEL": 13.0, "SONUÇ": 20.1, "TEKNİK SERVİS NO": 18.7, "AÇIKLAMA": 13.0, "TEKLİF FİYATI": 13.0, "FATURA BİRİM TUTARI": 13.0, "RESİM-1": 13.0, "RESİM-2": 13.0, "1. sütun": 13.0}},
  "MEGA METAL": {"font": "Nunito", "baslikBoyut": 12.0, "baslikYuk": 49.5, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": 22.5, "genislik": {"ÜRÜNÜN ADI VEYA KODU": 68.7, "GELİŞ TARİHİ": 16.3, "ÇIKIŞ TARİHİ": 13.0, "DURUM  BİLGİSİ": 13.0, "TEKNİK PERSONEL": 19.3, "SONUÇ": 21.4, "TEKNİK SERVİS NO": 14.7, "AÇIKLAMA": 22.6, "TEKLİF FİYATI": 16.9, "FATURA BİRİM TUTARI": 17.7, "TALEP NO": 20.6, "RESİM-1": 14.0, "RESİM-2": 14.1}},
  "ŞALT": {"font": "Nunito", "baslikBoyut": 12.0, "baslikYuk": 67.5, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": true, "bosIlkSatir": false, "ilkSatirYuk": null, "genislik": {"KARTIN ADI": 38.0, "SERİ NO": 24.6, "GELİŞ TARİHİ": 13.0, "ÇIKIŞ TARİHİ": 24.0, "DURUM": 18.7, "FİŞ NO": 13.7, "TEKNİK PERSONEL": 27.1, "FATURA": 20.3, "FİYAT TEKLİFİ": 21.1, "FATURA BİRİM TUTARI": 35.0, "AÇIKLAMA / SERİ NO": 38.0}},
  "TCDD": {"font": "Trebuchet MS", "baslikBoyut": 12.0, "baslikYuk": 60.0, "veriBoyut": 10.0, "veriKalin": false, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": null, "genislik": {"ŞEHİR": 12.4, "KARTIN ADI": 59.1, "GELİŞ TARİHİ": 17.0, "ÇIKIŞ TARİHİ": 14.4, "DURUM": 13.0, "TEKNİK PERSONEL": 17.6, "FATURA": 19.1, "KART NO": 14.4, "SERİ NO": 18.7, "TEKNİK ETİKET": 17.4, "TEKLİF FİYAT": 13.0, "FATURA BİRİM TUTARI": 13.0, "2. sütun": 34.3, "RESİM-1": 14.0, "RESİM-2": 13.0, "5. sütun": 13.0}},
  "KŞH": {"font": "Nunito", "baslikBoyut": 12.0, "baslikYuk": 72.0, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": null, "genislik": {"KARTIN ADI": 64.0, "GELİŞ TARİHİ": 18.6, "ÇIKIŞ TARİHİ": 16.1, "DURUM": 18.3, "TEKNİK PERSONEL": 17.9, "FATURA": 21.3, "TEKNİK SERVİS NO": 14.9, "KART NO": 13.0, "AÇIKLAMA": 27.1, "TEKLİF FİYATI": 18.6, "FATURA BİRİM TUTARI": 20.9, "SERİ NUMARASI": 21.0, "RESİM ÖN": 13.1, "RESİM ARKA": 18.1}},
  "SERSİM": {"font": "Montserrat", "baslikBoyut": 12.0, "baslikYuk": 49.5, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": 35.25, "genislik": {"KARTIN ADI": 61.9, "GELİŞ TARİHİ": 18.9, "ÇIKIŞ TARİHİ": 18.1, "DURUM": 15.4, "TEKNİK PERSONEL": 18.9, "FATURA": 21.9, "KART NO": 15.0, "AÇIKLAMA": 33.6, "TEKLİF FİYAT": 16.0, "FATURA BİRİM TUTARI": 17.7, "RESİM 1": 14.4, "RESİM 2": 14.0, "SERİ NO": 13.0}},
  "BORSAN": {"font": "Montserrat", "baslikBoyut": 12.0, "baslikYuk": 48.0, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": 33.0, "genislik": {"KARTIN ADI": 54.0, "GELİŞ TARİHİ": 16.9, "ÇIKIŞ TARİHİ": 17.6, "DURUM": 18.7, "TEKNİK PERSONEL": 19.4, "FATURA": 13.0, "AÇIKLAMA": 18.3, "TEKLİF FİYAT": 17.6, "FATURA BİRİM TUTARI": 17.7, "TALEP NO": 19.7, "RESİM": 17.0, "RESİM 2": 19.9}},
  "BAŞYAZICIOĞLU": {"font": "Nunito", "baslikBoyut": 12.0, "baslikYuk": 56.25, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": 22.5, "genislik": {"ÜRÜNÜN ADI VEYA KODU": 49.4, "GELİŞ TARİHİ": 21.6, "ÇIKIŞ TARİHİ": 18.4, "DURUM  BİLGİSİ": 15.3, "TEKNİK PERSONEL": 18.3, "SONUÇ": 21.6, "TEKNİK SERVİS NO": 15.1, "AÇIKLAMA": 23.4, "TEKLİF FİYATI": 16.3, "FATURA BİRİM TUTARI": 19.1, "ÜRÜN SERİ NO": 16.0, "RESİM-1": 13.4, "RESİM-2": 13.0}},
  "MES ET": {"font": "Montserrat", "baslikBoyut": 12.0, "baslikYuk": 60.75, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": 26.25, "genislik": {"ÜRÜNÜN ADI VEYA KODU": 55.4, "GELİŞ TARİHİ": 15.9, "ÇIKIŞ TARİHİ": 13.0, "DURUM  BİLGİSİ": 16.9, "TEKNİK PERSONEL": 19.9, "SONUÇ": 20.7, "TEKNİK SERVİS NO": 17.6, "AÇIKLAMA": 26.7, "TEKLİF FİYATI": 15.1, "FATURA BİRİM TUTARI": 16.6, "RESİM-1": 13.0, "RESİM-2": 13.0}},
  "DOĞUŞ": {"font": "Nunito", "baslikBoyut": 11.0, "baslikYuk": 47.25, "veriBoyut": 9.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": null, "genislik": {"ŞUBE": 24.9, "KARTIN ADI": 54.6, "GELİŞ TARİHİ": 22.0, "ÇIKIŞ TARİHİ": 22.1, "DURUM": 18.0, "TEKNİK PERSONEL": 19.3, "FATURA": 20.4, "KART NO": 18.0, "AÇIKLAMA": 29.9, "TEKLİF FİYAT": 18.0, "FATURA BİRİM TUTARI": 13.0, "RESİM-1": 14.4, "RESİM-2": 13.0}},
  "SÜTAŞ": {"font": "Montserrat", "baslikBoyut": 10.0, "baslikYuk": 48.75, "veriBoyut": 10.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": true, "bosIlkSatir": true, "ilkSatirYuk": 32.25, "genislik": {"KARTIN ADI": 62.1, "GELİŞ TARİHİ": 16.9, "ÇIKIŞ TARİHİ": 16.3, "DURUM": 17.6, "TEKNİK PERSONEL": 19.1, "FATURA": 25.0, "TEKNİK SERVİS NO": 16.3, "AÇIKLAMA": 42.3, "TEKLİF FİYAT": 17.3, "FATURA BİRİM TUTARI": 17.0, "SERİ NUMARASI": 22.4, "RESİM 1": 13.3, "RESİM 2": 11.7}},
  "RES": {"font": "Nunito", "baslikBoyut": 12.0, "baslikYuk": 52.5, "veriBoyut": 10.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": true, "bosIlkSatir": true, "ilkSatirYuk": 35.25, "genislik": {"ŞUBE ADI": 40.3, "ÜRÜNÜN ADI VEYA KODU": 40.7, "GELİŞ TARİHİ": 18.7, "ÇIKIŞ TARİHİ": 16.4, "DURUM  BİLGİSİ": 17.4, "TEKNİK PERSONEL": 19.6, "SONUÇ": 22.0, "TEKNİK SERVİS NO": 15.9, "AÇIKLAMA": 20.0, "TEKLİF FİYATI": 16.3, "FATURA BİRİM TUTARI": 17.3, "FİŞ NO": 11.7, "ÜRÜN SERİ NO": 25.0, "RESİM-1": 14.6, "RESİM-2": 16.6}},
  "K.B.Ş.B.": {"font": "Montserrat", "baslikBoyut": 12.0, "baslikYuk": 58.5, "veriBoyut": 10.0, "veriKalin": true, "veriYuk": 22.5, "kaydir": false, "bosIlkSatir": true, "ilkSatirYuk": null, "genislik": {"KARTIN ADI": 78.4, "GELİŞ TARİHİ": 18.1, "ÇIKIŞ TARİHİ": 19.0, "DURUM": 18.3, "TEKNİK PERSONEL": 19.3, "FATURA": 21.9, "KART NO": 14.9, "AÇIKLAMA": 46.7, "TEKLİF FİYAT": 14.4, "FATURA BİRİM TUTARI": 17.9, "SERİ NO": 14.4, "RESİM": 13.0}},
}

// Orijinalde olmayan (sonradan eklenen) firmalar için genel biçim
const VARSAYILAN_BICIM: SayfaBicim = {
  font: "Montserrat", baslikBoyut: 12, baslikYuk: 52.5,
  veriBoyut: 9, veriKalin: true, veriYuk: 22.5,
  kaydir: false, bosIlkSatir: true, ilkSatirYuk: 22.5, genislik: {},
}

// Orijinalde her hücrede ince kenarlık var
const INCE = { style: "thin" } as const
const KENARLIK = { top: INCE, left: INCE, bottom: INCE, right: INCE }

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
  const takipVar = rows.some((r) => r.garanti_no) // "Takip No" = garanti_no
  const talepVar = rows.some((r) => r.talep_no)
  const teklifNoVar = rows.some((r) => r.teklif_no)
  const adresVar = rows.some((r) => r.adres)
  const kargoVar = rows.some((r) => r.kargo_takip_no)
  const musteriVar = sablon.some(([, a]) => a === "musteri")
  const ilgiliVar = sablon.some(([, a]) => a === "ilgili")
  const teklifVar = sablon.some(([, a]) => a === "teklif")
  const sablonTalepVar = sablon.some(([, a]) => a === "talepno")
  const sablonTeklifNoVar = sablon.some(([, a]) => a === "teklifno")

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
  // Satırdaki geri kalan alanlar (veri varsa) — takip/talep/teklif no, adres, kargo
  if (takipVar) cikti.push(["TAKİP NO", "takipno"])
  if (talepVar && !sablonTalepVar) cikti.push(["TALEP NO", "talepno"])
  if (teklifNoVar && !sablonTeklifNoVar) cikti.push(["TEKLİF NO", "teklifno"])
  if (adresVar) cikti.push(["ADRES", "adres"])
  if (kargoVar) cikti.push(["KARGO NO", "kargo"])
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
    // TALEP NO: gerçek kolon; yoksa açıklamadan ayıklananı kullan
    case "talepno": return k.talep_no ?? ayiklanmis.notlar["TALEP NO"] ?? ""
    case "teklifno": return k.teklif_no ?? ayiklanmis.notlar["TEKLİF NO"] ?? ""
    case "etiket": return ayiklanmis.notlar["TEKNİK ETİKET"] ?? ""
    case "tsnNot": return ayiklanmis.notlar["SERVİS NO"] ?? ""
    case "sube": return k.sube?.ad ?? ""
    case "gelisSaat": return saatTR(k.gelis_saat)
    case "telefon": return k.telefon ?? ""
    // Tutar hep TL; birim yalnız fiyat teklifi içindir
    case "teklifBirim": return k.fiyat_teklifi != null ? (k.teklif_birim ?? "TL") : ""
    case "faturaTarihi": return tarihTR(k.fatura_tarihi)
    case "takipno": return k.garanti_no ?? "" // "Takip No" = garanti_no
    case "kargo": return k.kargo_takip_no ?? ""
    case "adres": return k.adres ?? ""
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

    // Orijinal düzen + o sayfada verisi olan yeni alanlar (şube, saat, telefon, döviz…)
    const sablon = sablonuGenislet(SABLONLAR[grupAd] ?? VARSAYILAN_SABLON, rows)
    const bicim = SAYFA_BICIM[grupAd] ?? VARSAYILAN_BICIM
    // Orijinalde başlık çoğu sayfada 2. satırda (1. satır boş); ŞALT'ta 1. satırda
    const baslikNo = bicim.bosIlkSatir ? 2 : 1
    const ws = wb.addWorksheet(ad, {
      views: [{ state: "frozen", ySplit: baslikNo }],
    })

    // Sütun genişlikleri: orijinalden BAŞLIK ADINA göre; yeni sütunlar için yedek
    ws.columns = sablon.map(([baslik, alan]) => ({
      width: bicim.genislik[baslik] ?? GENISLIK[alan],
    }))

    // Boş 1. satır (orijinaldeki boşluk satırı)
    if (bicim.bosIlkSatir && bicim.ilkSatirYuk) {
      ws.getRow(1).height = bicim.ilkSatirYuk
    }

    // Başlık satırı
    const baslikSatiri = ws.getRow(baslikNo)
    sablon.forEach(([baslik], i) => {
      baslikSatiri.getCell(i + 1).value = baslik
    })
    baslikSatiri.height = bicim.baslikYuk
    for (let c = 1; c <= sablon.length; c++) {
      const h = baslikSatiri.getCell(c)
      h.font = { name: bicim.font, size: bicim.baslikBoyut, bold: true }
      h.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
      h.border = KENARLIK
    }
    baslikSatiri.commit()

    // Veri satırları
    let satirNo = baslikNo + 1
    for (const k of rows) {
      const ayiklanmis = notlariAyikla(k.aciklama)
      const satir = ws.getRow(satirNo++)
      sablon.forEach(([, alan], i) => {
        const hucre = satir.getCell(i + 1)
        hucre.value = hucreDegeri(alan, k, ayiklanmis)
        // Fiyat teklifi para birimine göre: TL ise "…TL", döviz ise sadece sayı
        // (döviz PARA BİRİMİ sütununda gösterilir)
        if (alan === "teklif" && k.fiyat_teklifi != null) {
          hucre.numFmt = (k.teklif_birim ?? "TL") === "TL" ? '#,##0.00"TL"' : "#,##0.00"
        }
      })
      satir.height = bicim.veriYuk
      const renk = satirRengi(k.fatura_durumu?.ad ?? "", k.durum?.ad ?? "")
      for (let c = 1; c <= sablon.length; c++) {
        const hucre = satir.getCell(c)
        // Yazı tipi TEK seferde: renk kuralı yalnız RENGİ değiştirir, punto/kalınlığı değil
        hucre.font = {
          name: bicim.font,
          size: bicim.veriBoyut,
          bold: bicim.veriKalin,
          ...(renk ? { color: { argb: renk.yazi } } : {}),
        }
        hucre.alignment = { vertical: "middle", wrapText: bicim.kaydir }
        hucre.border = KENARLIK
        if (renk)
          hucre.fill = { type: "pattern", pattern: "solid", fgColor: { argb: renk.bg } }
      }
      satir.commit()
    }

    // Para sütunları: FATURA BİRİM TUTARI hep TL → "…TL". (teklif hücre-bazlı yukarıda)
    sablon.forEach(([, alan], i) => {
      if (alan === "tutar") ws.getColumn(i + 1).numFmt = '#,##0.00"TL"'
    })
  }

  const ab = await wb.xlsx.writeBuffer()
  return Buffer.from(ab)
}
