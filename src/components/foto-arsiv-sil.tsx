"use client"

import { useTransition } from "react"

import { fotolariSil } from "@/app/actions/foto"
import { Button } from "@/components/ui/button"

export function FotoArsivSil({ ay, adet }: { ay: string; adet: number }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={pending || adet === 0}
      onClick={() => {
        if (
          confirm(
            `${adet} fotoğraf KALICI olarak silinecek. Önce ZIP olarak indirip yedeklediğinizden emin olun. Devam edilsin mi?`
          )
        ) {
          startTransition(() => fotolariSil(ay))
        }
      }}
    >
      {pending ? "Siliniyor…" : "Fotoğrafları sil"}
    </Button>
  )
}
