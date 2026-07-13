"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

type ZoomYetenek = { min: number; max: number; step: number }

// "Kamerayı aç" düğmesi: webcam/telefon kamerasıyla foto çeker, File döndürür.
// Zoom: donanım destekliyorsa gerçek kamera zoom'u (applyConstraints),
// desteklemiyorsa dijital zoom (görüntüyü kırparak).
export function KameraYakala({
  onCek,
  etiket = "Kamerayı aç",
}: {
  onCek: (dosya: File) => void
  etiket?: string
}) {
  const [acik, setAcik] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [zoomYetenek, setZoomYetenek] = useState<ZoomYetenek | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)

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
    return () => durdur() // bileşen kalkınca kamerayı kapat
  }, [])

  function zoomUygula(deger: number) {
    setZoom(deger)
    if (!dijital && trackRef.current) {
      // Gerçek kamera zoom'u
      trackRef.current
        .applyConstraints({ advanced: [{ zoom: deger }] } as unknown as MediaTrackConstraints)
        .catch(() => {})
    }
    // dijital modda önizleme CSS transform ile büyür (aşağıda)
  }

  async function ac() {
    setHata(null)
    setZoom(1)
    setZoomYetenek(null)
    setAcik(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 } },
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

  function kapat() {
    durdur()
    setAcik(false)
  }

  function cek() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement("canvas")
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext("2d")
    if (dijital && zoom > 1) {
      // Dijital zoom: ortadan kırp, tam kareye ölçekle
      const sw = v.videoWidth / zoom
      const sh = v.videoHeight / zoom
      const sx = (v.videoWidth - sw) / 2
      const sy = (v.videoHeight - sh) / 2
      ctx?.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    } else {
      ctx?.drawImage(v, 0, 0)
    }
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const ad = `kamera-${new Date().getTime()}.jpg`
          onCek(new File([blob], ad, { type: "image/jpeg" }))
        }
        kapat()
      },
      "image/jpeg",
      0.9
    )
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
          ) : (
            <>
              <div className="max-h-[64vh] overflow-hidden rounded-xl bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-auto"
                  style={{
                    maxHeight: "64vh",
                    // Dijital modda önizlemeyi büyüt (donanım modunda stream zaten zoomlu)
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
            </>
          )}
          <div className="flex items-center gap-3">
            {!hata && (
              <Button type="button" onClick={cek}>
                Fotoğrafı çek
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={kapat}>
              Kapat
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
