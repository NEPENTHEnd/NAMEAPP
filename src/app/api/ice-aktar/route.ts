import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"
import {
  exceliCozumle,
  imzaUret,
  normBaslik,
  buyuk,
  type CozumSatir,
} from "@/lib/ice-aktarma"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types"

export const maxDuration = 60

type Ozet = {
  sayfa: string
  eklenecek: number
  guncellenecek: number
  zatenVar: number
  bosAtlanan: number
}

// Mevcut kayıttan birleştirme (merge) için gereken alanlar
type MevcutKayit = {
  id: string
  servis_no: string | null
  cihaz_adi: string
  seri_no: string | null
  gelis_tarihi: string | null
  cikis_tarihi: string | null
  fatura_durumu_id: string | null
  fiyat_teklifi: number | null
  fatura_tutari: number | null
  fatura_tarihi: string | null
  telefon: string | null
  ilgili_kisi: string | null
  teknik_personel_id: string | null
  aciklama: string | null
  musteri: { ad: string } | null
  grup: { ad: string } | null
}

const bos = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "")
// Fiş no'nun son 3 rakamı (müdür bazen ayı girmiyor → son haneler eşleşir)
const son3 = (s: string | null): string => (s?.match(/\d/g)?.join("") ?? "").slice(-3)
const rakam = (s: string | null): string => s?.match(/\d/g)?.join("") ?? ""

