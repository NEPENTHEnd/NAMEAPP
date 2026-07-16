import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"
import { exceliCozumle, imzaUret, buyuk, type CozumSatir } from "@/lib/ice-aktarma"
import type { TablesInsert } from "@/lib/supabase/database.types"

export const maxDuration = 60

type Ozet = {
  sayfa: string
  eklenecek: number
  zatenVar: number
  bosAtlanan: number
}

// Excel'i okuyup NELERİN ekleneceğini hesaplar (mevcut kayıtlara ASLA dokunmaz).
// Aynı imzadan Excel'de 3, sistemde 2 varsa → yalnız 1 eklenir (sayı bazlı).
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

  // ---- Mevcut kayıtların imzaları (sayı bazlı karşılaştırma için) ----
  const { data: mevcut, error: mevcutHata } = await supabase
    .from("is_kaydi")
    .select("cihaz_adi, seri_no, servis_no, gelis_tarihi, musteri:musteri_id ( ad ), grup:grup_id ( ad )")
    .range(0, 99999)
  if (mevcutHata) {
    return Response.json({ hata: "Mevcut kayıtlar okunamadı: " + mevcutHata.message }, { status: 500 })
  }
  const mevcutSayim = new Map<string, number>()
  for (const m of (mevcut ?? []) as unknown as {
    cihaz_adi: string; seri_no: string | null; servis_no: string | null
    gelis_tarihi: string | null
    musteri: { ad: string } | null; grup: { ad: string } | null
  }[]) {
    const imza = imzaUret({
      musteriAd: m.musteri?.ad ?? null,
      cihaz_adi: m.cihaz_adi,
      gelis_tarihi: m.gelis_tarihi,
      seri_no: m.seri_no,
      servis_no: m.servis_no,
    })
    mevcutSayim.set(imza, (mevcutSayim.get(imza) ?? 0) + 1)
  }

  // ---- Excel'de imza başına kaç satır var? ----
  const exceldeSayim = new Map<string, CozumSatir[]>()
  for (const s of cozum.satirlar) {
    const l = exceldeSayim.get(s.imza) ?? []
    l.push(s)
    exceldeSayim.set(s.imza, l)
  }

  // Eklenecekler: her imza için (Excel adedi − mevcut adedi) kadar
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
    zatenVar: sayfaZatenVar.get(s.sayfa) ?? 0,
    bosAtlanan: s.bosAtlanan,
  }))

  if (mod !== "uygula") {
    return Response.json({
      mod: "onizleme",
      toplamOkunan: cozum.satirlar.length,
      toplamEklenecek: eklenecekler.length,
      ozet,
      uyarilar: cozum.uyarilar,
      ornekler: eklenecekler.slice(0, 15).map((s) => ({
        sayfa: s.sayfa, musteri: s.musteriAd, cihaz: s.cihaz_adi,
        gelis: s.gelis_tarihi, seri: s.seri_no, servis: s.servis_no,
      })),
    })
  }

  // ---- UYGULA ----
  if (eklenecekler.length === 0) {
    return Response.json({ mod: "uygula", eklenen: 0, ozet, uyarilar: cozum.uyarilar })
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
  // Şube: aynı firmadaki adı müşteriyle birebir aynı olan şubeye otomatik bağla
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

  const bakilmadiId =
    durumHarita.get("BAKILMADI") ?? (durumRes.data ?? [])[0]?.id ?? null

  const satirlar: TablesInsert<"is_kaydi">[] = []
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
    if (!durumId || !s.gelis_tarihi) continue // durum ve geliş tarihi zorunlu

    satirlar.push({
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
      yonetici_gordu: true, // yönetici aktardı, "yeni" rozeti çıkmasın
    })
  }

  // Parça parça ekle (tek seferde çok büyük gövde olmasın)
  let eklenen = 0
  for (let i = 0; i < satirlar.length; i += 200) {
    const parca = satirlar.slice(i, i + 200)
    const { error } = await supabase.from("is_kaydi").insert(parca)
    if (error) {
      return Response.json(
        { hata: `Ekleme hatası (${eklenen} kayıt eklendikten sonra): ${error.message}`, eklenen },
        { status: 500 }
      )
    }
    eklenen += parca.length
  }

  return Response.json({
    mod: "uygula",
    eklenen,
    atlanan: eklenecekler.length - eklenen,
    ozet,
    uyarilar: cozum.uyarilar,
  })
}
