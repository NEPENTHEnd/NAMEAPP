import { type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

// Next.js 16 "proxy" konvansiyonu (eski adıyla middleware).
// Her istekte Supabase oturumunu tazeler ve yetki yönlendirmesini yapar.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Aşağıdakiler hariç tüm yolları eşle:
     * - _next/static, _next/image (Next.js iç dosyaları)
     * - api (cron/route handler'lar kendi yetkisini yönetir)
     * - favicon.ico, manifest.webmanifest (PWA), sw.js (service worker), görsel uzantıları
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
