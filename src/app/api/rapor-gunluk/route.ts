import { NextResponse } from "next/server"

import { raporMailGonder } from "@/lib/rapor-mail"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Vercel Cron her gün tetikler (vercel.json). Günlük Excel yedeğini
// rapor@nameteknik.com'dan yedek@nameteknik.com'a gönderir.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return new NextResponse("CRON_SECRET tanımlı değil.", { status: 500 })
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return new NextResponse("Yetkisiz.", { status: 401 })

  try {
    const r = await raporMailGonder("gunluk")
    if (!r.ok) return new NextResponse(r.hata ?? "Gönderilemedi", { status: 500 })
    return NextResponse.json(r)
  } catch (e) {
    return new NextResponse("Hata: " + (e as Error).message, { status: 500 })
  }
}
