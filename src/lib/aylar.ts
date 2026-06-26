const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
]

export type AyOgesi = {
  key: string // "YYYY-MM"
  label: string // "Haziran"
  yil: number
  guncel: boolean
}

// Bugünden geriye doğru kayan pencere (varsayılan son 4 ay; sonuncusu güncel ay).
export function sonAylar(adet = 4): AyOgesi[] {
  const now = new Date()
  const liste: AyOgesi[] = []
  for (let i = adet - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ay = d.getMonth()
    const key = `${d.getFullYear()}-${String(ay + 1).padStart(2, "0")}`
    liste.push({ key, label: AY_ADLARI[ay], yil: d.getFullYear(), guncel: i === 0 })
  }
  return liste
}

// "YYYY-MM" -> o ayın ilk/son günü (gelis_tarihi filtresi için)
export function ayAraligi(key: string): { baslangic: string; bitis: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key)
  if (!m) return null
  const yil = Number(m[1])
  const ay = Number(m[2])
  const sonGun = new Date(yil, ay, 0).getDate()
  return {
    baslangic: `${key}-01`,
    bitis: `${key}-${String(sonGun).padStart(2, "0")}`,
  }
}
