import { NextResponse } from "next/server"
import { Resend } from "resend"

import { createAdminClient } from "@/lib/supabase/admin"
import { raporExcelBuffer, RAPOR_SELECT, type RaporSatir } from "@/lib/rapor-excel"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Vercel Cron her ay 1'inde tetikler (vercel.json). Tüm iş kayıtlarının
// Excel dökümünü seçili e-posta adreslerine yedek olarak gönderir.
export async function GET(request: Request) {
  // Güvenlik: yalnız Vercel Cron (Authorization: Bearer <CRON_SECRET>) çalıştırabilir.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return new NextResponse("CRON_SECRET tanımlı değil.", { status: 500 })
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Yetkisiz.", { status: 401 })
  }

  const gonderen = process.env.RAPOR_GONDEREN
  const apiKey = process.env.RESEND_API_KEY
  const alicilar = (process.env.RAPOR_ALICILAR ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (!apiKey || !gonderen || alicilar.length === 0) {
    return new NextResponse(
      "Eksik yapılandırma: RESEND_API_KEY / RAPOR_GONDEREN / RAPOR_ALICILAR",
      { status: 500 }
    )
  }

  // Tüm veriyi servis-rolü ile oku (RLS dışı).
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("is_kaydi")
    .select(RAPOR_SELECT)
    .order("gelis_tarihi", { ascending: false })
    .range(0, 99999)
  if (error) {
    return new NextResponse("Veri alınamadı: " + error.message, { status: 500 })
  }

  const satirlar = (data ?? []) as unknown as RaporSatir[]
  const buffer = await raporExcelBuffer(satirlar)
  const bugun = new Date().toISOString().slice(0, 10)
  const dosyaAdi = `name-teknik-yedek-${bugun}.xlsx`

  const resend = new Resend(apiKey)
  const { error: mailErr } = await resend.emails.send({
    from: gonderen,
    to: alicilar,
    subject: `Name Teknik — Aylık Yedek (${bugun})`,
    text: `Ekte tüm iş kayıtlarının güncel Excel dökümü bulunuyor.\nToplam kayıt: ${satirlar.length}\n\nBu e-posta her ay otomatik gönderilir.`,
    attachments: [{ filename: dosyaAdi, content: buffer }],
  })
  if (mailErr) {
    return new NextResponse("Mail gönderilemedi: " + JSON.stringify(mailErr), {
      status: 500,
    })
  }

  return NextResponse.json({ ok: true, kayit: satirlar.length, alicilar })
}
