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
  const { data: eslesenMusteri } = await supabase
    .from("musteri")
    .select("id")
    .ilike("ad", `%${q}%`)
  const orParcalari = [
    `cihaz_adi.ilike.*${q}*`,
    `seri_no.ilike.*${q}*`,
    `servis_no.ilike.*${q}*`,
  ]
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
