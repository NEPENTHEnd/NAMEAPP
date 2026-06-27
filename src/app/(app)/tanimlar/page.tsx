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
  davetUret,
} from "@/app/actions/tanim"

const SEKMELER = [
  { k: "musteri", label: "Müşteriler" },
  { k: "personel", label: "Teknik Personel" },
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
  const [musteriler, personeller, durumlar, faturalar, profiller, davetler] =
    await Promise.all([
      supabase.from("musteri").select("id, ad, sube_sehir, aktif").order("ad"),
      supabase.from("teknik_personel").select("id, ad, aktif").order("ad"),
      supabase.from("durum").select("id, ad, sira, renk").order("sira"),
      supabase.from("fatura_durumu").select("id, ad").order("ad"),
      supabase.from("kullanici_profil").select("id, ad, rol").order("ad"),
      supabase
        .from("davet_kodu")
        .select("kod, rol, kullanildi, created_at")
        .order("created_at", { ascending: false }),
    ])

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
            <Input name="ad" placeholder="Personel adı" required className="max-w-xs" />
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
                  <option value="teknisyen">teknisyen</option>
                  <option value="yonetici">yonetici</option>
                </select>
                <Button type="submit" size="sm" variant="outline">Kaydet</Button>
              </form>
            ))}
          </div>
        </section>
      )}

      {/* DAVET KODLARI */}
      {sekme === "davet" && (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <form action={davetUret}>
              <input type="hidden" name="rol" value="teknisyen" />
              <Button type="submit" size="sm">+ Teknisyen daveti üret</Button>
            </form>
            {kullanici.sahip && (
              <form action={davetUret}>
                <input type="hidden" name="rol" value="yonetici" />
                <Button type="submit" size="sm" variant="secondary">
                  + Yönetici daveti üret
                </Button>
              </form>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Her kod <strong>tek kullanımlıktır</strong> — kayıt olununca tükenir.
            Üretilen kodu ilgili kişiye verin; "Üye ol" ekranında kullansın.
          </p>

          {(davetler.data ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Henüz davet kodu üretilmedi.
            </div>
          ) : (
            <div className="grid gap-2">
              {(davetler.data ?? []).map((d) => (
                <div
                  key={d.kod}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-2.5"
                >
                  <code className="rounded bg-muted px-2 py-1 font-mono text-sm font-semibold">
                    {d.kod}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {d.rol === "yonetici" ? "Yönetici" : "Teknisyen"}
                  </span>
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium",
                      d.kullanildi
                        ? "bg-muted text-muted-foreground"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    )}
                  >
                    {d.kullanildi ? "kullanıldı" : "aktif"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
