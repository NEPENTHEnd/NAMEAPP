import ExcelJS from "exceljs"

// TEMMUZ_2026.xlsx gibi çalışma dosyalarını okuyup iş kaydı satırlarına çevirir.
// scripts/ice_aktarma.py'nin web karşılığı — başlık eşlemesi birebir aynı tutulmalı.
// KURAL: yalnız gerçek karşılığı olan başlıklar eşlenir; karşılığı olmayanlar ya
// nota düşer (NOT_ESLEME) ya da UYARI olarak raporlanır — sessizce yutulmaz.

// ---------------------------------------------------------------------------
// Eşlemeler
// ---------------------------------------------------------------------------
const ATLANAN_SAYFALAR = new Set(["DURUM", "SAYFA6"])

type Alan =
  | "cihaz_adi" | "musteri" | "gelis_tarihi" | "cikis_tarihi" | "durum"
  | "teknik_personel" | "fatura_durumu" | "servis_no" | "stok_kodu"
  | "aciklama" | "ilgili_kisi" | "fiyat_teklifi" | "fatura_tutari"
  | "seri_no" | "resim"

const BASLIK_ESLEME: Record<string, Alan> = {
  "URUNUN ADI VEYA KODU": "cihaz_adi",
  "KARTIN ADI": "cihaz_adi",
  "FIRMA ADI": "musteri",
  "SUBE ADI": "musteri",
  "SUBE": "musteri",
  "SEHIR": "musteri",
  "GELIS TARIHI": "gelis_tarihi",
  "CIKIS TARIHI": "cikis_tarihi",
  "DURUM BILGISI": "durum",
  "DURUM": "durum",
  "TEKNIK PERSONEL": "teknik_personel",
  "SONUC": "fatura_durumu",
  "FATURA": "fatura_durumu",
  "TEKNIK SERVIS NO": "servis_no",
  "FIS NO": "servis_no",
  "FIRMA STOK KODU": "stok_kodu", // BOYTEKS: fiş yerine firma stok kodu
  "ACIKLAMA": "aciklama",
  "ACIKLAMA / SERI NO": "aciklama",
  "ILGILI KISI": "ilgili_kisi",
  "FIYAT TEKLIFI": "fiyat_teklifi",
  "TEKLIF FIYATI": "fiyat_teklifi",
  "TEKLIF FIYAT": "fiyat_teklifi",
  "TEKLIF BIRIM FIYAT": "fiyat_teklifi",
  "TEKLIF BIRIM FIYATI": "fiyat_teklifi",
  "FATURA BIRIM TUTARI": "fatura_tutari",
  "FATURA BIRIM TUTAR": "fatura_tutari",
  "URUN SERI NO": "seri_no",
  "SERI NO": "seri_no",
  "SERI NUMARASI": "seri_no",
  "RESIM-1": "resim",
  "RESIM-2": "resim",
  "RESIM 1": "resim",
  "RESIM 2": "resim",
  "RESIM ON": "resim",
  "RESIM ARKA": "resim",
  "RESIM": "resim",
}

// Sistemde alanı olmayan ama değeri KAYBOLMASIN istenen başlıklar:
// açıklamanın sonuna "BAŞLIK: değer" olarak eklenir.
const NOT_ESLEME: Record<string, string> = {
  "KART NO": "KART NO",
  "TALEP NO": "TALEP NO",
  "TEKLIF NO": "TEKLİF NO",
  "TEKNIK ETIKET": "TEKNİK ETİKET",
}

// Başlıksız ama İLETİŞİM bilgisi tutan sütunlar (sayfa adı → normalize başlık).
// TCDD'de "2. sütun" içinde "EMRE BEY : 0507 151 44 29" gibi ad+telefon var.
const ILETISIM_SUTUNLARI: Record<string, string[]> = {
  TCDD: ["2. SUTUN"],
}

// Excel'in isimsiz sütunlara verdiği otomatik ad ("1. sütun") — boş, çöp.
const COP_BASLIK = /^\d+\.\s*SUTUN$/

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------
const TR_CEVRIM: Record<string, string> = {
  ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", i: "i",
  ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U",
}

/** Başlığı eşleme için sadeleştir: Türkçe → ASCII, BÜYÜK, tek boşluk. */
export function normBaslik(s: unknown): string {
  if (s == null) return ""
  let t = String(s).trim()
  t = t.replace(/[çÇğĞıİiöÖşŞüÜ]/g, (c) => TR_CEVRIM[c] ?? c).toUpperCase()
  return t.replace(/\s+/g, " ").trim()
}

