import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { getYonetici } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DurumRozeti, FaturaRozeti } from "@/components/rozet"
import {
  musteriEkle,
  musteriDuzenle,
  musteriAktiflik,
  personelEkle,
  personelDuzenle,
  personelAktiflik,
  durumEkle,
  durumDuzenle,
  faturaEkle,
  faturaDuzenle,
  rolDuzenle,
  davetKodYenile,
} from "@/app/actions/tanim"

const SEKMELER = [
  { k: "musteri", label: "Müşteriler" },
  { k: "personel", label: "Tekniker" },
  { k: "durum", label: "Durumlar" },
  { k: "fatura", label: "Fatura Durumları" },
  { k: "roller", label: "Kullanıcı & Roller" },
  { k: "davet", label: "Davet Kodları" },
]

type SP = Record<string, string | string[] | undefined>

export default async function TanimlarSayfasi({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const kullanici = await getYonetici()
  const sp = await searchParams
  const sekmeRaw = Array.isArray(sp.sekme) ? sp.sekme[0] : sp.sekme
  const sekme = SEKMELER.some((s) => s.k === sekmeRaw) ? sekmeRaw! : "musteri"

  const supabase = await createClient()
  const [musteriler, personeller, durumlar, faturalar, profiller, kisiler] =
    await Promise.all([
      supabase.from("musteri").select("id, ad, sube_sehir, aktif").order("ad"),
      supabase.from("teknik_personel").select("id, ad, aktif").order("ad"),
      supabase.from("durum").select("id, ad, sira, renk").order("sira"),
      supabase.from("fatura_durumu").select("id, ad").order("ad"),
      supabase.from("kullanici_profil").select("id, ad, rol, fis_prefix").order("ad"),
      supabase
        .from("davet_kisi")
        .select("id, ad, fis_prefix, rol, aktif, kod")
        .order("fis_prefix"),
    ])

  const rolEtiket = (r: string) => (r === "yonetici" ? "Yönetici" : "Personel")
  // Bir davet kodu "kullanılmış" sayılır: o ön eke sahip kayıtlı bir profil varsa.
  const kullanilanOnekler = new Set(
    (profiller.data ?? [])
      .filter((p) => p.rol === "yonetici" || p.rol === "teknisyen")
      .map((p) => p.fis_prefix)
      .filter((x): x is number => x != null)
  )

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[21px] font-semibold tracking-tight">Tanımlar</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Müşteri, personel, durum ve kullanıcı yönetimi
        </p>
      </div>

      {/* Sekmeler */}
      <div className="flex flex-wrap gap-2">
        {SEKMELER.map((s) => (
          <Link
            key={s.k}
            href={`/tanimlar?sekme=${s.k}`}
            scroll={false}
            className={cn(
              "rounded-[9px] border px-3.5 py-2 text-[13px] font-medium transition-colors",
              sekme === s.k
                ? "border-primary bg-primary font-semibold text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* MÜŞTERİLER */}
      {sekme === "musteri" && (
        <section className="grid gap-3">
          <form action={musteriEkle} className="flex flex-wrap gap-2">
            <Input name="ad" placeholder="Müşteri adı" required className="max-w-xs" />
            <Input name="sube_sehir" placeholder="Şube/şehir (ops.)" className="max-w-xs" />
            <Button type="submit" size="sm">Ekle</Button>
          </form>
          <div className="grid gap-2">
            {(musteriler.data ?? []).map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
                <form action={musteriDuzenle} className="flex flex-1 flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={m.id} />
                  <Input name="ad" defaultValue={m.ad} className="max-w-xs" required />
                  <Input name="sube_sehir" defaultValue={m.sube_sehir ?? ""} placeholder="Şube/şehir" className="max-w-[10rem]" />
                  <Button type="submit" size="sm" variant="outline">Kaydet</Button>
                </form>
                <form action={musteriAktiflik}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="aktif" value={m.aktif ? "false" : "true"} />
                  <Button type="submit" size="sm" variant={m.aktif ? "ghost" : "secondary"}>
                    {m.aktif ? "Pasifleştir" : "Aktifleştir"}
                  </Button>
                </form>
                {!m.aktif && <span className="text-xs text-muted-foreground">(pasif)</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PERSONEL */}
      {sekme === "personel" && (
        <section className="grid gap-3">
          <form action={personelEkle} className="flex flex-wrap gap-2">
            <Input name="ad" placeholder="Tekniker adı" required className="max-w-xs" />
            <Button type="submit" size="sm">Ekle</Button>
          </form>
          <div className="grid gap-2">
            {(personeller.data ?? []).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
                <form action={personelDuzenle} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <Input name="ad" defaultValue={p.ad} className="max-w-xs" required />
                  <Button type="submit" size="sm" variant="outline">Kaydet</Button>
                </form>
                <form action={personelAktiflik}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="aktif" value={p.aktif ? "false" : "true"} />
                  <Button type="submit" size="sm" variant={p.aktif ? "ghost" : "secondary"}>
                    {p.aktif ? "Pasifleştir" : "Aktifleştir"}
                  </Button>
                </form>
                {!p.aktif && <span className="text-xs text-muted-foreground">(pasif)</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* DURUMLAR */}
      {sekme === "durum" && (
        <section className="grid gap-3">
          <form action={durumEkle} className="flex flex-wrap items-center gap-2">
            <Input name="ad" placeholder="Durum adı" required className="max-w-xs" />
            <Input name="sira" type="number" placeholder="Sıra" defaultValue="0" className="w-20" />
            <input name="renk" type="color" defaultValue="#64748b" className="h-9 w-12 rounded border border-input" />
            <Button type="submit" size="sm">Ekle</Button>
          </form>
          <div className="grid gap-2">
            {(durumlar.data ?? []).map((d) => (
              <form key={d.id} action={durumDuzenle} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
                <input type="hidden" name="id" value={d.id} />
                <div className="w-28"><DurumRozeti ad={d.ad} renk={d.renk} /></div>
                <Input name="ad" defaultValue={d.ad} className="max-w-xs" required />
                <Input name="sira" type="number" defaultValue={d.sira} className="w-20" />
                <input name="renk" type="color" defaultValue={d.renk ?? "#64748b"} className="h-9 w-12 rounded border border-input" />
                <Button type="submit" size="sm" variant="outline">Kaydet</Button>
              </form>
            ))}
          </div>
        </section>
      )}

      {/* FATURA */}
      {sekme === "fatura" && (
        <section className="grid gap-3">
          <form action={faturaEkle} className="flex flex-wrap gap-2">
            <Input name="ad" placeholder="Fatura durumu adı" required className="max-w-xs" />
            <Button type="submit" size="sm">Ekle</Button>
          </form>
          <div className="grid gap-2">
            {(faturalar.data ?? []).map((f) => (
              <form key={f.id} action={faturaDuzenle} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2">
                <input type="hidden" name="id" value={f.id} />
                <div className="w-40"><FaturaRozeti ad={f.ad} /></div>
                <Input name="ad" defaultValue={f.ad} className="max-w-xs" required />
                <Button type="submit" size="sm" variant="outline">Kaydet</Button>
              </form>
            ))}
          </div>
        </section>
      )}

      {/* KULLANICILAR */}
      {sekme === "roller" && (
        <section className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            Yeni kullanıcı Supabase panelinden eklenir; buradan rol atanır.
          </p>
          <div className="grid gap-2">
            {(profiller.data ?? []).map((u) => (
              <form key={u.id} action={rolDuzenle} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
                <input type="hidden" name="id" value={u.id} />
                <span className="flex flex-1 items-center gap-2.5 text-sm">
                  <span className="flex size-[30px] items-center justify-center rounded-lg bg-primary text-[11px] font-semibold text-primary-foreground">
                    {(u.ad ?? "?").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="font-semibold">{u.ad ?? u.id}</span>
                </span>
                <select
                  name="rol"
                  defaultValue={u.rol}
                  className="h-9 rounded-lg border border-input bg-card px-2.5 text-[12.5px]"
                >
                  <option value="teknisyen">Personel</option>
                  <option value="yonetici">Yönetici</option>
                </select>
                <Button type="submit" size="sm" variant="outline">Kaydet</Button>
              </form>
            ))}
          </div>
        </section>
      )}

      {/* DAVET KODLARI */}
      {sekme === "davet" && (
        <section className="grid gap-4">
          {/* Kişiler: her biri için davet üret */}
          <div className="grid gap-2">
            <h2 className="text-sm font-semibold">Davet kodları</h2>
            <p className="text-xs text-muted-foreground">
              Her kişinin kodu <strong>sabittir</strong> (tekrar tekrar kullanılabilir).
              İlgili kişiye verin; "Üye ol" ekranında kullansın — hesabı rolü ve fiş
              ön ekiyle açılır. <span className="text-emerald-600 dark:text-emerald-400">Kullanılmış</span> kodlar soluk gösterilir. Kod ele geçerse "Yenile" ile değiştirin.
            </p>
            <div className="grid gap-2">
              {(kisiler.data ?? [])
                .filter((k) => kullanici.sahip || k.rol !== "yonetici")
                .map((k) => {
                  const kullanildi = kullanilanOnekler.has(k.fis_prefix)
                  return (
                  <div
                    key={k.id}
                    className={
                      "flex flex-wrap items-center gap-3 rounded-xl border p-2.5 " +
                      (kullanildi
                        ? "border-border bg-muted/40 opacity-60"
                        : "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20")
                    }
                  >
                    <span className="w-28 font-semibold">{k.ad}</span>
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                      ön ek {k.fis_prefix}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {rolEtiket(k.rol)}
                    </span>
                    <code className="rounded bg-muted px-2 py-1 font-mono text-sm font-semibold">
                      {k.kod}
                    </code>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                        (kullanildi
                          ? "bg-muted text-muted-foreground"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300")
                      }
                    >
                      {kullanildi ? "Kullanıldı" : "Boşta"}
                    </span>
                    {kullanici.sahip && (
                      <form action={davetKodYenile} className="ml-auto">
                        <input type="hidden" name="kisi_id" value={k.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Yenile
                        </Button>
                      </form>
                    )}
                  </div>
                  )
                })}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
