"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"

// Tipli istemci bu RPC'leri tanımıyor (tipler önce üretildi); sade arayüzle çağırıyoruz.
type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: string | null; error: { message: string } | null }>
}

export default function KayitPage() {
  const router = useRouter()
  const [ad, setAd] = useState("")
  const [eposta, setEposta] = useState("")
  const [sifre, setSifre] = useState("")
  const [kod, setKod] = useState("")
  const [hata, setHata] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)

  async function kayitOl(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setHata(null)
    setYukleniyor(true)

    const supabase = createClient()
    const rpc = supabase as unknown as RpcClient
    const temizKod = kod.trim()

    // 1) Kod geçerli mi? (hesap oluşturmadan önce kontrol)
    const { data: rolKontrol } = await rpc.rpc("kod_rol", { p_kod: temizKod })
    if (!rolKontrol) {
      setHata("Geçersiz davet kodu. Lütfen yetkilinizden doğru kodu alın.")
      setYukleniyor(false)
      return
    }

    // 2) Hesap oluştur
    const { data: signData, error: signErr } = await supabase.auth.signUp({
      email: eposta,
      password: sifre,
      options: { data: { ad: ad.trim() } },
    })
    if (signErr) {
      setHata(
        signErr.message.includes("already")
          ? "Bu e-posta zaten kayıtlı."
          : "Kayıt başarısız: " + signErr.message
      )
      setYukleniyor(false)
      return
    }
    if (!signData.session) {
      setHata(
        "Hesap oluşturuldu ama oturum açılamadı. (Supabase e-posta onayı açık olabilir — yetkilinize bildirin.)"
      )
      setYukleniyor(false)
      return
    }

    // 3) Role koda göre ata
    await rpc.rpc("kayit_tamamla", { p_kod: temizKod })

    // 4) Uygulamaya gir
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
            <Image src="/name-teknik-logo.png" alt="Name Teknik" width={1592} height={238} priority className="mb-2 h-9 w-auto object-contain dark:hidden" />
            <Image src="/name-teknik-logo-beyaz.png" alt="Name Teknik" width={1592} height={238} priority className="mb-2 hidden h-9 w-auto object-contain dark:block" />
            <div className="text-[13px] font-medium text-muted-foreground">Üye ol</div>
          </div>

          <form onSubmit={kayitOl} className="grid gap-3.5">
            <div className="grid gap-1.5">
              <label className="text-[12.5px] font-semibold text-foreground">Ad Soyad</label>
              <input required value={ad} onChange={(e) => setAd(e.target.value)} className="w-full rounded-[10px] border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-[12.5px] font-semibold text-foreground">E-posta</label>
              <input type="email" inputMode="email" autoComplete="email" required value={eposta} onChange={(e) => setEposta(e.target.value)} placeholder="ad@nameteknik.com" className="w-full rounded-[10px] border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-[12.5px] font-semibold text-foreground">Şifre</label>
              <input type="password" autoComplete="new-password" required minLength={6} value={sifre} onChange={(e) => setSifre(e.target.value)} placeholder="En az 6 karakter" className="w-full rounded-[10px] border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-[12.5px] font-semibold text-foreground">Davet kodu</label>
              <input required value={kod} onChange={(e) => setKod(e.target.value)} placeholder="Yetkilinizden alın" className="w-full rounded-[10px] border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15" />
            </div>

            {hata && <p className="text-sm text-destructive">{hata}</p>}

            <button type="submit" disabled={yukleniyor} className="mt-2 w-full rounded-[10px] bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(30,64,175,.4)] transition-colors hover:bg-primary/90 disabled:opacity-60">
              {yukleniyor ? "Hesap oluşturuluyor…" : "Üye ol"}
            </button>
          </form>

          <p className="mt-4 text-center text-[12.5px] text-muted-foreground">
            Zaten hesabın var mı?{" "}
            <Link href="/giris" className="font-medium text-primary hover:underline">
              Giriş yap
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
