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
    teklif_birim: string | null
    fatura_tutari: number | null
    fatura_tarihi: string | null
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
        <div className="flex gap-1">
          <Input
            name="fiyat_teklifi"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Fiyat teklifi"
            defaultValue={varsayilan.fiyat_teklifi ?? ""}
            className="h-8 flex-1"
          />
          <select
            name="teklif_birim"
            defaultValue={varsayilan.teklif_birim ?? "TL"}
            aria-label="Para birimi"
            className="h-8 w-[64px] shrink-0 rounded-lg border border-input bg-card px-1.5 text-sm outline-none focus:border-primary"
          >
            <option value="TL">TL</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <Input
          name="fatura_tutari"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="Tutar (TL)"
          defaultValue={varsayilan.fatura_tutari ?? ""}
          className="h-8"
        />
      </div>
      <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
        Fatura tarihi
        <Input
          name="fatura_tarihi"
          type="date"
          defaultValue={varsayilan.fatura_tarihi ?? ""}
          className="h-8"
        />
      </label>
      <Input
        name="garanti_no"
        placeholder="Takip no (harf/rakam)"
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
