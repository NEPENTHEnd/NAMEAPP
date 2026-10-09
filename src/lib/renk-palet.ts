// Ayarlar ekranlarının (Müşteriler, Firmalar) ortak renk yardımcıları.

// Ad → sabit renk (aynı firma/müşteri hep aynı renkte; göz alışır)
const PALET = ["#2563eb", "#0891b2", "#059669", "#65a30d", "#d97706", "#dc2626", "#db2777", "#7c3aed", "#4f46e5", "#0d9488"]

export function renkSec(s: string): string {
  let h = 0
  for (const ch of s) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return PALET[h % PALET.length]
}

export function basHarf(ad: string): string {
  const k = ad.trim().split(/\s+/)
  return ((k[0]?.[0] ?? "") + (k[1]?.[0] ?? "")).toLocaleUpperCase("tr-TR") || "?"
}

// İş sayısı rozeti: büyüklüğe göre renk — büyük müşteri/firma bir bakışta ayrılsın
export function isRozeti(n: number): { renk: string; metin: string } {
  if (n === 0) return { renk: "#94a3b8", metin: "iş yok" }
  if (n < 5) return { renk: "#0ea5e9", metin: `${n} iş` }
  if (n < 20) return { renk: "#10b981", metin: `${n} iş` }
  if (n < 50) return { renk: "#f59e0b", metin: `${n} iş` }
  return { renk: "#8b5cf6", metin: `${n} iş` }
}
