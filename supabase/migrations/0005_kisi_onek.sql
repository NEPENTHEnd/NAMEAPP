-- ============================================================================
-- 0005 : Fiş ön ekini KULLANICIYA taşı; davet kodu kişiye göre (rol + ön ek);
--        teknik_personel = onarım teknikerleri (Excel isimleri).
-- SQL Editor'de YENİ sorgu açıp tamamını yapıştırıp Run deyin.
-- (0004'ün ön-ek kısmını düzeltir; 0004'ü çalıştırmadıysanız da sorunsuz çalışır.)
-- ============================================================================

-- 1) Fiş ön eki kullanıcı profilinde -----------------------------------------
alter table public.kullanici_profil add column if not exists fis_prefix int;
alter table public.davet_kodu add column if not exists fis_prefix int;

-- 2) Davet için kişi tanımları (ad, ön ek, rol) ------------------------------
create table if not exists public.davet_kisi (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  fis_prefix int not null unique,
  rol text not null check (rol in ('teknisyen', 'yonetici')),  -- teknisyen = "Personel"
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.davet_kisi enable row level security;
drop policy if exists davet_kisi_select on public.davet_kisi;
create policy davet_kisi_select on public.davet_kisi
  for select to authenticated using (public.yonetici_mi());

-- 9 kişi (yonetici: İsmail/Ahmet/Nazım/Şevket; personel: Osman/Özkan/Alpay/Emre/Furkan)
insert into public.davet_kisi (ad, fis_prefix, rol) values
  ('İsmail', 1, 'yonetici'), ('Ahmet', 2, 'yonetici'),
  ('Nazım', 3, 'yonetici'), ('Şevket', 4, 'yonetici'),
  ('Osman', 5, 'teknisyen'), ('Özkan', 6, 'teknisyen'),
  ('Alpay', 7, 'teknisyen'), ('Emre', 8, 'teknisyen'),
  ('Furkan', 9, 'teknisyen')
on conflict (fis_prefix) do nothing;

-- 3) Davet üret: kişiye göre. yonetici rolü -> sahip; personel -> yönetici ---
drop function if exists public.davet_uret(text);
drop function if exists public.davet_uret(text, uuid);
create or replace function public.davet_uret(p_kisi_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_rol text; v_prefix int; v_kod text;
begin
  select rol, fis_prefix into v_rol, v_prefix
    from public.davet_kisi where id = p_kisi_id and aktif;
  if v_rol is null then raise exception 'Kişi bulunamadı'; end if;
  if v_rol = 'yonetici' then
    if not public.sahip_mi() then raise exception 'Yetkisiz'; end if;
  else
    if not public.yonetici_mi() then raise exception 'Yetkisiz'; end if;
  end if;
  v_kod := 'NT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.davet_kodu (kod, rol, fis_prefix, olusturan_id)
    values (v_kod, v_rol, v_prefix, auth.uid());
  return v_kod;
end;
$$;
revoke all on function public.davet_uret(uuid) from public, anon;
grant execute on function public.davet_uret(uuid) to authenticated;

-- 3b) Yeni kişi ekle (sahip): sıradaki ön eki otomatik atar ------------------
create or replace function public.davet_kisi_ekle(p_ad text, p_rol text)
returns void language plpgsql security definer set search_path = public as $$
declare v_next int;
begin
  if not public.sahip_mi() then raise exception 'Yetkisiz'; end if;
  if p_rol not in ('teknisyen', 'yonetici') then raise exception 'Geçersiz rol'; end if;
  select coalesce(max(fis_prefix), 0) + 1 into v_next from public.davet_kisi;
  insert into public.davet_kisi (ad, fis_prefix, rol) values (p_ad, v_next, p_rol);
end;
$$;
revoke all on function public.davet_kisi_ekle(text, text) from public, anon;
grant execute on function public.davet_kisi_ekle(text, text) to authenticated;

-- 4) Kayıt tamamla: rol + fiş ön eki ata -------------------------------------
create or replace function public.kayit_tamamla(p_kod text)
returns text language plpgsql security definer set search_path = public as $$
declare v_rol text; v_prefix int;
begin
  update public.davet_kodu set kullanildi = true
    where kod = p_kod and not kullanildi
    returning rol, fis_prefix into v_rol, v_prefix;
  if v_rol is null then return null; end if;
  update public.kullanici_profil
    set rol = v_rol, fis_prefix = coalesce(v_prefix, fis_prefix)
    where id = auth.uid();
  return v_rol;
end;
$$;
revoke all on function public.kayit_tamamla(text) from public, anon;
grant execute on function public.kayit_tamamla(text) to authenticated;

-- 5) Fiş no: ön eki KULLANICIDAN al ------------------------------------------
-- (sayaç tablosu 0004'te oluşturuldu; 0004 çalışmadıysa diye yine garanti)
create table if not exists public.fis_sayac (
  prefix int not null,
  donem  text not null,
  sayac  int not null default 0,
  primary key (prefix, donem)
);
alter table public.fis_sayac enable row level security;

create or replace function public.fis_no_uret()
returns text language plpgsql security definer set search_path = public as $$
declare v_prefix int; v_donem text; v_sayac int;
begin
  select fis_prefix into v_prefix from public.kullanici_profil where id = auth.uid();
  if v_prefix is null then return null; end if;
  v_donem := to_char(now() at time zone 'Europe/Istanbul', 'MMYYYY');
  insert into public.fis_sayac (prefix, donem, sayac) values (v_prefix, v_donem, 1)
    on conflict (prefix, donem) do update set sayac = public.fis_sayac.sayac + 1
    returning sayac into v_sayac;
  return v_donem || v_prefix::text || lpad(v_sayac::text, 3, '0');
end;
$$;
revoke all on function public.fis_no_uret() from public, anon;
grant execute on function public.fis_no_uret() to authenticated;

-- 6) teknik_personel = onarım teknikerleri (Excel) ---------------------------
delete from public.teknik_personel
  where ad in ('Şevket Türkmen','Osman Mermi','Özkan Yıldız','Alpay','Emre Nalu','Furkan Yorulmaz');
alter table public.teknik_personel drop column if exists fis_prefix;
insert into public.teknik_personel (ad, aktif)
select v.ad, true from (values
  ('OKAN'),('ALAHATTİN'),('ÖMER'),('REMZİ'),('AHMET'),('NAZIM'),('FARUK')
) v(ad)
where not exists (select 1 from public.teknik_personel t where t.ad = v.ad);
