"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

import { getKullanici, type Kullanici } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { epostaGonder, htmlKacis } from "@/lib/eposta"
import {
  GUVEN_GUN,
  KOD_DAKIKA,
  MAKS_DENEME,
  TEKRAR_SANIYE,
  SAATLIK_MAKS_GONDERIM,
  cihazCerezAdi,
  cihazAdi,
  epostaMaskele,
  guvenilirCihaz,
  hashEsit,
  kodHash,
  oturumDurumu,
  oturumuIsaretle,
  sha256,
  yeniCihazToken,
  yeniKod,
} from "@/lib/guvenlik"

export type DogrulamaSonucu =
  | { ok: true; mesaj: string; bekle?: number }
  | { ok: false; hata: string; bekle?: number }

// Doğrulama eylemleri getYonetici() KULLANMAZ (o, doğrulanmış oturum ister) —
// yalnız profil düzeyinde aktif yönetici olmak yeterli.
async function yoneticiProfil(): Promise<Kullanici | null> {
  const k = await getKullanici()
  return k.rol === "yonetici" && k.aktif ? k : null
}

export async function dogrulamaKoduGonder(): Promise<DogrulamaSonucu> {
  const k = await yoneticiProfil()
  if (!k) return { ok: false, hata: "Yetkisiz işlem." }
  if (!k.eposta) return { ok: false, hata: "Hesabınızda kayıtlı e-posta yok." }

  const admin = createAdminClient()
  const simdi = Date.now()
  const { data: mevcut } = await admin
    .from("dogrulama_kodu")
    .select("son_gonderim, ilk_gonderim, gonderim_sayisi")
    .eq("user_id", k.id)
    .maybeSingle()

  let sayi = 1
  let ilk = new Date(simdi).toISOString()
  if (mevcut) {
    const gecen = (simdi - new Date(mevcut.son_gonderim).getTime()) / 1000
    if (gecen < TEKRAR_SANIYE) {
      const bekle = Math.ceil(TEKRAR_SANIYE - gecen)
      return { ok: false, hata: `Yeni kodu ${bekle} sn sonra isteyebilirsiniz.`, bekle }
    }
    if (simdi - new Date(mevcut.ilk_gonderim).getTime() < 3_600_000) {
      if (mevcut.gonderim_sayisi >= SAATLIK_MAKS_GONDERIM) {
        return { ok: false, hata: "Çok fazla kod istendi. Lütfen 1 saat sonra tekrar deneyin." }
      }
      sayi = mevcut.gonderim_sayisi + 1
      ilk = mevcut.ilk_gonderim
    }
  }

  const kod = yeniKod()
  const { error } = await admin.from("dogrulama_kodu").upsert(
    {
      user_id: k.id,
      kod_hash: kodHash(k.id, kod),
      son_gecerlilik: new Date(simdi + KOD_DAKIKA * 60_000).toISOString(),
      deneme: 0,
      gonderim_sayisi: sayi,
      ilk_gonderim: ilk,
      son_gonderim: new Date(simdi).toISOString(),
    },
    { onConflict: "user_id" }
  )
  if (error) return { ok: false, hata: "Kod oluşturulamadı. Lütfen tekrar deneyin." }

  const cihaz = await cihazAdi()
  const saat = new Date(simdi).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })
  const metin =
    `Name Teknik yönetici doğrulama kodunuz: ${kod}\n\n` +
    `${KOD_DAKIKA} dakika geçerlidir. İstek: ${saat} · ${cihaz}\n` +
    `Doğrulanan cihazda ${GUVEN_GUN} gün boyunca tekrar kod sorulmaz.\n\n` +
    `Bu girişi siz yapmadıysanız kodu kimseyle paylaşmayın, şifrenizi değiştirin ve hemen sahibe bildirin.\n— Name Teknik`
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#1f2937">
  <h2 style="color:#356854;margin:0 0 12px">Name Teknik — yönetici doğrulama</h2>
  <p>Doğrulama kodunuz:</p>
  <p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:10px 0 18px">${kod}</p>
  <p style="font-size:13px;color:#6b7280">${KOD_DAKIKA} dakika geçerlidir. İstek: ${htmlKacis(saat)} · ${htmlKacis(cihaz)}<br>
  Doğrulanan cihazda ${GUVEN_GUN} gün boyunca tekrar kod sorulmaz.</p>
  <p style="font-size:12px;color:#b91c1c">Bu girişi siz yapmadıysanız kodu kimseyle paylaşmayın, şifrenizi değiştirin ve hemen sahibe bildirin.</p>
