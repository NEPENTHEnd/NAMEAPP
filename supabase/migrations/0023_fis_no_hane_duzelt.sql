-- ============================================================================
-- 0023 : Fiş no BUG düzeltmesi — sayaç 99'u geçince numara KIRPILIYORDU
-- ----------------------------------------------------------------------------
-- 0017'de sıra için lpad(v_sayac::text, 2, '0') kullanılmıştı. Postgres'te
-- lpad, string HEDEF UZUNLUKTAN UZUNSA sağdan KIRPAR:  lpad('175', 2) = '17'.
-- Yani sayaç 100+ olunca (3 hane) fiş 2 haneye kırpılıp eski numarayla
-- çakışıyordu:  sayaç 100-109 -> '...110', 130-137 -> '...113', 175/176 -> '...117'.
-- Yalnız sayacı 99'u geçen kullanıcıda (İsmail) görüldü.
-- Düzeltme: min 2 hane, 99 aşılınca 3+ haneye GENİŞLE (kırpma yok).
-- (Canlıya MCP ile uygulandı; kayıt için burada da tutulur.)
-- ============================================================================
create or replace function public.fis_no_uret()
returns text language plpgsql security definer set search_path to 'public' as $function$
declare v_prefix int; v_donem text; v_sayac int;
begin
  select fis_prefix into v_prefix from public.kullanici_profil where id = auth.uid();
  if v_prefix is null then return null; end if;
  v_donem := to_char(now() at time zone 'Europe/Istanbul', 'MMYYYY');
  insert into public.fis_sayac (prefix, donem, sayac) values (v_prefix, v_donem, 1)
    on conflict (prefix, donem) do update set sayac = public.fis_sayac.sayac + 1
    returning sayac into v_sayac;
  return to_char(now() at time zone 'Europe/Istanbul', 'MMYY')
         || v_prefix::text
         || case when v_sayac < 10 then '0' || v_sayac::text else v_sayac::text end;
end;
$function$;
