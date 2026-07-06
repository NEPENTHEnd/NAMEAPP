import { NextResponse } from "next/server"

import { raporMailGonder } from "@/lib/rapor-mail"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Vercel Cron her hafta tetikler (vercel.json). Haftalık Excel raporunu
// rapor@nameteknik.com'dan seçili adreslere gönderir.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return new NextResponse("CRON_SECRET tanımlı değil.", { status: 500 })
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return new NextResponse("Yetkisiz.", { status: 401 })

  try {
    const r = await raporMailGonder("haftalik")
    if (!r.ok) return new NextResponse(r.hata ?? "Gönderilemedi", { status: 500 })
    return NextResponse.json(r)
  } catch (e) {
    return new NextResponse("Hata: " + (e as Error).message, { status: 500 })
  }
}
