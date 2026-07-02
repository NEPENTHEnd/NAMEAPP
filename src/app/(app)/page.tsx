import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"
import { buttonVariants } from "@/components/ui/button"
import { DurumRozeti } from "@/components/rozet"
import { sonAylar, ayAraligi } from "@/lib/aylar"
import { AySecici } from "@/components/ay-secici"
import { IslerFiltreler } from "./isler-filtreler"
import { IslerEkrani } from "./isler-ekrani"

const SAYFA_BOYUTU = 20

// "YYYY-MM-DD" -> "DD.MM.YYYY" (zaman dilimi kaymasından etkilenmez)
function tarihTR(s: string | null): string {
  if (!s) return "—"
  const [y, m, g] = s.split("-")
  return `${g}.${m}.${y}`
}

const tutarBicim = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
})

function tutarTR(n: number | null): string {
  return n == null ? "—" : tutarBicim.format(n)
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
  const bakilmadiFiltre = tek(sp.bakilmadi) === "1"
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
    ])

  const gruplar = gruplarRes.data ?? []
  const bakilmadiId = durumlarRes.data?.find((d) => d.ad === "BAKILMADI")?.id ?? ""
  const faturaDurumlari = faturalarRes.data ?? []
  // Bu fatura durumları "kapanmış" sayılır: çıkış tarihi olmasa da sonraki aya devretmez
  const KAPALI_FATURA = new Set([
    "BEDELSİZ",
    "FATURA EDİLDİ",
    "GARANTİ",
    "İADE",
    "PEŞİN ALINDI",
    "ÇALIŞMADI",
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
        id, cihaz_adi, seri_no, servis_no, gelis_tarihi, cikis_tarihi,
        fatura_tarihi, fiyat_teklifi, fatura_tutari, garanti_no, kargo_takip_no,
        musteri_id, durum_id, fatura_durumu_id, grup_id, teknik_personel_id, olusturan_id,
        musteri:musteri_id ( ad, sube_sehir ),
        durum:durum_id ( ad, renk ),
        teknik_personel:teknik_personel_id ( ad ),
        fatura_durumu:fatura_durumu_id ( ad, renk )
      `,
      { count: "exact" }
    )

  if (durum) query = query.eq("durum_id", durum)
  // Sol menü grubu: "diger" = grupsuz (null), aksi halde grup id
  if (grupParam === "diger") query = query.is("grup_id", null)
  else if (grupParam) query = query.eq("grup_id", grupParam)
  // "Bakılmadı (gelenler)" tuşu
  if (bakilmadiFiltre && bakilmadiId) query = query.eq("durum_id", bakilmadiId)
  if (personel) query = query.eq("teknik_personel_id", personel)
  if (fatura) query = query.eq("fatura_durumu_id", fatura)
  if (musteri) query = query.eq("musteri_id", musteri)
  if (baslangic) query = query.gte("gelis_tarihi", baslangic)
  if (bitis) query = query.lte("gelis_tarihi", bitis)
  // Arama yapılırken ay filtresi devre dışı — sonuç hangi aydaysa o gelsin.
  const ayAralik = ay && !q ? ayAraligi(ay) : null
  if (ayAralik) {
    // O ayın gelenleri VEYA hâlâ açık işler. "Açık" = çıkış tarihi yok VE fatura
    // durumu kapanmış (bedelsiz/fatura edildi/garanti/iade/peşin/çalışmadı) değil.
    const acikKosul =
      kapaliFaturaIdler.length > 0
        ? `and(cikis_tarihi.is.null,or(fatura_durumu_id.is.null,fatura_durumu_id.not.in.(${kapaliFaturaIdler.join(",")})))`
        : `cikis_tarihi.is.null`
    query = query.or(
      `and(gelis_tarihi.gte.${ayAralik.baslangic},gelis_tarihi.lte.${ayAralik.bitis}),${acikKosul}`
    )
  }

  if (q) {
    // Müşteri adına göre de aramak için önce eşleşen müşteri id'lerini bul.
    const { data: eslesenMusteri } = await supabase
      .from("musteri")
      .select("id")
      .ilike("ad", `%${q}%`)
    const orParcalari = [
      `cihaz_adi.ilike.*${q}*`,
      `seri_no.ilike.*${q}*`,
      `servis_no.ilike.*${q}*`,
      `garanti_no.ilike.*${q}*`,
      `kargo_takip_no.ilike.*${q}*`,
      `takip_no.ilike.*${q}*`,
      `ilgili_kisi.ilike.*${q}*`,
      `adres.ilike.*${q}*`,
    ]
    if (eslesenMusteri && eslesenMusteri.length > 0) {
      orParcalari.push(`musteri_id.in.(${eslesenMusteri.map((m) => m.id).join(",")})`)
    }
    query = query.or(orParcalari.join(","))
  }

  const siralaKolon = sirala ? SIRALANABILIR[sirala] : "gelis_tarihi"
  const artan = sirala ? yon === "asc" : false
  const baslangicIndex = (sayfa - 1) * SAYFA_BOYUTU
  const { data, count, error } = await query
    .order(siralaKolon, { ascending: artan, nullsFirst: false })
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
    fatura_tutari: number | null
    garanti_no: string | null
    fotolar: { id: string; url: string }[]
  }
  let seciliBilgi: SeciliBilgi | null = null
  if (secili) {
    const { data: kayit } = await supabase
      .from("is_kaydi")
      .select(
        "cihaz_adi, servis_no, aciklama, kargo_takip_no, fatura_durumu_id, fiyat_teklifi, fatura_tutari, garanti_no, musteri:musteri_id ( ad )"
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
        fatura_tutari: kayit.fatura_tutari,
        garanti_no: kayit.garanti_no,
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
      bakilmadi?: string
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
    const hedefBakilmadi =
      over.bakilmadi !== undefined ? over.bakilmadi : bakilmadiFiltre ? "1" : ""
    if (hedefBakilmadi) params.set("bakilmadi", hedefBakilmadi)
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

  const filtrelerBlogu = (
    <IslerFiltreler
      durumlar={durumlarRes.data ?? []}
      personeller={personellerRes.data ?? []}
      faturaDurumlari={faturaDurumlari}
      musteriler={musterilerRes.data ?? []}
      sagSlot={hizliButonlar}
      aySlot={<AySecici aylar={sonAylar()} basePath="/" />}
    />
  )

  return (
    <div className="grid min-w-0 gap-4">
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
            durumlar={durumlarRes.data ?? []}
            personeller={personellerRes.data ?? []}
            faturaDurumlari={faturaDurumlari}
            finansal={finansal}
            seciliId={secili}
            seciliBilgi={seciliBilgi}
            aktifGrup={grupParam}
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
                  <div>Geliş: {tarihTR(k.gelis_tarihi)}</div>
                  <div>Çıkış: {tarihTR(k.cikis_tarihi)}</div>
                  {finansal && k.garanti_no ? <div>Takip no: {k.garanti_no}</div> : null}
                  {k.kargo_takip_no ? <div>Kargo: {k.kargo_takip_no}</div> : null}
                  {finansal && <div>Fatura: {k.fatura_durumu?.ad ?? "—"}</div>}
                  {finansal && (
                    <div className="font-medium text-foreground">
                      {tutarTR(k.fatura_tutari ?? k.fiyat_teklifi)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Sayfalama */}
          {toplamSayfa > 1 && (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                Sayfa {sayfa} / {toplamSayfa}
              </span>
              <div className="flex gap-2">
                {sayfa > 1 ? (
                  <Link
                    href={sayfaLinki(sayfa - 1)}
                    className="rounded-md border px-3 py-1.5 hover:bg-muted"
                    scroll={false}
                  >
                    ← Önceki
                  </Link>
                ) : (
                  <span className="rounded-md border px-3 py-1.5 text-muted-foreground/50">
                    ← Önceki
                  </span>
                )}
                {sayfa < toplamSayfa ? (
                  <Link
                    href={sayfaLinki(sayfa + 1)}
                    className="rounded-md border px-3 py-1.5 hover:bg-muted"
                    scroll={false}
                  >
                    Sonraki →
                  </Link>
                ) : (
                  <span className="rounded-md border px-3 py-1.5 text-muted-foreground/50">
                    Sonraki →
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
