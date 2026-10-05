import nodemailer from "nodemailer"

// SADECE SUNUCU. Kendi mail sunucunuzdan (rapor@nameteknik.com) SMTP ile gönderim —
// günlük rapor, kullanıcı daveti ve yönetici doğrulama kodu aynı ayarları kullanır.

export function smtpTransport() {
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

export function gonderenAdres(): string {
  return process.env.RAPOR_GONDEREN || process.env.SMTP_USER || ""
}

// Tek e-posta gönderir. Ayar eksikse ya da sunucu reddederse Error fırlatır.
export async function epostaGonder(o: {
  kime: string
  konu: string
  metin: string
  html?: string
}): Promise<void> {
  const from = gonderenAdres()
  if (!process.env.SMTP_HOST || !from) {
    throw new Error("E-posta ayarları eksik (SMTP)")
  }
  await smtpTransport().sendMail({
    from,
    to: o.kime,
    subject: o.konu,
    text: o.metin,
    html: o.html,
  })
}

// Basit HTML kaçışı (e-posta şablonlarına kullanıcı girdisi basarken)
export function htmlKacis(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
