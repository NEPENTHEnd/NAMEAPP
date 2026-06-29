-- ============================================================================
-- 0006 : Fotoğraf deposu kullanımı (bar için) + yardımcılar
-- SQL Editor'de YENİ sorgu açıp çalıştırın.
-- ============================================================================

-- 'foto' bucket'ındaki toplam boyut (byte) ve dosya sayısı.
create or replace function public.foto_kullanim()
returns table (toplam_byte bigint, adet bigint)
language sql security definer set search_path = public, storage as $$
  select
    coalesce(sum((metadata->>'size')::bigint), 0)::bigint as toplam_byte,
    count(*)::bigint as adet
  from storage.objects
  where bucket_id = 'foto';
$$;
revoke all on function public.foto_kullanim() from public, anon;
grant execute on function public.foto_kullanim() to authenticated;
