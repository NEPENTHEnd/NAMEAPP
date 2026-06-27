import Image from "next/image"
import Link from "next/link"

import { getKullanici } from "@/lib/auth"
import { AppNav } from "@/components/app-nav"
import { UserMenu } from "@/components/user-menu"
import { ThemeToggle } from "@/components/theme-toggle"

// Giriş gerektiren tüm sayfaların ortak kabuğu: üst başlık + navigasyon + çıkış.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const kullanici = await getKullanici()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-5">
          <div className="flex h-[60px] items-center gap-3">
            <Link
              href="/"
              className="flex shrink-0 items-center rounded-lg bg-white px-2.5 py-1.5 dark:shadow-[0_0_0_1px_rgba(255,255,255,.08)]"
            >
              <Image
                src="/name-teknik-logo.png"
                alt="Name Teknik"
                width={260}
                height={52}
                priority
                className="h-9 w-auto object-contain sm:h-11"
              />
            </Link>

            {/* Masaüstü navigasyon */}
            <div className="hidden min-w-0 flex-1 items-center gap-[18px] md:flex">
              <div className="h-[26px] w-px shrink-0 bg-border" />
              <AppNav rol={kullanici.rol} />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/yeni"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[9px] bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(30,64,175,.35)] transition-colors hover:bg-primary/90 sm:px-3.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="hidden whitespace-nowrap sm:inline">Yeni İş</span>
              </Link>
              <ThemeToggle />
              <UserMenu
                ad={kullanici.ad}
                eposta={kullanici.eposta}
                rol={kullanici.rol}
              />
            </div>
          </div>

          {/* Mobil navigasyon (kaydırılabilir alt satır) */}
          <div className="-mx-1 border-t border-border/60 px-1 py-1.5 md:hidden">
            <AppNav rol={kullanici.rol} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-5 sm:py-6">
        {children}
      </main>
    </div>
  )
}
