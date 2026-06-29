"use client"

import { useActionState } from "react"

import { isFinansalGuncelle, type IsFormState } from "@/app/actions/is"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Secenek = { id: string; ad: string }

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15"

export function PanelFinansal({
  isKaydiId,
  faturaDurumlari,
  varsayilan,
}: {
  isKaydiId: string
  faturaDurumlari: Secenek[]
  varsayilan: {
    fatura_durumu_id: string | null
    fiyat_teklifi: number | null
    fatura_tutari: number | null
    garanti_no: string | null
  }
}) {
  const action = isFinansalGuncelle.bind(null, isKaydiId)
  const [state, formAction, pending] = useActionState<IsFormState, FormData>(
    action,
    {}
  )

  return (
    <form action={formAction} className="mt-3 grid gap-2 border-t border-border pt-3">
      <div className="text-[12px] font-semibold text-muted-foreground">
        Finansal (hızlı düzenle)
      </div>
      <select
        name="fatura_durumu_id"
        defaultValue={varsayilan.fatura_durumu_id ?? ""}
        className={selectClass}
      >
        <option value="">Fatura durumu —</option>
        {faturaDurumlari.map((f) => (
          <option key={f.id} value={f.id}>
            {f.ad}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <Input
          name="fiyat_teklifi"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="Teklif ₺"
          defaultValue={varsayilan.fiyat_teklifi ?? ""}
          className="h-8"
        />
        <Input
          name="fatura_tutari"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="Tutar ₺"
          defaultValue={varsayilan.fatura_tutari ?? ""}
          className="h-8"
        />
      </div>
      <Input
        name="garanti_no"
        placeholder="Garanti no (harf/rakam)"
        defaultValue={varsayilan.garanti_no ?? ""}
        className="h-8"
      />
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.basari && (
        <p className="text-xs font-medium text-emerald-600">Kaydedildi ✓</p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Finansalı kaydet"}
      </Button>
    </form>
  )
}
