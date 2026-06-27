"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"

export default function GirisPage() {
  const router = useRouter()
  const [eposta, setEposta] = useState("")
  const [sifre, setSifre] = useState("")
  const [hata, setHata] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)

  async function girisYap(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setHata(null)
    setYukleniyor(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: eposta,
      password: sifre,
    })

    if (error) {
      setHata("E-posta veya şifre hatalı.")
      setYukleniyor(false)
      return
    }
    router.refresh()
    router.replace("/")
  }

  return (
    <main
      className="flex min-h-svh items-center justify-center p-6"
      style={{
        background:
          "radial-gradient(120% 120% at 50% 0%, var(--accent) 0%, var(--background) 42%)",
      }}
    >
      <div className="w-full max-w-[392px]">
        <div className="rounded-[18px] border border-border bg-card px-8 pb-7 pt-9 shadow-[0_18px_48px_-24px_rgba(15,23,42,.28),0_2px_6px_-2px_rgba(15,23,42,.06)]">
          <div className="mb-7 flex flex-col items-center gap-1">
            <Image
              src="/name-teknik-logo.png"
              alt="Name Teknik"
              width={1592}
              height={238}
              priority
              className="mb-2 h-9 w-auto object-contain dark:hidden"
            />
            <Image
              src="/name-teknik-logo-beyaz.png"
              alt="Name Teknik"
              width={1592}
              height={238}
              priority
              className="mb-2 hidden h-9 w-auto object-contain dark:block"
            />
            <div className="text-[13px] font-medium text-muted-foreground">
              Teknik Servis Takip Sistemi
            </div>
          </div>

          <form onSubmit={girisYap}>
            <div className="mb-3.5 flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-foreground">
                E-posta
              </label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={eposta}
                onChange={(e) => setEposta(e.target.value)}
                placeholder="ad@nameteknik.com"
                className="w-full rounded-[10px] border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15"
              />
            </div>
            <div className="mb-3 flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-foreground">
                Şifre
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={sifre}
                onChange={(e) => setSifre(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-[10px] border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15"
              />
            </div>

            {hata && (
              <p className="mb-3 text-sm text-destructive">{hata}</p>
            )}

            <button
              type="submit"
              disabled={yukleniyor}
              className="mt-2 w-full rounded-[10px] bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(30,64,175,.4)] transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {yukleniyor ? "Giriş yapılıyor…" : "Giriş yap"}
            </button>
          </form>

          <p className="mt-4 text-center text-[12.5px] text-muted-foreground">
            Hesabın yok mu?{" "}
            <Link href="/kayit" className="font-medium text-primary hover:underline">
              Üye ol
            </Link>
          </p>
        </div>
        <div className="mt-[18px] text-center text-xs text-muted-foreground/80">
          © 2026 Name Teknik · Kayseri · Endüstriyel Elektronik Onarım
        </div>
      </div>
    </main>
  )
}
