-- ============================================================================
-- 0002 : Roller, davet kodu ile kayıt, iş sahipliği
-- Supabase SQL Editor'e yapıştırıp Run deyin.
-- ============================================================================

-- 1) İş kaydına "ekleyen" (sahip) bilgisi -----------------------------------
alter table public.is_kaydi
  add column if not exists olusturan_id uuid references auth.users(id) on delete set null;
create index if not exists is_kaydi_olusturan_idx on public.is_kaydi (olusturan_id);

-- 2) Davet kodları (gizli tablo: RLS açık + politika YOK -> yalnız SECURITY
--    DEFINER fonksiyonlar okuyabilir; anon/authenticated doğrudan göremez) ---
create table if not exists public.kayit_kodu (
  rol text primary key check (rol in ('teknisyen', 'yonetici')),
  kod text not null
);
alter table public.kayit_kodu enable row level security;

-- BAŞLANGIÇ KODLARI — bunları değiştirin! (update public.kayit_kodu set kod='...' where rol='...')
insert into public.kayit_kodu (rol, kod) values
  ('teknisyen', 'TKN-2026-7H4QZ9'),
  ('yonetici',  'YON-2026-3B8K6P')
on conflict (rol) do nothing;

-- 3) Kod -> rol (ön kontrol; kod geçerli mi) ---------------------------------
create or replace function public.kod_rol(p_kod text)
returns text language sql stable security definer set search_path = public as $$
  select rol from public.kayit_kodu where kod = p_kod limit 1;
$$;
revoke all on function public.kod_rol(text) from public;
grant execute on function public.kod_rol(text) to anon, authenticated;

-- 4) Kayıt tamamla: giriş yapan kullanıcının rolünü koda göre ayarlar --------
create or replace function public.kayit_tamamla(p_kod text)
returns text language plpgsql security definer set search_path = public as $$
declare v_rol text;
begin
  select rol into v_rol from public.kayit_kodu where kod = p_kod limit 1;
  if v_rol is null then
    return null;
  end if;
  update public.kullanici_profil set rol = v_rol where id = auth.uid();
  return v_rol;
end;
$$;
revoke all on function public.kayit_tamamla(text) from public, anon;
grant execute on function public.kayit_tamamla(text) to authenticated;

-- 5) Profil: kullanıcı KENDİ rolünü değiştiremez (yalnız yönetici) -----------
drop policy if exists profil_update_self on public.kullanici_profil;
drop policy if exists profil_update_yonetici on public.kullanici_profil;
create policy profil_update_yonetici on public.kullanici_profil
  for update to authenticated
  using (public.yonetici_mi()) with check (public.yonetici_mi());

-- 6) is_kaydi: teknisyen yalnız KENDİ işlerini görür/günceller; yönetici hepsi
drop policy if exists is_kaydi_select on public.is_kaydi;
create policy is_kaydi_select on public.is_kaydi
  for select to authenticated
  using (public.yonetici_mi() or olusturan_id = auth.uid());

drop policy if exists is_kaydi_insert on public.is_kaydi;
create policy is_kaydi_insert on public.is_kaydi
  for insert to authenticated
  with check (olusturan_id = auth.uid());

drop policy if exists is_kaydi_update on public.is_kaydi;
create policy is_kaydi_update on public.is_kaydi
  for update to authenticated
  using (public.yonetici_mi() or olusturan_id = auth.uid())
  with check (public.yonetici_mi() or olusturan_id = auth.uid());

-- 7) foto: yalnız erişilebilir işin fotoğrafları -----------------------------
drop policy if exists foto_select on public.foto;
create policy foto_select on public.foto
  for select to authenticated using (
    exists (select 1 from public.is_kaydi k where k.id = foto.is_kaydi_id
            and (public.yonetici_mi() or k.olusturan_id = auth.uid()))
  );

drop policy if exists foto_insert on public.foto;
create policy foto_insert on public.foto
  for insert to authenticated with check (
    exists (select 1 from public.is_kaydi k where k.id = foto.is_kaydi_id
            and (public.yonetici_mi() or k.olusturan_id = auth.uid()))
  );

drop policy if exists foto_delete on public.foto;
create policy foto_delete on public.foto
  for delete to authenticated using (
    exists (select 1 from public.is_kaydi k where k.id = foto.is_kaydi_id
            and (public.yonetici_mi() or k.olusturan_id = auth.uid()))
  );
