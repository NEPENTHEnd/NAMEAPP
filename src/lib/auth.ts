import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export type Rol = "teknisyen" | "yonetici"

export type Kullanici = {
  id: string
  eposta: string | null
  ad: string | null
  rol: Rol
  sahip: boolean
  aktif: boolean // false = erişimi kapatıldı (layout "erişim kapalı" ekranı gösterir)
  hizliFiltre: unknown // kişisel hızlı filtre buton ayarı (user_metadata.hizli_filtre)
}

// Giriş yapan kullanıcıyı + profilini döndürür. Oturum yoksa /giris'e atar.
// Sayfa/layout'larda savunma amaçlı (middleware'e ek) kullanılır.
export async function getKullanici(): Promise<Kullanici> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/giris")
  }

  const { data: profil } = await supabase
    .from("kullanici_profil")
    .select("ad, rol, sahip, aktif")
    .eq("id", user.id)
    .maybeSingle()

  return {
    id: user.id,
    eposta: user.email ?? null,
    ad: profil?.ad ?? null,
    rol: (profil?.rol as Rol) ?? "teknisyen",
    sahip: profil?.sahip ?? false,
    aktif: profil?.aktif ?? true,
    hizliFiltre: (user.user_metadata as Record<string, unknown> | undefined)?.hizli_filtre ?? null,
  }
}

// Yönetici e-posta doğrulaması açıksa bu oturum doğrulanmış olmalı (0027).
// (RPC yoksa/hata verirse uygulama katmanı geçer; asıl zorunluluk veritabanında,
// yonetici_mi() içinde.)
async function yoneticiOturumuGecerli(): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc("oturum_durumu")
  const d = Array.isArray(data) ? data[0] : data
  return !d?.o_zorunlu || !!d?.o_dogrulandi
}

// Yalnız yöneticilere açık sayfalar/eylemler için. Teknisyeni, erişimi kapatılmış
// hesabı ya da doğrulanmamış yönetici oturumunu ana sayfaya atar (orada güvenlik
// penceresi çıkar). Servis anahtarı kullanan eylemler de bundan geçer.
export async function getYonetici(): Promise<Kullanici> {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici" || !kullanici.aktif) {
    redirect("/")
  }
  if (!(await yoneticiOturumuGecerli())) {
    redirect("/")
  }
  return kullanici
}

// Route handler'lar için (yönlendirme yerine 403 döndürmek isteyenler)
export async function yoneticiYetkili(): Promise<boolean> {
  const k = await getKullanici()
  return k.rol === "yonetici" && k.aktif && (await yoneticiOturumuGecerli())
}