/** Türkçe-duyarlı BÜYÜK harf (uygulama genelinde metinler büyük). */
export function buyuk(s: string | null): string | null {
  if (s == null) return null
  const t = s.replace(/\s+/g, " ").trim()
  return t ? t.toLocaleUpperCase("tr-TR") : null
}

// Bilinen yazım düzeltmeleri (ice_aktarma.py DURUM_DUZELT ile aynı)
const DURUM_DUZELT: Record<string, string> = {
  ONARILDI: "ONARILDI",
  ONARIMDA: "ONARIMDA",
  BAKILMADI: "BAKILMADI",
  "GERI GELEN": "GERİ GELEN",
  IADE: "İADE",
  SATIS: "SATIŞ",
}

function durumDuzelt(ad: string | null): string | null {
  if (!ad) return null
  return DURUM_DUZELT[normBaslik(ad)] ?? ad
}

function temizle(s: unknown): string | null {
  if (s == null) return null
  const t = String(s).replace(/\s+/g, " ").trim()
  return t || null
}

const iki = (n: number) => String(n).padStart(2, "0")

/**
 * Hücre değerini düz metne çevir. Excel'de bir hücre iç içe olabilir:
 * köprünün metni zengin metin, formülün sonucu zengin metin olabilir —
 * bu yüzden ÖZYİNELEMELİ çözülür (yoksa "[object Object]" yazardı).
 */
function hucreMetin(v: ExcelJS.CellValue): string {
  if (v == null) return ""
  if (v instanceof Date) return v.toISOString()
  if (typeof v !== "object") return String(v)
  const o = v as unknown as Record<string, unknown>
  if (Array.isArray(o.richText))
    return (o.richText as { text?: unknown }[])
      .map((p) => hucreMetin(p.text as ExcelJS.CellValue))
      .join("")
  if ("text" in o) return hucreMetin(o.text as ExcelJS.CellValue) // köprü
  if ("result" in o) return hucreMetin(o.result as ExcelJS.CellValue) // formül
  return "" // hata hücresi vb.
}

/** Excel tarihini "YYYY-MM-DD"ye çevir. Date'ler UTC okunur (gün kaymasın). */
export function tarihCevir(v: ExcelJS.CellValue): string | null {
  if (v == null || v === "") return null
  if (v instanceof Date)
    return `${v.getUTCFullYear()}-${iki(v.getUTCMonth() + 1)}-${iki(v.getUTCDate())}`
  const s = hucreMetin(v).trim()
  if (!s) return null
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/) // YYYY-MM-DD
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/) // DD.MM.YYYY | DD/MM/YYYY
  if (m) return `${m[3]}-${iki(+m[2])}-${iki(+m[1])}`
  return null // çözülemeyen tarih
}

/** "1.234,56" / "1234.56" / 1234 → 1234.56 */
export function sayiCevir(v: ExcelJS.CellValue): number | null {
  if (v == null || v === "") return null
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  let s = hucreMetin(v).replace(/[^\d,.-]/g, "")
  if (!s) return null
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".")
  else if (s.includes(",")) s = s.replace(",", ".")
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * "EMRE BEY : 0507 151 44 29" → { ad: "EMRE BEY", telefon: "0507 151 44 29" }
 * Telefon ayrılamazsa metnin tamamı ad olur — veri kaybolmaz.
 */
export function iletisimAyir(metin: string | null): {
  ad: string | null
  telefon: string | null
} {
  const t = temizle(metin)
  if (!t) return { ad: null, telefon: null }
  const m = t.match(/(\+?\d[\d\s().-]{7,}\d)/)
  if (m) {
    const rakamSayisi = (m[1].match(/\d/g) ?? []).length
    if (rakamSayisi >= 10) {
      const tel = m[1].trim()
      const ad = temizle(t.slice(0, m.index).replace(/[:\-–]\s*$/, ""))
      return { ad, telefon: tel }
    }
  }
  return { ad: t, telefon: null }
}

// ---------------------------------------------------------------------------
// Çıktı tipleri
// ---------------------------------------------------------------------------
export type CozumSatir = {
  sayfa: string
  grupAd: string | null // null → DİĞER (grupsuz)
  musteriAd: string | null
  cihaz_adi: string
  seri_no: string | null
  servis_no: string | null
  gelis_tarihi: string | null
  cikis_tarihi: string | null
  durumAd: string | null
  faturaDurumuAd: string | null
  personelAd: string | null
  ilgili_kisi: string | null
  telefon: string | null
  fiyat_teklifi: number | null
  fatura_tutari: number | null
  aciklama: string | null
  imza: string
}

export type SayfaOzet = {
  sayfa: string
  okunan: number
  bosAtlanan: number
  bilinmeyenBasliklar: string[]
}

