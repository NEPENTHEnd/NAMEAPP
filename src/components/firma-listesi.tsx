"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import {
  grupDuzenle,
  grupMusteridenEkle,
  grupSil,
  grupSirala,
  subeDuzenle,
  subeEkle,
  subeSil,
} from "@/app/actions/tanim"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Grup = { id: string; ad: string; sira: number }
type Sube = {
  id: string
  grup_id: string
  ad: string
  ilgili_kisi: string | null
  telefon: string | null
}
type Musteri = { id: string; ad: string }

// Tanımlar > Firmalar: müşteriden ekle, sürükleyerek sırala, adını değiştir, şube ekle, sil.
export function FirmaListesi({
  gruplar,
  musteriler,
  subeler,
}: {
  gruplar: Grup[]
  musteriler: Musteri[]
  subeler: Sube[]
}) {
  const router = useRouter()
  const [liste, setListe] = useState(gruplar)
  const [surukleIdx, setSurukleIdx] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  // Sunucu tazelenince (ekle/sil) listeyi güncelle — sürükleme dışında
  useEffect(() => {
    if (surukleIdx === null) setListe(gruplar)
  }, [gruplar, surukleIdx])

  // Şubeleri firmaya göre grupla
  const subeMap = useMemo(() => {
    const m = new Map<string, Sube[]>()
    for (const s of subeler) {
      const l = m.get(s.grup_id) ?? []
      l.push(s)
      m.set(s.grup_id, l)
    }
    return m
  }, [subeler])
  const [acikSube, setAcikSube] = useState<Set<string>>(new Set())

  // Yeni firma: müşteri arama
  const [ara, setAra] = useState("")
  const [aramaAcik, setAramaAcik] = useState(false)
  const aramaKutu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function disari(e: MouseEvent) {
      if (aramaKutu.current && !aramaKutu.current.contains(e.target as Node))
        setAramaAcik(false)
    }
    document.addEventListener("mousedown", disari)
    return () => document.removeEventListener("mousedown", disari)
  }, [])
  const menudekiAdlar = useMemo(
    () => new Set(liste.map((g) => g.ad.toLocaleUpperCase("tr-TR"))),
    [liste]
  )
  const filtreliMusteriler = useMemo(() => {
    const q = ara.trim().toLocaleLowerCase("tr-TR")
    return musteriler
      .filter(
        (m) =>
          !menudekiAdlar.has(m.ad.toLocaleUpperCase("tr-TR")) &&
          (!q || m.ad.toLocaleLowerCase("tr-TR").includes(q))
      )
      .slice(0, 30)
  }, [musteriler, ara, menudekiAdlar])

  function firmaEkle(m: Musteri) {
    setAramaAcik(false)
    setAra("")
    startTransition(async () => {
      const fd = new FormData()
      fd.set("musteri_id", m.id)
      await grupMusteridenEkle(fd)
      router.refresh()
    })
  }

  function siralamayiKaydet(yeni: Grup[]) {
    startTransition(async () => {
      await grupSirala(yeni.map((g) => g.id))
      router.refresh()
    })
  }

  function sil(g: Grup) {
    if (
      !window.confirm(
        `"${g.ad}" firması sol menüden KALICI olarak silinecek.\nİşleri silinmez, DİĞER'e taşınır. Şubeleri de silinir. Emin misin?`
      )
    )
      return
    setListe((l) => l.filter((x) => x.id !== g.id))
    startTransition(async () => {
      await grupSil(g.id)
      router.refresh()
    })
  }

  function subeToggle(grupId: string) {
    setAcikSube((prev) => {
      const y = new Set(prev)
      if (y.has(grupId)) y.delete(grupId)
      else y.add(grupId)
      return y
    })
  }

  function subeSilTikla(s: Sube) {
    if (!window.confirm(`"${s.ad}" şubesi silinecek. İşleri ana firmaya döner. Emin misin?`))
      return
    startTransition(async () => {
      await subeSil(s.id)
      router.refresh()
    })
  }

  return (
    <div className="grid max-w-xl gap-2">
      {/* Yeni firma: yalnız kayıtlı müşteriden seç */}
      <div ref={aramaKutu} className="relative">
        <Input
          value={ara}
          placeholder="Müşteri ara ve menüye ekle…"
          autoComplete="off"
          onFocus={() => setAramaAcik(true)}
          onChange={(e) => {
            setAra(e.target.value)
            setAramaAcik(true)
          }}
          className="max-w-sm"
        />
        {aramaAcik && (
          <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-full max-w-sm overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-xl">
            {filtreliMusteriler.length === 0 ? (
              <div className="px-3 py-2.5 text-sm text-muted-foreground">
                {ara.trim()
                  ? "Eşleşen müşteri yok. Yeni firmayı önce Müşteriler'e ekleyin."
                  : "Aramak için yazın…"}
              </div>
            ) : (
              filtreliMusteriler.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => firmaEkle(m)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </span>
                  {m.ad}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className={cn("grid gap-1.5", pending && "opacity-60")}>
        {liste.map((g, i) => {
          const gSubeler = subeMap.get(g.id) ?? []
          const subeAcik = acikSube.has(g.id)
          return (
            <div
              key={g.id}
              className={cn(
                "rounded-xl border border-border bg-card",
                surukleIdx === i && "border-primary ring-2 ring-primary/20"
              )}
            >
              <div
                draggable
                onDragStart={() => setSurukleIdx(i)}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (surukleIdx === null || surukleIdx === i) return
                  setListe((l) => {
                    const yeni = [...l]
                    const [tasinan] = yeni.splice(surukleIdx, 1)
                    yeni.splice(i, 0, tasinan)
                    return yeni
                  })
                  setSurukleIdx(i)
                }}
                onDragEnd={() => {
                  setSurukleIdx(null)
                  siralamayiKaydet(liste)
                }}
                className="flex items-center gap-2 p-2"
              >
                {/* Tutma sapı */}
                <span
                  title="Sürükleyerek sırala"
                  className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground/60 active:cursor-grabbing"
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                    <circle cx="2.5" cy="2.5" r="1.4" /><circle cx="7.5" cy="2.5" r="1.4" />
                    <circle cx="2.5" cy="8" r="1.4" /><circle cx="7.5" cy="8" r="1.4" />
                    <circle cx="2.5" cy="13.5" r="1.4" /><circle cx="7.5" cy="13.5" r="1.4" />
                  </svg>
                </span>
                <span className="w-6 text-right font-mono text-xs text-muted-foreground">
                  {i + 1}
                </span>
                {/* Ad değiştir */}
                <form
                  action={async (fd) => {
                    await grupDuzenle(fd)
                    router.refresh()
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <input type="hidden" name="id" value={g.id} />
                  <Input name="ad" defaultValue={g.ad} className="h-8 min-w-0 flex-1" required />
                  <Button type="submit" size="sm" variant="ghost">Kaydet</Button>
                </form>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => subeToggle(g.id)}
                  className={cn(subeAcik && "bg-muted")}
                >
                  Şubeler{gSubeler.length > 0 ? ` (${gSubeler.length})` : ""}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => sil(g)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  Sil
                </Button>
              </div>

              {/* Şube paneli */}
              {subeAcik && (
                <div className="grid gap-1.5 border-t border-border/60 bg-muted/30 p-2">
                  {gSubeler.map((s) => (
                    <form
                      key={s.id}
                      action={async (fd) => {
                        await subeDuzenle(fd)
                        router.refresh()
                      }}
                      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1.5"
                    >
                      <input type="hidden" name="id" value={s.id} />
                      <Input name="ad" defaultValue={s.ad} placeholder="Şube adı" className="h-8 min-w-[8rem] flex-1" required />
                      <Input name="ilgili_kisi" defaultValue={s.ilgili_kisi ?? ""} placeholder="İlgili kişi" className="h-8 w-[9rem]" />
                      <Input name="telefon" defaultValue={s.telefon ?? ""} placeholder="Telefon" className="h-8 w-[8rem]" />
                      <Button type="submit" size="sm" variant="outline">Kaydet</Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => subeSilTikla(s)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        Sil
                      </Button>
                    </form>
                  ))}
                  {/* Yeni şube ekle */}
                  <form
                    action={async (fd) => {
                      await subeEkle(fd)
                      router.refresh()
                    }}
                    className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-border p-1.5"
                  >
                    <input type="hidden" name="grup_id" value={g.id} />
                    <Input name="ad" placeholder="Yeni şube adı" className="h-8 min-w-[8rem] flex-1" required />
                    <Input name="ilgili_kisi" placeholder="İlgili kişi (ops.)" className="h-8 w-[9rem]" />
                    <Input name="telefon" placeholder="Telefon (ops.)" className="h-8 w-[8rem]" />
                    <Button type="submit" size="sm">+ Şube ekle</Button>
                  </form>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
