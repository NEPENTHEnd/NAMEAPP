"use client"

import { useTransition } from "react"

import { Button } from "@/components/ui/button"

// Onaylı silme. silAction sunucudan bind edilmiş server action'dır.
export function SilButonu({ silAction }: { silAction: () => Promise<void> }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="destructive"
      disabled={pending}
      onClick={() => {
        if (confirm("Bu iş kaydını silmek istediğinize emin misiniz?")) {
          startTransition(() => silAction())
        }
      }}
    >
      {pending ? "Siliniyor…" : "Sil"}
    </Button>
  )
}
