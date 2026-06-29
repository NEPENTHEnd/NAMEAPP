import JSZip from "jszip"

import { createClient } from "@/lib/supabase/server"
import { getKullanici } from "@/lib/auth"
import { ayAraligi } from "@/lib/aylar"

export async function GET(request: Request) {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    return new Response("Yetkisiz", { status: 403 })
  }

  const ay = new URL(request.url).searchParams.get("ay") ?? ""
  const aralik = ay ? ayAraligi(ay) : null

  const supabase = await createClient()
  const { data: fotolar, error } = await supabase
    .from("foto")
    .select(
      "dosya_yolu, is_kaydi:is_kaydi_id ( servis_no, gelis_tarihi )"
    )
    .order("sira")

  if (error) return new Response("Veri alınamadı: " + error.message, { status: 500 })

  // Aya göre süz (geliş ayına göre)
  const secilenler = (fotolar ?? []).filter((f) => {
    if (!aralik) return true
    const g = f.is_kaydi?.gelis_tarihi
    return g ? g >= aralik.baslangic && g <= aralik.bitis : false
  })

  if (secilenler.length === 0) {
    return new Response("İndirilecek fotoğraf yok.", { status: 404 })
  }

  const zip = new JSZip()
  const sayac = new Map<string, number>()

  for (const f of secilenler) {
    const { data: blob } = await supabase.storage.from("foto").download(f.dosya_yolu)
    if (!blob) continue
    const ext = f.dosya_yolu.split(".").pop() || "jpg"
    const taban = f.is_kaydi?.servis_no || "fissiz"
    const n = (sayac.get(taban) ?? 0) + 1
    sayac.set(taban, n)
    const ad = n === 1 ? `${taban}.${ext}` : `${taban}-${n}.${ext}`
    zip.file(ad, await blob.arrayBuffer())
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" })
  const bugun = new Date().toISOString().slice(0, 10)
  const dosyaAdi = ay
    ? `name-teknik-fotograflar-${ay}.zip`
    : `name-teknik-fotograflar-${bugun}.zip`

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${dosyaAdi}"`,
    },
  })
}
