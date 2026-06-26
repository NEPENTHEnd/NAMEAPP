import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl font-bold text-muted-foreground">404</div>
      <h1 className="text-lg font-semibold">Sayfa bulunamadı</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir.
      </p>
      <Link href="/" className={buttonVariants({ variant: "default" })}>
        İşler listesine dön
      </Link>
    </main>
  )
}
