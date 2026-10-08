"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getYonetici } from "@/lib/auth"
import { epostaGonder, htmlKacis } from "@/lib/eposta"
import { siteKoku } from "@/lib/site"

// Şifre sıfırlama: bağlantı DOĞRUDAN bizim /sifre-yenile sayfamıza gider
// (?token_hash=...&type=recovery → sayfada verifyOtp). Supabase'in "Site URL" /
// yönlendirme ayarına bağlı değildir; e-posta bizim SMTP'mizden Türkçe gider.
// Bağlantı Supabase varsayılanıyla 1 saat geçerli ve tek kullanımlıktır.

export type SifreSonucu =
  | { ok: true; mesaj: string; link?: string; epostaGitti?: boolean }
  | { ok: false; hata: string }

const BEKLEME_MS = 60_000 // aynı hesaba "Şifremi unuttum" en fazla dakikada bir

async function sifirlamaLinki(eposta: string): Promise<string | null> {
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "recovery",
    email: eposta,
  })
  const th = data?.properties?.hashed_token
  if (error || !th) return null
  return `${await siteKoku()}/sifre-yenile?token_hash=${encodeURIComponent(th)}&type=recovery`
}

async function sifirlamaEpostasi(eposta: string, ad: string | null, link: string): Promise<boolean> {
  const selam = ad ? `Merhaba ${ad},` : "Merhaba,"
  const metin =
    `${selam}\n\nName Teknik Servis Takip hesabınız için şifre yenileme istendi.\n` +
    `Yeni şifrenizi belirlemek için bu bağlantıyı açın (1 saat geçerli, bir kez kullanılır):\n${link}\n\n` +
    `Bu isteği siz yapmadıysanız bu e-postayı yok sayın; şifreniz değişmez.\n— Name Teknik`
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
  <h2 style="color:#356854;margin:0 0 12px">Name Teknik Servis Takip</h2>
  <p>${htmlKacis(selam)}</p>
  <p>Hesabınız için şifre yenileme istendi. Yeni şifrenizi belirlemek için:</p>
  <p style="margin:22px 0"><a href="${htmlKacis(link)}" style="background:#356854;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Yeni şifre belirle</a></p>
  <p style="font-size:13px;color:#6b7280">Bağlantı 1 saat geçerlidir ve bir kez kullanılabilir.</p>
  <p style="font-size:12px;color:#9ca3af">Bu isteği siz yapmadıysanız bu e-postayı yok sayın; şifreniz değişmez.</p>
</div>`
  try {
    await epostaGonder({ kime: eposta, konu: "Name Teknik — şifre yenileme", metin, html })
    return true
  } catch {
    return false
  }
}

// Giriş sayfası: "Şifremi unuttum". E-postanın kayıtlı olup olmadığını BELLİ ETMEZ.
export async function sifremiUnuttum(
  _onceki: SifreSonucu | null,
  formData: FormData
): Promise<SifreSonucu> {
  const eposta = String(formData.get("eposta") ?? "").trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(eposta)) {
    return { ok: false, hata: "Geçerli bir e-posta adresi girin." }
  }
  const genel: SifreSonucu = {
    ok: true,
    mesaj:
      "Bu e-posta kayıtlıysa şifre yenileme bağlantısı gönderildi. Gelen kutunuzu (ve gereksiz/spam klasörünü) kontrol edin.",
  }

  const admin = createAdminClient()
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const u = data?.users.find((x) => x.email?.toLowerCase() === eposta)
  if (!u) return genel
  if (u.banned_until && new Date(u.banned_until).getTime() > Date.now()) return genel // erişimi kapalı
  const meta = (u.app_metadata ?? {}) as Record<string, unknown>
  if (Date.now() - Number(meta.sifre_istek ?? 0) < BEKLEME_MS) return genel // art arda istek

  const link = await sifirlamaLinki(eposta)
  if (!link) return genel
  await admin.auth.admin.updateUserById(u.id, {
    app_metadata: { ...meta, sifre_istek: Date.now() },
  })
  const ad = (u.user_metadata as Record<string, unknown> | undefined)?.ad
  await sifirlamaEpostasi(eposta, typeof ad === "string" ? ad : null, link)
  return genel
}

// Ayarlar → Kullanıcılar: yönetici başkasına şifre yenileme bağlantısı gönderir.
// İzin veritabanında (hesap_yonetim_kontrol): personeli her yönetici, yöneticiyi yalnız sahip.
export async function kullaniciSifreSifirla(id: string): Promise<SifreSonucu> {
  await getYonetici()
  const supabase = await createClient()
  const { data: hedef, error } = await supabase.rpc("hesap_yonetim_kontrol", { p_hedef: id })
  if (error) return { ok: false, hata: error.message }
  if (hedef && hedef.aktif === false) {
    return { ok: false, hata: "Bu hesabın erişimi kapalı — önce erişimi açın." }
  }

  const { data: ud } = await createAdminClient().auth.admin.getUserById(id)
  const eposta = ud?.user?.email
  if (!eposta) return { ok: false, hata: "Kullanıcının kayıtlı e-postası yok." }
  const link = await sifirlamaLinki(eposta)
  if (!link) return { ok: false, hata: "Şifre yenileme bağlantısı oluşturulamadı." }
  const gitti = await sifirlamaEpostasi(eposta, hedef?.ad ?? null, link)
  return {
    ok: true,
    epostaGitti: gitti,
    link,
    mesaj: gitti
      ? `Şifre yenileme bağlantısı ${eposta} adresine gönderildi (1 saat geçerli).`
      : "E-posta gönderilemedi. Aşağıdaki bağlantıyı kişiye siz iletin (1 saat geçerli).",
  }
}