// Excel'i okuyup NELERİN ekleneceğini + NELERİN güncelleneceğini hesaplar.
// - EKLE: sistemde olmayan yeni satırlar (sayı bazlı dedup).
// - GÜNCELLE (birleştir): fiş no'nun son haneleri + müşteri + cihaz eşleşiyorsa,
//   o kaydın YALNIZ BOŞ alanları Excel'den doldurulur (dolu alana dokunulmaz).
export async function POST(request: Request) {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    return Response.json({ hata: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 })
  }

  const form = await request.formData()
  const dosya = form.get("dosya")
  const mod = String(form.get("mod") ?? "onizleme")
  if (!(dosya instanceof File)) {
    return Response.json({ hata: "Dosya bulunamadı." }, { status: 400 })
  }
  if (!/\.xlsx?$/i.test(dosya.name)) {
    return Response.json({ hata: "Yalnız .xlsx dosyası yükleyin." }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: gruplar } = await supabase.from("grup").select("id, ad")
  const grupListesi = gruplar ?? []

  let cozum
  try {
    cozum = await exceliCozumle(
      await dosya.arrayBuffer(),
      grupListesi.map((g) => g.ad)
    )
  } catch (e) {
    return Response.json(
      { hata: "Excel okunamadı: " + (e instanceof Error ? e.message : "bilinmeyen hata") },
      { status: 400 }
    )
  }

  // ---- Mevcut kayıtlar (birleştirme + dedup için tüm alanlar) ----
  const { data: mevcutData, error: mevcutHata } = await supabase
    .from("is_kaydi")
    .select(
      "id, servis_no, cihaz_adi, seri_no, gelis_tarihi, cikis_tarihi, fatura_durumu_id, fiyat_teklifi, fatura_tutari, fatura_tarihi, telefon, ilgili_kisi, teknik_personel_id, aciklama, musteri:musteri_id ( ad ), grup:grup_id ( ad )"
    )
    .range(0, 99999)
  if (mevcutHata) {
    return Response.json({ hata: "Mevcut kayıtlar okunamadı: " + mevcutHata.message }, { status: 500 })
  }
  const mevcut = (mevcutData ?? []) as unknown as MevcutKayit[]

  // Dedup için imza sayımı (fiş'siz satırların tekrar eklenmesini önler)
  const mevcutSayim = new Map<string, number>()
  // Birleştirme indeksi: son3(fiş) | müşteriNorm | cihazNorm → sıradaki eşleşmeler (kuyruk)
  const birlestirmeIndeks = new Map<string, MevcutKayit[]>()
  for (const m of mevcut) {
    const imza = imzaUret({
      musteriAd: m.musteri?.ad ?? null,
      cihaz_adi: m.cihaz_adi,
      gelis_tarihi: m.gelis_tarihi,
      seri_no: m.seri_no,
      servis_no: m.servis_no,
    })
    mevcutSayim.set(imza, (mevcutSayim.get(imza) ?? 0) + 1)
    if (m.servis_no && rakam(m.servis_no)) {
      const k = `${son3(m.servis_no)}|${normBaslik(m.musteri?.ad ?? "")}|${normBaslik(m.cihaz_adi)}`
      const l = birlestirmeIndeks.get(k) ?? []
      l.push(m)
      birlestirmeIndeks.set(k, l)
    }
  }

  // ---- Excel satırlarını ikiye ayır: GÜNCELLE (birleştir) vs EKLE-adayı ----
  const birlestirilecekler: { mevcut: MevcutKayit; excel: CozumSatir }[] = []
  const ekleAdaylari: CozumSatir[] = []
  const sayfaGuncellenecek = new Map<string, number>()

  for (const s of cozum.satirlar) {
    let eslesme: MevcutKayit | null = null
    if (s.servis_no && rakam(s.servis_no)) {
      const k = `${son3(s.servis_no)}|${normBaslik(s.musteriAd ?? "")}|${normBaslik(s.cihaz_adi)}`
      const kuyruk = birlestirmeIndeks.get(k)
      if (kuyruk && kuyruk.length > 0) {
        // Ek güvenlik: rakam dizileri birbirinin SONU olmalı (ay eksikse de tutar)
        const eRak = rakam(s.servis_no)
        const idx = kuyruk.findIndex((m) => {
          const mRak = rakam(m.servis_no)
          return mRak.endsWith(eRak) || eRak.endsWith(mRak)
        })
        if (idx >= 0) eslesme = kuyruk.splice(idx, 1)[0]
      }
    }
    if (eslesme) {
      // Yalnız DOLDURULACAK boş alanı olan eşleşmeleri say
      if (birlesmeVar(eslesme, s)) {
        birlestirilecekler.push({ mevcut: eslesme, excel: s })
        sayfaGuncellenecek.set(s.sayfa, (sayfaGuncellenecek.get(s.sayfa) ?? 0) + 1)
      }
    } else {
      ekleAdaylari.push(s)
    }
  }

  // ---- EKLE: kalan satırlarda sayı bazlı dedup ----
  const exceldeSayim = new Map<string, CozumSatir[]>()
  for (const s of ekleAdaylari) {
    const l = exceldeSayim.get(s.imza) ?? []
    l.push(s)
    exceldeSayim.set(s.imza, l)
  }
  const eklenecekler: CozumSatir[] = []
  const sayfaEklenecek = new Map<string, number>()
  const sayfaZatenVar = new Map<string, number>()
  for (const [imza, liste] of exceldeSayim) {
    const zaten = mevcutSayim.get(imza) ?? 0
    const eksik = Math.max(0, liste.length - zaten)
    const sayfa = liste[0].sayfa
    sayfaZatenVar.set(sayfa, (sayfaZatenVar.get(sayfa) ?? 0) + Math.min(zaten, liste.length))
    if (eksik > 0) {
      eklenecekler.push(...liste.slice(0, eksik))
      sayfaEklenecek.set(sayfa, (sayfaEklenecek.get(sayfa) ?? 0) + eksik)
    }
  }

  const ozet: Ozet[] = cozum.sayfalar.map((s) => ({
    sayfa: s.sayfa,
    eklenecek: sayfaEklenecek.get(s.sayfa) ?? 0,
    guncellenecek: sayfaGuncellenecek.get(s.sayfa) ?? 0,
    zatenVar: sayfaZatenVar.get(s.sayfa) ?? 0,
    bosAtlanan: s.bosAtlanan,
  }))

  if (mod !== "uygula") {
    return Response.json({
      mod: "onizleme",
      toplamOkunan: cozum.satirlar.length,
      toplamEklenecek: eklenecekler.length,
      toplamGuncellenecek: birlestirilecekler.length,
      ozet,
      uyarilar: cozum.uyarilar,
      ornekler: eklenecekler.slice(0, 12).map((s) => ({
        sayfa: s.sayfa, musteri: s.musteriAd, cihaz: s.cihaz_adi,
        gelis: s.gelis_tarihi, seri: s.seri_no, servis: s.servis_no,
      })),
    })
  }

  // =============================== UYGULA ===============================
  if (eklenecekler.length === 0 && birlestirilecekler.length === 0) {
    return Response.json({ mod: "uygula", eklenen: 0, guncellenen: 0, ozet, uyarilar: cozum.uyarilar })
  }

  // Yardımcı tablolar: bul ya da oluştur
  const [musteriRes, durumRes, faturaRes, personelRes, subeRes] = await Promise.all([
    supabase.from("musteri").select("id, ad"),
    supabase.from("durum").select("id, ad"),
    supabase.from("fatura_durumu").select("id, ad"),
    supabase.from("teknik_personel").select("id, ad"),
    supabase.from("sube").select("id, ad, grup_id"),
  ])
  const anahtar = (s: string) => s.toLocaleUpperCase("tr-TR")
  const musteriHarita = new Map((musteriRes.data ?? []).map((m) => [anahtar(m.ad), m.id]))
  const durumHarita = new Map((durumRes.data ?? []).map((d) => [anahtar(d.ad), d.id]))
  const faturaHarita = new Map((faturaRes.data ?? []).map((f) => [anahtar(f.ad), f.id]))
  const personelHarita = new Map((personelRes.data ?? []).map((p) => [anahtar(p.ad), p.id]))
  const grupHarita = new Map(grupListesi.map((g) => [anahtar(g.ad), g.id]))
  const subeHarita = new Map(
    (subeRes.data ?? []).map((s) => [`${s.grup_id}¦${anahtar(s.ad)}`, s.id])
  )

  async function bulYaOlustur(
    harita: Map<string, string>,
    tablo: "musteri" | "durum" | "fatura_durumu" | "teknik_personel",
    ad: string
  ): Promise<string | null> {
    const k = anahtar(ad)
    const v = harita.get(k)
    if (v) return v
    const { data, error } = await supabase
      .from(tablo)
      .insert({ ad: buyuk(ad)! })
      .select("id")
      .single()
    if (error || !data) return null
    harita.set(k, data.id)
    return data.id
  }

  // ---- GÜNCELLE (birleştir): boş alanları doldur ----
  let guncellenen = 0
  for (const { mevcut: m, excel: s } of birlestirilecekler) {
    const g: TablesUpdate<"is_kaydi"> = {}
    if (bos(m.cikis_tarihi) && s.cikis_tarihi) g.cikis_tarihi = s.cikis_tarihi
    if (bos(m.fiyat_teklifi) && s.fiyat_teklifi != null) g.fiyat_teklifi = s.fiyat_teklifi
    if (bos(m.fatura_tutari) && s.fatura_tutari != null) g.fatura_tutari = s.fatura_tutari
    if (bos(m.telefon) && s.telefon) g.telefon = s.telefon
    if (bos(m.ilgili_kisi) && s.ilgili_kisi) g.ilgili_kisi = s.ilgili_kisi
    if (bos(m.seri_no) && s.seri_no) g.seri_no = s.seri_no
    if (bos(m.aciklama) && s.aciklama) g.aciklama = s.aciklama
    if (bos(m.fatura_durumu_id) && s.faturaDurumuAd)
      g.fatura_durumu_id = await bulYaOlustur(faturaHarita, "fatura_durumu", s.faturaDurumuAd)
    if (bos(m.teknik_personel_id) && s.personelAd)
      g.teknik_personel_id = await bulYaOlustur(personelHarita, "teknik_personel", s.personelAd)
    if (Object.keys(g).length === 0) continue
    const { error } = await supabase.from("is_kaydi").update(g).eq("id", m.id)
    if (!error) guncellenen++
  }

  // ---- EKLE ----
  const bakilmadiId =
    durumHarita.get("BAKILMADI") ?? (durumRes.data ?? [])[0]?.id ?? null
  const yeniSatirlar: TablesInsert<"is_kaydi">[] = []
  for (const s of eklenecekler) {
    const grupId = s.grupAd ? grupHarita.get(anahtar(s.grupAd)) ?? null : null
    const musteriId = s.musteriAd
      ? await bulYaOlustur(musteriHarita, "musteri", s.musteriAd)
      : null
    const durumId = s.durumAd
      ? await bulYaOlustur(durumHarita, "durum", s.durumAd)
      : bakilmadiId
    const faturaId = s.faturaDurumuAd
      ? await bulYaOlustur(faturaHarita, "fatura_durumu", s.faturaDurumuAd)
      : null
    const personelId = s.personelAd
      ? await bulYaOlustur(personelHarita, "teknik_personel", s.personelAd)
      : null
    if (!durumId || !s.gelis_tarihi) continue

    yeniSatirlar.push({
      musteri_id: musteriId,
      grup_id: grupId,
      sube_id:
        grupId && s.musteriAd
          ? subeHarita.get(`${grupId}¦${anahtar(s.musteriAd)}`) ?? null
          : null,
      cihaz_adi: s.cihaz_adi,
      seri_no: s.seri_no,
      servis_no: s.servis_no,
      gelis_tarihi: s.gelis_tarihi,
      cikis_tarihi: s.cikis_tarihi,
      durum_id: durumId,
      fatura_durumu_id: faturaId,
      teknik_personel_id: personelId,
      ilgili_kisi: s.ilgili_kisi,
      telefon: s.telefon,
      fiyat_teklifi: s.fiyat_teklifi,
      fatura_tutari: s.fatura_tutari,
      aciklama: s.aciklama,
      olusturan_id: kullanici.id,
      yonetici_gordu: true,
    })
  }

  let eklenen = 0
  for (let i = 0; i < yeniSatirlar.length; i += 200) {
    const parca = yeniSatirlar.slice(i, i + 200)
    const { error } = await supabase.from("is_kaydi").insert(parca)
    if (error) {
      return Response.json(
        { hata: `Ekleme hatası (${eklenen} eklendi, ${guncellenen} güncellendi): ${error.message}`, eklenen, guncellenen },
        { status: 500 }
      )
    }
    eklenen += parca.length
  }

  return Response.json({
    mod: "uygula",
    eklenen,
    guncellenen,
    ozet,
    uyarilar: cozum.uyarilar,
  })
}

// Bu eşleşmede DOLDURULACAK en az bir boş alan var mı? (önizleme sayımı için)
function birlesmeVar(m: MevcutKayit, s: CozumSatir): boolean {
  return (
    (bos(m.cikis_tarihi) && !!s.cikis_tarihi) ||
    (bos(m.fiyat_teklifi) && s.fiyat_teklifi != null) ||
    (bos(m.fatura_tutari) && s.fatura_tutari != null) ||
    (bos(m.telefon) && !!s.telefon) ||
    (bos(m.ilgili_kisi) && !!s.ilgili_kisi) ||
    (bos(m.seri_no) && !!s.seri_no) ||
    (bos(m.aciklama) && !!s.aciklama) ||
    (bos(m.fatura_durumu_id) && !!s.faturaDurumuAd) ||
    (bos(m.teknik_personel_id) && !!s.personelAd)
  )
}
