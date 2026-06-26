import { createClient } from "@/lib/supabase/server"
import { getYonetici } from "@/lib/auth"
import { getIsFormSecenekleri } from "@/lib/secenekler"
import { filtreleriOku, aramaOrIfadesi, filtreToParams } from "@/lib/isler-sorgu"
import { sonAylar, ayAraligi } from "@/lib/aylar"
import { AySecici } from "@/components/ay-secici"
import { DurumRozeti, FaturaRozeti } from "@/components/rozet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { IslerFiltreler } from "../isler-filtreler"

const ONIZLEME_LIMIT = 100

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

export default async function RaporlarSayfasi({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  await getYonetici()
  const sp = await searchParams
  const filtre = filtreleriOku(sp)
  const ay = (Array.isArray(sp.ay) ? sp.ay[0] : sp.ay) ?? ""
  const ayAralik = ay ? ayAraligi(ay) : null

  const supabase = await createClient()
  const secenekler = await getIsFormSecenekleri()

  let sorgu = supabase.from("is_kaydi").select(
    `
      id, cihaz_adi, seri_no, servis_no, gelis_tarihi, cikis_tarihi,
      fiyat_teklifi, fatura_tutari,
      musteri:musteri_id ( ad ),
      durum:durum_id ( ad, renk ),
      teknik_personel:teknik_personel_id ( ad ),
      fatura_durumu:fatura_durumu_id ( ad )
    `,
    { count: "exact" }
  )
  if (filtre.durum) sorgu = sorgu.eq("durum_id", filtre.durum)
  if (filtre.personel) sorgu = sorgu.eq("teknik_personel_id", filtre.personel)
  if (filtre.fatura) sorgu = sorgu.eq("fatura_durumu_id", filtre.fatura)
  if (filtre.musteri) sorgu = sorgu.eq("musteri_id", filtre.musteri)
  if (filtre.baslangic) sorgu = sorgu.gte("gelis_tarihi", filtre.baslangic)
  if (filtre.bitis) sorgu = sorgu.lte("gelis_tarihi", filtre.bitis)
  if (ayAralik) sorgu = sorgu.gte("gelis_tarihi", ayAralik.baslangic).lte("gelis_tarihi", ayAralik.bitis)
  const orStr = await aramaOrIfadesi(supabase, filtre.q)
  if (orStr) sorgu = sorgu.or(orStr)

  const { data, count } = await sorgu
    .order("gelis_tarihi", { ascending: false })
    .range(0, ONIZLEME_LIMIT - 1)

  const kayitlar = data ?? []
  const toplam = count ?? 0

  // --- Aylık kırılım (tüm eşleşen kayıtlar) ---
  let aySorgu = supabase
    .from("is_kaydi")
    .select("gelis_tarihi, cikis_tarihi, fatura_tutari")
  if (filtre.durum) aySorgu = aySorgu.eq("durum_id", filtre.durum)
  if (filtre.personel) aySorgu = aySorgu.eq("teknik_personel_id", filtre.personel)
  if (filtre.fatura) aySorgu = aySorgu.eq("fatura_durumu_id", filtre.fatura)
  if (filtre.musteri) aySorgu = aySorgu.eq("musteri_id", filtre.musteri)
  if (filtre.baslangic) aySorgu = aySorgu.gte("gelis_tarihi", filtre.baslangic)
  if (filtre.bitis) aySorgu = aySorgu.lte("gelis_tarihi", filtre.bitis)
  if (ayAralik) aySorgu = aySorgu.gte("gelis_tarihi", ayAralik.baslangic).lte("gelis_tarihi", ayAralik.bitis)
  if (orStr) aySorgu = aySorgu.or(orStr)
  const { data: ayData } = await aySorgu.range(0, 9999)

  const AYLAR = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ]
  const ayAdi = (anahtar: string) => {
    const [y, m] = anahtar.split("-")
    return `${AYLAR[Number(m) - 1]} ${y}`
  }
  const aylik = new Map<string, { gelen: number; cikan: number; ciro: number }>()
  const getAy = (k: string) =>
    aylik.get(k) ?? { gelen: 0, cikan: 0, ciro: 0 }
  for (const r of ayData ?? []) {
    if (r.gelis_tarihi) {
      const k = r.gelis_tarihi.slice(0, 7)
      const v = getAy(k)
      v.gelen++
      aylik.set(k, v)
    }
    if (r.cikis_tarihi) {
      const k = r.cikis_tarihi.slice(0, 7)
      const v = getAy(k)
      v.cikan++
      v.ciro += r.fatura_tutari ?? 0
      aylik.set(k, v)
    }
  }
  const aylikSirali = [...aylik.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  const indirParams = filtreToParams(filtre)
  if (ayAralik) {
    indirParams.set("baslangic", ayAralik.baslangic)
    indirParams.set("bitis", ayAralik.bitis)
  }
  const indirHref = `/raporlar/disa-aktar?${indirParams.toString()}`

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Raporlar</h1>
        <a
          href={indirHref}
          className="inline-flex items-center gap-2 rounded-[9px] border border-input bg-card px-4 py-2 text-[13px] font-semibold text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" />
          </svg>
          Excel indir ({toplam})
        </a>
      </div>

      <AySecici aylar={sonAylar()} basePath="/raporlar" />

      <IslerFiltreler
        basePath="/raporlar"
        durumlar={secenekler.durumlar}
        personeller={secenekler.personeller}
        faturaDurumlari={secenekler.faturaDurumlari}
        musteriler={secenekler.musteriler}
      />

      <p className="text-sm text-muted-foreground">
        {toplam} kayıt eşleşti.
        {toplam > ONIZLEME_LIMIT
          ? ` Aşağıda ilk ${ONIZLEME_LIMIT} tanesi gösteriliyor; tümünü CSV ile indirebilirsiniz.`
          : ""}
      </p>

      {aylikSirali.length > 0 && (
        <div className="grid gap-2">
          <h2 className="text-sm font-semibold">Aylık özet</h2>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ay</TableHead>
                  <TableHead className="text-right">Gelen</TableHead>
                  <TableHead className="text-right">Çıkan</TableHead>
                  <TableHead className="text-right">Ciro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aylikSirali.map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell className="font-medium">{ayAdi(k)}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.gelen}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.cikan}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {tutarTR(v.ciro)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {kayitlar.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Filtrenize uyan kayıt yok.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servis No</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead>Cihaz</TableHead>
                <TableHead>Geliş</TableHead>
                <TableHead>Çıkış</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Personel</TableHead>
                <TableHead>Fatura</TableHead>
                <TableHead className="text-right">Teklif</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kayitlar.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">
                    {k.servis_no ?? "—"}
                  </TableCell>
                  <TableCell>{k.musteri?.ad ?? "—"}</TableCell>
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
                    <DurumRozeti ad={k.durum?.ad} renk={k.durum?.renk} />
                  </TableCell>
                  <TableCell>{k.teknik_personel?.ad ?? "—"}</TableCell>
                  <TableCell>
                    <FaturaRozeti ad={k.fatura_durumu?.ad} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {tutarTR(k.fiyat_teklifi)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {tutarTR(k.fatura_tutari)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
