"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getYonetici } from "@/lib/auth"
import { epostaGonder, htmlKacis } from "@/lib/eposta"
import { siteKoku } from "@/lib/site"

// Web'den kullanıcı yönetimi. İZİN KURALLARI VERİTABANINDA (0026): her eylem önce
// kullanıcı oturumuyla bir RPC çağırır — yetkisizse orada hata döner. Servis anahtarı
// (Auth API: giriş engeli / silme) ancak o kontrol geçtikten sonra kullanılır.

export type IslemSonucu =
  | { ok: true; mesaj: string; link?: string; epostaGitti?: boolean }
  | { ok: false; hata: string }

const rolAd = (r: string) => (r === "yonetici" ? "Yönetici" : "Personel")
const BAN_SURESI = "876000h" // ~100 yıl = süresiz giriş engeli

async function davetEpostasiGonder(o: {
  ad: string
  eposta: string
  rol: string
  kod: string
}): Promise<{ link: string; gitti: boolean }> {
  const link = `${await siteKoku()}/kayit?kod=${encodeURIComponent(o.kod)}`
  const metin =
    `Merhaba ${o.ad},\n\n` +
    `Name Teknik Servis Takip sistemine ${rolAd(o.rol)} olarak davet edildiniz.\n\n` +
    `Hesabınızı oluşturmak ve kendi şifrenizi belirlemek için bu bağlantıyı açın:\n${link}\n\n` +
    `Davet kodu: ${o.kod}\n` +
    `Bu davet yalnızca ${o.eposta} adresiyle ve bir kez kullanılabilir.\n\n` +
    `Bu daveti beklemiyorsanız bu e-postayı yok sayabilirsiniz.\n— Name Teknik`
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
  <h2 style="color:#356854;margin:0 0 12px">Name Teknik Servis Takip</h2>
  <p>Merhaba <strong>${htmlKacis(o.ad)}</strong>,</p>
  <p>Sisteme <strong>${rolAd(o.rol)}</strong> olarak davet edildiniz. Hesabınızı oluşturmak ve kendi şifrenizi belirlemek için:</p>
  <p style="margin:22px 0"><a href="${htmlKacis(link)}" style="background:#356854;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Hesabımı oluştur</a></p>
  <p style="font-size:13px;color:#6b7280">Davet kodu: <code>${htmlKacis(o.kod)}</code><br>Bu davet yalnızca ${htmlKacis(o.eposta)} adresiyle ve bir kez kullanılabilir.</p>
  <p style="font-size:12px;color:#9ca3af">Bu daveti beklemiyorsanız bu e-postayı yok sayabilirsiniz.</p>
</div>`
  try {
    await epostaGonder({
      kime: o.eposta,
      konu: "Name Teknik Servis Takip — davetiniz",
      metin,
      html,
    })
    return { link, gitti: true }
  } catch {
    return { link, gitti: false }
  }
}

// useActionState ile kullanılır (form)
export async function kullaniciDavetEt(
  _onceki: IslemSonucu | null,
  formData: FormData
): Promise<IslemSonucu> {
  await getYonetici()
  const ad = String(formData.get("ad") ?? "").trim()
  const eposta = String(formData.get("eposta") ?? "").trim().toLowerCase()
  const rol = String(formData.get("rol") ?? "teknisyen")

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("davet_olustur", {
    p_ad: ad,
    p_eposta: eposta,
    p_rol: rol,
  })
  if (error) return { ok: false, hata: error.message }
  const satir = Array.isArray(data) ? data[0] : data
  if (!satir?.o_kod) return { ok: false, hata: "Davet oluşturulamadı." }

  const { link, gitti } = await davetEpostasiGonder({ ad, eposta, rol, kod: satir.o_kod })
  revalidatePath("/tanimlar")
  return {
    ok: true,
    epostaGitti: gitti,
    link,
    mesaj: gitti
      ? `Davet ${eposta} adresine gönderildi.`
      : "Davet oluşturuldu ama e-posta gönderilemedi. Aşağıdaki bağlantıyı kişiye siz iletin.",
  }
}

export async function davetYenidenGonder(id: string): Promise<IslemSonucu> {
  const ben = await getYonetici()
  const supabase = await createClient()
  const { data: d } = await supabase
    .from("davet_kisi")
    .select("ad, eposta, rol, kod, aktif, kullanildi")
    .eq("id", id)
    .maybeSingle()
  if (!d || !d.eposta || !d.kod || !d.aktif || d.kullanildi) {
    return { ok: false, hata: "Davet bulunamadı." }
  }
  if (d.rol === "yonetici" && !ben.sahip) {
    return { ok: false, hata: "Yönetici davetini yalnız sahip gönderebilir." }
  }
  const { link, gitti } = await davetEpostasiGonder({
    ad: d.ad,
    eposta: d.eposta,
    rol: d.rol,
    kod: d.kod,
  })
  return gitti
    ? { ok: true, epostaGitti: true, link, mesaj: `Davet ${d.eposta} adresine yeniden gönderildi.` }
    : { ok: false, hata: "E-posta gönderilemedi. Bağlantıyı kopyalayıp kişiye iletin." }
}

export async function davetIptalEt(id: string): Promise<IslemSonucu> {
  await getYonetici()
  const supabase = await createClient()
  const { error } = await supabase.rpc("davet_iptal", { p_id: id })
  if (error) return { ok: false, hata: error.message }
  revalidatePath("/tanimlar")
  return { ok: true, mesaj: "Davet iptal edildi." }
}

export async function kullaniciRolDegistir(id: string, rol: string): Promise<IslemSonucu> {
  await getYonetici()
  const supabase = await createClient()
  const { error } = await supabase.rpc("kullanici_rol_ayarla", { p_hedef: id, p_rol: rol })
  if (error) return { ok: false, hata: error.message }
  revalidatePath("/tanimlar")
  return { ok: true, mesaj: `Rol ${rolAd(rol)} olarak güncellendi.` }
}

// Erişimi kapat: giriş engellenir, geçmiş işler ve adı korunur, geri açılabilir.
export async function kullaniciErisimKapat(id: string): Promise<IslemSonucu> {
  await getYonetici()
  const supabase = await createClient()
  const { error } = await supabase.rpc("kullanici_erisim_ayarla", {
    p_hedef: id,
    p_aktif: false,
  })
  if (error) return { ok: false, hata: error.message }
  // İzin geçti → Auth seviyesinde de girişi/oturum yenilemeyi engelle
  const { error: banHata } = await createAdminClient().auth.admin.updateUserById(id, {
    ban_duration: BAN_SURESI,
  })
  revalidatePath("/tanimlar")
  if (banHata) {
    return {
      ok: true,
      mesaj: "Erişim kapatıldı (uygulama kilitli), ancak giriş engeli uygulanamadı: " + banHata.message,
    }
  }
  return { ok: true, mesaj: "Erişim kapatıldı." }
}

export async function kullaniciErisimAc(id: string): Promise<IslemSonucu> {
  await getYonetici()
  const supabase = await createClient()
  const { error } = await supabase.rpc("kullanici_erisim_ayarla", {
    p_hedef: id,
    p_aktif: true,
  })
  if (error) return { ok: false, hata: error.message }
  const { error: banHata } = await createAdminClient().auth.admin.updateUserById(id, {
    ban_duration: "none",
  })
  revalidatePath("/tanimlar")
  if (banHata) return { ok: false, hata: "Giriş engeli kaldırılamadı: " + banHata.message }
  return { ok: true, mesaj: "Erişim yeniden açıldı." }
}

// Kalıcı silme: yalnız hiç iş kaydı olmayan hesaplar (test/yanlış açılmış).
export async function kullaniciKaliciSil(id: string): Promise<IslemSonucu> {
  await getYonetici()
  const supabase = await createClient()
  const { error: kontrolHata } = await supabase.rpc("kullanici_silme_kontrol", { p_hedef: id })
  if (kontrolHata) return { ok: false, hata: kontrolHata.message }
  // davet kodunu ve bildirim aboneliğini kapat (profil silinmeden önce)
  await supabase.rpc("kullanici_erisim_ayarla", { p_hedef: id, p_aktif: false })
  const { error } = await createAdminClient().auth.admin.deleteUser(id)
  revalidatePath("/tanimlar")
  if (error) return { ok: false, hata: "Hesap silinemedi: " + error.message }
  return { ok: true, mesaj: "Hesap kalıcı olarak silindi." }
}
