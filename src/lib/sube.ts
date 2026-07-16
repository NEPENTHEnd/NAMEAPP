type SubeSatir = { id: string; ad: string; ust_sube_id: string | null }

// Şubeleri ağaç sırasına dizer ve alt şubeleri girintiler:
//   TCDD NİĞDE
//   — NİĞDE MERKEZ
//   — NİĞDE 2
//   TCDD ADANA
// Açılır listede (form) hiyerarşiyi göstermek için.
export function subeSecenekleri(
  subeler: SubeSatir[]
): { id: string; ad: string }[] {
  const cocuklar = new Map<string, SubeSatir[]>()
  const kokler: SubeSatir[] = []
  for (const s of subeler) {
    if (s.ust_sube_id) {
      const l = cocuklar.get(s.ust_sube_id) ?? []
      l.push(s)
      cocuklar.set(s.ust_sube_id, l)
    } else {
      kokler.push(s)
    }
  }
  const sonuc: { id: string; ad: string }[] = []
  function gez(s: SubeSatir, derinlik: number) {
    sonuc.push({ id: s.id, ad: "— ".repeat(derinlik) + s.ad })
    for (const c of cocuklar.get(s.id) ?? []) gez(c, derinlik + 1)
  }
  for (const k of kokler) gez(k, 0)
  return sonuc
}
