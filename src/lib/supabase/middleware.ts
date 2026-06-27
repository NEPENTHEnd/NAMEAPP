import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Her istekte oturumu tazeler ve giriş yapmamış kullanıcıyı /giris'e yönlendirir.
// Korumasız (herkese açık) yollar: /giris ve Next.js iç dosyaları.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ÖNEMLİ: getClaims/getUser arasına başka kod koymayın; oturum buna göre tazelenir.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/giris") ||
    request.nextUrl.pathname.startsWith("/kayit")

  if (!user && !isAuthRoute) {
    // Oturum yoksa giriş sayfasına yönlendir.
    const url = request.nextUrl.clone()
    url.pathname = "/giris"
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    // Zaten giriş yapmışsa giriş sayfasından ana sayfaya gönder.
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
