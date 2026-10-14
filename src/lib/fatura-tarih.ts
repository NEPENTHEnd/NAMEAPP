// Fatura TARİHİ olan (= ciroya giren) fatura durumları. Bunlardan biri seçilip fatura
// tarihi boşsa sunucu tarihi otomatik BUGÜN yapar; listede tarih hücresi de yalnız
// bunlarda görünür. Ciro her yerde fatura tarihinin ayına yazılır (Raporlar, matris,
// Pano) — tarihi olmayan işin tutarı hiçbir rapora girmez.
// PEŞİN ALINDI eklendi (kullanıcı isteği, 2026-10-14): peşin tahsilat da ciro sayılır.
export const TARIHLI_FATURA_DURUMLARI = ["FATURA EDİLDİ", "PEŞİN ALINDI"]

export function faturaTarihliDurum(ad: string | null | undefined): boolean {
  return !!ad && TARIHLI_FATURA_DURUMLARI.includes(ad.toLocaleUpperCase("tr-TR"))
}
