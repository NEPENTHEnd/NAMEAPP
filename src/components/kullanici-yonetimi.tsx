"use client"

import { useActionState, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  kullaniciDavetEt,
  davetYenidenGonder,
  davetIptalEt,
  kullaniciRolDegistir,
  kullaniciErisimKapat,
  kullaniciErisimAc,
  kullaniciKaliciSil,
  type IslemSonucu,
} from "@/app/actions/kullanici"
import { kullaniciSifreSifirla, type SifreSonucu } from "@/app/actions/sifre"

export type YonetimKullanici = {
  id: string
  ad: string | null
  rol: string
  sahip: boolean
  aktif: boolean
  eposta: string | null
  sonGiris: string | null
  isSayisi: number
}

export type BekleyenDavet = {
  id: string
  ad: string
  eposta: string
  rol: string
  kod: string
  tarih: string | null
}

const rolAd = (r: string) => (r === "yonetici" ? "Yönetici" : "Personel")
const tarihTR = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) : "—"

function davetLinki(kod: string) {
  return `${window.location.origin}/kayit?kod=${encodeURIComponent(kod)}`
}

async function kopyala(metin: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(metin)
    return true
  } catch {
    return false
  }
}

export function KullaniciYonetimi({
  kullanicilar,
  davetler,
  benId,
  benSahip,
}: {
  kullanicilar: YonetimKullanici[]
  davetler: BekleyenDavet[]
  benId: string
  benSahip: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [bildirim, setBildirim] = useState<{ ok: boolean; metin: string; link?: string } | null>(null)
  const [davetSonuc, davetAction, davetGonderiliyor] = useActionState<IslemSonucu | null, FormData>(
    kullaniciDavetEt,
    null
  )

  function calistir(is: () => Promise<IslemSonucu | SifreSonucu>) {
    setBildirim(null)
    startTransition(async () => {
      const s = await is()
      setBildirim(s.ok ? { ok: true, metin: s.mesaj, link: s.link } : { ok: false, metin: s.hata })
      router.refresh()
    })
  }

  // Hedef hesabı bu kullanıcı yönetebilir mi? (asıl kural veritabanında; burada yalnız arayüz)
  const yonetilebilir = (u: YonetimKullanici) =>
    u.id !== benId && !u.sahip && (u.rol !== "yonetici" || benSahip)

  return (
    <section className="grid gap-5">
      {/* --- Davet --- */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Yeni kullanıcı davet et</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Kişiye e-postayla kayıt bağlantısı gider; şifresini kendisi belirler. Davet yalnız
          o e-posta ile ve bir kez kullanılabilir.
          {!benSahip && " Yönetici hesaplarını yalnız sahip davet edebilir."}
        </p>
        <form action={davetAction} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs font-medium">
            Ad soyad
            <Input name="ad" required className="h-9 w-48" placeholder="Ad Soyad" />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            E-posta
            <Input
              name="eposta"
              type="email"
              required
              className="h-9 w-60"
              placeholder="kisi@ornek.com"
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Rol
            <select
              name="rol"
              defaultValue="teknisyen"
              className="h-9 rounded-lg border border-input bg-card px-2.5 text-[12.5px]"
            >
              <option value="teknisyen">Personel</option>
              {benSahip && <option value="yonetici">Yönetici</option>}
            </select>
          </label>
          <Button type="submit" size="sm" disabled={davetGonderiliyor}>
            {davetGonderiliyor ? "Gönderiliyor…" : "Davet gönder"}
          </Button>
        </form>
        {davetSonuc && (
          <div
            className={cn(
              "mt-3 rounded-lg border p-2.5 text-[13px]",
              davetSonuc.ok && davetSonuc.epostaGitti
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                : davetSonuc.ok
                  ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                  : "border-destructive/30 bg-destructive/5 text-destructive"
            )}
          >
            {davetSonuc.ok ? davetSonuc.mesaj : davetSonuc.hata}
            {davetSonuc.ok && davetSonuc.link && <LinkKutusu link={davetSonuc.link} />}
          </div>
        )}
      </div>

      {bildirim && (
        <div
          className={cn(
            "rounded-lg border p-2.5 text-[13px]",
            bildirim.ok
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          {bildirim.metin}
          {bildirim.ok && bildirim.link && <LinkKutusu link={bildirim.link} />}
        </div>
      )}

      {/* --- Bekleyen davetler --- */}
      {davetler.length > 0 && (
        <div className="grid gap-2">
          <h2 className="text-sm font-semibold">Bekleyen davetler ({davetler.length})</h2>
          {davetler.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-dashed border-border bg-card p-2.5 text-sm"
            >
              <span className="font-semibold">{d.ad}</span>
              <span className="text-muted-foreground">{d.eposta}</span>
              <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold">{rolAd(d.rol)}</span>
              <span className="text-xs text-muted-foreground">{tarihTR(d.tarih)}</span>
              <span className="ml-auto flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ok = await kopyala(davetLinki(d.kod))
                    setBildirim(
                      ok
                        ? { ok: true, metin: `${d.ad} için kayıt bağlantısı kopyalandı.` }
                        : { ok: false, metin: "Kopyalanamadı: " + davetLinki(d.kod) }
                    )
                  }}
                >
                  Bağlantıyı kopyala
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => calistir(() => davetYenidenGonder(d.id))}
                >
                  Yeniden gönder
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`${d.ad} davetini iptal etmek istiyor musunuz?`))
                      calistir(() => davetIptalEt(d.id))
                  }}
                >
                  İptal
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* --- Kullanıcılar --- */}
      <div className="grid gap-2">
        <h2 className="text-sm font-semibold">Kullanıcılar ({kullanicilar.length})</h2>
        {kullanicilar.map((u) => {
          const yon = yonetilebilir(u)
          return (
            <div
              key={u.id}
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-2.5 text-sm",
                !u.aktif && "opacity-60"
              )}
            >
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-semibold text-primary-foreground">
                {(u.ad ?? "?").slice(0, 2).toUpperCase()}
              </span>
              <span className="grid min-w-0">
                <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                  {u.ad ?? "—"}
                  {u.id === benId && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10.5px] text-primary">Sen</span>
                  )}
                  {u.sahip && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10.5px] text-amber-700 dark:text-amber-300">Sahip</span>
                  )}
                  {!u.aktif && (
                    <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10.5px] text-destructive">Erişim kapalı</span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {u.eposta ?? "—"} · son giriş {tarihTR(u.sonGiris)} · {u.isSayisi} iş
                </span>
              </span>

              <span className="ml-auto flex flex-wrap items-center gap-1.5">
                <select
                  value={u.rol}
                  disabled={!yon || pending || !u.aktif}
                  onChange={(e) => {
                    const yeni = e.target.value
                    if (confirm(`${u.ad ?? "Kullanıcı"} rolü "${rolAd(yeni)}" yapılsın mı?`))
                      calistir(() => kullaniciRolDegistir(u.id, yeni))
                  }}
                  className="h-9 rounded-lg border border-input bg-card px-2.5 text-[12.5px] disabled:opacity-60"
                >
                  <option value="teknisyen">Personel</option>
                  <option value="yonetici" disabled={!benSahip}>
                    Yönetici
                  </option>
                </select>

                {yon ? (
                  <>
                    {u.aktif && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          if (
                            confirm(
                              `${u.ad ?? "Kullanıcı"} için şifre yenileme bağlantısı ${u.eposta ?? "e-postasına"} gönderilsin mi?\n\nBağlantı 1 saat geçerli; kişi yeni şifresini kendisi belirler.`
                            )
                          )
                            calistir(() => kullaniciSifreSifirla(u.id))
                        }}
                      >
                        Şifre sıfırla
                      </Button>
                    )}
                    {u.aktif ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={pending}
                        onClick={() => {
                          if (
                            confirm(
                              `${u.ad ?? "Kullanıcı"} erişimi kapatılsın mı?\n\nGiriş yapamaz; eski işlerinde adı görünmeye devam eder. Sonra tekrar açılabilir.`
                            )
                          )
                            calistir(() => kullaniciErisimKapat(u.id))
                        }}
                      >
                        Erişimi kapat
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => calistir(() => kullaniciErisimAc(u.id))}
                      >
                        Erişimi aç
                      </Button>
                    )}
                    {u.isSayisi === 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={pending}
                        onClick={() => {
                          if (
                            confirm(
                              `${u.ad ?? "Kullanıcı"} hesabı KALICI olarak silinsin mi?\n\nBu işlem geri alınamaz. (Yalnız hiç iş kaydı olmayan hesaplar silinebilir.)`
                            )
                          )
                            calistir(() => kullaniciKaliciSil(u.id))
                        }}
                      >
                        Kalıcı sil
                      </Button>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {u.id === benId
                      ? "kendi hesabın"
                      : u.sahip
                        ? "sahip hesabı"
                        : "yalnız sahip yönetebilir"}
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function LinkKutusu({ link }: { link: string }) {
  const [kopyalandi, setKopyalandi] = useState(false)
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2 font-mono text-xs text-foreground"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => setKopyalandi(await kopyala(link))}
      >
        {kopyalandi ? "Kopyalandı" : "Kopyala"}
      </Button>
    </div>
  )
}
