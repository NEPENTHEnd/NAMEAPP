-- ============================================================================
-- 0012 : Kargo takip no alanı (iş kaydına)
-- (Canlıya MCP ile uygulandı; kayıt için burada da tutulur.)
-- ============================================================================
alter table public.is_kaydi add column if not exists kargo_takip_no text;
