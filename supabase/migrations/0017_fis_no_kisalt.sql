-- ============================================================================
-- 0017 : Fiş no formatı kısaltıldı
-- Eski: AY + YIL(4) + önek + sıra(3)   ->  072026 8 007  = 0720268007
-- Yeni: AY + YIL(2) + önek + sıra(≥2)  ->  0726 8 07     = 0726807
-- Ay içinde 99 aşılırsa sıra kendiliğinden 3 haneye çıkar: 0726 8 100 = 07268100
-- Sayaç dönemi (MMYYYY) ve aylık sıfırlama aynı kalır; yalnız çıktı kısalır.
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
         || lpad(v_sayac::text, 2, '0');
end;
$function$;

-- Mevcut 10 haneli otomatik fiş numaralarını yeni kısa biçime çevir
update public.is_kaydi
set servis_no =
  substr(servis_no,1,2) || substr(servis_no,5,2) || substr(servis_no,7,1)
    || lpad((substr(servis_no,8,3))::int::text, 2, '0')
where servis_no ~ '^(0[1-9]|1[0-2])(20[0-9]{2})([0-9])([0-9]{3})$';
