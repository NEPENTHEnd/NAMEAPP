import Link from "next/link"

import { getKullanici } from "@/lib/auth"
import { getIsFormSecenekleri } from "@/lib/secenekler"
import { isOlustur } from "@/app/actions/is"
import { IsFormu } from "@/components/is-formu"

export default async function YeniIsSayfasi() {
  const kullanici = await getKullanici()
  const secenekler = await getIsFormSecenekleri()
  // Geliş tarihi için bugünü varsayılan ver
  const bugun = new Date().toISOString().slice(0, 10)

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← İşler
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Yeni İş</h1>
      </div>

      <IsFormu
        action={isOlustur}
        musteriler={secenekler.musteriler}
        durumlar={secenekler.durumlar}
        personeller={secenekler.personeller}
        faturaDurumlari={secenekler.faturaDurumlari}
        varsayilan={{ gelis_tarihi: bugun }}
        gonderEtiketi="İşi oluştur"
        finansalGoster={kullanici.rol === "yonetici"}
        servisNoGoster={kullanici.rol === "yonetici"}
        fotoSecimi
      />
    </div>
  )
}
