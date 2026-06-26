"use client"

import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto grid max-w-md gap-4 rounded-lg border p-6 text-center">
      <h2 className="text-lg font-semibold">Bir şeyler ters gitti</h2>
      <p className="text-sm text-muted-foreground">
        Beklenmeyen bir hata oluştu. Tekrar deneyebilir ya da sayfayı
        yenileyebilirsiniz.
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">Hata kodu: {error.digest}</p>
      ) : null}
      <div className="flex justify-center">
        <Button onClick={reset}>Tekrar dene</Button>
      </div>
    </div>
  )
}
