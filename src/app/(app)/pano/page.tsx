import { createClient } from "@/lib/supabase/server"
import { getYonetici } from "@/lib/auth"
import { sonAylar, ayAraligi } from "@/lib/aylar"
import { AySecici } from "@/components/ay-secici"
import { durumRenk } from "@/components/rozet"

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const g = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${g}`
}

const AYLAR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
]

const tutarBicim = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
})

type PerfSatir = {
  ad: string
  toplam: number
  onarildi: number
  calismadi: number
  faturaAdet: number
  faturaYuzde: number
  basari: number
  pasta: string | null
}

// TEKNİKER: pasta yeşil=onarıldı / kırmızı=çalışmadı + ortada başarı% + fatura barı
function PerfBolum({ baslik, liste }: { baslik: string; liste: PerfSatir[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[13.5px] font-semibold">{baslik}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="size-2.5 rounded-full" style={{ background: "#10b981" }} /> Onarıldı</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="size-2.5 rounded-full" style={{ background: "#ef4444" }} /> Çalışmadı</span>
      </div>
      {liste.length === 0 ? (
        <p className="text-sm text-muted-foreground">Kayıt yok.</p>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {liste.map((t) => (
            <div key={t.ad} className="rounded-xl border border-border/70 p-3.5">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="size-14 rounded-full shadow-[inset_0_0_0_1px_rgba(148,163,184,.3)]" style={{ background: t.pasta ?? "var(--muted)" }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex size-8 items-center justify-center rounded-full bg-card text-[11px] font-semibold">
                      {t.onarildi + t.calismadi > 0 ? `%${t.basari}` : "—"}
                    </div>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{t.ad}</div>
                  <div className="text-[11px] text-muted-foreground">{t.toplam} iş</div>
                  <div className="mt-0.5 flex gap-2.5 text-[11.5px] font-medium">
                    <span className="text-emerald-600 dark:text-emerald-400">✓ {t.onarildi}</span>
                    <span className="text-rose-600 dark:text-rose-400">✗ {t.calismadi}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex items-baseline justify-between text-[11px]">
                  <span className="text-muted-foreground">Fatura edilen</span>
                  <span className="font-semibold">%{t.faturaYuzde} <span className="font-normal text-muted-foreground">({t.faturaAdet}/{t.toplam})</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${t.faturaYuzde}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type PersonelSatir = {
  ad: string
  toplam: number
  faturaAdet: number
  faturaYuzde: number
  pasta: string | null
  dilimler: { ad: string; renk: string; adet: number }[]
}

// PERSONEL (kaydeden): teknikerden FARKLI yapı — çok renkli DURUM pastası + durum
// dökümü chip'leri + (aynı) fatura barı. 2 sütun + hafif zeminle ayrışır.
function PersonelBolum({ baslik, liste }: { baslik: string; liste: PersonelSatir[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <div className="mb-3 text-[13.5px] font-semibold">{baslik}</div>
      {liste.length === 0 ? (
        <p className="text-sm text-muted-foreground">Kayıt yok.</p>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {liste.map((p) => (
            <div key={p.ad} className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="size-14 rounded-full shadow-[inset_0_0_0_1px_rgba(148,163,184,.3)]" style={{ background: p.pasta ?? "var(--muted)" }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex size-8 items-center justify-center rounded-full bg-card text-[11px] font-semibold">{p.toplam}</div>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{p.ad}</div>
                  <div className="text-[11px] text-muted-foreground">{p.toplam} iş kaydetti</div>
                </div>
              </div>
              {/* Durum dökümü — çoğu durum burada */}
              <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                {p.dilimler.map((d) => (
                  <span key={d.ad} className="flex items-center gap-1 text-muted-foreground">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: d.renk }} />
                    {d.ad} <span className="font-semibold text-foreground">{d.adet}</span>
                  </span>
                ))}
              </div>
              <div className="mt-3">
                <div className="mb-1 flex items-baseline justify-between text-[11px]">
                  <span className="text-muted-foreground">Fatura edilen</span>
                  <span className="font-semibold">%{p.faturaYuzde} <span className="font-normal text-muted-foreground">({p.faturaAdet}/{p.toplam})</span></span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${p.faturaYuzde}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Kart({
  baslik,
  deger,
  alt,
  renk,
}: {
  baslik: string
  deger: string
  alt?: string
  renk: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-[18px] shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <div className="h-[5px] w-[30px] rounded-full" style={{ background: renk }} />
      <div className="mt-3 text-[12.5px] font-medium text-muted-foreground">{baslik}</div>
      <div className="mt-1.5 font-mono text-[27px] font-semibold tracking-tight">{deger}</div>
      {alt ? <div className="mt-1.5 text-[11.5px] text-muted-foreground">{alt}</div> : null}
    </div>
  )
}

export default async function PanoSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await getYonetici()
  const sp = await searchParams
  const ay = (Array.isArray(sp.ay) ? sp.ay[0] : sp.ay) ?? ""
  const ayAralik = ay ? ayAraligi(ay) : null
  const supabase = await createClient()

  const now = new Date()
  const ayBasi = ayAralik
    ? ayAralik.baslangic
    : ymd(new Date(now.getFullYear(), now.getMonth(), 1))
  const aySonu = ayAralik
    ? ayAralik.bitis
    : ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const seciliAyEtiketi = ayAralik
    ? sonAylar(12).find((a) => a.key === ay)?.label ?? "Seçili ay"
    : "Bu ay"

  const [islerRes, durumlarRes, personellerRes, faturalarRes, profillerRes] =
    await Promise.all([
      supabase
        .from("is_kaydi")
        .select(
          "gelis_tarihi, cikis_tarihi, fatura_tarihi, fatura_tutari, durum_id, teknik_personel_id, fatura_durumu_id, olusturan_id"
        ),
      supabase.from("durum").select("id, ad, renk, sira").order("sira"),
      supabase.from("teknik_personel").select("id, ad").order("ad"),
      supabase.from("fatura_durumu").select("id, ad"),
      supabase.from("kullanici_profil").select("id, ad, rol"),
    ])

  const isler = islerRes.data ?? []
  const durumlar = durumlarRes.data ?? []
  const personeller = personellerRes.data ?? []
  const faturalar = faturalarRes.data ?? []
  const profiller = profillerRes.data ?? []
  const profilAd = new Map(profiller.map((p) => [p.id, p.ad ?? "—"]))
  const faturaAdById = new Map(faturalar.map((f) => [f.id, f.ad]))

  // Kartlar
  const acikIs = isler.filter((j) => !j.cikis_tarihi).length
  const teklifAdlari = new Set(["TEKLİF VERİLDİ", "TEKLİF HAZIRLANDI"])
  const teklifAsamasi = isler.filter(
    (j) => j.fatura_durumu_id && teklifAdlari.has(faturaAdById.get(j.fatura_durumu_id) ?? "")
  ).length
  const buAyGelen = isler.filter((j) => j.gelis_tarihi >= ayBasi && j.gelis_tarihi <= aySonu).length
  const buAyCikanlar = isler.filter(
    (j) => j.cikis_tarihi && j.cikis_tarihi >= ayBasi && j.cikis_tarihi <= aySonu
  )
  // CİRO: fatura tarihine göre (Raporlar'la aynı) — yalnız o ay FATURALANAN işler
  const buAyCiro = isler
    .filter((j) => j.fatura_tarihi && j.fatura_tarihi >= ayBasi && j.fatura_tarihi <= aySonu)
    .reduce((t, j) => t + (j.fatura_tutari ?? 0), 0)

  // Ortalama onarım süresi (gün)
  const kapananlar = isler.filter((j) => j.cikis_tarihi)
  let ortGun: number | null = null
  if (kapananlar.length > 0) {
    const toplam = kapananlar.reduce((t, j) => {
      const g = new Date(j.gelis_tarihi).getTime()
      const c = new Date(j.cikis_tarihi as string).getTime()
      return t + Math.max(0, (c - g) / 86400000)
    }, 0)
    ortGun = Math.round((toplam / kapananlar.length) * 10) / 10
  }

  // Duruma göre dağılım (donut)
  const durumAdet = durumlar
    .map((d) => ({
      ad: d.ad,
      renk: d.renk ?? "#94a3b8",
      adet: isler.filter((j) => j.durum_id === d.id).length,
    }))
    .filter((d) => d.adet > 0)
  const toplamIs = isler.length
  let acc = 0
  const stops: string[] = []
  for (const d of durumAdet) {
    const from = (acc / Math.max(1, toplamIs)) * 360
    acc += d.adet
    const to = (acc / Math.max(1, toplamIs)) * 360
    stops.push(`${d.renk} ${from}deg ${to}deg`)
  }
  const donut = stops.length
    ? `conic-gradient(${stops.join(",")})`
    : "conic-gradient(#e2e8f0 0deg 360deg)"

  // ---- Onarım & fatura performansı (TÜM ZAMANLAR): tekniker + personel ----
  // Onarıldı = ONARILDI · Çalışmadı = ÇALIŞMADI + GERİ GELEN · fatura% = tüm işlerinin oranı
  const onarildiId = durumlar.find((d) => d.ad === "ONARILDI")?.id
  const calismadiIdSet = new Set(
    durumlar.filter((d) => d.ad === "ÇALIŞMADI" || d.ad === "GERİ GELEN").map((d) => d.id)
  )
  const faturaEdildiId = faturalar.find(
    (f) => (f.ad ?? "").toLocaleUpperCase("tr-TR") === "FATURA EDİLDİ"
  )?.id
  const perfHesapla = (ad: string, kendi: typeof isler): PerfSatir => {
    const toplam = kendi.length
    const onarildi = kendi.filter((j) => j.durum_id === onarildiId).length
    const calismadi = kendi.filter((j) => calismadiIdSet.has(j.durum_id)).length
    const faturaAdet = faturaEdildiId ? kendi.filter((j) => j.fatura_durumu_id === faturaEdildiId).length : 0
    const pieTop = onarildi + calismadi
    const onarPay = pieTop > 0 ? (onarildi / pieTop) * 360 : 0
    return {
      ad, toplam, onarildi, calismadi, faturaAdet,
      faturaYuzde: toplam > 0 ? Math.round((faturaAdet / toplam) * 100) : 0,
      basari: pieTop > 0 ? Math.round((onarildi / pieTop) * 100) : 0,
      pasta: pieTop > 0 ? `conic-gradient(#10b981 0deg ${onarPay}deg, #ef4444 ${onarPay}deg 360deg)` : null,
    }
  }
  // TEKNİKER (işi yapan = teknik_personel)
  const teknikPerf = personeller
    .map((p) => perfHesapla(p.ad, isler.filter((j) => j.teknik_personel_id === p.id)))
    .filter((t) => t.toplam > 0)
    .sort((a, b) => b.toplam - a.toplam)
  // PERSONEL (kaydeden = olusturan) — teknikerden FARKLI: ÇOĞU DURUM gösterilir.
  // Yönetici rolündekiler (admin dâhil) burada GÖSTERİLMEZ; yalnız teknisyen personel.
  const yoneticiIdSet = new Set(profiller.filter((p) => p.rol === "yonetici").map((p) => p.id))
  const kaydedenIdler = ([...new Set(isler.map((j) => j.olusturan_id).filter(Boolean))] as string[])
    .filter((id) => !yoneticiIdSet.has(id))
  const personelDurum: PersonelSatir[] = kaydedenIdler
    .map((id) => {
      const kendi = isler.filter((j) => j.olusturan_id === id)
      const toplam = kendi.length
      const dilimler = durumlar
        .map((d) => ({ ad: d.ad, renk: durumRenk(d.ad, d.renk), adet: kendi.filter((j) => j.durum_id === d.id).length }))
        .filter((x) => x.adet > 0)
        .sort((a, b) => b.adet - a.adet)
      let acc = 0
      const stops: string[] = []
      for (const x of dilimler) {
        const from = (acc / Math.max(1, toplam)) * 360
        acc += x.adet
        stops.push(`${x.renk} ${from}deg ${(acc / Math.max(1, toplam)) * 360}deg`)
      }
      const faturaAdet = faturaEdildiId ? kendi.filter((j) => j.fatura_durumu_id === faturaEdildiId).length : 0
      return {
        ad: profilAd.get(id) ?? "—",
        toplam,
        faturaAdet,
        faturaYuzde: toplam > 0 ? Math.round((faturaAdet / toplam) * 100) : 0,
        pasta: stops.length ? `conic-gradient(${stops.join(",")})` : null,
        dilimler,
      }
    })
    .filter((t) => t.toplam > 0)
    .sort((a, b) => b.toplam - a.toplam)

  // Aylık trend (son 3 ay)
  const ayMap = new Map<string, { gelen: number; cikan: number }>()
  const getAy = (k: string) => ayMap.get(k) ?? { gelen: 0, cikan: 0 }
  for (const j of isler) {
    if (j.gelis_tarihi) {
      const k = j.gelis_tarihi.slice(0, 7)
      const v = getAy(k)
      v.gelen++
      ayMap.set(k, v)
    }
    if (j.cikis_tarihi) {
      const k = j.cikis_tarihi.slice(0, 7)
      const v = getAy(k)
      v.cikan++
      ayMap.set(k, v)
    }
  }
  const trend = [...ayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-3)
    .map(([k, v]) => ({ ay: AYLAR[Number(k.split("-")[1]) - 1], ...v }))
  const trendMaks = Math.max(1, ...trend.flatMap((t) => [t.gelen, t.cikan]))

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-semibold tracking-tight">Pano</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {seciliAyEtiketi === "Bu ay" ? "Genel bakış" : `${seciliAyEtiketi} özeti`}
          </p>
        </div>
        <div className="xl:hidden">
          <AySecici aylar={sonAylar()} basePath="/pano" />
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <Kart baslik="Açık iş" deger={String(acikIs)} alt="Çıkışı yapılmamış" renk="#f59e0b" />
        <Kart baslik="Teklif aşamasında" deger={String(teklifAsamasi)} alt="Onay bekleyen" renk="#3b82f6" />
        <Kart baslik={`${seciliAyEtiketi} gelen`} deger={String(buAyGelen)} renk="#1e40af" />
        <Kart baslik={`${seciliAyEtiketi} çıkan`} deger={String(buAyCikanlar.length)} alt="Teslim edilen" renk="#10b981" />
        <Kart baslik={`${seciliAyEtiketi} ciro`} deger={tutarBicim.format(buAyCiro)} renk="#a855f7" />
      </div>


      {/* Önce TEKNİKER (işi yapan), sonra PERSONEL (kaydeden) — alt alta, farklı yapıda */}
      <PerfBolum baslik="Teknikerler" liste={teknikPerf} />
      <PersonelBolum baslik="Personel (kaydeden)" liste={personelDurum} />

      {/* Grafikler */}
      <div className="grid gap-3.5 lg:grid-cols-[1.2fr_1fr]">
        {/* Donut */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
          <div className="mb-4 text-[13.5px] font-semibold">Duruma göre dağılım</div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="relative shrink-0">
              <div className="size-[148px] rounded-full" style={{ background: donut }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex size-24 flex-col items-center justify-center rounded-full bg-card shadow-[inset_0_0_0_1px_#f1f5f9]">
                  <span className="font-mono text-[23px] font-semibold">{toplamIs}</span>
                  <span className="text-[10.5px] text-muted-foreground">toplam iş</span>
                </div>
              </div>
            </div>
            <div className="flex min-w-[150px] flex-1 flex-col gap-2.5">
              {durumAdet.map((d) => (
                <div key={d.ad} className="flex items-center gap-2.5 text-[12.5px]">
                  <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: d.renk }} />
                  <span className="flex-1 text-muted-foreground">{d.ad}</span>
                  <span className="font-mono font-semibold">{d.adet}</span>
                  <span className="w-9 text-right text-muted-foreground">
                    %{Math.round((d.adet / Math.max(1, toplamIs)) * 100)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ortalama onarım */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
          <div className="mb-2 text-[13.5px] font-semibold">Ortalama onarım süresi</div>
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-3.5">
            <div className="mb-1 flex size-[54px] items-center justify-center rounded-[14px] bg-accent">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
              </svg>
            </div>
            <div className="font-mono text-[34px] font-semibold tracking-tight">
              {ortGun == null ? "—" : `${String(ortGun).replace(".", ",")} gün`}
            </div>
            <div className="text-xs text-muted-foreground">geliş → çıkış ortalaması</div>
          </div>
          <div className="flex gap-2 border-t border-muted pt-3.5">
            <div className="flex-1 text-center">
              <div className="font-mono text-base font-semibold text-emerald-700">{kapananlar.length}</div>
              <div className="mt-0.5 text-[10.5px] text-muted-foreground">kapanan iş</div>
            </div>
            <div className="w-px bg-muted" />
            <div className="flex-1 text-center">
              <div className="font-mono text-base font-semibold text-amber-700">{acikIs}</div>
              <div className="mt-0.5 text-[10.5px] text-muted-foreground">açık iş</div>
            </div>
          </div>
        </div>
      </div>

      {/* Aylık trend */}
      {trend.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="text-[13.5px] font-semibold">Aylık trend — gelen / çıkan iş</div>
            <div className="flex gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="size-[11px] rounded-[3px] bg-primary" />Gelen
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="size-[11px] rounded-[3px]" style={{ background: "#bfdbfe" }} />Çıkan
              </span>
            </div>
          </div>
          <div className="flex h-[188px] items-end justify-around gap-6 px-3">
            {trend.map((t) => (
              <div key={t.ay} className="flex h-full max-w-[120px] flex-1 flex-col items-center justify-end gap-2.5">
                <div className="flex w-full flex-1 items-end justify-center gap-2">
                  <div
                    className="w-[22px] rounded-t-[5px] bg-primary"
                    style={{ height: `${Math.round((t.gelen / trendMaks) * 100)}%`, minHeight: 6 }}
                  />
                  <div
                    className="w-[22px] rounded-t-[5px]"
                    style={{ height: `${Math.round((t.cikan / trendMaks) * 100)}%`, minHeight: 6, background: "#bfdbfe" }}
                  />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{t.ay}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
