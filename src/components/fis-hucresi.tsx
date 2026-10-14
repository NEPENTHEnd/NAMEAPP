"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { isHucreGuncelle } from "@/app/actions/is"
import { createClient } from "@/lib/supabase/client"
import { kaydedildiGoster } from "@/lib/toast"
import { cn } from "@/lib/utils"

// İş listesindeki fiş no hücresi: numara işe giden bağlantı olarak kalır; yanındaki
// kalemle (yalnız izin verilen işlerde — bkz. lib/fis-duzeltme) elle düzeltilir.
// Aynı numara başka bir işte varsa kaydetmeden önce sorar (adetle açılan işler bilerek
// aynı fişi paylaşır, o yüzden engellemez).
export function FisHucresi({ isId, deger }: { isId: string; deger: string | null }) {
  const router = useRouter()
  const [acik, setAcik] = useState(false)
  const [pending, startTransition] = useTransition()
  const [hata, setHata] = useState<string | null>(null)
  const dur = (e: React.SyntheticEvent) => e.stopPropagation()

  function kaydet(ham: string) {
    const yeni = ham.trim().toLocaleUpperCase("tr-TR")
    setAcik(false)
    if (yeni === (deger ?? "")) return
    startTransition(async () => {
      if (yeni) {
        const { count } = await createClient()
          .from("is_kaydi")
          .select("id", { count: "exact", head: true })
          .eq("servis_no", yeni)
          .neq("id", isId)
        if (count && !window.confirm(`"${yeni}" fiş numarası ${count} başka işte de var. Yine de kaydedilsin mi?`)) return
      }
      const r = await isHucreGuncelle(isId, "servis_no", yeni)
      if (!r.ok) {
        setHata(r.error ?? "Kaydedilemedi")
        return
      }
      setHata(null)
      kaydedildiGoster()
      router.refresh()
    })
  }

  if (acik) {
    return (
      <input
        autoFocus
        defaultValue={deger ?? ""}
        placeholder="Fiş no"
        onPointerDown={dur}
        onClick={dur}
        onBlur={(e) => kaydet(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          if (e.key === "Escape") setAcik(false)
        }}
        className="w-[120px] rounded border border-primary bg-card px-1.5 py-0.5 font-mono text-sm outline-none ring-2 ring-primary/20"
      />
    )
  }

  return (
    <span className="inline-flex items-center gap-1" title={hata ?? undefined}>
      <Link
        href={`/is/${isId}`}
        onPointerDown={dur}
        className={cn("text-primary underline-offset-4 hover:underline", pending && "opacity-50", hata && "text-destructive")}
      >
        {deger ?? "Aç"}
      </Link>
      <button
        type="button"
        onPointerDown={dur}
        onClick={(e) => {
          dur(e)
          setHata(null)
          setAcik(true)
        }}
        disabled={pending}
        title="Fiş numarasını elle düzelt (yalnız Temmuz 2026 içe aktarılan işler)"
        aria-label="Fiş numarasını düzenle"
        className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-primary"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    </span>
  )
}
