import { headers } from "next/headers"

// SADECE SUNUCU. E-postalardaki bağlantılar için sitenin kök adresi
// (Vercel'de gelen isteğin host'u; bulunamazsa canlı alan adı).
export async function siteKoku(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  return host ? `${proto}://${host}` : "https://nameteknik.com"
}
