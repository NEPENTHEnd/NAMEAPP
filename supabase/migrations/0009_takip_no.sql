-- ============================================================================
-- 0009 : Müşteri takip portalı — takip_no + herkese açık sorgu
-- (Canlıya MCP ile uygulandı; kayıt için burada da tutulur.)
-- ============================================================================
create extension if not exists pgcrypto;

-- Müşteriye verilecek, tahmin edilmesi zor takip kodu: NT + 6 hane
create or replace function public.gen_takip_no()
returns text language sql volatile set search_path = public as $$
  select 'NT' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
$$;

alter table public.is_kaydi add column if not exists takip_no text;
update public.is_kaydi set takip_no = public.gen_takip_no() where takip_no is null;
alter table public.is_kaydi alter column takip_no set default public.gen_takip_no();
alter table public.is_kaydi alter column takip_no set not null;
create unique index if not exists is_kaydi_takip_no_key on public.is_kaydi (takip_no);

-- Herkese açık sorgu: yalnız müşteriye gösterilebilir alanlar.
-- (fiyat, fatura, açıklama, adres, telefon DÖNMEZ)
create or replace function public.takip_sorgula(p_takip_no text)
returns table (
  musteri_ad text,
  cihaz_adi text,
  servis_no text,
  durum_ad text,
  durum_renk text,
  gelis_tarihi date,
  cikis_tarihi date
) language sql stable security definer set search_path = public as $$
  select m.ad, k.cihaz_adi, k.servis_no, d.ad, d.renk, k.gelis_tarihi, k.cikis_tarihi
  from public.is_kaydi k
  left join public.musteri m on m.id = k.musteri_id
  left join public.durum d on d.id = k.durum_id
  where upper(k.takip_no) = upper(trim(p_takip_no))
  limit 1;
$$;
revoke all on function public.takip_sorgula(text) from public;
grant execute on function public.takip_sorgula(text) to anon, authenticated;
