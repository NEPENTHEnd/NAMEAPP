import nodemailer from "nodemailer"

import { createAdminClient } from "@/lib/supabase/admin"
import { raporExcelBuffer, RAPOR_SELECT, type RaporSatir } from "@/lib/rapor-excel"

// Tüm iş kayıtlarını çekip stilli Excel üretir (rapor + yedek maili için ortak).
async function raporExceliUret(): Promise<{ buffer: Buffer; adet: number }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("is_kaydi")
    .select(RAPOR_SELECT)
    .order("gelis_tarihi", { ascending: false })
    .range(0, 99999)
  if (error) throw new Error("Veri alınamadı: " + error.message)
  const satirlar = (data ?? []) as unknown as RaporSatir[]
  const buffer = await raporExcelBuffer(satirlar)
  return { buffer, adet: satirlar.length }
}

// Tüm tabloların tam kopyası (JSON) — günlük yedek maili eki; geri yüklenebilir.
const YEDEK_TABLOLARI = [
  "is_kaydi", "foto", "musteri", "grup", "sube", "durum", "fatura_durumu",
  "teknik_personel", "kullanici_profil", "davet_kodu", "davet_kisi",
  "fis_sayac", "firma_hedef", "push_abonelik",
]
async function tumVeriYedekJson(): Promise<Buffer> {
  const supabase = createAdminClient()
  const paket: Record<string, unknown> = {
    _meta: { tarih: new Date().toISOString() },
  }
  for (const t of YEDEK_TABLOLARI) {
    const { data } = await supabase.from(t as never).select("*").range(0, 99999)
    paket[t] = data ?? []
  }
  return Buffer.from(JSON.stringify(paket), "utf-8")
}

function aliciListesi(env: string | undefined): string[] {
  return (env ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

// Kendi mail sunucunuzdan (rapor@nameteknik.com) SMTP ile gönderim.
function transporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || "587")
  if (!host) throw new Error("SMTP_HOST tanımlı değil")
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

export type MailTip = "gunluk" | "haftalik"

export async function raporMailGonder(
  tip: MailTip
): Promise<{ ok: boolean; kayit: number; alicilar: string[]; hata?: string }> {
  const gonderen =
    process.env.RAPOR_GONDEREN || process.env.SMTP_USER || ""
  const alicilar =
    tip === "gunluk"
      ? aliciListesi(process.env.RAPOR_GUNLUK_ALICILAR)
      : aliciListesi(process.env.RAPOR_HAFTALIK_ALICILAR)

  if (!gonderen || alicilar.length === 0 || !process.env.SMTP_HOST) {
    return {
      ok: false,
      kayit: 0,
      alicilar,
      hata: "Eksik yapılandırma (SMTP_* / RAPOR_GONDEREN / alıcı listesi)",
    }
  }

  const { buffer, adet } = await raporExceliUret()
  const bugun = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })

  const konu =
    tip === "gunluk"
      ? `Name Teknik — Günlük Yedek (${bugun})`
      : `Name Teknik — Haftalık Rapor (${bugun})`
  const metin =
    tip === "gunluk"
      ? `Ekte tüm iş kayıtlarının güncel Excel yedeği + tam veri yedeği (JSON) bulunuyor.\nToplam kayıt: ${adet}\n\nBu e-posta her gün otomatik gönderilir. JSON dosyası geri yükleme içindir; bu kutuyu saklamanız yeterli.`
      : `Ekte bu haftanın tüm iş kayıtları Excel raporu bulunuyor.\nToplam kayıt: ${adet}\n\nBu e-posta her hafta otomatik gönderilir.`

  const ekler: { filename: string; content: Buffer }[] = [
    { filename: `name-teknik-${bugun}.xlsx`, content: buffer },
  ]
  // Günlük yedek maili: tam veri yedeği JSON'unu da ekle (geri yüklenebilir)
  if (tip === "gunluk") {
    ekler.push({
      filename: `name-teknik-yedek-${bugun}.json`,
      content: await tumVeriYedekJson(),
    })
  }

  await transporter().sendMail({
    from: gonderen,
    to: alicilar,
    subject: konu,
    text: metin,
    attachments: ekler,
  })

  return { ok: true, kayit: adet, alicilar }
}
