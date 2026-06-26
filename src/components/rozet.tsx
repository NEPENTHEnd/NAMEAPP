import type { CSSProperties } from "react"

// Durum/fatura nokta renkleri (tasarım handoff). Bilinmeyen durum için DB rengi.
const DURUM_DOT: Record<string, string> = {
  BAKILMADI: "#94a3b8",
  ONARIMDA: "#f59e0b",
  ONARILDI: "#10b981",
  "GERİ GELEN": "#ef4444",
  İADE: "#a855f7",
  SATIŞ: "#3b82f6",
}

const FATURA_DOT: Record<string, string> = {
  "FATURA EDİLDİ": "#10b981",
  "FATURA EDİLECEK": "#f59e0b",
  "PEŞİN ALINDI": "#94a3b8",
  GARANTİ: "#3b82f6",
  "SONUÇ BEKLİYOR": "#cbb24f",
  İADE: "#ef4444",
}

function gecerliHex(r: string | null | undefined): string | null {
  return r && /^#[0-9a-fA-F]{6}$/.test(r) ? r : null
}

// Tema-bağımsız tint: card/foreground değişkenleriyle karışır →
// açık temada koyu metin + açık zemin, koyu temada açık metin + koyu zemin.
function tint(c: string) {
  return {
    background: `color-mix(in oklab, ${c} 16%, var(--card))`,
    borderColor: `color-mix(in oklab, ${c} 42%, var(--card))`,
    color: `color-mix(in oklab, ${c} 78%, var(--foreground))`,
  }
}

const pill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 9px",
  borderRadius: 999,
  fontSize: "11.5px",
  fontWeight: 600,
  letterSpacing: ".01em",
  whiteSpace: "nowrap",
  borderWidth: 1,
  borderStyle: "solid",
}

const dotBase: CSSProperties = { width: 6, height: 6, borderRadius: 999, flex: "none" }

export function DurumRozeti({
  ad,
  renk,
}: {
  ad: string | null | undefined
  renk?: string | null
}) {
  if (!ad) return <span className="text-muted-foreground">—</span>
  const c = DURUM_DOT[ad] ?? gecerliHex(renk) ?? "#94a3b8"
  return (
    <span style={{ ...pill, ...tint(c) }}>
      <span style={{ ...dotBase, background: c }} />
      {ad}
    </span>
  )
}

export function FaturaRozeti({ ad }: { ad: string | null | undefined }) {
  if (!ad) return <span className="text-muted-foreground">—</span>
  const c = FATURA_DOT[ad] ?? "#94a3b8"
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
        color: `color-mix(in oklab, ${c} 78%, var(--foreground))`,
      }}
    >
      <span style={{ ...dotBase, background: c }} />
      {ad}
    </span>
  )
}
