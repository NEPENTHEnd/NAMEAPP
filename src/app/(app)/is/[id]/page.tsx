import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"
import { getIsFormSecenekleri } from "@/lib/secenekler"
import { isGuncelle, isSil } from "@/app/actions/is"
import { IsFormu } from "@/components/is-formu"
import { SilButonu } from "@/components/sil-butonu"
import { FotoBolumu, type FotoOgesi } from "@/components/foto-bolumu"
import { DurumRozeti } from "@/components/rozet"
import { TakipKodu } from "@/components/takip-kodu"

function tarihSaatTR(s: string | null): string {
  if (!s) return "—"
  return new Date(s).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default async function IsDetaySayfasi({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const kullanici = await getKullanici()
  const supabase = await createClient()

  const { data: kayit } = await supabase
    .from("is_kaydi")
    .select(
      `
        id, cihaz_adi, seri_no, servis_no, takip_no, gelis_tarihi, cikis_tarihi,
        ilgili_kisi, adres, kargo_takip_no, grup_id, fiyat_teklifi, fatura_tutari, fatura_tarihi, garanti_no, aciklama,
        yonetici_gordu,
        created_at, updated_at,
        musteri_id, durum_id, teknik_personel_id, fatura_durumu_id,
        musteri:musteri_id ( ad ),
        durum:durum_id ( ad, renk )
      `
    )
    .eq("id", id)
    .maybeSingle()

  if (!kayit) notFound()

  // Yönetici yeni bir işi açtığında "görüldü" işaretle (bildirim rozeti düşsün).
  if (kullanici.rol === "yonetici" && !kayit.yonetici_gordu) {
    await supabase.from("is_kaydi").update({ yonetici_gordu: true }).eq("id", id)
  }

  // Fotoğraflar — private bucket olduğu için imzalı URL üret
  const { data: fotoSatirlari } = await supabase
    .from("foto")
    .select("id, dosya_yolu")
    .eq("is_kaydi_id", id)
    .order("sira")

  let fotograflar: FotoOgesi[] = []
  if (fotoSatirlari && fotoSatirlari.length > 0) {
    const { data: imzali } = await supabase.storage
      .from("foto")
      .createSignedUrls(
        fotoSatirlari.map((f) => f.dosya_yolu),
        60 * 60
      )
    fotograflar = fotoSatirlari.map((f, i) => ({
      id: f.id,
      dosyaYolu: f.dosya_yolu,
      url: imzali?.[i]?.signedUrl ?? "",
    }))
  }

  const secenekler = await getIsFormSecenekleri()
  const guncelleAction = isGuncelle.bind(null, id)
  const silAction = isSil.bind(null, id)

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← İşler
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">
              {kayit.servis_no ?? kayit.cihaz_adi}
            </h1>
            {kayit.durum ? (
              <DurumRozeti ad={kayit.durum.ad} renk={kayit.durum.renk} />
            ) : null}
          </div>
          {kullanici.rol === "yonetici" && <SilButonu silAction={silAction} />}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {kayit.musteri?.ad ?? "—"} · oluşturuldu {tarihSaatTR(kayit.created_at)}
          {kayit.updated_at !== kayit.created_at
            ? ` · güncellendi ${tarihSaatTR(kayit.updated_at)}`
            : ""}
        </p>
      </div>

      <TakipKodu kod={kayit.takip_no} />

      <div className="rounded-lg border p-4">
        <FotoBolumu isKaydiId={id} fotograflar={fotograflar} />
      </div>

      <IsFormu
        action={guncelleAction}
        musteriler={secenekler.musteriler}
        durumlar={secenekler.durumlar}
        personeller={secenekler.personeller}
        faturaDurumlari={secenekler.faturaDurumlari}
        varsayilan={{
          musteri_id: kayit.musteri_id,
          cihaz_adi: kayit.cihaz_adi,
          seri_no: kayit.seri_no,
          servis_no: kayit.servis_no,
          gelis_tarihi: kayit.gelis_tarihi,
          cikis_tarihi: kayit.cikis_tarihi,
          durum_id: kayit.durum_id,
          teknik_personel_id: kayit.teknik_personel_id,
          fatura_durumu_id: kayit.fatura_durumu_id,
          ilgili_kisi: kayit.ilgili_kisi,
          adres: kayit.adres,
          kargo_takip_no: kayit.kargo_takip_no,
          grup_id: kayit.grup_id,
          fiyat_teklifi: kayit.fiyat_teklifi,
          fatura_tutari: kayit.fatura_tutari,
          fatura_tarihi: kayit.fatura_tarihi,
          garanti_no: kayit.garanti_no,
          aciklama: kayit.aciklama,
        }}
        gonderEtiketi="Değişiklikleri kaydet"
        iptalHref="/"
        finansalGoster={kullanici.rol === "yonetici"}
        personelMod={kullanici.rol !== "yonetici"}
        degisiklikTakip
      />
    </div>
  )
}
