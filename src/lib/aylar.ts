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

// Sunucu Vercel'de UTC çalışır; "bugün"ü Türkiye gününe sabitle. Yoksa ay/yıl
// sınırında (gece yarısı-03:00) matris/pano bir ay/yıl geriye kayar.
// ay: 1-12, gun: 1-31, iso: "YYYY-MM-DD".
export function bugunIstanbul(): { yil: number; ay: number; gun: number; iso: string } {
  const iso = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })
  const [yil, ay, gun] = iso.split("-").map(Number)
  return { yil, ay, gun, iso }
}

// Bugünden geriye doğru kayan pencere (varsayılan son 4 ay; sonuncusu güncel ay).
export function sonAylar(adet = 4): AyOgesi[] {
  const { yil: nowY, ay: nowM } = bugunIstanbul() // ay 1-12
  const liste: AyOgesi[] = []
  for (let i = adet - 1; i >= 0; i--) {
    const d = new Date(nowY, nowM - 1 - i, 1)
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
