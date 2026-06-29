-- ============================================================================
-- 0013 : Güvenlik sertleştirme — açık kayıt kapatma
-- Yeni hesaplar 'bekliyor' rolüyle başlar (yetkisiz). Gerçek rol yalnız
-- geçerli davet koduyla (kayit_tamamla) verilir. İş/müşteri ekleme gerçek
-- rol ister. Test daveti + kullanılmayan legacy fonksiyonlar kaldırıldı.
-- (Canlıya MCP ile uygulandı; kayıt için burada da tutulur.)
-- ============================================================================
do $$
declare cname text;
begin
  select conname into cname from pg_constraint
   where conrelid='public.kullanici_profil'::regclass and contype='c'
     and pg_get_constraintdef(oid) ilike '%rol%';
  if cname is not null then
    execute 'alter table public.kullanici_profil drop constraint '||quote_ident(cname);
  end if;
end $$;
alter table public.kullanici_profil
  add constraint kullanici_profil_rol_check check (rol in ('bekliyor','teknisyen','yonetici'));

alter table public.kullanici_profil alter column rol set default 'bekliyor';

create or replace function public.kayitli_mi()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.kullanici_profil
     where id = auth.uid() and rol in ('teknisyen','yonetici')
  );
$$;
revoke all on function public.kayitli_mi() from public, anon;
grant execute on function public.kayitli_mi() to authenticated;

drop policy if exists is_kaydi_insert on public.is_kaydi;
create policy is_kaydi_insert on public.is_kaydi
  for insert to authenticated
  with check (olusturan_id = auth.uid() and public.kayitli_mi());

drop policy if exists musteri_insert on public.musteri;
create policy musteri_insert on public.musteri
  for insert to authenticated
  with check (public.kayitli_mi());

delete from public.davet_kisi where ad = 'deneme';
drop function if exists public.davet_uret(uuid);
drop function if exists public.davet_kisi_ekle(text, text);
