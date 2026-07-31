// İnternet yokken girilen YENİ işleri tarayıcıda (IndexedDB) saklar; bağlantı
// gelince components/cevrimdisi-senkron.tsx bunları sunucuya yükler.
// Yalnız YENİ İŞ girişi kuyruğa alınır (hep insert → çakışma yok).

const DB_AD = "nameteknik-cevrimdisi"
const STORE = "bekleyen"
const SURUM = 1

export type BekleyenIs = {
  id: string
  veri: [string, string][] // form (alan, değer) çiftleri — çoklu seri_no korunur
  fotolar: File[] // IndexedDB File/Blob saklayabilir
  zaman: number
  cihazAdi: string // listede göstermek için
}

function ac(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_AD, SURUM)
    r.onupgradeneeded = () => {
      const d = r.result
      if (!d.objectStoreNames.contains(STORE))
        d.createObjectStore(STORE, { keyPath: "id" })
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function istek<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function kuyrugaEkle(x: {
  veri: [string, string][]
  fotolar: File[]
  cihazAdi: string
}): Promise<void> {
  const d = await ac()
  const kayit: BekleyenIs = {
    id: crypto.randomUUID(),
    zaman: Date.now(),
    ...x,
  }
  const t = d.transaction(STORE, "readwrite")
  t.objectStore(STORE).add(kayit)
  await new Promise<void>((res, rej) => {
    t.oncomplete = () => res()
    t.onerror = () => rej(t.error)
  })
  d.close()
}

export async function kuyrukListe(): Promise<BekleyenIs[]> {
  const d = await ac()
  const l = await istek(d.transaction(STORE, "readonly").objectStore(STORE).getAll())
  d.close()
  return (l as BekleyenIs[]).sort((a, b) => a.zaman - b.zaman)
}

export async function kuyruktanSil(id: string): Promise<void> {
  const d = await ac()
  const t = d.transaction(STORE, "readwrite")
  t.objectStore(STORE).delete(id)
  await new Promise<void>((res, rej) => {
    t.oncomplete = () => res()
    t.onerror = () => rej(t.error)
  })
  d.close()
}
