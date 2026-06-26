import Link from "next/link"
import Image from "next/image"

import { createClient } from "@/lib/supabase/server"
import { buttonVariants } from "@/components/ui/button"
import { DurumRozeti, FaturaRozeti } from "@/components/rozet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { sonAylar, ayAraligi } from "@/lib/aylar"
import { AySecici } from "@/components/ay-secici"
import { IslerFiltreler } from "./isler-filtreler"
import { OnizleSatiri } from "./onizle-satiri"

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

  // Filtre seçenekleri (dropdown'lar için)
  const [durumlarRes, personellerRes, faturalarRes, musterilerRes] =
    await Promise.all([
      supabase.from("durum").select("id, ad").order("sira"),
      supabase
        .from("teknik_personel")
        .select("id, ad")
        .eq("aktif", true)
        .order("ad"),
      supabase.from("fatura_durumu").select("id, ad").order("ad"),
      supabase
        .from("musteri")
        .select("id, ad")
        .eq("aktif", true)
        .order("ad"),
    ])

  // Ana sorgu — embed ile ilişkili isimleri çek + toplam say
  let query = supabase
    .from("is_kaydi")
    .select(
      `
        id, cihaz_adi, seri_no, servis_no, gelis_tarihi, cikis_tarihi,
        fiyat_teklifi, fatura_tutari,
        musteri:musteri_id ( ad, sube_sehir ),
        durum:durum_id ( ad, renk ),
        teknik_personel:teknik_personel_id ( ad ),
        fatura_durumu:fatura_durumu_id ( ad )
      `,
      { count: "exact" }
    )

  if (durum) query = query.eq("durum_id", durum)
  if (personel) query = query.eq("teknik_personel_id", personel)
  if (fatura) query = query.eq("fatura_durumu_id", fatura)
  if (musteri) query = query.eq("musteri_id", musteri)
  if (baslangic) query = query.gte("gelis_tarihi", baslangic)
  if (bitis) query = query.lte("gelis_tarihi", bitis)
  const ayAralik = ay ? ayAraligi(ay) : null
  if (ayAralik) {
    query = query
      .gte("gelis_tarihi", ayAralik.baslangic)
      .lte("gelis_tarihi", ayAralik.bitis)
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
  const kayitlar = data ?? []

  // Seçili işin fotoğrafları (yan önizleme paneli için)
  type SeciliBilgi = {
    cihaz_adi: string
    servis_no: string | null
    musteriAd: string | null
    fotolar: { id: string; url: string }[]
  }
  let seciliBilgi: SeciliBilgi | null = null
  if (secili) {
    const { data: kayit } = await supabase
      .from("is_kaydi")
      .select("cihaz_adi, servis_no, musteri:musteri_id ( ad )")
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
        fotolar = fotoR.map((f, i) => ({
          id: f.id,
          url: imzali?.[i]?.signedUrl ?? "",
        }))
      }
      seciliBilgi = {
        cihaz_adi: kayit.cihaz_adi,
        servis_no: kayit.servis_no,
        musteriAd: kayit.musteri?.ad ?? null,
        fotolar,
      }
    }
  }

  // Mevcut filtreleri koruyarak link üret (sayfa/seçili/sıralama üzerine yazılabilir)
  function linkUret(
    over: { sayfa?: number; secili?: string; sirala?: string; yon?: string } = {}
  ): string {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (durum) params.set("durum", durum)
    if (personel) params.set("personel", personel)
    if (fatura) params.set("fatura", fatura)
    if (musteri) params.set("musteri", musteri)
    if (baslangic) params.set("baslangic", baslangic)
    if (bitis) params.set("bitis", bitis)
    if (ay) params.set("ay", ay)
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

  // Sıralanabilir başlık: tıklayınca yönü değiştirir, ok gösterir
  function siralaHref(anahtar: string): string {
    const yeniYon = sirala === anahtar && yon === "asc" ? "desc" : "asc"
    return linkUret({ sirala: anahtar, yon: yeniYon, sayfa: 1 })
  }
  function siralaOk(anahtar: string): string {
    if (sirala !== anahtar) return ""
    return yon === "asc" ? " ▲" : " ▼"
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[21px] font-semibold tracking-tight">İşler</h1>
          <span className="text-sm text-muted-foreground">{toplam} kayıt</span>
        </div>
        <AySecici aylar={sonAylar()} basePath="/" />
      </div>

      <IslerFiltreler
        durumlar={durumlarRes.data ?? []}
        personeller={personellerRes.data ?? []}
        faturaDurumlari={faturalarRes.data ?? []}
        musteriler={musterilerRes.data ?? []}
      />

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Kayıtlar yüklenirken bir hata oluştu: {error.message}
        </div>
      ) : kayitlar.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
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
      ) : (
        <>
          {/* Masaüstü: tablo + yan önizleme paneli */}
          <div className="hidden gap-4 md:flex">
            <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Link href={siralaHref("servis")} scroll={false} className="hover:underline">
                        Servis No{siralaOk("servis")}
                      </Link>
                    </TableHead>
                    <TableHead>Müşteri</TableHead>
                    <TableHead>
                      <Link href={siralaHref("cihaz")} scroll={false} className="hover:underline">
                        Cihaz{siralaOk("cihaz")}
                      </Link>
                    </TableHead>
                    <TableHead>
                      <Link href={siralaHref("gelis")} scroll={false} className="hover:underline">
                        Geliş{siralaOk("gelis")}
                      </Link>
                    </TableHead>
                    <TableHead>
                      <Link href={siralaHref("cikis")} scroll={false} className="hover:underline">
                        Çıkış{siralaOk("cikis")}
                      </Link>
                    </TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Personel</TableHead>
                    <TableHead>Fatura</TableHead>
                    <TableHead className="text-right">
                      <Link href={siralaHref("tutar")} scroll={false} className="hover:underline">
                        Tutar{siralaOk("tutar")}
                      </Link>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kayitlar.map((k) => (
                    <OnizleSatiri
                      key={k.id}
                      href={linkUret({ secili: k.id })}
                      secili={k.id === secili}
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={`/is/${k.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {k.servis_no ?? "Aç"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {k.musteri?.ad ?? "—"}
                        {k.musteri?.sube_sehir ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {k.musteri.sube_sehir}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {k.cihaz_adi}
                        {k.seri_no ? (
                          <span className="block text-xs text-muted-foreground">
                            SN: {k.seri_no}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>{tarihTR(k.gelis_tarihi)}</TableCell>
                      <TableCell>{tarihTR(k.cikis_tarihi)}</TableCell>
                      <TableCell>
                        {k.durum ? (
                          <DurumRozeti ad={k.durum.ad} renk={k.durum.renk} />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{k.teknik_personel?.ad ?? "—"}</TableCell>
                      <TableCell>
                        <FaturaRozeti ad={k.fatura_durumu?.ad} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {tutarTR(k.fatura_tutari ?? k.fiyat_teklifi)}
                      </TableCell>
                    </OnizleSatiri>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Yan önizleme paneli */}
            <aside className="w-80 shrink-0 lg:w-96">
              <div className="sticky top-20 rounded-lg border p-3">
                {seciliBilgi ? (
                  <>
                    <div className="text-sm font-medium">
                      {seciliBilgi.servis_no ?? seciliBilgi.cihaz_adi}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {seciliBilgi.musteriAd ? `${seciliBilgi.musteriAd} · ` : ""}
                      {seciliBilgi.cihaz_adi}
                    </div>
                    {seciliBilgi.fotolar.length > 0 ? (
                      <div className="mt-3 grid gap-2">
                        {/* İlk fotoğraf — tam genişlik büyük önizleme */}
                        <a
                          href={seciliBilgi.fotolar[0].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative block aspect-square overflow-hidden rounded-md border"
                        >
                          <Image
                            src={seciliBilgi.fotolar[0].url}
                            alt="Önizleme"
                            fill
                            sizes="(min-width:1024px) 360px, 300px"
                            quality={70}
                            priority
                            className="object-cover"
                          />
                        </a>
                        {/* Diğer fotoğraflar — küçük thumbnail */}
                        {seciliBilgi.fotolar.length > 1 && (
                          <div className="grid grid-cols-4 gap-2">
                            {seciliBilgi.fotolar.slice(1).map((f) => (
                              <a
                                key={f.id}
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative aspect-square overflow-hidden rounded-md border"
                              >
                                <Image
                                  src={f.url}
                                  alt="Önizleme"
                                  fill
                                  sizes="90px"
                                  quality={60}
                                  className="object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Bu işte fotoğraf yok.
                      </p>
                    )}
                    <Link
                      href={`/is/${secili}`}
                      className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Detayı aç →
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Önizleme için bir işe tıklayın.
                  </p>
                )}
              </div>
            </aside>
          </div>

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
                  <div>Fatura: {k.fatura_durumu?.ad ?? "—"}</div>
                  <div className="font-medium text-foreground">
                    {tutarTR(k.fatura_tutari ?? k.fiyat_teklifi)}
                  </div>
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
