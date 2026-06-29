"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

// "Kamerayı aç" düğmesi: webcam/telefon kamerasıyla foto çeker, File döndürür.
export function KameraYakala({
  onCek,
  etiket = "Kamerayı aç",
}: {
  onCek: (dosya: File) => void
  etiket?: string
}) {
  const [acik, setAcik] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  function durdur() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    return () => durdur() // bileşen kalkınca kamerayı kapat
  }, [])

  async function ac() {
    setHata(null)
    setAcik(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1600 } },
        audio: false,
      })
      streamRef.current = stream
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
    canvas.getContext("2d")?.drawImage(v, 0, 0)
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
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-h-[70vh] w-auto rounded-xl bg-black"
            />
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