</div>`
  try {
    await epostaGonder({ kime: k.eposta, konu: `Name Teknik doğrulama kodu: ${kod}`, metin, html })
  } catch {
    return {
      ok: false,
      hata: "Doğrulama e-postası gönderilemedi. Lütfen biraz sonra tekrar deneyin ya da sahibe bildirin.",
    }
  }
  return {
    ok: true,
    mesaj: `Kod ${epostaMaskele(k.eposta)} adresine gönderildi (${KOD_DAKIKA} dk geçerli).`,
    bekle: TEKRAR_SANIYE,
  }
}

export async function dogrulamaKoduKontrol(kodHam: string): Promise<DogrulamaSonucu> {
  const k = await yoneticiProfil()
  if (!k) return { ok: false, hata: "Yetkisiz işlem." }
  const kod = String(kodHam ?? "").replace(/\D/g, "")
  if (kod.length !== 6) return { ok: false, hata: "6 haneli kodu girin." }

  const admin = createAdminClient()
  const { data: r } = await admin
    .from("dogrulama_kodu")
    .select("kod_hash, son_gecerlilik, deneme")
    .eq("user_id", k.id)
    .maybeSingle()
  if (!r) return { ok: false, hata: "Önce doğrulama kodu isteyin." }
  if (new Date(r.son_gecerlilik).getTime() < Date.now()) {
    return { ok: false, hata: "Kodun süresi doldu. Yeni kod isteyin." }
  }
  if (r.deneme >= MAKS_DENEME) {
    return { ok: false, hata: "Çok fazla hatalı deneme. Yeni kod isteyin." }
  }
  if (!hashEsit(r.kod_hash, kodHash(k.id, kod))) {
    const kalan = MAKS_DENEME - (r.deneme + 1)
    await admin.from("dogrulama_kodu").update({ deneme: r.deneme + 1 }).eq("user_id", k.id)
    return {
      ok: false,
      hata: kalan > 0 ? `Kod hatalı. ${kalan} deneme hakkınız kaldı.` : "Çok fazla hatalı deneme. Yeni kod isteyin.",
    }
  }

  // Doğru kod → bu cihazı 60 gün güvenilir yap + bu oturumu işaretle
  const d = await oturumDurumu()
  if (!d.sessionId) return { ok: false, hata: "Oturum bulunamadı. Çıkış yapıp tekrar girin." }
  const gecerlilik = new Date(Date.now() + GUVEN_GUN * 86_400_000).toISOString()
  const token = yeniCihazToken()
  const { error: cihazHata } = await admin.from("guvenilir_cihaz").insert({
    user_id: k.id,
    token_hash: sha256(token),
    cihaz: await cihazAdi(),
    gecerlilik,
    son_kullanim: new Date().toISOString(),
  })
  if (cihazHata) return { ok: false, hata: "Cihaz kaydedilemedi. Lütfen tekrar deneyin." }
  if (!(await oturumuIsaretle(d.sessionId, k.id, gecerlilik))) {
    return { ok: false, hata: "Oturum doğrulanamadı. Lütfen tekrar deneyin." }
  }
  await admin.from("dogrulama_kodu").delete().eq("user_id", k.id)
  ;(await cookies()).set(cihazCerezAdi(k.id), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUVEN_GUN * 86_400,
  })
  revalidatePath("/", "layout")
  return { ok: true, mesaj: `Cihaz doğrulandı. ${GUVEN_GUN} gün boyunca bu cihazda tekrar sorulmayacak.` }
}

// /giris'ten hemen sonra çağrılır: güvenilir cihazdaysa yeni oturumu işaretle ki ilk
// ekran (layout ile sayfanın paralel sorguları) yarışmasın. Hata olsa da girişi bozmaz.
export async function girisSonrasiDogrula(): Promise<void> {
  try {
    const k = await yoneticiProfil()
    if (!k) return
    const d = await oturumDurumu()
    if (!d.zorunlu || d.dogrulandi || !d.sessionId) return
    const c = await guvenilirCihaz(k.id)
    if (c) await oturumuIsaretle(d.sessionId, k.id, c.gecerlilik)
  } catch {
    // layout zaten yedek olarak kontrol eder
  }
}

// Sahip: bayrağı aç/kapa. Veritabanı, bu oturumun doğrulanmış olmasını şart koşar.
export async function guvenlikAyarla(acik: boolean): Promise<DogrulamaSonucu> {
  const k = await getKullanici()
  if (!k.sahip || !k.aktif) return { ok: false, hata: "Bu ayarı yalnız sahip değiştirebilir." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("guvenlik_ayarla", { p_acik: acik })
  if (error) return { ok: false, hata: error.message }
  revalidatePath("/", "layout")
  return {
    ok: true,
    mesaj: acik
      ? "Yönetici e-posta doğrulaması açıldı. Diğer yöneticilere bir sonraki girişlerinde kod sorulacak."
      : "Yönetici e-posta doğrulaması kapatıldı.",
  }
}
