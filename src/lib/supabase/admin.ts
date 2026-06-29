import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

// SADECE SUNUCU. Servis-rolü anahtarıyla RLS'i aşar (cron/yedek gibi
// kullanıcı oturumu olmayan işler için). Asla istemciye sızdırma.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY tanımlı değil.")
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
