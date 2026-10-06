import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto"
import { cookies, headers } from "next/headers"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Kullanici } from "@/lib/auth"
import { CIHAZ_CEREZ_ONEK } from "@/lib/guvenlik-sabit"

// SADECE SUNUCU. Yönetici e-posta doğrulaması (0027): cihaz başına BİR KEZ, süresiz.
// Kod / cihaz / oturum tabloları RLS'de kapalı → yalnız servis rolüyle erişilir.

// Doğrulanan cihaz süresiz güvenilir: DB kaydı ~100 yıl. Tarayıcılar çerezi en fazla
// ~400 gün tutar; proxy her istekte çerezi yeniler (kayan süre) → kullanılan cihazda
// pratikte bir daha hiç sorulmaz.
export const CIHAZ_GECERLILIK_MS = 100 * 365 * 86_400_000
export { CEREZ_SANIYE, CIHAZ_CEREZ_ONEK } from "@/lib/guvenlik-sabit"
export const KOD_DAKIKA = 10 // e-postadaki kodun geçerlilik süresi
export const MAKS_DENEME = 5 // kod başına hatalı deneme hakkı
export const TEKRAR_SANIYE = 60 // yeni kod isteme bekleme süresi
export const SAATLIK_MAKS_GONDERIM = 5 // saatte en fazla kod e-postası

// Kullanıcı başına ayrı çerez: aynı tarayıcıyı paylaşan iki yönetici birbirini ezmesin
export const cihazCerezAdi = (userId: string) =>
  `${CIHAZ_CEREZ_ONEK}${userId.replace(/-/g, "").slice(0, 12)}`

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

function hmacAnahtar(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY tanımlı değil.")
  return k
}
// Kod veritabanında düz durmaz: kullanıcıya bağlı HMAC
export const kodHash = (userId: string, kod: string) =>
  createHmac("sha256", hmacAnahtar()).update(`${userId}:${kod}`).digest("hex")

export function hashEsit(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex")
  const y = Buffer.from(b, "hex")
  return x.length === y.length && timingSafeEqual(x, y)
}

export const yeniKod = () => randomInt(0, 1_000_000).toString().padStart(6, "0")
export const yeniCihazToken = () => randomBytes(32).toString("base64url")

export function epostaMaskele(e: string | null): string {
  if (!e) return "e-posta adresiniz"
  const [ad, alan] = e.split("@")
  if (!alan) return e
  const goster = ad.slice(0, Math.min(2, ad.length))
  return `${goster}${"*".repeat(Math.max(2, ad.length - goster.length))}@${alan}`
}

// Bildirim e-postası ve cihaz listesi için kaba cihaz özeti
export async function cihazAdi(): Promise<string> {
  const ua = (await headers()).get("user-agent") ?? ""
  const sistem = /iPhone|iPad/.test(ua)
    ? "iPhone/iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "Bilinmeyen sistem"
  const tarayici = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Tarayıcı"
  return `${tarayici} · ${sistem}`
}

export type OturumDurumu = {
  sessionId: string | null
  zorunlu: boolean // bayrak açık mı
  dogrulandi: boolean // bu oturum doğrulanmış mı
  profilYonetici: boolean
  profilSahip: boolean
}

// Veritabanının gördüğü oturum (JWT session_id) + bayrak + doğrulama — tek sorgu
export async function oturumDurumu(): Promise<OturumDurumu> {
  const supabase = await createClient()
  const { data } = await supabase.rpc("oturum_durumu")
  const d = Array.isArray(data) ? data[0] : data
  return {
    sessionId: d?.o_session_id ?? null,
    zorunlu: !!d?.o_zorunlu,
    dogrulandi: !!d?.o_dogrulandi,
    profilYonetici: !!d?.o_profil_yonetici,
    profilSahip: !!d?.o_profil_sahip,
  }
}

export async function oturumuIsaretle(
  sessionId: string,
  userId: string,
  gecerlilik: string
): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("dogrulanmis_oturum")
    .upsert({ session_id: sessionId, user_id: userId, gecerlilik }, { onConflict: "session_id" })
  return !error
}

// Bu tarayıcı, bu kullanıcı için hâlâ güvenilir mi? (çerez → hash → kayıt)
export async function guvenilirCihaz(
  userId: string
): Promise<{ id: string; gecerlilik: string } | null> {
  const token = (await cookies()).get(cihazCerezAdi(userId))?.value
  if (!token) return null
  const { data } = await createAdminClient()
    .from("guvenilir_cihaz")
    .select("id, gecerlilik")
    .eq("user_id", userId)
    .eq("token_hash", sha256(token))
    .gt("gecerlilik", new Date().toISOString())
    .maybeSingle()
  return data ?? null
}

export type GuvenlikSonucu =
  | { durum: "serbest" }
  | { durum: "isaretlendi" } // güvenilir cihaz: oturum şimdi işaretlendi → sayfayı yenile
  | { durum: "dogrulama_gerekli"; epostaMaskeli: string }

// Layout için: bu yönetici bu oturumda içeri alınabilir mi?
export async function guvenlikKontrol(k: Kullanici): Promise<GuvenlikSonucu> {
  if (k.rol !== "yonetici" || !k.aktif) return { durum: "serbest" }
  const d = await oturumDurumu()
  if (!d.zorunlu || d.dogrulandi) return { durum: "serbest" }
  if (d.sessionId) {
    const c = await guvenilirCihaz(k.id)
    if (c && (await oturumuIsaretle(d.sessionId, k.id, c.gecerlilik))) {
      await createAdminClient()
        .from("guvenilir_cihaz")
        .update({ son_kullanim: new Date().toISOString() })
        .eq("id", c.id)
      // Veritabanı artık bu oturumu doğrulanmış görüyor mu? Görmüyorsa yenileme
      // döngüsüne girme — doğrulama penceresine düş.
      if ((await oturumDurumu()).dogrulandi) return { durum: "isaretlendi" }
    }
  }
  return { durum: "dogrulama_gerekli", epostaMaskeli: epostaMaskele(k.eposta) }
}
