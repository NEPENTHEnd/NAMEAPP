import Link from "next/link"

import { tint } from "@/components/rozet"
import { ustYaziRengi } from "@/lib/hizli-filtre"

export type HizliDugmeVeri = {
  anahtar: string
  etiket: string
  href: string
  aktif: boolean
  renk: string
}

// Hızlı filtre butonu: pasifken durumun renginde açık ton (tablodaki rozet gibi),
// aktifken dolu renk. Tıkla = filtrele, tekrar tıkla = kaldır.
export function HizliFiltreDugme({ d }: { d: HizliDugmeVeri }) {
  const stil = d.aktif
    ? { background: d.renk, borderColor: d.renk, color: ustYaziRengi(d.renk) }
    : tint(d.renk)
  return (
    <Link
      href={d.href}
      aria-pressed={d.aktif}
      className="rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold transition-[filter] hover:brightness-95"
      style={stil}
    >
      {d.etiket}
    </Link>
  )
}
