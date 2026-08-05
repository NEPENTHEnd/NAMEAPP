import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"
import { buttonVariants } from "@/components/ui/button"
import { DurumRozeti } from "@/components/rozet"
import { sonAylar, ayAraligi } from "@/lib/aylar"
import { AySecici } from "@/components/ay-secici"
import { IslerFiltreler } from "./isler-filtreler"
import { IslerEkrani } from "./isler-ekrani"

const SAYFA_BOYUTU = 50

// "YYYY-MM-DD" -> "DD.MM.YYYY" (zaman dilimi kaymasından etkilenmez)
function tarihTR(s: string | null): string {
  if (!s) return "—"
  const [y, m, g] = s.split("-")
  return `${g}.${m}.${y}`
}

const sayiBicim = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 })
// Düz sayı + birim son eki (₺ simgesi yok): "1.000 TL", "500 USD"
function paraTR(n: number | null, birim = "TL"): string {
  return n == null ? "—" : `${sayiBicim.format(n)} ${birim}`
}

type SP = Record<string, string | string[] | undefined>

function tek(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function IslerSayfasi({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const sp = await searchParams
  const q = tek(sp.q)?.trim() ?? ""
  const durum = tek(sp.durum) ?? ""
  const personel = tek(sp.personel) ?? ""
  const fatura = tek(sp.fatura) ?? ""
  const musteri = tek(sp.musteri) ?? ""
  const baslangic = tek(sp.baslangic) ?? ""
  const bitis = tek(sp.bitis) ?? ""
  const ay = tek(sp.ay) ?? ""
  const secili = tek(sp.secili) ?? ""
  const grupParam = tek(sp.grup) ?? "" // "" | "diger" | grup id
  const subeParam = tek(sp.sube) ?? "" // belirli şube id
  const bakilmadiFiltre = tek(sp.bakilmadi) === "1"
  const cikissizFiltre = tek(sp.cikissiz) === "1" // çıkış tarihi olmayanlar
  const musterisizFiltre = tek(sp.musterisiz) === "1" // müşterisiz (tanımsız) işler
  const sayfa = Math.max(1, Number(tek(sp.sayfa) ?? "1") || 1)

  // Sıralama
  const SIRALANABILIR: Record<string, string> = {
    servis: "servis_no",
    cihaz: "cihaz_adi",
    gelis: "gelis_tarihi",
    cikis: "cikis_tarihi",
    tutar: "fatura_tutari",
  }
  const siralaParam = tek(sp.sirala) ?? ""
  const sirala = SIRALANABILIR[siralaParam] ? siralaParam : ""
  const yon = tek(sp.yon) === "asc" ? "asc" : "desc"

  const supabase = await createClient()
  const kullanici = await getKullanici()
  const finansal = kullanici.rol === "yonetici" // teknisyen finansal sütunları görmez

  // Filtre seçenekleri (dropdown'lar için)
  const [
    durumlarRes,
    personellerRes,
    faturalarRes,
    musterilerRes,
    gruplarRes,
    profillerRes,
    subelerRes,
  ] = await Promise.all([
      supabase.from("durum").select("id, ad").order("sira"),
      supabase
        .from("teknik_personel")
        .select("id, ad")
        .eq("aktif", true)
        .order("ad"),
      supabase.from("fatura_durumu").select("id, ad, sira, hizli").order("sira"),
      supabase
        .from("musteri")
        .select("id, ad")
        .eq("aktif", true)
        .order("ad"),
      supabase.from("grup").select("id, ad").eq("aktif", true).order("sira"),
      supabase.from("kullanici_profil").select("id, ad"),
      supabase
        .from("sube")
        .select("id, grup_id, ad, ust_sube_id")
        .eq("aktif", true)
        .order("sira"),
    ])

  const gruplar = gruplarRes.data ?? []
  const subeler = subelerRes.data ?? []
  const bakilmadiId = durumlarRes.data?.find((d) => d.ad === "BAKILMADI")?.id ?? ""
  const faturaDurumlari = faturalarRes.data ?? []
  // "Kapanmış" fatura durumları. Bir iş yalnızca ÇIKIŞ TARİHİ VAR **ve** fatura
  // durumu bu listedeyse ayında kalır (devretmez). Çıkışı olmayan her iş —
  // durum ne olursa olsun — sonraki aya devreder.
  const KAPALI_FATURA = new Set([
    "BEDELSİZ",
    "FATURA EDİLDİ",
    "GARANTİ",
    "İADE",
    "PEŞİN ALINDI",
    "ÇALIŞMADI",
    "SAĞLAM",
  ])
  const kapaliFaturaIdler = faturaDurumlari
    .filter((f) => KAPALI_FATURA.has(f.ad))
    .map((f) => f.id)
  // Üst şeritteki hızlı fatura-durumu butonları (Tanımlar'dan yönetilir)
  const hizliFaturalar = faturaDurumlari.filter((f) => f.hizli)

  // Ana sorgu — embed ile ilişkili isimleri çek + toplam say
  let query = supabase
    .from("is_kaydi")
    .select(
      `
        id, cihaz_adi, seri_no, servis_no, gelis_tarihi, gelis_saat, cikis_tarihi,
        fatura_tarihi, fiyat_teklifi, teklif_birim, fatura_tutari, garanti_no, talep_no, kargo_takip_no,
        telefon, ilgili_kisi, adres,
        musteri_id, durum_id, fatura_durumu_id, grup_id, sube_id, teknik_personel_id, olusturan_id,
        musteri:musteri_id ( ad, sube_sehir ),
        durum:durum_id ( ad, renk ),
        teknik_personel:teknik_personel_id ( ad ),
        fatura_durumu:fatura_durumu_id ( ad, renk )
      `,
      { count: "exact" }
    )

  // ARAMA (q) yapılırken TÜM diğer filtreler devre dışı kalır — arama tüm firmaları,
  // şubeleri, ayları, durumları kapsar. (Kullanıcı: aramada bir şeye tıklayınca her filtre iptal.)
  if (!q) {
  if (durum) query = query.eq("durum_id", durum)
  // Sol menü grubu: "diger" = grupsuz (null), aksi halde grup id
  if (grupParam === "diger") query = query.is("grup_id", null)
  else if (grupParam) query = query.eq("grup_id", grupParam)
  // Belirli şube seçiliyse o şubenin İŞLERİ + ALT ŞUBELERİNİN işleri
  // (firmaya tıklayınca hepsi geldiği gibi, üst şubeye tıklayınca da altındakiler gelir)
  if (subeParam) {
    const kapsam = [subeParam]
    const kuyruk = [subeParam]
    while (kuyruk.length > 0) {
      const ust = kuyruk.shift()!
      for (const s of subeler) {
        if (s.ust_sube_id === ust && !kapsam.includes(s.id)) {
          kapsam.push(s.id)
          kuyruk.push(s.id)
        }
      }
    }
    query = query.in("sube_id", kapsam)
  }
  // "Müşterisiz" (tanımsız) — müşterisi silinmiş işler
  if (musterisizFiltre) query = query.is("musteri_id", null)
  // "Bakılmadı (gelenler)" tuşu
  if (bakilmadiFiltre && bakilmadiId) query = query.eq("durum_id", bakilmadiId)
  // "Çıkış tarihi olmayanlar" tuşu
  if (cikissizFiltre) query = query.is("cikis_tarihi", null)
  if (personel) query = query.eq("teknik_personel_id", personel)
  if (fatura) query = query.eq("fatura_durumu_id", fatura)
  if (musteri) query = query.eq("musteri_id", musteri)
  if (baslangic) query = query.gte("gelis_tarihi", baslangic)
  if (bitis) query = query.lte("gelis_tarihi", bitis)
  // Arama yapılırken ay filtresi devre dışı — sonuç hangi aydaysa o gelsin.
  const ayAralik = ay && !q ? ayAraligi(ay) : null
  if (ayAralik) {
    // O ayın gelenleri VEYA hâlâ "açık" işler. Açık = çıkış tarihi yok (durum ne
    // olursa olsun) VEYA fatura durumu kapanmış listede değil (null dahil).
    const acikKosul =
      kapaliFaturaIdler.length > 0
        ? `or(cikis_tarihi.is.null,fatura_durumu_id.is.null,fatura_durumu_id.not.in.(${kapaliFaturaIdler.join(",")}))`
        : `cikis_tarihi.is.null`
    query = query.or(
      `and(gelis_tarihi.gte.${ayAralik.baslangic},gelis_tarihi.lte.${ayAralik.bitis}),${acikKosul}`
    )
  }
  } // /if (!q) — arama yapılıyorsa hiçbir filtre uygulanmaz

  if (q) {
    // or() sözdizimini bozan karakterleri temizle; Türkçe İ/i–I/ı için TR-büyük
    // ve TR-küçük varyantla ara (ilike zaten harf-duyarsız ama İ/ı için şart).
    // or() sözdizimini bozan/joker karakterleri BOŞLUKLA DEĞİL '*' (joker) ile değiştir:
    // böylece "1.2KW" araması veritabanındaki "1.2KW" ile de eşleşir (nokta silinmez).
    const qTemiz = q
      .replace(/[%,().:*\\&"]/g, "*")
      .replace(/\*{2,}/g, "*")
      .replace(/\s+/g, " ")
      .trim()
    const varyantlar = [
      ...new Set([
        qTemiz,
        qTemiz.toLocaleUpperCase("tr-TR"),
        qTemiz.toLocaleLowerCase("tr-TR"),
      ]),
    ].filter(Boolean)
    const like = (alan: string) => varyantlar.map((v) => `${alan}.ilike.*${v}*`)
    // İlişkili tablolarda ADA göre eşleşen id'ler (müşteri + durum + fatura durumu)
    const [musteriM, durumM, faturaM] = await Promise.all([
      supabase.from("musteri").select("id").or(like("ad").join(",")),
      supabase.from("durum").select("id").or(like("ad").join(",")),
      supabase.from("fatura_durumu").select("id").or(like("ad").join(",")),
    ])
    // Kayıt üzerindeki metin alanları
    const alanlar = [
      "cihaz_adi", "seri_no", "servis_no", "garanti_no", "talep_no",
      "kargo_takip_no", "takip_no", "ilgili_kisi", "telefon", "adres",
    ]
    const orParcalari = alanlar.flatMap(like)
    if (musteriM.data?.length)
      orParcalari.push(`musteri_id.in.(${musteriM.data.map((m) => m.id).join(",")})`)
    if (durumM.data?.length)
      orParcalari.push(`durum_id.in.(${durumM.data.map((d) => d.id).join(",")})`)
    if (faturaM.data?.length)
      orParcalari.push(`fatura_durumu_id.in.(${faturaM.data.map((f) => f.id).join(",")})`)
    // Sayı yazıldıysa fiyat/tutar da ara
    const sayi = Number(qTemiz.replace(",", "."))
    if (qTemiz !== "" && Number.isFinite(sayi)) {
      orParcalari.push(`fiyat_teklifi.eq.${sayi}`, `fatura_tutari.eq.${sayi}`)
    }
    // Telefon: rakamlar boşluk/tire ile saklanır (0507 151 44 29). Sorgu telefon-benzeriyse
    // (yalnız rakam + telefon işaretleri) rakamları joker'le ayırıp telefon + ilgili kişide ara —
    // böylece SON 3 HANE ("429") bile boşluklara takılmadan bulunur.
    const telRakam = q.replace(/\D/g, "")
    const telefonAramasi = telRakam.length >= 3 && q.replace(/[\d\s()+\-.]/g, "") === ""
    if (telefonAramasi) {
      // Biçimsiz rakam sütununda ARDIŞIK ara: "429" gerçekten 429 içeren telefonu bulur,
      // 4-2-9'u dağınık içerenleri DEĞİL (yanlış pozitif olmaz).
      orParcalari.push(`telefon_rakam.ilike.*${telRakam}*`)
    }
    query = query.or(orParcalari.join(","))
  }

  const siralaKolon = sirala ? SIRALANABILIR[sirala] : "gelis_tarihi"
  const artan = sirala ? yon === "asc" : false
  const baslangicIndex = (sayfa - 1) * SAYFA_BOYUTU
  let siraliQuery = query.order(siralaKolon, { ascending: artan, nullsFirst: false })
  // Geliş sıralamasında aynı gün içinde saate göre de sırala
  if (siralaKolon === "gelis_tarihi")
    siraliQuery = siraliQuery.order("gelis_saat", { ascending: artan, nullsFirst: false })
  const { data, count, error } = await siraliQuery
    .order("created_at", { ascending: false })
    .range(baslangicIndex, baslangicIndex + SAYFA_BOYUTU - 1)

  const toplam = count ?? 0
  const toplamSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU))
  // Fiş no altında "kim kaydetti" için profil adlarını iliştir
  const profilAd = new Map(
    (profillerRes.data ?? []).map((p) => [p.id, p.ad ?? "—"])
  )
  const kayitlar = (data ?? []).map((k) => ({
    ...k,
    olusturan_ad: k.olusturan_id ? profilAd.get(k.olusturan_id) ?? null : null,
  }))

  // Seçili işin fotoğrafları (yan önizleme paneli için)
  type SeciliBilgi = {
    id: string
    cihaz_adi: string
    servis_no: string | null
    musteriAd: string | null
    aciklama: string | null
    kargo_takip_no: string | null
    fatura_durumu_id: string | null
    fiyat_teklifi: number | null
    teklif_birim: string | null
    fatura_tutari: number | null
    fatura_tarihi: string | null
    garanti_no: string | null
    talep_no: string | null
    fotolar: { id: string; url: string }[]
  }
  let seciliBilgi: SeciliBilgi | null = null
  if (secili) {
    const { data: kayit } = await supabase
      .from("is_kaydi")
      .select(
        "cihaz_adi, servis_no, aciklama, kargo_takip_no, fatura_durumu_id, fiyat_teklifi, teklif_birim, fatura_tutari, fatura_tarihi, garanti_no, talep_no, musteri:musteri_id ( ad )"
      )
      .eq("id", secili)
      .maybeSingle()
    if (kayit) {
      const { data: fotoR } = await supabase
        .from("foto")
        .select("id, dosya_yolu")
        .eq("is_kaydi_id", secili)
        .order("sira")
      let fotolar: { id: string; url: string }[] = []
      if (fotoR && fotoR.length > 0) {
        const { data: imzali } = await supabase.storage
          .from("foto")
          .createSignedUrls(
            fotoR.map((f) => f.dosya_yolu),
            60 * 60
          )
        fotolar = fotoR
          .map((f, i) => ({
            id: f.id,
            url: imzali?.[i]?.signedUrl ?? "",
          }))
          .filter((f) => f.url) // boş URL next/image'i patlatmasın
      }
      seciliBilgi = {
        id: secili,
        cihaz_adi: kayit.cihaz_adi,
        servis_no: kayit.servis_no,
        musteriAd: kayit.musteri?.ad ?? null,
        aciklama: kayit.aciklama,
        kargo_takip_no: kayit.kargo_takip_no,
        fatura_durumu_id: kayit.fatura_durumu_id,
        fiyat_teklifi: kayit.fiyat_teklifi,
        teklif_birim: kayit.teklif_birim,
        fatura_tutari: kayit.fatura_tutari,
        fatura_tarihi: kayit.fatura_tarihi,
        garanti_no: kayit.garanti_no,
        talep_no: kayit.talep_no,
        fotolar,
      }
    }
  }

  // Mevcut filtreleri koruyarak link üret (sayfa/seçili/sıralama/grup üzerine yazılabilir)
  function linkUret(
    over: {
      sayfa?: number
      secili?: string
      sirala?: string
      yon?: string
      grup?: string
      sube?: string
      bakilmadi?: string
      cikissiz?: string
      musterisiz?: string
      fatura?: string
    } = {}
  ): string {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (durum) params.set("durum", durum)
    if (personel) params.set("personel", personel)
    const hedefFatura = over.fatura !== undefined ? over.fatura : fatura
    if (hedefFatura) params.set("fatura", hedefFatura)
    if (musteri) params.set("musteri", musteri)
    if (baslangic) params.set("baslangic", baslangic)
    if (bitis) params.set("bitis", bitis)
    if (ay) params.set("ay", ay)
    const hedefGrup = over.grup !== undefined ? over.grup : grupParam
    if (hedefGrup) params.set("grup", hedefGrup)
    const hedefSube = over.sube !== undefined ? over.sube : subeParam
    if (hedefSube) params.set("sube", hedefSube)
    const hedefBakilmadi =
      over.bakilmadi !== undefined ? over.bakilmadi : bakilmadiFiltre ? "1" : ""
    if (hedefBakilmadi) params.set("bakilmadi", hedefBakilmadi)
    const hedefCikissiz =
      over.cikissiz !== undefined ? over.cikissiz : cikissizFiltre ? "1" : ""
    if (hedefCikissiz) params.set("cikissiz", hedefCikissiz)
    const hedefMusterisiz =
      over.musterisiz !== undefined ? over.musterisiz : musterisizFiltre ? "1" : ""
    if (hedefMusterisiz) params.set("musterisiz", hedefMusterisiz)
    const hedefSayfa = over.sayfa ?? sayfa
    if (hedefSayfa > 1) params.set("sayfa", String(hedefSayfa))
    const hedefSecili = over.secili !== undefined ? over.secili : secili
    if (hedefSecili) params.set("secili", hedefSecili)
    const hedefSirala = over.sirala !== undefined ? over.sirala : sirala
    const hedefYon = over.yon !== undefined ? over.yon : yon
    if (hedefSirala) {
      params.set("sirala", hedefSirala)
      params.set("yon", hedefYon)
    }
    const qs = params.toString()
    return qs ? `/?${qs}` : "/"
  }
  const sayfaLinki = (hedef: number) => linkUret({ sayfa: hedef })

  // Üst şerit: Bakılmadı + hızlı fatura-durumu butonları (tıkla=filtrele, tekrar tıkla=kaldır)
  const hizliButonlar = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link
        href={linkUret({ bakilmadi: bakilmadiFiltre ? "" : "1", sayfa: 1 })}
        className={
          "rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors " +
          (bakilmadiFiltre
            ? "bg-amber-500 text-white"
            : "border border-amber-300/60 bg-card text-amber-700 hover:bg-amber-500/10 dark:text-amber-300")
        }
      >
        Bakılmadı
      </Link>
      <Link
        href={linkUret({ cikissiz: cikissizFiltre ? "" : "1", sayfa: 1 })}
        className={
          "rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors " +
          (cikissizFiltre
            ? "bg-sky-600 text-white"
            : "border border-sky-300/60 bg-card text-sky-700 hover:bg-sky-500/10 dark:text-sky-300")
        }
        title="Henüz çıkış tarihi girilmemiş (teslim edilmemiş) işler"
      >
        Çıkış tarihi olmayanlar
      </Link>
      <Link
        href={linkUret({ musterisiz: musterisizFiltre ? "" : "1", sayfa: 1, grup: "" })}
        className={
          "rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors " +
          (musterisizFiltre
            ? "bg-rose-600 text-white"
            : "border border-rose-300/60 bg-card text-rose-700 hover:bg-rose-500/10 dark:text-rose-300")
        }
        title="Müşterisi silinmiş (tanımsız) işler"
      >
        Müşterisiz
      </Link>
      {hizliFaturalar.map((f) => {
        const aktifMi = fatura === f.id
        return (
          <Link
            key={f.id}
            href={linkUret({ fatura: aktifMi ? "" : f.id, sayfa: 1 })}
            className={
              "rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors " +
              (aktifMi
                ? "bg-primary font-semibold text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-muted")
            }
          >
            {f.ad}
          </Link>
        )
      })}
    </div>
  )

  // Kompakt sayfalama — arama satırının sağında (sayfa dikey kaymasın diye üstte)
  const okBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-sm hover:bg-muted"
  const sayfalama =
    toplamSayfa > 1 ? (
      <div className="flex items-center gap-1.5 text-[12.5px]">
        {sayfa > 1 ? (
          <Link href={sayfaLinki(sayfa - 1)} scroll={false} className={okBtn} title="Önceki sayfa">
            ←
          </Link>
        ) : (
          <span className={okBtn + " opacity-35"}>←</span>
        )}
        <span className="whitespace-nowrap text-muted-foreground">
          {sayfa}/{toplamSayfa}
        </span>
        {sayfa < toplamSayfa ? (
          <Link href={sayfaLinki(sayfa + 1)} scroll={false} className={okBtn} title="Sonraki sayfa">
            →
          </Link>
        ) : (
          <span className={okBtn + " opacity-35"}>→</span>
        )}
      </div>
    ) : null

  const filtrelerBlogu = (
    <IslerFiltreler
      durumlar={durumlarRes.data ?? []}
      personeller={personellerRes.data ?? []}
      faturaDurumlari={faturaDurumlari}
      musteriler={musterilerRes.data ?? []}
      sadeMod={!finansal} // personel: yalnız arama + aylar
      sagSlot={finansal ? hizliButonlar : undefined}
      aySlot={
        <div className="flex items-center gap-3">
          {/* Ay kutucukları yalnız yöneticide (geniş ekranda üst barda); personel hep tümü */}
          {finansal && (
            <div className="xl:hidden">
              <AySecici aylar={sonAylar()} basePath="/" />
            </div>
          )}
          {sayfalama}
        </div>
      }
    />
  )

  const ilkAd = (kullanici.ad ?? "").trim().split(/\s+/)[0]

  return (
    <div className="grid min-w-0 gap-4">
      {/* Personele kişisel karşılama */}
      {!finansal && ilkAd && (
        <div className="rounded-xl border border-primary/20 bg-accent/60 px-4 py-3">
          <div className="text-[15px] font-semibold text-primary">
            Hoş geldin, {ilkAd} 👋
          </div>
          <div className="text-[12px] text-muted-foreground">
            Aşağıdaki + ile yeni iş ekleyebilir, kendi kayıtlarını görebilirsin.
          </div>
        </div>
      )}

      {/* Mobil: arama + filtreler (masaüstünde tablo sütununun üstünde) */}
      <div className="md:hidden">{filtrelerBlogu}</div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Kayıtlar yüklenirken bir hata oluştu: {error.message}
        </div>
      ) : (
        <>
          {/* Mobil boş durum (masaüstünde sol menü hep kalır, tablo kendi mesajını basar) */}
          {kayitlar.length === 0 && (
            <div className="grid justify-items-center gap-3 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground md:hidden">
              {toplam === 0 && !q && !durum && !personel && !fatura && !musteri ? (
                <>
                  <span>Henüz iş kaydı yok.</span>
                  <Link href="/yeni" className={buttonVariants({ size: "sm" })}>
                    + İlk işi ekle
                  </Link>
                </>
              ) : (
                "Aramanıza/filtrenize uyan kayıt bulunamadı."
              )}
            </div>
          )}

          {/* Masaüstü: sol menü + Excel-gibi tablo + panel */}
          <IslerEkrani
            kayitlar={kayitlar}
            gruplar={gruplar}
            subeler={subeler}
            durumlar={durumlarRes.data ?? []}
            personeller={personellerRes.data ?? []}
            faturaDurumlari={faturaDurumlari}
            finansal={finansal}
            seciliId={secili}
            seciliBilgi={seciliBilgi}
            aktifGrup={grupParam}
            aktifSube={subeParam}
            arama={q}
            ustSlot={filtrelerBlogu}
          />

          {/* Mobil: kart görünümü */}
          <div className="grid gap-3 md:hidden">
            {kayitlar.map((k) => (
              <Link
                key={k.id}
                href={`/is/${k.id}`}
                className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{k.musteri?.ad ?? "—"}</div>
                  {k.durum ? (
                    <DurumRozeti ad={k.durum.ad} renk={k.durum.renk} />
                  ) : null}
                </div>
                <div className="mt-1 text-sm">{k.cihaz_adi}</div>
                {k.seri_no ? (
                  <div className="text-xs text-muted-foreground">
                    SN: {k.seri_no}
                  </div>
                ) : null}
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <div>Servis: {k.servis_no ?? "—"}</div>
                  <div>Personel: {k.teknik_personel?.ad ?? "—"}</div>
                  <div>
                    Geliş: {tarihTR(k.gelis_tarihi)}
                    {k.gelis_saat ? ` ${k.gelis_saat.slice(0, 5)}` : ""}
                  </div>
                  <div>Çıkış: {tarihTR(k.cikis_tarihi)}</div>
                  {finansal && k.garanti_no ? <div>Takip no: {k.garanti_no}</div> : null}
                  {finansal && <div>Fatura: {k.fatura_durumu?.ad ?? "—"}</div>}
                  {finansal && (
                    <div className="font-medium text-foreground">
                      {k.fatura_tutari != null
                        ? paraTR(k.fatura_tutari, "TL")
                        : paraTR(k.fiyat_teklifi, k.teklif_birim ?? "TL")}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

        </>
      )}
    </div>
  )
}
