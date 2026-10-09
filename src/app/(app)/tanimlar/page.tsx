import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { getYonetici } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DurumRozeti, FaturaRozeti } from "@/components/rozet"
import { FirmaListesi } from "@/components/firma-listesi"
import { MusteriListesi } from "@/components/musteri-listesi"
import {
  KullaniciYonetimi,
  type YonetimKullanici,
  type BekleyenDavet,
} from "@/components/kullanici-yonetimi"
import { GuvenlikAyari } from "@/components/guvenlik-ayari"
import { HizliFiltreAyari } from "@/components/hizli-filtre-ayari"
import { hizliOgeler, type HizliAyar } from "@/lib/hizli-filtre"
import { oturumDurumu, epostaMaskele } from "@/lib/guvenlik"
import {
  personelEkle,
  personelDuzenle,
  personelAktiflik,
  durumEkle,
  durumDuzenle,
  faturaEkle,
  faturaDuzenle,
  davetKodYenile,
} from "@/app/actions/tanim"

const SEKMELER = [
  { k: "musteri", label: "Müşteriler" },
  { k: "firmalar", label: "Firmalar (Sol Menü)" },
  { k: "personel", label: "Tekniker" },
  { k: "durum", label: "Durumlar" },
  { k: "fatura", label: "Fatura Durumları" },
  { k: "filtreler", label: "Filtre Butonları" },
  { k: "roller", label: "Kullanıcılar" },
  { k: "davet", label: "Eski Davet Kodları" },
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
  const [musteriler, personeller, durumlar, faturalar, profiller, kisiler, gruplar, isKisiler, subeler, yonetimListe] =
    await Promise.all([
      supabase.from("musteri").select("id, ad, sube_sehir, aktif").order("ad"),
      supabase.from("teknik_personel").select("id, ad, aktif").order("ad"),
      supabase.from("durum").select("id, ad, sira, renk").order("sira"),
      supabase.from("fatura_durumu").select("id, ad, sira, hizli, renk").order("sira"),
      supabase.from("kullanici_profil").select("id, ad, rol, fis_prefix").order("ad"),
      supabase
        .from("davet_kisi")
        .select("id, ad, fis_prefix, rol, aktif, kod, eposta, kullanildi, davet_tarihi")
        .order("fis_prefix"),
      supabase.from("grup").select("id, ad, sira, aktif").order("sira"),
      // Müşteri başına biriken ilgili kişi + telefon (işlerden otomatik toplanır)
      supabase.from("is_kaydi").select("musteri_id, grup_id, sube_id, ilgili_kisi, telefon"),
      supabase
        .from("sube")
        .select("id, grup_id, ad, ilgili_kisi, telefon, ust_sube_id")
        .order("sira"),
      // Yönetim listesi (e-posta + son giriş + iş sayısı) — yalnız yöneticiye döner
      supabase.rpc("kullanici_listesi"),
    ])

  const yonetimKullanicilar: YonetimKullanici[] = (yonetimListe.data ?? []).map((u) => ({
    id: u.o_id,
    ad: u.o_ad,
    rol: u.o_rol,
    sahip: u.o_sahip,
    aktif: u.o_aktif,
    eposta: u.o_eposta,
    sonGiris: u.o_son_giris,
    isSayisi: Number(u.o_is_sayisi ?? 0),
  }))
  // Yönetici e-posta doğrulaması durumu (yalnız Kullanıcılar sekmesinde gerekli)
  const guvenlik = sekme === "roller" ? await oturumDurumu() : null

  // E-postayla gönderilmiş, henüz kullanılmamış davetler (yönetici davetlerini yalnız sahip görür)
  const bekleyenDavetler: BekleyenDavet[] = (kisiler.data ?? [])
    .filter((k) => k.eposta && k.kod && k.aktif && !k.kullanildi)
    .filter((k) => kullanici.sahip || k.rol !== "yonetici")
    .map((k) => ({
      id: k.id,
      ad: k.ad,
      eposta: k.eposta!,
      rol: k.rol,
      kod: k.kod!,
      tarih: k.davet_tarihi,
    }))

  // Her müşterinin işlerinden benzersiz (ad · telefon) iletişimlerini + iş sayısını çıkar
  const musteriIletisim = new Map<string, { ad: string | null; telefon: string | null }[]>()
  const musteriIsSayisi = new Map<string, number>()
  // Firmalar sekmesi için: firma ve şube başına iş sayısı
  const grupIsSayisi = new Map<string, number>()
  const subeIsSayisi = new Map<string, number>()
  for (const r of isKisiler.data ?? []) {
    if (r.grup_id) grupIsSayisi.set(r.grup_id, (grupIsSayisi.get(r.grup_id) ?? 0) + 1)
    if (r.sube_id) subeIsSayisi.set(r.sube_id, (subeIsSayisi.get(r.sube_id) ?? 0) + 1)
    if (!r.musteri_id) continue
    musteriIsSayisi.set(r.musteri_id, (musteriIsSayisi.get(r.musteri_id) ?? 0) + 1)
    const ad = r.ilgili_kisi?.trim() || null
    const tel = r.telefon?.trim() || null
    if (!ad && !tel) continue
    const liste = musteriIletisim.get(r.musteri_id) ?? []
    const anahtar = `${ad ?? ""}|${tel ?? ""}`
    if (!liste.some((x) => `${x.ad ?? ""}|${x.telefon ?? ""}` === anahtar)) {
      liste.push({ ad, telefon: tel })
      musteriIletisim.set(r.musteri_id, liste)
    }
  }

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
        <h1 className="text-[21px] font-semibold tracking-tight">Ayarlar</h1>
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

      {/* FİRMALAR — İşler ekranındaki sol menü */}
      {sekme === "firmalar" && (
        <section className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            İşler ekranının solundaki firma menüsü. Yeni firma yalnız
            <strong> kayıtlı müşterilerden</strong> seçilerek eklenir. Kartı tutma
            noktasından <strong>sürükleyerek</strong> sırala; <strong>Şubeler</strong> ile alt
            firma ekle; ad değiştirme ve <strong>Sil</strong> için <strong>Düzenle</strong> (silinen
            firmanın işleri silinmez, DİĞER'e taşınır).
          </p>
          <FirmaListesi
            gruplar={(gruplar.data ?? []).map((g) => ({
              id: g.id,
              ad: g.ad,
              sira: g.sira,
            }))}
            musteriler={(musteriler.data ?? []).map((m) => ({ id: m.id, ad: m.ad }))}
            subeler={subeler.data ?? []}
            isSayisi={Object.fromEntries(grupIsSayisi)}
            subeIsSayisi={Object.fromEntries(subeIsSayisi)}
          />
        </section>
      )}

      {/* MÜŞTERİLER — renkli, aranabilir liste (düzenleme satıra tıklayınca açılır) */}
      {sekme === "musteri" && (
        <MusteriListesi
          musteriler={musteriler.data ?? []}
          subeler={subeler.data ?? []}
          gruplar={(gruplar.data ?? []).map((g) => ({ id: g.id, ad: g.ad }))}
          iletisim={Object.fromEntries(musteriIletisim)}
          isSayisi={Object.fromEntries(musteriIsSayisi)}
        />
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
          <p className="text-xs text-muted-foreground">
            <strong>Sıra</strong> = listedeki diziliş numarası (küçük olan üstte);
            <strong> renk</strong> tabloda satırın ve rozetin rengini belirler.
          </p>
          <form action={durumEkle} className="flex flex-wrap items-center gap-2">
            <Input name="ad" placeholder="Durum adı" required className="max-w-xs" />
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              Sıra
              <Input name="sira" type="number" placeholder="0" defaultValue="0" className="w-16" />
            </label>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              Renk
              <input name="renk" type="color" defaultValue="#64748b" className="h-9 w-12 rounded border border-input" />
            </label>
            <Button type="submit" size="sm">Ekle</Button>
          </form>
          <div className="grid gap-2">
            {(durumlar.data ?? []).map((d) => (
              <form key={d.id} action={durumDuzenle} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
                <input type="hidden" name="id" value={d.id} />
                <div className="w-28"><DurumRozeti ad={d.ad} renk={d.renk} /></div>
                <Input name="ad" defaultValue={d.ad} className="max-w-xs" required />
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  Sıra
                  <Input name="sira" type="number" defaultValue={d.sira} className="w-16" />
                </label>
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  Renk
                  <input name="renk" type="color" defaultValue={d.renk ?? "#64748b"} className="h-9 w-12 rounded border border-input" />
                </label>
                <Button type="submit" size="sm" variant="outline">Kaydet</Button>
              </form>
            ))}
          </div>
        </section>
      )}

      {/* FATURA */}
      {sekme === "fatura" && (
        <section className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            <strong>Hızlı</strong> işaretli durumlar, kendi düzenini yapmamış yöneticilerde
            İşler ekranının üstünde buton olarak görünür (her yönetici{" "}
            <strong>Filtre Butonları</strong> sekmesinden kendine göre değiştirebilir);{" "}
            <strong>Sıra</strong> butonların dizilişini belirler;
            <strong> renk</strong> tablodaki rozetin rengini değiştirir.
          </p>
          <form action={faturaEkle} className="flex flex-wrap items-center gap-2">
            <Input name="ad" placeholder="Fatura durumu adı" required className="max-w-xs" />
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              Sıra
              <Input name="sira" type="number" placeholder="100" className="w-16" />
            </label>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              Renk
              <input name="renk" type="color" defaultValue="#94a3b8" className="h-9 w-12 rounded border border-input" />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input type="checkbox" name="hizli" className="size-4 accent-primary" />
              Hızlı
            </label>
            <Button type="submit" size="sm">Ekle</Button>
          </form>
          <div className="grid gap-2">
            {(faturalar.data ?? []).map((f) => (
              <form key={f.id} action={faturaDuzenle} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-2">
                <input type="hidden" name="id" value={f.id} />
                <div className="w-40"><FaturaRozeti ad={f.ad} renk={f.renk} /></div>
                <Input name="ad" defaultValue={f.ad} className="max-w-xs" required />
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  Sıra
                  <Input name="sira" type="number" defaultValue={f.sira} className="w-16" />
                </label>
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  Renk
                  <input name="renk" type="color" defaultValue={f.renk ?? "#94a3b8"} className="h-9 w-12 rounded border border-input" />
                </label>
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <input type="checkbox" name="hizli" defaultChecked={f.hizli} className="size-4 accent-primary" />
                  Hızlı
                </label>
                <Button type="submit" size="sm" variant="outline">Kaydet</Button>
              </form>
            ))}
          </div>
        </section>
      )}

      {/* FİLTRE BUTONLARI — kişisel: hangi hızlı filtre buton, hangisi Filtre içinde + renk */}
      {sekme === "filtreler" && (
        <HizliFiltreAyari
          ogeler={hizliOgeler(durumlar.data ?? [], faturalar.data ?? [])}
          ayar={(kullanici.hizliFiltre ?? null) as HizliAyar | null}
        />
      )}

      {/* KULLANICILAR — davet / erişim kapat-aç / kalıcı sil / rol */}
      {sekme === "roller" && (
        <div className="grid gap-5">
          {kullanici.sahip ? (
            <GuvenlikAyari
              acik={!!guvenlik?.zorunlu}
              benDogrulandi={!!guvenlik?.dogrulandi}
              epostaMaskeli={epostaMaskele(kullanici.eposta)}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Yönetici e-posta doğrulaması:{" "}
              <strong>{guvenlik?.zorunlu ? "Açık" : "Kapalı"}</strong> (yalnız sahip değiştirebilir)
            </p>
          )}
          {yonetimListe.error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Kullanıcı listesi alınamadı: {yonetimListe.error.message}
            </p>
          ) : (
            <KullaniciYonetimi
              kullanicilar={yonetimKullanicilar}
              davetler={bekleyenDavetler}
              benId={kullanici.id}
              benSahip={kullanici.sahip}
            />
          )}
        </div>
      )}

      {/* DAVET KODLARI */}
      {sekme === "davet" && (
        <section className="grid gap-4">
          {/* Kişiler: her biri için davet üret */}
          <div className="grid gap-2">
            <h2 className="text-sm font-semibold">Eski davet kodları</h2>
            <p className="rounded-lg bg-primary/5 p-2 text-xs text-foreground">
              Yeni kullanıcıları artık <strong>Kullanıcılar</strong> sekmesinden e-postayla davet
              edin (tek kullanımlık, e-postaya bağlı). Aşağıdakiler önceki sabit kodlardır.
            </p>
            <p className="text-xs text-muted-foreground">
              Her kişinin kodu <strong>sabittir</strong> (tekrar tekrar kullanılabilir).
              İlgili kişiye verin; "Üye ol" ekranında kullansın — hesabı rolü ve fiş
              ön ekiyle açılır. <span className="text-emerald-600 dark:text-emerald-400">Kullanılmış</span> kodlar soluk gösterilir. Kod ele geçerse "Yenile" ile değiştirin.
            </p>
            <div className="grid gap-2">
              {(kisiler.data ?? [])
                .filter((k) => !k.eposta) // yalnız eski sabit kodlar (e-postalı davetler Kullanıcılar'da)
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
