import { createClient } from "@/lib/supabase/server"

type SP = Record<string, string | string[] | undefined>

function tek(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export type IsFiltre = {
  q: string
  durum: string
  personel: string
  fatura: string
  musteri: string
  baslangic: string
  bitis: string
}

export function filtreleriOku(sp: SP): IsFiltre {
  return {
    q: tek(sp.q)?.trim() ?? "",
    durum: tek(sp.durum) ?? "",
    personel: tek(sp.personel) ?? "",
    fatura: tek(sp.fatura) ?? "",
    musteri: tek(sp.musteri) ?? "",
    baslangic: tek(sp.baslangic) ?? "",
    bitis: tek(sp.bitis) ?? "",
  }
}

// Arama metni (q) için PostgREST .or() ifadesini üretir; müşteri adına da bakar.
// Diğer filtreler (eq/gte/lte) çağıran tarafta uygulanır (builder tipi korunsun diye).
export async function aramaOrIfadesi(
  supabase: Awaited<ReturnType<typeof createClient>>,
  q: string
): Promise<string | null> {
  if (!q) return null
  // Türkçe İ/i–I/ı için hem TR-büyük hem TR-küçük varyantla ara.
  // Özel karakterleri boşlukla DEĞİL '*' (joker) ile değiştir ki "1.2KW" de eşleşsin.
  const qTemiz = q
    .replace(/[%,().:*\\]/g, "*")
    .replace(/\*{2,}/g, "*")
    .replace(/\s+/g, " ")
    .trim()
  const varyantlar = [
    ...new Set([
      qTemiz,
      qTemiz.toLocaleUpperCase("tr-TR"),
      qTemiz.toLocaleLowerCase("tr-TR"),
    ]),
  ]
  const { data: eslesenMusteri } = await supabase
    .from("musteri")
    .select("id")
    .or(varyantlar.map((v) => `ad.ilike.*${v}*`).join(","))
  const alanlar = [
    "cihaz_adi",
    "seri_no",
    "servis_no",
    "garanti_no",
    "talep_no",
    "kargo_takip_no",
    "takip_no",
    "ilgili_kisi",
    "telefon",
    "adres",
  ]
  const orParcalari = alanlar.flatMap((a) =>
    varyantlar.map((v) => `${a}.ilike.*${v}*`)
  )
  if (eslesenMusteri && eslesenMusteri.length > 0) {
    orParcalari.push(
      `musteri_id.in.(${eslesenMusteri.map((m) => m.id).join(",")})`
    )
  }
  return orParcalari.join(",")
}

// Filtreleri querystring'e çevir (link/indirme için)
export function filtreToParams(f: IsFiltre): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set("q", f.q)
  if (f.durum) p.set("durum", f.durum)
  if (f.personel) p.set("personel", f.personel)
  if (f.fatura) p.set("fatura", f.fatura)
  if (f.musteri) p.set("musteri", f.musteri)
  if (f.baslangic) p.set("baslangic", f.baslangic)
  if (f.bitis) p.set("bitis", f.bitis)
  return p
}
