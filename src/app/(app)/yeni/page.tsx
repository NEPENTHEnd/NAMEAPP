import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"
import { getIsFormSecenekleri } from "@/lib/secenekler"
import { subeSecenekleri } from "@/lib/sube"
import { isOlustur } from "@/app/actions/is"
import { IsFormu } from "@/components/is-formu"

export default async function YeniIsSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const grupParam = Array.isArray(sp.grup) ? sp.grup[0] : sp.grup
  const kullanici = await getKullanici()
  const secenekler = await getIsFormSecenekleri()
  // Geliş tarihi için bugünü varsayılan ver (Türkiye saatiyle — UTC değil, yoksa
  // gece yarısı-03:00 arası "dün" görünür ve iş yanlış güne düşer)
  const bugun = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })
  const personel = kullanici.rol !== "yonetici"
  // İş oluştururken durum herkeste otomatik BAKILMADI (yönetici de seçmez); geliş bugün
  const bakilmadiId =
    secenekler.durumlar.find((d) => d.ad === "BAKILMADI")?.id ??
    secenekler.durumlar[0]?.id ??
    ""
  // Yeşil + ile gruba hızlı ekleme (yalnız yönetici)
  const grup = !personel
    ? secenekler.gruplar.find((g) => g.id === grupParam)
    : undefined
  // Şubeler: ön-seçili firmanınki (yeşil + ile) + müşteri adına göre açılması için TÜMÜ
  const supabase = await createClient()
  const { data: subeHam } = await supabase
    .from("sube")
    .select("id, grup_id, ad, ust_sube_id")
    .eq("aktif", true)
    .order("sira")
  const tumSubeler = subeHam ?? []
  const subeler = grup
    ? subeSecenekleri(tumSubeler.filter((s) => s.grup_id === grup.id))
    : []

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← İşler
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          Yeni İş{grup ? ` · ${grup.ad}` : ""}
        </h1>
      </div>

      <IsFormu
        action={isOlustur}
        musteriler={secenekler.musteriler}
        durumlar={secenekler.durumlar}
        personeller={secenekler.personeller}
        faturaDurumlari={secenekler.faturaDurumlari}
        subeler={subeler}
        firmalar={secenekler.gruplar}
        tumSubeler={tumSubeler}
        varsayilan={{
          gelis_tarihi: bugun,
          durum_id: bakilmadiId,
          grup_id: grup?.id ?? undefined,
        }}
        gonderEtiketi="İşi oluştur"
        finansalGoster={!personel}
        personelMod={personel}
        durumSabit
        servisNoGoster={grup?.ad === "BOYTEKS"} // BOYTEKS: fiş no otomatik değil, stok kodu elle
        servisNoEtiket="Firma stok kodu"
        fotoSecimi
      />
    </div>
  )
}
