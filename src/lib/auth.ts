import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export type Rol = "teknisyen" | "yonetici"

export type Kullanici = {
  id: string
  eposta: string | null
  ad: string | null
  rol: Rol
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
    .select("ad, rol")
    .eq("id", user.id)
    .maybeSingle()

  return {
    id: user.id,
    eposta: user.email ?? null,
    ad: profil?.ad ?? null,
    rol: (profil?.rol as Rol) ?? "teknisyen",
  }
}

// Yalnız yöneticilere açık sayfalar için. Teknisyeni ana sayfaya atar.
export async function getYonetici(): Promise<Kullanici> {
  const kullanici = await getKullanici()
  if (kullanici.rol !== "yonetici") {
    redirect("/")
  }
  return kullanici
}
