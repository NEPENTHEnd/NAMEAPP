import webpush from "web-push"

import type { createClient } from "@/lib/supabase/server"

// Tipli istemcide tanımlı olmayan RPC'ler için sade arayüz
type RpcIstemci = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

let yapilandirildi = false
function vapidHazirla(): boolean {
  if (yapilandirildi) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subj = process.env.VAPID_SUBJECT || "mailto:admin@nameteknik.com"
  if (!pub || !priv) return false
  webpush.setVapidDetails(subj, pub, priv)
  yapilandirildi = true
  return true
}

type Abonelik = { endpoint: string; p256dh: string; auth: string }

// Tüm yöneticilere push bildirim gönderir. Hata olsa da iş akışını bozmaz.
export async function yoneticilereBildir(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mesaj: { baslik: string; govde: string; url?: string; tag?: string }
): Promise<void> {
  if (!vapidHazirla()) return // anahtarlar yoksa sessizce çık

  const rpc = supabase as unknown as RpcIstemci
  const { data } = await rpc.rpc("push_yonetici_abonelikleri")
  const abonelikler = (Array.isArray(data) ? data : []) as Abonelik[]
  if (abonelikler.length === 0) return

  const payload = JSON.stringify(mesaj)

  await Promise.allSettled(
    abonelikler.map(async (a) => {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          payload
        )
      } catch (e: unknown) {
        const kod = (e as { statusCode?: number })?.statusCode
        if (kod === 404 || kod === 410) {
          // Abonelik geçersiz → temizle
          await rpc.rpc("push_abonelik_temizle", { p_endpoint: a.endpoint })
        }
      }
    })
  )
}
