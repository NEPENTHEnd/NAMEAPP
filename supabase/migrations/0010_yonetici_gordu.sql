-- ============================================================================
-- 0010 : Uygulama içi bildirim — yönetici "okunmamış yeni iş" rozeti
-- (Canlıya MCP ile uygulandı; kayıt için burada da tutulur.)
-- ============================================================================
alter table public.is_kaydi add column if not exists yonetici_gordu boolean not null default false;

-- Mevcut kayıtları "görüldü" say (ilk açılışta bildirim seli olmasın)
update public.is_kaydi set yonetici_gordu = true where yonetici_gordu = false;
