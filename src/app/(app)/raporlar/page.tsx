import { createClient } from "@/lib/supabase/server"
import { getYonetici } from "@/lib/auth"
import { getIsFormSecenekleri } from "@/lib/secenekler"
import { filtreleriOku, aramaOrIfadesi, filtreToParams } from "@/lib/isler-sorgu"
import { sonAylar, ayAraligi } from "@/lib/aylar"
import { AySecici } from "@/components/ay-secici"
import { DurumRozeti, FaturaRozeti } from "@/components/rozet"
import { FirmaGrafik } from "@/components/firma-grafik"
import { FirmaAyMatris } from "@/components/firma-ay-matris"
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

  // Firma-ay grafiği: son 6 ayın firma × ay kırılımı (grafik bileşenine gider)
  const [{ data: grupListe }, { data: subeListe }, { data: firmaIsleri }, { data: hedefListe }] =
    await Promise.all([
      supabase.from("grup").select("id, ad").order("sira"),
      supabase.from("sube").select("id, ad, grup_id"),
      supabase
        .from("is_kaydi")
        .select("grup_id, sube_id, musteri_id, gelis_tarihi, fatura_tarihi, fatura_tutari, musteri:musteri_id ( ad )")
        .range(0, 99999),
      supabase
        .from("firma_hedef")
        .select("grup_id, yil, ort_gecen_adet, ort_hedef_adet, ort_gecen_para, ort_hedef_para"),
    ])
  const subeAdMap = new Map((subeListe ?? []).map((s) => [s.id, s.ad]))
  const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]
  const simdi = new Date()
  // Üst bardaki ay seçimi grafiği de yönetir: ay seçiliyse yalnız o ay,
  // "Tümü"deyse bu YILIN başından bu aya kadar tüm aylar (müdür Excel'i gibi).
  const ayPencere: { key: string; ad: string }[] = []
  if (ayAralik) {
    const key = ayAralik.baslangic.slice(0, 7)
    ayPencere.push({ key, ad: AY_KISA[Number(key.split("-")[1]) - 1] })
  } else {
    const yil = simdi.getFullYear()
    for (let m = 0; m <= simdi.getMonth(); m++) {
      ayPencere.push({
        key: `${yil}-${String(m + 1).padStart(2, "0")}`,
        ad: AY_KISA[m],
      })
    }
  }
  const grupAdMap = new Map((grupListe ?? []).map((g) => [g.id, g.ad]))
  const noktaMap = new Map<string, { adet: number; tutar: number }>()
  for (const j of firmaIsleri ?? []) {
    const ayKey = j.gelis_tarihi?.slice(0, 7)
    if (!ayKey || !ayPencere.some((a) => a.key === ayKey)) continue
    const firmaAd = j.grup_id ? grupAdMap.get(j.grup_id) ?? "DİĞER" : "DİĞER"
    const anahtar = `${firmaAd}|${ayKey}`
    const v = noktaMap.get(anahtar) ?? { adet: 0, tutar: 0, grupId: (j.grup_id as string | null) ?? null }
    v.adet++
    // Kazanç yalnız FATURA TARİHLİ (kesilmiş) işlerden — tarihsiz fiyatlar sayılmaz
    v.tutar += j.fatura_tarihi ? j.fatura_tutari ?? 0 : 0
    noktaMap.set(anahtar, v)
  }
  const grafikNoktalar = [...noktaMap.entries()].map(([anahtar, v]) => {
    const [firma, ayKey] = anahtar.split("|")
    return {
      firma,
      ayKey,
      ayAd: ayPencere.find((a) => a.key === ayKey)?.ad ?? ayKey,
      ...v,
    }
  })

  // Şube kırılımı (firma × şube × ay) — balon grafiğinde firmaya tıklayınca alt şubeler
  const subeMap = new Map<string, { adet: number; tutar: number }>()
  for (const j of firmaIsleri ?? []) {
    if (!j.sube_id) continue
    const ayKey = j.gelis_tarihi?.slice(0, 7)
    if (!ayKey || !ayPencere.some((a) => a.key === ayKey)) continue
    const firmaAd = j.grup_id ? grupAdMap.get(j.grup_id) ?? "DİĞER" : "DİĞER"
    const subeAd = subeAdMap.get(j.sube_id)
    if (!subeAd) continue
    const anahtar = `${firmaAd}|${subeAd}|${ayKey}`
    const v = subeMap.get(anahtar) ?? { adet: 0, tutar: 0, subeId: j.sube_id as string }
    v.adet++
    v.tutar += j.fatura_tarihi ? j.fatura_tutari ?? 0 : 0
    subeMap.set(anahtar, v)
  }
  const grafikSubeNoktalar = [...subeMap.entries()].map(([anahtar, v]) => {
    const [firma, sube, ayKey] = anahtar.split("|")
    return { firma, sube, ayKey, ...v }
  })

  // "DİĞER" (gruba atanmamış) işlerin MÜŞTERİ kırılımı — balonda DİĞER'e tıklayınca
  // içindeki tek tek müşteriler (küçük firmalar) balon olarak açılır.
  const digerMap = new Map<string, { adet: number; tutar: number }>()
  for (const j of firmaIsleri ?? []) {
    if (j.grup_id) continue // yalnız grupsuzlar
    const ayKey = j.gelis_tarihi?.slice(0, 7)
    if (!ayKey || !ayPencere.some((a) => a.key === ayKey)) continue
    const mus = Array.isArray(j.musteri) ? j.musteri[0] : j.musteri
    const musteriAd = (mus?.ad ?? "—").toString()
    const anahtar = `${musteriAd}|${ayKey}`
    const v = digerMap.get(anahtar) ?? { adet: 0, tutar: 0, musteriId: (j.musteri_id as string | null) ?? null }
    v.adet++
    v.tutar += j.fatura_tarihi ? j.fatura_tutari ?? 0 : 0
    digerMap.set(anahtar, v)
  }
  const grafikDigerNoktalar = [...digerMap.entries()].map(([anahtar, v]) => {
    const [musteri, ayKey] = anahtar.split("|")
    return { musteri, ayKey, ...v }
  })

  // ---- Müdür Excel'i "2026_GENEL": Firma × Ay iş adedi matrisi (canlı) ----
  // Satır = firma (DİĞER + firmalar, sıra sırasına göre), sütun = 12 ay, hücre = iş adedi.
  const matrisYil = new Date().getFullYear()
  const gecenAy = new Date().getMonth() + 1 // matris bu yıl → ort./ay geçen aylara bölünür
  const matrisSatirSira = ["DİĞER", ...(grupListe ?? []).map((g) => g.ad)]
  const matrisMap = new Map<string, number[]>(
    matrisSatirSira.map((ad) => [ad, new Array(12).fill(0)])
  )
  // ₺ ciro (fatura ayına göre, yalnız faturalı işlerin fatura_tutari'si)
  const matrisPara = new Map<string, number[]>(
    matrisSatirSira.map((ad) => [ad, new Array(12).fill(0)])
  )
  for (const j of firmaIsleri ?? []) {
    const firmaAd = j.grup_id ? grupAdMap.get(j.grup_id) ?? "DİĞER" : "DİĞER"
    // ADET — geliş ayına göre (yalnız bu yıl)
    if (j.gelis_tarihi && j.gelis_tarihi.slice(0, 4) === String(matrisYil)) {
      const ay = Number(j.gelis_tarihi.slice(5, 7)) - 1
      if (ay >= 0 && ay <= 11) (matrisMap.get(firmaAd) ?? matrisMap.get("DİĞER")!)[ay]++
    }
    // CİRO — GELİŞ ayına göre (adet ile aynı eksen), yalnız FATURALANAN işlerin tutarı
    // (fatura ayına göre değil; yoksa tüm ciro tek aya yığılıyordu)
    if (j.fatura_tarihi && j.gelis_tarihi && j.gelis_tarihi.slice(0, 4) === String(matrisYil)) {
      const ay = Number(j.gelis_tarihi.slice(5, 7)) - 1
      if (ay >= 0 && ay <= 11) (matrisPara.get(firmaAd) ?? matrisPara.get("DİĞER")!)[ay] += j.fatura_tutari ?? 0
    }
  }
  // Elle girilen hedef değerleri (bu yıl) — grup_id (DİĞER = "DIGER") ile eşle
  const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v))
  const hedefMap = new Map<
    string,
    { ort_gecen_adet: number | null; ort_hedef_adet: number | null; ort_gecen_para: number | null; ort_hedef_para: number | null }
  >()
  for (const h of hedefListe ?? []) {
    if (h.yil !== matrisYil) continue
    hedefMap.set(h.grup_id ?? "DIGER", {
      ort_gecen_adet: num(h.ort_gecen_adet),
      ort_hedef_adet: num(h.ort_hedef_adet),
      ort_gecen_para: num(h.ort_gecen_para),
      ort_hedef_para: num(h.ort_hedef_para),
    })
  }
  const grupIdByAd = new Map((grupListe ?? []).map((g) => [g.ad, g.id]))
  const bosHedef = { ort_gecen_adet: null, ort_hedef_adet: null, ort_gecen_para: null, ort_hedef_para: null }
  const matrisSatirlar = matrisSatirSira.map((firma) => {
    const aylar = matrisMap.get(firma)!
    const toplam = aylar.reduce((t, n) => t + n, 0)
    const ort = gecenAy > 0 ? toplam / gecenAy : 0
    const aylarPara = matrisPara.get(firma)!
    const toplamPara = aylarPara.reduce((t, n) => t + n, 0)
    const ortPara = gecenAy > 0 ? toplamPara / gecenAy : 0
    const grupId = grupIdByAd.get(firma) ?? null
    const hedef = hedefMap.get(grupId ?? "DIGER") ?? bosHedef
    return { firma, grupId, aylar, toplam, ort, aylarPara, toplamPara, ortPara, hedef }
  })
  const matrisAylikToplam = Array.from({ length: 12 }, (_, i) =>
    matrisSatirlar.reduce((t, s) => t + s.aylar[i], 0)
  )
  const matrisGenelToplam = matrisAylikToplam.reduce((t, n) => t + n, 0)
  const matrisGenelOrt = gecenAy > 0 ? matrisGenelToplam / gecenAy : 0
  const matrisAylikToplamPara = Array.from({ length: 12 }, (_, i) =>
    matrisSatirlar.reduce((t, s) => t + s.aylarPara[i], 0)
  )
  const matrisGenelToplamPara = matrisAylikToplamPara.reduce((t, n) => t + n, 0)
  const matrisGenelOrtPara = gecenAy > 0 ? matrisGenelToplamPara / gecenAy : 0

  let sorgu = supabase.from("is_kaydi").select(
    `
      id, cihaz_adi, seri_no, servis_no, gelis_tarihi, cikis_tarihi,
      fiyat_teklifi, fatura_tutari,
      musteri:musteri_id ( ad ),
      durum:durum_id ( ad, renk ),
      teknik_personel:teknik_personel_id ( ad ),
      fatura_durumu:fatura_durumu_id ( ad, renk )
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
    .select("gelis_tarihi, cikis_tarihi, fatura_tarihi, fatura_tutari, fiyat_teklifi, durum:durum_id ( ad )")
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
  const aylik = new Map<
    string,
    { gelen: number; cikan: number; ciroOnarim: number; ciroSatis: number }
  >()
  const getAy = (k: string) =>
    aylik.get(k) ?? { gelen: 0, cikan: 0, ciroOnarim: 0, ciroSatis: 0 }
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
      aylik.set(k, v)
    }
    // CİRO YALNIZ fatura tarihli (kesilmiş) işlerden — fatura tarihi olmayan fiyatlar
    // rapora GİRMEZ. Ay = fatura tarihinin ayı.
    if (r.fatura_tarihi) {
      const k = r.fatura_tarihi.slice(0, 7)
      const v = getAy(k)
      // SATIŞ durumundaki işler ürün satışı sayılır; tutarları çoğunlukla
      // fiyat_teklifi'nde tutulur (fatura yoksa oradan alınır). Diğerleri onarım.
      const durumAd = Array.isArray(r.durum) ? r.durum[0]?.ad : r.durum?.ad
      if (durumAd === "SATIŞ") v.ciroSatis += r.fatura_tutari ?? r.fiyat_teklifi ?? 0
      else v.ciroOnarim += r.fatura_tutari ?? 0
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

      <div className="xl:hidden">
        <AySecici aylar={sonAylar()} basePath="/raporlar" />
      </div>

      {/* Müdür Excel takibinin canlı hâli: Firma × Ay iş adedi matrisi */}
      <FirmaAyMatris
        yil={matrisYil}
        satirlar={matrisSatirlar}
        aylikToplam={matrisAylikToplam}
        genelToplam={matrisGenelToplam}
        genelOrt={matrisGenelOrt}
        aylikToplamPara={matrisAylikToplamPara}
        genelToplamPara={matrisGenelToplamPara}
        genelOrtPara={matrisGenelOrtPara}
        aktifAy={gecenAy}
      />

      {/* Firma grafiği: aylık/balon/pasta/firmalar + adet/kazanç (dönem bileşen içinden) */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
        <div className="mb-1 text-[13.5px] font-semibold">Firma grafiği</div>
        <p className="mb-4 text-[11.5px] text-muted-foreground">
          Grafik tipini, firmayı, ölçüyü ve dönemi (Bu ay / Tüm aylar) aşağıdan değiştir.
        </p>
        <FirmaGrafik
          noktalar={grafikNoktalar}
          aylar={ayPencere}
          subeNoktalar={grafikSubeNoktalar}
          digerNoktalar={grafikDigerNoktalar}
        />
      </div>

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
                  <TableHead className="text-right">Onarım Cirosu</TableHead>
                  <TableHead className="text-right">Satış Cirosu</TableHead>
                  <TableHead className="text-right">Toplam Ciro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aylikSirali.map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell className="font-medium">{ayAdi(k)}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.gelen}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.cikan}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {tutarTR(v.ciroOnarim)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {tutarTR(v.ciroSatis)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {tutarTR(v.ciroOnarim + v.ciroSatis)}
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
                <TableHead>Fiş No</TableHead>
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
                    <FaturaRozeti ad={k.fatura_durumu?.ad} renk={k.fatura_durumu?.renk} />
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
