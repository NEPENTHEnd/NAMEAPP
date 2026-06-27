-- ============================================================================
-- 0004 : Tekniker fiş numarası (aylık sayaç) + davet kodunun kişiye atanması
-- SQL Editor'de YENİ sorgu açıp tamamını yapıştırıp Run deyin.
-- ============================================================================

-- 1) teknik_personel'e fiş ön eki (1..N, benzersiz) --------------------------
alter table public.teknik_personel add column if not exists fis_prefix int;
create unique index if not exists teknik_personel_fis_prefix_key
  on public.teknik_personel (fis_prefix) where fis_prefix is not null;

-- Sabit 6 kişi (aynı isim yoksa ekle)
insert into public.teknik_personel (ad, fis_prefix, aktif)
select v.ad, v.p, true
from (values
  ('Şevket Türkmen', 1), ('Osman Mermi', 2), ('Özkan Yıldız', 3),
  ('Alpay', 4), ('Emre Nalu', 5), ('Furkan Yorulmaz', 6)
) as v(ad, p)
where not exists (select 1 from public.teknik_personel t where t.ad = v.ad);

-- 2) davet kodunu bir personele (isme) bağla ---------------------------------
alter table public.davet_kodu add column if not exists teknik_personel_id uuid
  references public.teknik_personel(id) on delete set null;

-- 3) Fiş sayacı: (prefix, dönem=MMYYYY) -> sayaç -----------------------------
create table if not exists public.fis_sayac (
  prefix int not null,
  donem  text not null,
  sayac  int not null default 0,
  primary key (prefix, donem)
);
alter table public.fis_sayac enable row level security; -- politika yok: yalnız RPC

-- 4) Giriş yapan teknikerin sıradaki fiş numarasını üret ---------------------
create or replace function public.fis_no_uret()
returns text language plpgsql security definer set search_path = public as $$
declare v_prefix int; v_donem text; v_sayac int;
begin
  select tp.fis_prefix into v_prefix
    from public.kullanici_profil p
    join public.teknik_personel tp on tp.id = p.teknik_personel_id
    where p.id = auth.uid();
  if v_prefix is null then return null; end if; -- ön ek yoksa otomatik üretme
  v_donem := to_char(now() at time zone 'Europe/Istanbul', 'MMYYYY');
  insert into public.fis_sayac (prefix, donem, sayac) values (v_prefix, v_donem, 1)
    on conflict (prefix, donem) do update set sayac = public.fis_sayac.sayac + 1
    returning sayac into v_sayac;
  return v_donem || v_prefix::text || lpad(v_sayac::text, 3, '0');
end;
$$;
revoke all on function public.fis_no_uret() from public, anon;
grant execute on function public.fis_no_uret() to authenticated;

-- 5) davet_uret: teknisyen kodu bir personele atanabilir ---------------------
drop function if exists public.davet_uret(text);
create or replace function public.davet_uret(p_rol text, p_personel_id uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_kod text;
begin
  if p_rol = 'teknisyen' then
    if not public.yonetici_mi() then raise exception 'Yetkisiz'; end if;
  elsif p_rol = 'yonetici' then
    if not public.sahip_mi() then raise exception 'Yetkisiz'; end if;
  else raise exception 'Geçersiz rol'; end if;
  v_kod := 'NT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.davet_kodu (kod, rol, olusturan_id, teknik_personel_id)
    values (v_kod, p_rol, auth.uid(), p_personel_id);
  return v_kod;
end;
$$;
revoke all on function public.davet_uret(text, uuid) from public, anon;
grant execute on function public.davet_uret(text, uuid) to authenticated;

-- 6) kayit_tamamla: koddaki personeli profile bağla --------------------------
create or replace function public.kayit_tamamla(p_kod text)
returns text language plpgsql security definer set search_path = public as $$
declare v_rol text; v_personel uuid;
begin
  update public.davet_kodu set kullanildi = true
    where kod = p_kod and not kullanildi
    returning rol, teknik_personel_id into v_rol, v_personel;
  if v_rol is null then return null; end if;
  update public.kullanici_profil
    set rol = v_rol,
        teknik_personel_id = coalesce(v_personel, teknik_personel_id)
    where id = auth.uid();
  return v_rol;
end;
$$;
revoke all on function public.kayit_tamamla(text) from public, anon;
grant execute on function public.kayit_tamamla(text) to authenticated;
