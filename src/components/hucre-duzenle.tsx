"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { isHucreGuncelle } from "@/app/actions/is"
import { cn } from "@/lib/utils"

type Secenek = { id: string; ad: string; renk?: string | null }

// Excel gibi: hücreye tıkla → düzenle. metin | tarih | select.
export function HucreDuzenle({
  isId,
  alan,
  deger,
  tip = "metin",
  secenekler,
  bosEtiket = "—",
  goster,
  duzenlenebilir = true,
  className,
  placeholder,
}: {
  isId: string
  alan: string
  deger: string | null
  tip?: "metin" | "tarih" | "select"
  secenekler?: Secenek[]
  bosEtiket?: string
  goster?: (deger: string | null) => React.ReactNode
  duzenlenebilir?: boolean
  className?: string
  placeholder?: string
}) {
  const router = useRouter()
  const [acik, setAcik] = useState(false)
  const [pending, startTransition] = useTransition()
  const [hata, setHata] = useState(false)
  const kapsayiciRef = useRef<HTMLDivElement>(null)

  function kaydet(yeni: string) {
    setAcik(false)
    if ((yeni ?? "") === (deger ?? "")) return
    setHata(false)
    startTransition(async () => {
      const r = await isHucreGuncelle(isId, alan, yeni)
      if (!r.ok) setHata(true)
      else router.refresh()
    })
  }

  // select dışarı tıklayınca kapansın
  useEffect(() => {
    if (!acik || tip !== "select") return
    function d(e: MouseEvent) {
      if (kapsayiciRef.current && !kapsayiciRef.current.contains(e.target as Node))
        setAcik(false)
    }
    document.addEventListener("mousedown", d)
    return () => document.removeEventListener("mousedown", d)
  }, [acik, tip])

  const govde = goster ? goster(deger) : deger || <span className="text-muted-foreground">{bosEtiket}</span>

  if (!duzenlenebilir) {
    return <div className={className}>{govde}</div>
  }

  // Hücre etkileşimi satır sürüklemesini/panel açmayı tetiklemesin
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  if (tip === "select") {
    return (
      <div
        ref={kapsayiciRef}
        className={cn("relative", className)}
        onPointerDown={stop}
        onClick={stop}
      >
        <button
          type="button"
          disabled={pending}
          onClick={() => setAcik((v) => !v)}
          className={cn(
            "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-muted/60",
            pending && "opacity-50",
            hata && "ring-1 ring-destructive"
          )}
        >
          {govde}
        </button>
        {acik && (
          <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-max min-w-[160px] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
            {secenekler?.some((s) => s.id === "") ? null : (
              <button
                type="button"
                onClick={() => kaydet("")}
                className="block w-full rounded px-2.5 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
              >
                {bosEtiket}
              </button>
            )}
            {secenekler?.map((s) => (
              <button
                key={s.id || "bos"}
                type="button"
                onClick={() => kaydet(s.id)}
                className="block w-full rounded px-2.5 py-1.5 text-left text-sm hover:bg-muted"
              >
                {s.ad}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // metin / tarih
  if (acik) {
    return (
      <div className={className} onPointerDown={stop} onClick={stop}>
        <input
          autoFocus
          type={tip === "tarih" ? "date" : "text"}
          defaultValue={deger ?? ""}
          placeholder={placeholder}
          onBlur={(e) => kaydet(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            if (e.key === "Escape") setAcik(false)
          }}
          className="w-full min-w-[80px] rounded border border-primary bg-card px-1.5 py-0.5 text-sm outline-none ring-2 ring-primary/20"
        />
      </div>
    )
  }

  return (
    <div
      className={cn("cursor-text rounded px-1 py-0.5 hover:bg-muted/60", pending && "opacity-50", hata && "ring-1 ring-destructive", className)}
      onPointerDown={stop}
      onClick={(e) => {
        stop(e)
        setAcik(true)
      }}
      title="Düzenlemek için tıkla"
    >
      {govde}
    </div>
  )
}
