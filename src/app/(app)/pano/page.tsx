import { createClient } from "@/lib/supabase/server"
import { getYonetici } from "@/lib/auth"
import { sonAylar, ayAraligi } from "@/lib/aylar"
import { AySecici } from "@/components/ay-secici"

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
          "gelis_tarihi, cikis_tarihi, fatura_tutari, durum_id, teknik_personel_id, fatura_durumu_id, olusturan_id"
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
  const buAyCiro = buAyCikanlar.reduce((t, j) => t + (j.fatura_tutari ?? 0), 0)

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

  // Seçili ay penceresindeki işler (geliş tarihine göre)
  const aydakiIsler = isler.filter(
    (j) => j.gelis_tarihi >= ayBasi && j.gelis_tarihi <= aySonu
  )

  // ASIL: kim daha çok iş kaydetti (olusturan) — seçili ay
  const kaydedenMap = new Map<string, number>()
  for (const j of aydakiIsler) {
    const key = j.olusturan_id ?? "yok"
    kaydedenMap.set(key, (kaydedenMap.get(key) ?? 0) + 1)
  }
  const kaydedenAdet = [...kaydedenMap.entries()]
    .map(([id, adet]) => ({
      ad: id === "yok" ? "Bilinmiyor" : profilAd.get(id) ?? "—",
      adet,
    }))
    .sort((a, b) => b.adet - a.adet)
  const kaydedenMaks = Math.max(1, ...kaydedenAdet.map((k) => k.adet))

  // Teknik personel dağılımı (seçili ay) — sağda küçük
  const personelAdet = personeller
    .map((p) => ({
      ad: p.ad,
      adet: aydakiIsler.filter((j) => j.teknik_personel_id === p.id).length,
    }))
    .filter((p) => p.adet > 0)
    .sort((a, b) => b.adet - a.adet)
  const personelMaks = Math.max(1, ...personelAdet.map((p) => p.adet))

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
        <AySecici aylar={sonAylar()} basePath="/pano" />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <Kart baslik="Açık iş" deger={String(acikIs)} alt="Çıkışı yapılmamış" renk="#f59e0b" />
        <Kart baslik="Teklif aşamasında" deger={String(teklifAsamasi)} alt="Onay bekleyen" renk="#3b82f6" />
        <Kart baslik={`${seciliAyEtiketi} gelen`} deger={String(buAyGelen)} renk="#1e40af" />
        <Kart baslik={`${seciliAyEtiketi} çıkan`} deger={String(buAyCikanlar.length)} alt="Teslim edilen" renk="#10b981" />
        <Kart baslik={`${seciliAyEtiketi} ciro`} deger={tutarBicim.format(buAyCiro)} renk="#a855f7" />
      </div>

      {/* ASIL: kim daha çok iş kaydetti + (sağda küçük) teknik personel */}
      <div className="grid gap-3.5 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
          <div className="mb-1 text-[13.5px] font-semibold">
            Kim daha çok iş kaydetti · {seciliAyEtiketi}
          </div>
          <p className="mb-4 text-[11.5px] text-muted-foreground">
            Sisteme en çok ürün/iş giren personel
          </p>
          {kaydedenAdet.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu ay kayıt yok.</p>
          ) : (
            <div className="flex flex-col gap-[15px]">
              {kaydedenAdet.map((k, i) => (
                <div key={k.ad + i}>
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span className="font-medium">
                      {i === 0 ? "🏆 " : ""}
                      {k.ad}
                    </span>
                    <span className="font-mono font-semibold">{k.adet}</span>
                  </div>
                  <div className="h-[11px] overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((k.adet / kaydedenMaks) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Teknik personel — küçük */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
          <div className="mb-4 text-[12.5px] font-semibold text-muted-foreground">
            Teknik personel · {seciliAyEtiketi}
          </div>
          {personelAdet.length === 0 ? (
            <p className="text-xs text-muted-foreground">Bu ay atanan iş yok.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {personelAdet.map((p) => (
                <div key={p.ad} className="flex items-center gap-2 text-[12px]">
                  <span className="w-20 shrink-0 truncate text-muted-foreground">{p.ad}</span>
                  <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-sky-400"
                      style={{ width: `${Math.round((p.adet / personelMaks) * 100)}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono font-semibold">{p.adet}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
