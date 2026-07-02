-- ============================================================================
-- 0015 : Fatura durumlarına sıra + hızlı filtre bayrağı (üst şerit butonları)
-- (Canlıya MCP ile uygulandı; kayıt için burada da tutulur.)
-- ============================================================================
alter table public.fatura_durumu add column if not exists sira int not null default 100;
alter table public.fatura_durumu add column if not exists hizli boolean not null default false;

update public.fatura_durumu set hizli = true, sira = 1 where ad = 'SONUÇ BEKLİYOR';
update public.fatura_durumu set hizli = true, sira = 2 where ad = 'TEKLİF HAZIRLANDI';
update public.fatura_durumu set hizli = true, sira = 3 where ad = 'TEKLİF VERİLECEK';
update public.fatura_durumu set hizli = true, sira = 4 where ad = 'FATURA EDİLECEK';
insert into public.fatura_durumu (ad, sira, hizli)
select 'ÜCRET ALINACAK', 5, true
where not exists (select 1 from public.fatura_durumu where ad = 'ÜCRET ALINACAK');
