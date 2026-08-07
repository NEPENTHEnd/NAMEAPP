import { createClient } from "@/lib/supabase/server"
import { getYonetici } from "@/lib/auth"
import { getIsFormSecenekleri } from "@/lib/secenekler"
import { filtreleriOku, aramaOrIfadesi, filtreToParams } from "@/lib/isler-sorgu"
import { sonAylar, ayAraligi } from "@/lib/aylar"
import { AySecici } from "@/components/ay-secici"
import { DurumRozeti, FaturaRozeti } from "@/components/rozet"
import { FirmaGrafik } from "@/components/firma-grafik"
import { FotoArsivSil } from "@/components/foto-arsiv-sil"
import { buttonVariants } from "@/components/ui/button"

const FOTO_KOTA = 512 * 1024 * 1024 // 0,5 GB
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

  // Fotoğraf deposu kullanımı (bar) + seçili kapsamdaki foto sayısı
  const rpc = supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>
  }
  const { data: kullanimData } = await rpc.rpc("foto_kullanim")
  const ku = (Array.isArray(kullanimData) ? kullanimData[0] : kullanimData) as
    | { toplam_byte?: number; adet?: number }
    | null
  const fotoByte = Number(ku?.toplam_byte ?? 0)
  const fotoYuzde = Math.min(100, Math.round((fotoByte / FOTO_KOTA) * 100))
  const mb = (b: number) => (b / 1024 / 1024).toFixed(0)

  const { data: fotoListe } = await supabase
    .from("foto")
    .select("id, is_kaydi:is_kaydi_id ( gelis_tarihi )")
  const kapsamAdet = (fotoListe ?? []).filter((f) => {
    if (!ayAralik) return true
    const g = f.is_kaydi?.gelis_tarihi
    return g ? g >= ayAralik.baslangic && g <= ayAralik.bitis : false
  }).length

  // Firma-ay grafiği: son 6 ayın firma × ay kırılımı (grafik bileşenine gider)
  const [{ data: grupListe }, { data: subeListe }, { data: firmaIsleri }] = await Promise.all([
    supabase.from("grup").select("id, ad").order("sira"),
    supabase.from("sube").select("id, ad, grup_id"),
    supabase
      .from("is_kaydi")
      .select("grup_id, sube_id, gelis_tarihi, fatura_tutari")
      .range(0, 99999),
  ])
  const subeAdMap = new Map((subeListe ?? []).map((s) => [s.id, s.ad]))
  const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]
  const simdi = new Date()
  // Üst bardaki ay seçimi grafiği de yönetir: ay seçiliyse yalnız o ay,
  // "Tümü"deyse son 6 aylık pencere gösterilir.
  const ayPencere: { key: string; ad: string }[] = []
  if (ayAralik) {
    const key = ayAralik.baslangic.slice(0, 7)
    ayPencere.push({ key, ad: AY_KISA[Number(key.split("-")[1]) - 1] })
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(simdi.getFullYear(), simdi.getMonth() - i, 1)
      ayPencere.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        ad: AY_KISA[d.getMonth()],
      })
    }
  }
  const grafikDonem = ayAralik
    ? sonAylar(12).find((a) => a.key === ay)?.label ?? ayPencere[0].ad
    : "son 6 ay"
  const grupAdMap = new Map((grupListe ?? []).map((g) => [g.id, g.ad]))
  const noktaMap = new Map<string, { adet: number; tutar: number }>()
  for (const j of firmaIsleri ?? []) {
    const ayKey = j.gelis_tarihi?.slice(0, 7)
    if (!ayKey || !ayPencere.some((a) => a.key === ayKey)) continue
    const firmaAd = j.grup_id ? grupAdMap.get(j.grup_id) ?? "DİĞER" : "DİĞER"
    const anahtar = `${firmaAd}|${ayKey}`
    const v = noktaMap.get(anahtar) ?? { adet: 0, tutar: 0 }
    v.adet++
    v.tutar += j.fatura_tutari ?? 0
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
  const grafikFirmalar = [...(grupListe ?? []).map((g) => g.ad), "DİĞER"]

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
    const v = subeMap.get(anahtar) ?? { adet: 0, tutar: 0 }
    v.adet++
    v.tutar += j.fatura_tutari ?? 0
    subeMap.set(anahtar, v)
  }
  const grafikSubeNoktalar = [...subeMap.entries()].map(([anahtar, v]) => {
    const [firma, sube, ayKey] = anahtar.split("|")
    return { firma, sube, ayKey, ...v }
  })

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
    // CİRO yalnız FATURA TARİHİNE göre işlenir (istenen). Fatura tarihi olmayan eski
    // kayıtlar için çıkış tarihine düşülür ki ciro kaybolmasın.
    const ciroTarih = r.fatura_tarihi ?? r.cikis_tarihi
    if (ciroTarih) {
      const k = ciroTarih.slice(0, 7)
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

      {/* Firma grafiği: firma seç + sütun/çizgi/pasta + adet/kazanç (son 6 ay) */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
        <div className="mb-1 text-[13.5px] font-semibold">Firma grafiği — {grafikDonem}</div>
        <p className="mb-4 text-[11.5px] text-muted-foreground">
          Dönemi üst bardaki ay kutucuklarından, firmayı/tipi/ölçüyü buradan değiştir.
        </p>
        <FirmaGrafik
          noktalar={grafikNoktalar}
          firmalar={grafikFirmalar}
          aylar={ayPencere}
          subeNoktalar={grafikSubeNoktalar}
        />
      </div>

      {/* Fotoğraf deposu: bar + arşivle (ZIP) + sil */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-[220px] flex-1">
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span className="font-semibold">Fotoğraf deposu</span>
              <span className="font-mono text-muted-foreground">
                {mb(fotoByte)} / {mb(FOTO_KOTA)} MB · %{fotoYuzde}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${fotoYuzde}%`,
                  background:
                    fotoYuzde >= 90 ? "#dc2626" : fotoYuzde >= 70 ? "#f59e0b" : "#1e40af",
                }}
              />
            </div>
            {fotoYuzde >= 90 && (
              <p className="mt-1 text-xs text-destructive">
                Depo dolmak üzere — arşivleyip silin (dolunca foto yüklenemez).
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/raporlar/fotolar-zip${ay ? `?ay=${ay}` : ""}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {ay ? `${ayAdi(ay)} fotoğrafları (ZIP)` : "Tüm fotoğraflar (ZIP)"}
            </a>
            <FotoArsivSil ay={ay} adet={kapsamAdet} />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {ay ? "Seçili aya ait" : "Tüm"} fotoğraflar <strong>fiş no</strong>{" "}
          isimleriyle ZIP'e iner ({kapsamAdet} adet); indirip yedekledikten sonra
          "Fotoğrafları sil" ile depo boşaltılır. Fiş no ve kayıt bilgileri kalıcıdır.
        </p>
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
