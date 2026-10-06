// Bağımlılıksız sabitler — hem sunucu (lib/guvenlik) hem proxy kullanır.

// Güvenilir cihaz çerezi: kullanıcı başına "nt_cihaz_<uid12>"
export const CIHAZ_CEREZ_ONEK = "nt_cihaz_"
// Tarayıcılar çerezi en fazla ~400 gün tutar; proxy her istekte yeniler (kayan süre)
export const CEREZ_SANIYE = 400 * 86_400
