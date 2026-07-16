import Link from "next/link"

import { getYonetici } from "@/lib/auth"
import { ExcelYukle } from "@/components/excel-yukle"

export default async function IceAktarSayfasi() {
  await getYonetici() // yalnız yönetici

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← İşler
        </Link>
        <h1 className="mt-1 text-[21px] font-semibold tracking-tight">
          Excel&apos;den içe aktar
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Çalışma dosyasının güncel hâlini yükleyin; sistemde <strong>olmayan</strong>{" "}
          kayıtlar eklenir.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-muted/30 p-4 text-[12.5px] leading-relaxed">
        <div className="mb-1.5 font-semibold">Nasıl çalışır?</div>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            <strong className="text-foreground">Mevcut kayıtlar asla değişmez.</strong>{" "}
            Yalnız yeni satırlar eklenir. (Excel&apos;de bir işin çıkış tarihini
            doldurursanız bu sisteme <em>yansımaz</em> — o düzenlemeyi uygulamadan yapın.)
          </li>
          <li>
            Aynı üründen birden çok satır varsa <strong>adet olarak</strong> sayılır:
            Excel&apos;de 3, sistemde 2 varsa yalnız eksik 1 tanesi eklenir. Aynı dosyayı
            tekrar yüklerseniz kayıtlar çoğalmaz.
          </li>
          <li>
            Her sekme bir <strong>firmaya</strong> karşılık gelir. Karşılığı olmayan bir
            sekme ya da başlık varsa <strong>eklemeden önce uyarılırsınız</strong>.
          </li>
          <li>
            <strong>Fotoğraflar aktarılmaz</strong> — Excel&apos;deki resimler alınmaz,
            fotoğrafları uygulamadan ekleyin.
          </li>
        </ul>
      </div>

      <ExcelYukle />
    </div>
  )
}
