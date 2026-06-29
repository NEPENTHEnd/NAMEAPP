-- ============================================================================
-- 0007 : Kişiye SABİT (yeniden kullanılabilir) davet kodu; tek-kullanım kaldırıldı
--        + yüceadmin fiş ön eki 0
-- SQL Editor'de YENİ sorgu açıp tamamını yapıştırıp Run deyin.
-- ============================================================================

-- 1) Her kişiye sabit kod ----------------------------------------------------
alter table public.davet_kisi add column if not exists kod text;
update public.davet_kisi
  set kod = 'NT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  where kod is null;
create unique index if not exists davet_kisi_kod_key on public.davet_kisi (kod);

-- 2) kod_rol / kayit_tamamla artık davet_kisi.kod'a göre (TEK KULLANIM DEĞİL) -
create or replace function public.kod_rol(p_kod text)
returns text language sql stable security definer set search_path = public as $$
  select rol from public.davet_kisi where kod = p_kod and aktif limit 1;
$$;
revoke all on function public.kod_rol(text) from public;
grant execute on function public.kod_rol(text) to anon, authenticated;

create or replace function public.kayit_tamamla(p_kod text)
returns text language plpgsql security definer set search_path = public as $$
declare v_rol text; v_prefix int;
begin
  select rol, fis_prefix into v_rol, v_prefix
    from public.davet_kisi where kod = p_kod and aktif limit 1;
  if v_rol is null then return null; end if;
  update public.kullanici_profil
    set rol = v_rol, fis_prefix = coalesce(v_prefix, fis_prefix)
    where id = auth.uid();
  return v_rol;
end;
$$;
revoke all on function public.kayit_tamamla(text) from public, anon;
grant execute on function public.kayit_tamamla(text) to authenticated;

-- 3) Kod yenileme (sahip) — kod ele geçerse değiştirmek için ------------------
create or replace function public.davet_kod_yenile(p_kisi_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_kod text;
begin
  if not public.sahip_mi() then raise exception 'Yetkisiz'; end if;
  v_kod := 'NT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  update public.davet_kisi set kod = v_kod where id = p_kisi_id;
  return v_kod;
end;
$$;
revoke all on function public.davet_kod_yenile(uuid) from public, anon;
grant execute on function public.davet_kod_yenile(uuid) to authenticated;

-- 4) yüceadmin fiş ön eki = 0 ------------------------------------------------
update public.kullanici_profil set fis_prefix = 0
  where id = (select id from auth.users where email = 'mustafaks478@gmail.com');
