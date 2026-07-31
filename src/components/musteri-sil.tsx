"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"

import { musteriSil } from "@/app/actions/tanim"
import { Button } from "@/components/ui/button"
import { kaydedildiGoster } from "@/lib/toast"

// Müşteriyi uyarıyla sil — işleri silinmez, "Müşterisiz" olur (FK set null)
export function MusteriSil({
  id,
  ad,
  isSayisi,
}: {
  id: string
  ad: string
  isSayisi: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function tikla() {
    const mesaj =
      isSayisi > 0
        ? `"${ad}" müşterisi silinecek.\n\n${isSayisi} işi "Müşterisiz" klasörüne taşınacak (işler SİLİNMEZ). Emin misin?`
        : `"${ad}" müşterisi silinecek. Emin misin?`
    if (!window.confirm(mesaj)) return
    startTransition(async () => {
      await musteriSil(id)
      kaydedildiGoster("Silindi")
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={tikla}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      Sil
    </Button>
  )
}
