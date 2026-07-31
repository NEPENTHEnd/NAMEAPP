import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { getYonetici } from "@/lib/auth"
import { FotoArsivSil } from "@/components/foto-arsiv-sil"
import { buttonVariants } from "@/components/ui/button"

const FOTO_KOTA = 512 * 1024 * 1024 // 0,5 GB

export default async function IceAktarSayfasi() {
  await getYonetici() // yalnız yönetici

  const supabase = await createClient()
  // Kayıt sayısı (dışa aktar butonu için) + fotoğraf deposu kullanımı
  const rpc = supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>
  }
  const [{ count: kayitSayisi }, { data: kullanimData }, { count: fotoAdet }] =
    await Promise.all([
      supabase.from("is_kaydi").select("id", { count: "exact", head: true }),
      rpc.rpc("foto_kullanim"),
      supabase.from("foto").select("id", { count: "exact", head: true }),
    ])
  const ku = (Array.isArray(kullanimData) ? kullanimData[0] : kullanimData) as
    | { toplam_byte?: number }
    | null
  const fotoByte = Number(ku?.toplam_byte ?? 0)
  const fotoYuzde = Math.min(100, Math.round((fotoByte / FOTO_KOTA) * 100))
  const mb = (b: number) => (b / 1024 / 1024).toFixed(0)

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← İşler
        </Link>
        <h1 className="mt-1 text-[21px] font-semibold tracking-tight">
          Dışa Aktar / Yedek
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Tüm verileri Excel'e indirin, fotoğrafları arşivleyin.
        </p>
      </div>

      {/* ---------------- DIŞA AKTAR ---------------- */}
      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></svg>
          </span>
          Dışa aktar (sistem → Excel)
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <p className="text-[12.5px] text-muted-foreground">
            Tüm kayıtlar, orijinal çalışma dosyanızla <strong>birebir aynı düzende</strong>
            (her firma kendi sayfasında, renkler, sütun genişlikleri) Excel'e iner.
            Filtreye göre indirmek için <Link href="/raporlar" className="text-primary underline underline-offset-2">Raporlar</Link>'ı kullanın.
          </p>
          <a
            href="/raporlar/disa-aktar"
            className="inline-flex shrink-0 items-center gap-2 rounded-[9px] border border-input bg-card px-4 py-2 text-[13px] font-semibold text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></svg>
            Tüm kayıtları indir{kayitSayisi != null ? ` (${kayitSayisi})` : ""}
          </a>
        </div>
      </section>

      {/* ---------------- FOTOĞRAFLAR ---------------- */}
      <section className="grid gap-3 border-t border-border pt-5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></svg>
          </span>
          Fotoğraflar (arşivle / sil)
        </h2>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <span className="font-semibold">Fotoğraf deposu</span>
            <span className="font-mono text-muted-foreground">
              {mb(fotoByte)} / {mb(FOTO_KOTA)} MB · %{fotoYuzde} · {fotoAdet ?? 0} foto
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${fotoYuzde}%`,
                background:
                  fotoYuzde >= 90 ? "#dc2626" : fotoYuzde >= 70 ? "#f59e0b" : "#1e40af",
              }}
            />
          </div>
          {fotoYuzde >= 90 && (
            <p className="mt-1 text-xs text-destructive">
              Depo dolmak üzere — arşivleyip silin (dolunca yeni fotoğraf yüklenemez).
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href="/raporlar/fotolar-zip"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Tüm fotoğrafları indir (ZIP)
            </a>
            <FotoArsivSil ay="" adet={fotoAdet ?? 0} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Fotoğraflar <strong>fiş no</strong> isimleriyle ZIP'e iner; indirip
            yedekledikten sonra "Fotoğrafları sil" ile depo boşaltılır. Fiş no ve kayıt
            bilgileri kalıcıdır. Aya göre indirmek için <Link href="/raporlar" className="text-primary underline underline-offset-2">Raporlar</Link>'ı kullanın.
          </p>
        </div>
      </section>
    </div>
  )
}
