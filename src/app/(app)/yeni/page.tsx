import Link from "next/link"

import { getKullanici } from "@/lib/auth"
import { getIsFormSecenekleri } from "@/lib/secenekler"
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
  // Geliş tarihi için bugünü varsayılan ver
  const bugun = new Date().toISOString().slice(0, 10)
  const personel = kullanici.rol !== "yonetici"
  // Personel: durum otomatik (BAKILMADI), geliş bugün
  const bakilmadiId =
    secenekler.durumlar.find((d) => d.ad === "BAKILMADI")?.id ??
    secenekler.durumlar[0]?.id ??
    ""
  // Yeşil + ile gruba hızlı ekleme (yalnız yönetici)
  const grup = !personel
    ? secenekler.gruplar.find((g) => g.id === grupParam)
    : undefined

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
        varsayilan={{
          gelis_tarihi: bugun,
          durum_id: personel ? bakilmadiId : undefined,
          grup_id: grup?.id ?? undefined,
        }}
        gonderEtiketi="İşi oluştur"
        finansalGoster={!personel}
        personelMod={personel}
        fotoSecimi
      />
    </div>
  )
}
