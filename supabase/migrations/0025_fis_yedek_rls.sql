-- ============================================================================
-- 0025 : _fis_yedek_20260831 tablosuna RLS
-- ----------------------------------------------------------------------------
-- 31 Ağu 2026 İsmail fiş no temizliğinde eski servis_no'ları saklamak için elle
-- açılan yedek tablo RLS'siz kalmıştı → Supabase kritik uyarısı
-- (rls_disabled_in_public): anon anahtarla herkes okuyup silebilirdi.
-- RLS açık + politika YOK → yalnız service_role erişir. Veri silinmez.
-- (Canlıya MCP ile uygulandı; kayıt için burada da tutulur.)
-- ============================================================================
alter table if exists public._fis_yedek_20260831 enable row level security;
