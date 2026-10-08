"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"

// Yeni şifre belirleme. Üç giriş yolu:
//  1) Bizim e-posta bağlantımız:     /sifre-yenile?token_hash=...&type=recovery  → verifyOtp
//  2) Supabase panelinden gönderilen: /sifre-yenile#access_token=...&refresh_token=... → setSession
//  3) Giriş yapmış kullanıcı ("Şifremi değiştir"): mevcut oturum
export default function SifreYenilePage() {
  const router = useRouter()
  const [durum, setDurum] = useState<"yukleniyor" | "form" | "hata" | "tamam">("yukleniyor")
  const [hata, setHata] = useState<string | null>(null)
  const [s1, setS1] = useState("")
  const [s2, setS2] = useState("")
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const gecersiz = (m?: string) => {
      setHata(
        m ??
          "Bağlantı geçersiz ya da süresi dolmuş (bağlantılar 1 saat geçerlidir ve bir kez kullanılır). Giriş sayfasından \"Şifremi unuttum\" ile yeni bağlantı isteyin."
      )
      setDurum("hata")
    }
    ;(async () => {
      const q = new URLSearchParams(window.location.search)
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ""))
      // Token'ı adres çubuğunda/geçmişte bırakma
      const temizle = () => window.history.replaceState(null, "", "/sifre-yenile")

      if (q.get("error_description") || h.get("error_description")) {
        temizle()
        return gecersiz()
      }
      const th = q.get("token_hash")
      if (th && q.get("type") === "recovery") {
        const { error } = await supabase.auth.verifyOtp({ token_hash: th, type: "recovery" })
        temizle()
        return error ? gecersiz() : setDurum("form")
      }
      const at = h.get("access_token")
      const rt = h.get("refresh_token")
      if (at && rt) {
        const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt })
        temizle()
        return error ? gecersiz() : setDurum("form")
      }
      const code = q.get("code")
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        temizle()
        return error ? gecersiz() : setDurum("form")
      }
      const { data } = await supabase.auth.getUser()
      if (data.user) return setDurum("form")
      gecersiz(
        "Geçerli bir şifre yenileme bağlantısı bulunamadı. Giriş sayfasından \"Şifremi unuttum\" ile bağlantı isteyin."
      )
    })()
  }, [])

  async function kaydet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setHata(null)
    if (s1.length < 6) return setHata("Şifre en az 6 karakter olmalı.")
    if (s1 !== s2) return setHata("Şifreler aynı değil.")
    setKaydediliyor(true)
    const { error } = await createClient().auth.updateUser({ password: s1 })
    setKaydediliyor(false)
    if (error) {
      setHata(
        /different from the old/i.test(error.message)
          ? "Yeni şifre eskisiyle aynı olamaz."
          : /session/i.test(error.message)
            ? "Oturum süresi doldu. Yeni bağlantı isteyin."
            : "Şifre kaydedilemedi: " + error.message
      )
      return
    }
    setDurum("tamam")
    setTimeout(() => {
      router.refresh()
      router.replace("/")
    }, 1500)
  }

  const girdi =
    "w-full rounded-[10px] border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15"

  return (
    <main
      className="flex min-h-svh items-center justify-center p-6"
      style={{
        background: "radial-gradient(120% 120% at 50% 0%, var(--accent) 0%, var(--background) 42%)",
      }}
    >
      <div className="w-full max-w-[392px]">
        <div className="rounded-[18px] border border-border bg-card px-8 pb-7 pt-9 shadow-[0_18px_48px_-24px_rgba(15,23,42,.28),0_2px_6px_-2px_rgba(15,23,42,.06)]">
          <div className="mb-6 flex flex-col items-center gap-1">
            <Image src="/name-teknik-logo.png" alt="Name Teknik" width={1592} height={238} priority className="mb-2 h-9 w-auto object-contain dark:hidden" />
            <Image src="/name-teknik-logo-beyaz.png" alt="Name Teknik" width={1592} height={238} priority className="mb-2 hidden h-9 w-auto object-contain dark:block" />
            <div className="text-[13px] font-medium text-muted-foreground">Yeni şifre belirle</div>
          </div>

          {durum === "yukleniyor" && (
            <p className="text-center text-sm text-muted-foreground">Bağlantı doğrulanıyor…</p>
          )}

          {durum === "hata" && (
            <div className="grid gap-4">
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[13px] text-destructive">
                {hata}
              </p>
              <Link href="/giris" className="text-center text-[13px] font-medium text-primary hover:underline">
                Giriş sayfasına dön
              </Link>
            </div>
          )}

          {durum === "form" && (
            <form onSubmit={kaydet} className="grid gap-3.5">
              <div className="grid gap-1.5">
                <label className="text-[12.5px] font-semibold">Yeni şifre</label>
                <input type="password" autoComplete="new-password" required minLength={6} value={s1} onChange={(e) => setS1(e.target.value)} placeholder="En az 6 karakter" className={girdi} />
              </div>
              <div className="grid gap-1.5">
                <label className="text-[12.5px] font-semibold">Yeni şifre (tekrar)</label>
                <input type="password" autoComplete="new-password" required minLength={6} value={s2} onChange={(e) => setS2(e.target.value)} className={girdi} />
              </div>
              {hata && <p className="text-sm text-destructive">{hata}</p>}
              <button
                type="submit"
                disabled={kaydediliyor}
                className="mt-1 w-full rounded-[10px] bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {kaydediliyor ? "Kaydediliyor…" : "Şifreyi kaydet"}
              </button>
            </form>
          )}

          {durum === "tamam" && (
            <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-center text-[13px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              Şifreniz güncellendi. Yönlendiriliyorsunuz…
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
