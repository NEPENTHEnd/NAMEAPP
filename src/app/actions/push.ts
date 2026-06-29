"use server"

import { getKullanici } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

type RpcIstemci = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

// Cihazı push aboneliğine kaydeder (yalnız yöneticiler için anlamlı).
export async function pushAbone(sub: {
  endpoint: string
  p256dh: string
  auth: string
}): Promise<{ ok: boolean; error?: string }> {
  await getKullanici() // oturum şart
  const supabase = await createClient()
  const rpc = supabase as unknown as RpcIstemci
  const { error } = await rpc.rpc("push_kaydet", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.p256dh,
    p_auth: sub.auth,
  })
  return { ok: !error, error: error?.message }
}

// Cihaz aboneliğini siler.
export async function pushCikis(endpoint: string): Promise<{ ok: boolean }> {
  await getKullanici()
  const supabase = await createClient()
  const rpc = supabase as unknown as RpcIstemci
  await rpc.rpc("push_abonelik_temizle", { p_endpoint: endpoint })
  return { ok: true }
}
