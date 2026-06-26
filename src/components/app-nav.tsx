"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import type { Rol } from "@/lib/auth"

type NavItem = {
  href: string
  etiket: string
  roller?: Rol[]
}

const NAV: NavItem[] = [
  { href: "/", etiket: "İşler" },
  { href: "/pano", etiket: "Pano", roller: ["yonetici"] },
  { href: "/raporlar", etiket: "Raporlar", roller: ["yonetici"] },
  { href: "/tanimlar", etiket: "Tanımlar", roller: ["yonetici"] },
]

export function AppNav({ rol }: { rol: Rol }) {
  const pathname = usePathname()
  const gorunecekler = NAV.filter((i) => !i.roller || i.roller.includes(rol))

  return (
    <nav className="flex flex-1 items-center gap-0.5 overflow-x-auto">
      {gorunecekler.map((item) => {
        const aktif =
          item.href === "/"
            ? pathname === "/" || pathname.startsWith("/is") || pathname === "/yeni"
            : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-[9px] px-3.5 py-2 text-[13.5px] font-medium whitespace-nowrap transition-colors",
              aktif
                ? "bg-accent font-semibold text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.etiket}
          </Link>
        )
      })}
    </nav>
  )
}