export type CozumSonucu = {
  satirlar: CozumSatir[]
  sayfalar: SayfaOzet[]
  uyarilar: string[]
}

/**
 * Aynı ürünün aynı satırı mı? Sayı bazlı karşılaştırma bu imzaya göre yapılır.
 *
 * FİRMA (grup) BİLEREK DIŞARIDA: iş uygulamada sürükleyip başka firmaya/şubeye
 * taşınmış olabilir; Excel hâlâ eski sayfada gösterir. Firmayı imzaya katsaydık
 * o iş "yok" sanılıp TEKRAR eklenirdi. Müşteri + cihaz + geliş + seri + fiş
 * birlikte zaten yeterince ayırt edici.
 */
export function imzaUret(p: {
  musteriAd: string | null
  cihaz_adi: string
  gelis_tarihi: string | null
  seri_no: string | null
  servis_no: string | null
}): string {
  return [
    p.musteriAd ?? "",
    p.cihaz_adi,
    p.gelis_tarihi ?? "",
    p.seri_no ?? "",
    p.servis_no ?? "",
  ]
    .map((x) => normBaslik(x))
    .join("¦")
}

// ---------------------------------------------------------------------------
// Ayrıştırma
// ---------------------------------------------------------------------------
export async function exceliCozumle(
  veri: ArrayBuffer,
  gecerliGrupAdlari: string[]
): Promise<CozumSonucu> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(veri)

  const satirlar: CozumSatir[] = []
  const sayfalar: SayfaOzet[] = []
  const uyarilar: string[] = []
  // Firma adı eşlemesi büyük/küçük ve Türkçe farkına takılmasın
  const grupHarita = new Map(gecerliGrupAdlari.map((g) => [normBaslik(g), g]))

  for (const ws of wb.worksheets) {
    const sayfaAd = ws.name.trim()
    if (ATLANAN_SAYFALAR.has(normBaslik(sayfaAd))) continue

    // DİĞER = grupsuz; diğer sayfalar bir firmaya karşılık gelmeli
    const digerMi = normBaslik(sayfaAd) === "DIGER"
    let grupAd: string | null = null
    if (!digerMi) {
      const bulunan = grupHarita.get(normBaslik(sayfaAd))
      if (!bulunan) {
        uyarilar.push(
          `"${sayfaAd}" sekmesi hiçbir firmayla eşleşmiyor — bu sayfa ATLANDI. Önce Tanımlar → Firmalar'dan bu firmayı ekleyin.`
        )
        continue
      }
      grupAd = bulunan
    }

    // Başlık satırını bul (1–3 arası)
    let baslikSatir = 0
    for (let r = 1; r <= 3; r++) {
      const degerler = (ws.getRow(r).values as ExcelJS.CellValue[]) ?? []
      if (degerler.some((d) => BASLIK_ESLEME[normBaslik(hucreMetin(d))]))
        { baslikSatir = r; break }
    }
    if (!baslikSatir) {
      uyarilar.push(`"${sayfaAd}" sekmesinde başlık satırı bulunamadı — ATLANDI.`)
      continue
    }

    // Sütun index → alan (ilk eşleşen sütun kazanır)
    const sutunAlan = new Map<Alan, number>()
    const notSutunlar: { etiket: string; idx: number }[] = []
    const iletisimSutunlar: number[] = []
    const bilinmeyen: string[] = []
    const iletisimBeklenen = ILETISIM_SUTUNLARI[normBaslik(sayfaAd)] ?? []

    const baslikRow = ws.getRow(baslikSatir)
    baslikRow.eachCell({ includeEmpty: false }, (hucre, idx) => {
      const ham = hucreMetin(hucre.value).trim()
      if (!ham) return
      const nb = normBaslik(ham)
      const alan = BASLIK_ESLEME[nb]
      if (alan) {
        if (!sutunAlan.has(alan)) sutunAlan.set(alan, idx)
      } else if (NOT_ESLEME[nb]) {
        notSutunlar.push({ etiket: NOT_ESLEME[nb], idx })
      } else if (iletisimBeklenen.includes(nb)) {
        iletisimSutunlar.push(idx)
      } else if (!COP_BASLIK.test(nb)) {
        bilinmeyen.push(ham)
      }
    })
    if (bilinmeyen.length > 0) {
      uyarilar.push(
        `"${sayfaAd}": karşılığı olmayan başlık(lar) — ${bilinmeyen.join(", ")}. Bu sütunlar OKUNMADI.`
      )
    }

    // Firma sütunu yoksa müşteri = sayfa adı (tek firmalı sayfalar)
    const sayfaMusterisi = sutunAlan.has("musteri") ? null : temizle(sayfaAd)

    let okunan = 0
    let bosAtlanan = 0
    const sonSatir = ws.actualRowCount ? ws.lastRow?.number ?? 0 : 0
    for (let r = baslikSatir + 1; r <= sonSatir; r++) {
      const row = ws.getRow(r)
      const al = (alan: Alan): ExcelJS.CellValue => {
        const i = sutunAlan.get(alan)
        return i ? row.getCell(i).value : null
      }
      const cihaz = buyuk(temizle(hucreMetin(al("cihaz_adi"))))
      if (!cihaz) {
        // Cihaz adı yoksa kayıt açılamaz. Satırda BAŞKA veri varsa "atlandı" say;
        // tamamen boşsa (Excel'in binlerce biçimli boş satırı) sessizce geç.
        const baskaVeriVar = [...sutunAlan.values()].some((i) =>
          temizle(hucreMetin(row.getCell(i).value))
        )
        if (baskaVeriVar) bosAtlanan++
        continue
      }

      const aciklamaHam = temizle(hucreMetin(al("aciklama")))

      // Seri no: sütun boşsa açıklamadaki "SN: ..." ifadesinden ayıkla
      let seri = temizle(hucreMetin(al("seri_no")))
      if (!seri && aciklamaHam) {
        const m = aciklamaHam.match(/SN[:\s]*([A-Za-z0-9-]+)/)
        if (m) seri = m[1]
      }

      // Fiş: BOYTEKS'te FİRMA STOK KODU fiş YERİNE GEÇER; o sayfadaki
      // TEKNİK SERVİS NO değeri kaybolmasın diye nota düşer.
      const stok = temizle(hucreMetin(al("stok_kodu")))
      let servisNo = temizle(hucreMetin(al("servis_no")))
      const notlar: string[] = []
      if (stok) {
        if (servisNo) notlar.push(`SERVİS NO: ${servisNo}`)
        servisNo = stok
      }
      // Karşılığı olmayan ama saklanan sütunlar (KART NO, TALEP NO, …)
      for (const { etiket, idx } of notSutunlar) {
        const d = temizle(hucreMetin(row.getCell(idx).value))
        if (!d) continue
        // Değer zaten etiketle başlıyorsa tekrar etiketleme
        notlar.push(normBaslik(d).startsWith(normBaslik(etiket)) ? d : `${etiket}: ${d}`)
      }
      const aciklamaParcalari = [...(aciklamaHam ? [aciklamaHam] : []), ...notlar]

      // İlgili kişi + telefon: hem gerçek sütundan hem başlıksız iletişim sütunundan
      let ad: string | null = null
      let telefon: string | null = null
      const ilgiliHam = temizle(hucreMetin(al("ilgili_kisi")))
      if (ilgiliHam) {
        const a = iletisimAyir(ilgiliHam)
        ad = a.ad
        telefon = a.telefon
      }
      for (const idx of iletisimSutunlar) {
        const d = temizle(hucreMetin(row.getCell(idx).value))
        if (!d) continue
        const a = iletisimAyir(d)
        ad = ad ?? a.ad
        telefon = telefon ?? a.telefon
      }

      const musteriAd =
        buyuk(temizle(hucreMetin(al("musteri")))) ?? buyuk(sayfaMusterisi)

      const satir: Omit<CozumSatir, "imza"> = {
        sayfa: sayfaAd,
        grupAd,
        musteriAd,
        cihaz_adi: cihaz,
        seri_no: buyuk(seri),
        servis_no: buyuk(servisNo),
        gelis_tarihi: tarihCevir(al("gelis_tarihi")),
        cikis_tarihi: tarihCevir(al("cikis_tarihi")),
        durumAd: durumDuzelt(buyuk(temizle(hucreMetin(al("durum"))))),
        faturaDurumuAd: buyuk(temizle(hucreMetin(al("fatura_durumu")))),
        personelAd: buyuk(temizle(hucreMetin(al("teknik_personel")))),
        ilgili_kisi: buyuk(ad),
        telefon,
        fiyat_teklifi: sayiCevir(al("fiyat_teklifi")),
        fatura_tutari: sayiCevir(al("fatura_tutari")),
        aciklama: buyuk(aciklamaParcalari.join(" · ") || null),
      }
      satirlar.push({ ...satir, imza: imzaUret(satir) })
      okunan++
    }

    sayfalar.push({ sayfa: sayfaAd, okunan, bosAtlanan, bilinmeyenBasliklar: bilinmeyen })
  }

  return { satirlar, sayfalar, uyarilar }
}
