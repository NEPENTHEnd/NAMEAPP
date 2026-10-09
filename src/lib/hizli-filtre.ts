import { durumRenk, faturaRozetRenk } from "@/components/rozet"

// İş listesi üstündeki HIZLI FİLTRE butonları — her yönetici kendine göre ayarlar
// (Ayarlar → Filtre Butonları). Ayar kullanıcının Supabase user_metadata'sında
// "hizli_filtre" olarak durur; yalnız VARSAYILANDAN farklı olanlar kaydedilir.
//
// Anahtarlar: "durum:<id>", "fatura:<id>", "cikissiz", "musterisiz".
// Varsayılan görünürlük = eski davranış (BAKILMADI + Çıkış tarihi olmayanlar +
// Müşterisiz + fatura durumlarında "Hızlı" işaretli olanlar).
// Varsayılan renk = durumun KENDİ rengi (tablodaki rozetle aynı: Bakılmadı gri,
// Onarıldı yeşil…).

export type HizliAyar = Record<string, { buton?: boolean; renk?: string | null }>

export type HizliOge = {
  anahtar: string
  etiket: string
  tur: "durum" | "fatura" | "ozel"
  id?: string // durum/fatura id
  varsayilanButon: boolean
  varsayilanRenk: string
}

export const OZEL_RENK = { cikissiz: "#0284c7", musterisiz: "#e11d48" } as const

export function hizliOgeler(
  durumlar: { id: string; ad: string; renk: string | null }[],
  faturalar: { id: string; ad: string; renk: string | null; hizli: boolean }[]
): HizliOge[] {
  return [
    ...durumlar.map((d) => ({
      anahtar: `durum:${d.id}`,
      etiket: d.ad,
      tur: "durum" as const,
      id: d.id,
      varsayilanButon: d.ad === "BAKILMADI",
      varsayilanRenk: durumRenk(d.ad, d.renk),
    })),
    {
      anahtar: "cikissiz",
      etiket: "Çıkış tarihi olmayanlar",
      tur: "ozel" as const,
      varsayilanButon: true,
      varsayilanRenk: OZEL_RENK.cikissiz,
    },
    {
      anahtar: "musterisiz",
      etiket: "Müşterisiz",
      tur: "ozel" as const,
      varsayilanButon: true,
      varsayilanRenk: OZEL_RENK.musterisiz,
    },
    ...faturalar.map((f) => ({
      anahtar: `fatura:${f.id}`,
      etiket: f.ad,
      tur: "fatura" as const,
      id: f.id,
      varsayilanButon: f.hizli,
      varsayilanRenk: faturaRozetRenk(f.ad, f.renk),
    })),
  ]
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function cozumle(o: HizliOge, ayar: HizliAyar | null | undefined) {
  const a = ayar?.[o.anahtar]
  return {
    buton: typeof a?.buton === "boolean" ? a.buton : o.varsayilanButon,
    renk: a?.renk && HEX.test(a.renk) ? a.renk : o.varsayilanRenk,
  }
}

// Dışarıdan gelen ayarı doğrula: yalnız bilinen anahtarlar, boolean + #RRGGBB;
// varsayılana eşit değerler kaydedilmez (metadata küçük kalsın).
export function ayarTemizle(ham: unknown, ogeler: HizliOge[]): HizliAyar {
  const sonuc: HizliAyar = {}
  if (!ham || typeof ham !== "object") return sonuc
  const kaynak = ham as Record<string, unknown>
  for (const o of ogeler) {
    const v = kaynak[o.anahtar]
    if (!v || typeof v !== "object") continue
    const { buton, renk } = v as { buton?: unknown; renk?: unknown }
    const kayit: { buton?: boolean; renk?: string } = {}
    if (typeof buton === "boolean" && buton !== o.varsayilanButon) kayit.buton = buton
    if (typeof renk === "string" && HEX.test(renk) && renk.toLowerCase() !== o.varsayilanRenk.toLowerCase())
      kayit.renk = renk.toLowerCase()
    if (Object.keys(kayit).length > 0) sonuc[o.anahtar] = kayit
  }
  return sonuc
}

// Dolu (aktif) buton üzerindeki yazı rengi: açık zeminde koyu, koyu zeminde beyaz
export function ustYaziRengi(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#111827" : "#ffffff"
}
