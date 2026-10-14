// Fiş no ELLE düzeltme kuralı — hem sunucu (isHucreGuncelle) hem ekran kullanır.
//
// Normalde fiş no sunucunun ürettiği otomatik numaradır ve değiştirilemez. İstisnalar:
//  * BOYTEKS: "Firma Stok Kodu" zaten elle girilen bir alan → her zaman düzenlenebilir.
//  * TEMMUZ 2026: ağustosta Excel'den admin(sahip) hesabıyla içe aktarılan, geliş
//    tarihi temmuz olan işlerin fiş numaraları Excel'den karışık geldi ("-", "9717"…);
//    yalnız bunlar yönetici tarafından elle düzeltilebilir (kullanıcı isteği, 2026-10-14).
export const FIS_DUZELTME_AYI = "2026-07"

export function fisElleDuzeltilebilir(o: {
  gelisTarihi: string | null
  olusturanSahip: boolean
  boyteks: boolean
}): boolean {
  if (o.boyteks) return true
  return !!o.gelisTarihi?.startsWith(FIS_DUZELTME_AYI) && o.olusturanSahip
}
