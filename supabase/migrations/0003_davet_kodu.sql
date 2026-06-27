-- ============================================================================
-- 0003 : Tek kullanımlık davet kodları + "sahip" (owner) ayrımı
-- SQL Editor'de YENİ sorgu açıp tamamını yapıştırıp Run deyin.
-- (0002'deki sabit kayit_kodu sistemi bununla değişir.)
-- ============================================================================

-- 1) Sahip (owner) bayrağı: yönetici daveti yalnız sahip üretebilir ----------
alter table public.kullanici_profil
  add column if not exists sahip boolean not null default false;

create or replace function public.sahip_mi()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.kullanici_profil where id = auth.uid() and sahip);
$$;
revoke all on function public.sahip_mi() from public, anon;
grant execute on function public.sahip_mi() to authenticated;

-- 2) Tek kullanımlık davet kodları tablosu -----------------------------------
create table if not exists public.davet_kodu (
  kod         text primary key,
  rol         text not null check (rol in ('teknisyen', 'yonetici')),
  kullanildi  boolean not null default false,
  olusturan_id uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.davet_kodu enable row level security;

-- Yönetici kodları listeleyebilir (kopyalayıp paylaşmak için). Yazma RPC ile.
drop policy if exists davet_select on public.davet_kodu;
create policy davet_select on public.davet_kodu
  for select to authenticated using (public.yonetici_mi());

-- 3) Kod üret: teknisyen -> yönetici; yönetici daveti -> yalnız sahip --------
create or replace function public.davet_uret(p_rol text)
returns text language plpgsql security definer set search_path = public as $$
declare v_kod text;
begin
  if p_rol = 'teknisyen' then
    if not public.yonetici_mi() then raise exception 'Yetkisiz'; end if;
  elsif p_rol = 'yonetici' then
    if not public.sahip_mi() then raise exception 'Yetkisiz'; end if;
  else
    raise exception 'Geçersiz rol';
  end if;
  v_kod := 'NT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.davet_kodu (kod, rol, olusturan_id) values (v_kod, p_rol, auth.uid());
  return v_kod;
end;
$$;
revoke all on function public.davet_uret(text) from public, anon;
grant execute on function public.davet_uret(text) to authenticated;

-- 4) Kayıt RPC'lerini tek kullanımlık koda göre yeniden tanımla --------------
create or replace function public.kod_rol(p_kod text)
returns text language sql stable security definer set search_path = public as $$
  select rol from public.davet_kodu where kod = p_kod and not kullanildi limit 1;
$$;
revoke all on function public.kod_rol(text) from public;
grant execute on function public.kod_rol(text) to anon, authenticated;

create or replace function public.kayit_tamamla(p_kod text)
returns text language plpgsql security definer set search_path = public as $$
declare v_rol text;
begin
  -- kodu atomik olarak tüket
  update public.davet_kodu set kullanildi = true
    where kod = p_kod and not kullanildi
    returning rol into v_rol;
  if v_rol is null then return null; end if;
  update public.kullanici_profil set rol = v_rol where id = auth.uid();
  return v_rol;
end;
$$;
revoke all on function public.kayit_tamamla(text) from public, anon;
grant execute on function public.kayit_tamamla(text) to authenticated;

-- 5) Eski sabit kod sistemini kaldır -----------------------------------------
drop table if exists public.kayit_kodu;

-- 6) İLK SAHİBİ ata (gerekirse e-postayı kendininkiyle değiştir) -------------
update public.kullanici_profil
set sahip = true, rol = 'yonetici'
where id = (select id from auth.users where email = 'mustafaks478@gmail.com');
