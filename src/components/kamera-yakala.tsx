"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { MAKS_KENAR } from "@/lib/foto-istemci"

type ZoomYetenek = { min: number; max: number; step: number }
type Kutu = { x: number; y: number; w: number; h: number } // 0..1 (görsele oranlı)
type Kose = "nw" | "ne" | "sw" | "se"

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const MIN_KUTU = 0.12 // kırpma kutusu en küçük kenar (oran)
const KARART = "rgba(0,0,0,.5)" // kırpma kutusu dışını karartan şeritler
const ONIZLEME_KENAR = 1280 // kırpma ekranındaki önizleme (yalnız gösterim; kırpma tam kareden)

// Büyük kareden küçültülmüş kopya (yüksek kaliteli ölçekleme)
function kucult(
  src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, maks: number
): HTMLCanvasElement {
  const o = Math.min(1, maks / Math.max(sw, sh))
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.round(sw * o))
  c.height = Math.max(1, Math.round(sh * o))
  const ctx = c.getContext("2d")
  if (ctx) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height)
  }
  return c
}
const jpeg = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", q))

// "Kamerayı aç" düğmesi: webcam/telefon kamerasıyla foto çeker, File döndürür.
// Zoom: donanım destekliyorsa gerçek kamera zoom'u (applyConstraints),
// desteklemiyorsa dijital zoom (görüntüyü kırparak).
// Çektikten sonra KIRPMA aşaması: personel geniş açıda çıkan fazlalığı (ayak vs.)
// kutuyu sürükleyerek/köşeden boyutlandırarak kırpabilir; istemezse kırpmadan kullanır.
export function KameraYakala({
  onCek,
  etiket = "Kamerayı aç",
}: {
  onCek: (dosya: File) => void
  etiket?: string
}) {
  const [acik, setAcik] = useState(false)
  const [asama, setAsama] = useState<"kamera" | "kirp">("kamera")
  const [hata, setHata] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [zoomYetenek, setZoomYetenek] = useState<ZoomYetenek | null>(null)
  const [cekilenUrl, setCekilenUrl] = useState<string | null>(null)
  const [kutu, setKutu] = useState<Kutu>({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 })
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const kutuRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(1)
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)
  // Çekilen tam çözünürlüklü kare (kırpma bundan yapılır — kalite korunur)
  const kaynakRef = useRef<HTMLCanvasElement | null>(null)
  // İşlem kilidi: çekme/kırpma sürerken tekrar basılırsa AYNI foto birden çok
  // kez yüklenmesin. Ref = anlık (aynı tıklama döngüsünde bile) koruma, state = butonları kilitle.
  const [mesgul, setMesgul] = useState(false)
  const mesgulRef = useRef(false)
  const onizlemeRef = useRef<string | null>(null) // objectURL (bellek sızmasın diye revoke)
  const kirpAlanRef = useRef<HTMLDivElement>(null)
  const surukleRef = useRef<
    | { mod: "move" | Kose; px: number; py: number; box: Kutu; rw: number; rh: number }
    | null
  >(null)

  // Dijital zoom (donanım desteklemezse): min 1, max 4
  const dijital = zoomYetenek == null
  const zMin = zoomYetenek?.min ?? 1
  const zMax = zoomYetenek?.max ?? 4
  const zStep = zoomYetenek?.step ?? 0.1

  function durdur() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    trackRef.current = null
  }

  useEffect(() => {
    return () => {
      durdur() // bileşen kalkınca kamerayı kapat
      if (onizlemeRef.current) URL.revokeObjectURL(onizlemeRef.current)
    }
  }, [])

  function zoomUygula(deger: number) {
    setZoom(deger)
    zoomRef.current = deger
    if (!dijital && trackRef.current) {
      // Gerçek kamera zoom'u
      trackRef.current
        .applyConstraints({ advanced: [{ zoom: deger }] } as unknown as MediaTrackConstraints)
        .catch(() => {})
    }
    // dijital modda önizleme CSS transform ile büyür (aşağıda)
  }

  // İki parmakla aç/kapat (pinch) → yakınlaştır/uzaklaştır (yalnız kamera aşamasında)
  useEffect(() => {
    const el = kutuRef.current
    if (!acik || hata || asama !== "kamera" || !el) return
    const uzaklik = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    function baslat(e: TouchEvent) {
      if (e.touches.length === 2)
        pinchRef.current = { dist: uzaklik(e.touches), zoom: zoomRef.current }
    }
    function hareket(e: TouchEvent) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const oran = uzaklik(e.touches) / pinchRef.current.dist
        const yeni = Math.min(zMax, Math.max(zMin, +(pinchRef.current.zoom * oran).toFixed(2)))
        zoomUygula(yeni)
      }
    }
    function bitir(e: TouchEvent) {
      if (e.touches.length < 2) pinchRef.current = null
    }
    el.addEventListener("touchstart", baslat, { passive: false })
    el.addEventListener("touchmove", hareket, { passive: false })
    el.addEventListener("touchend", bitir)
    el.addEventListener("touchcancel", bitir)
    return () => {
      el.removeEventListener("touchstart", baslat)
      el.removeEventListener("touchmove", hareket)
      el.removeEventListener("touchend", bitir)
      el.removeEventListener("touchcancel", bitir)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik, hata, asama, dijital, zMin, zMax])

  function kilitle(): boolean {
    if (mesgulRef.current) return false // zaten işleniyor → yok say
    mesgulRef.current = true
    setMesgul(true)
    return true
  }
  function kilitAc() {
    mesgulRef.current = false
    setMesgul(false)
  }
  function onizlemeTemizle() {
    if (onizlemeRef.current) URL.revokeObjectURL(onizlemeRef.current)
    onizlemeRef.current = null
    setCekilenUrl(null)
  }

  async function ac() {
    setHata(null)
    setZoom(1)
    setZoomYetenek(null)
    onizlemeTemizle()
    setAsama("kamera")
    setAcik(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Yüksek çözünürlük iste — kırpınca kalite düşmesin (cihaz desteklediğince verir)
        video: { facingMode: "environment", width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: false,
      })
      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      trackRef.current = track
      // Donanım zoom yeteneği var mı?
      const cap = track.getCapabilities?.() as
        | (MediaTrackCapabilities & { zoom?: ZoomYetenek })
        | undefined
      if (cap?.zoom && typeof cap.zoom.max === "number" && cap.zoom.max > cap.zoom.min) {
        setZoomYetenek({
          min: cap.zoom.min,
          max: cap.zoom.max,
          step: cap.zoom.step || 0.1,
        })
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setHata("Kamera açılamadı (izin verilmedi ya da kamera yok).")
    }
  }

  function tamKapat() {
    durdur()
    setAcik(false)
    setAsama("kamera")
    onizlemeTemizle()
    kaynakRef.current = null
    kilitAc()
  }

  // Kareyi yakala → kırpma aşamasına geç. HIZLI: 4K video karesi anında çizilir
  // (yavaş ImageCapture.takePhoto ve senkron toDataURL yok). Son foto zaten
  // MAKS_KENAR'a (1600px) küçültüldüğü için 4K kare kırpmaya bol pay bırakır.
  async function cek() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    if (!kilitle()) return // art arda basışı yok say
    try {
      const kw = v.videoWidth
      const kh = v.videoHeight
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (dijital && zoom > 1) {
        // Dijital zoom: ortadan kırp
        const sw = kw / zoom
        const sh = kh / zoom
        canvas.width = Math.round(sw)
        canvas.height = Math.round(sh)
        ctx?.drawImage(v, (kw - sw) / 2, (kh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height)
      } else {
        canvas.width = kw
        canvas.height = kh
        ctx?.drawImage(v, 0, 0)
      }
      kaynakRef.current = canvas
      durdur() // kare alındı; kamerayı serbest bırak ("Tekrar çek" yeniden açar)
      // Önizleme: küçük kopya + ASENKRON JPEG → ekran donmaz
      const onz = kucult(canvas, 0, 0, canvas.width, canvas.height, ONIZLEME_KENAR)
      const blob = await jpeg(onz, 0.85)
      onizlemeTemizle()
      if (blob) {
        const url = URL.createObjectURL(blob)
        onizlemeRef.current = url
        setCekilenUrl(url)
      } else {
        setCekilenUrl(onz.toDataURL("image/jpeg", 0.85))
      }
      setKutu({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 })
      setAsama("kirp")
    } finally {
      kilitAc()
    }
  }

  // Kırpılan (veya tam) kareyi File olarak üret ve TEK SEFER emit et.
  // Doğrudan MAKS_KENAR boyutunda üretilir → kodlama ve yükleme hızlı.
  async function uret(alan: Kutu | null) {
    const src = kaynakRef.current
    if (!src) return
    if (!kilitle()) return // işlenirken tekrar basılırsa aynı foto 2. kez gitmesin
    const natW = src.width
    const natH = src.height
    const a = alan ?? { x: 0, y: 0, w: 1, h: 1 }
    const sx = Math.round(a.x * natW)
    const sy = Math.round(a.y * natH)
    const sw = Math.max(1, Math.round(a.w * natW))
    const sh = Math.max(1, Math.round(a.h * natH))
    const out = kucult(src, sx, sy, sw, sh, MAKS_KENAR)
    const blob = await jpeg(out, 0.85)
    if (!blob) {
      kilitAc() // nadir: kodlanamadı → kullanıcı tekrar deneyebilsin
      return
    }
    onCek(new File([blob], `kamera-${Date.now()}.jpg`, { type: "image/jpeg" }))
    tamKapat() // kilidi de açar
  }

  // --- Kırpma kutusu sürükleme (dokunma + fare, pointer capture ile) ---
  function basla(e: React.PointerEvent, mod: "move" | Kose) {
    e.preventDefault()
    e.stopPropagation()
    const rect = kirpAlanRef.current?.getBoundingClientRect()
    if (!rect) return
    surukleRef.current = { mod, px: e.clientX, py: e.clientY, box: { ...kutu }, rw: rect.width, rh: rect.height }
    // iOS Safari bazen fırlatır (pointer bitmişse) — overlay çökmesin
    try {
      kirpAlanRef.current?.setPointerCapture?.(e.pointerId)
    } catch {}
  }
  function tasi(e: React.PointerEvent) {
    const s = surukleRef.current
    if (!s) return
    const dx = (e.clientX - s.px) / s.rw
    const dy = (e.clientY - s.py) / s.rh
    let { x, y, w, h } = s.box
    if (s.mod === "move") {
      x = clamp(x + dx, 0, 1 - w)
      y = clamp(y + dy, 0, 1 - h)
    } else {
      if (s.mod === "nw" || s.mod === "sw") {
        const nx = clamp(x + dx, 0, x + w - MIN_KUTU)
        w = w + (x - nx)
        x = nx
      }
      if (s.mod === "ne" || s.mod === "se") {
        w = clamp(w + dx, MIN_KUTU, 1 - x)
      }
      if (s.mod === "nw" || s.mod === "ne") {
        const ny = clamp(y + dy, 0, y + h - MIN_KUTU)
        h = h + (y - ny)
        y = ny
      }
      if (s.mod === "sw" || s.mod === "se") {
        h = clamp(h + dy, MIN_KUTU, 1 - y)
      }
    }
    setKutu({ x, y, w, h })
  }
  function birak() {
    surukleRef.current = null
  }

  const koseStil: React.CSSProperties = {
    position: "absolute",
    width: 22,
    height: 22,
    background: "#fff",
    border: "2px solid var(--primary, #356854)",
    borderRadius: 4,
    touchAction: "none",
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={ac}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
        {etiket}
      </Button>

      {acik && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-4">
          {hata ? (
            <div className="rounded-lg bg-card p-4 text-center text-sm text-destructive">
              {hata}
            </div>
          ) : asama === "kamera" ? (
            <>
              <div
                ref={kutuRef}
                className="max-h-[64vh] overflow-hidden rounded-xl bg-black"
                style={{ touchAction: "none" }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-auto"
                  style={{
                    maxHeight: "64vh",
                    transform: dijital ? `scale(${zoom})` : undefined,
                    transformOrigin: "center",
                  }}
                />
              </div>

              {/* Zoom kontrolü */}
              <div className="flex w-full max-w-xs items-center gap-3 text-white">
                <button
                  type="button"
                  onClick={() => zoomUygula(Math.max(zMin, +(zoom - (zMax > 6 ? 1 : 0.5)).toFixed(2)))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl"
                  aria-label="Uzaklaş"
                >
                  −
                </button>
                <input
                  type="range"
                  min={zMin}
                  max={zMax}
                  step={zStep}
                  value={zoom}
                  onChange={(e) => zoomUygula(Number(e.target.value))}
                  className="flex-1 accent-primary"
                  aria-label="Yakınlaştırma"
                />
                <button
                  type="button"
                  onClick={() => zoomUygula(Math.min(zMax, +(zoom + (zMax > 6 ? 1 : 0.5)).toFixed(2)))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl"
                  aria-label="Yakınlaş"
                >
                  +
                </button>
                <span className="w-10 text-right text-sm tabular-nums">
                  {zoom.toFixed(1)}×
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Button type="button" onClick={cek} disabled={mesgul}>
                  {mesgul ? "İşleniyor…" : "Fotoğrafı çek"}
                </Button>
                <Button type="button" variant="secondary" onClick={tamKapat} disabled={mesgul}>
                  Kapat
                </Button>
              </div>
            </>
          ) : (
            // --- KIRPMA aşaması ---
            <>
              <p className="text-center text-[13px] text-white/90">
                Kutuyu sürükle · köşelerden boyutlandır · fazlalığı (ayak vb.) kırp
              </p>
              <div style={{ position: "relative", display: "inline-block", lineHeight: 0 }}>
                {cekilenUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cekilenUrl}
                    alt="Çekilen fotoğraf"
                    style={{ display: "block", maxHeight: "62vh", maxWidth: "92vw", width: "auto", borderRadius: 8 }}
                  />
                )}
                <div
                  ref={kirpAlanRef}
                  className="absolute inset-0"
                  style={{ touchAction: "none" }}
                  onPointerMove={tasi}
                  onPointerUp={birak}
                  onPointerCancel={birak}
                >
                  {/* Dış karartma — 4 şerit (yalnız görselin içinde; butonları soldurmaz) */}
                  <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: `${kutu.y * 100}%`, background: KARART, pointerEvents: "none" }} />
                  <div style={{ position: "absolute", left: 0, top: `${(kutu.y + kutu.h) * 100}%`, width: "100%", bottom: 0, background: KARART, pointerEvents: "none" }} />
                  <div style={{ position: "absolute", left: 0, top: `${kutu.y * 100}%`, width: `${kutu.x * 100}%`, height: `${kutu.h * 100}%`, background: KARART, pointerEvents: "none" }} />
                  <div style={{ position: "absolute", left: `${(kutu.x + kutu.w) * 100}%`, top: `${kutu.y * 100}%`, right: 0, height: `${kutu.h * 100}%`, background: KARART, pointerEvents: "none" }} />
                  {/* Kırpma kutusu — kenar + köşe tutamaçları */}
                  <div
                    onPointerDown={(e) => basla(e, "move")}
                    style={{
                      position: "absolute",
                      left: `${kutu.x * 100}%`,
                      top: `${kutu.y * 100}%`,
                      width: `${kutu.w * 100}%`,
                      height: `${kutu.h * 100}%`,
                      border: "2px solid #fff",
                      boxShadow: "0 0 0 1px rgba(0,0,0,.4)",
                      cursor: "move",
                      touchAction: "none",
                    }}
                  >
                    <div onPointerDown={(e) => basla(e, "nw")} style={{ ...koseStil, left: -11, top: -11, cursor: "nwse-resize" }} />
                    <div onPointerDown={(e) => basla(e, "ne")} style={{ ...koseStil, right: -11, top: -11, cursor: "nesw-resize" }} />
                    <div onPointerDown={(e) => basla(e, "sw")} style={{ ...koseStil, left: -11, bottom: -11, cursor: "nesw-resize" }} />
                    <div onPointerDown={(e) => basla(e, "se")} style={{ ...koseStil, right: -11, bottom: -11, cursor: "nwse-resize" }} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button type="button" onClick={() => uret(kutu)} disabled={mesgul}>
                  {mesgul ? "Kaydediliyor…" : "Kırp ve kullan"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => uret(null)} disabled={mesgul}>
                  Kırpmadan kullan
                </Button>
                <Button type="button" variant="outline" onClick={ac} disabled={mesgul}>
                  Tekrar çek
                </Button>
                <Button type="button" variant="ghost" className="text-white hover:text-white" onClick={tamKapat} disabled={mesgul}>
                  Vazgeç
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
