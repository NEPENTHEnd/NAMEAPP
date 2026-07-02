-- ============================================================================
-- 0016 : Fatura durumlarına renk (durumlardaki gibi, Tanımlar'dan seçilir)
-- (Canlıya MCP ile uygulandı; kayıt için burada da tutulur.)
-- ============================================================================
alter table public.fatura_durumu add column if not exists renk text;

update public.fatura_durumu set renk = '#10b981' where ad = 'FATURA EDİLDİ' and renk is null;
update public.fatura_durumu set renk = '#f59e0b' where ad = 'FATURA EDİLECEK' and renk is null;
update public.fatura_durumu set renk = '#94a3b8' where ad = 'PEŞİN ALINDI' and renk is null;
update public.fatura_durumu set renk = '#3b82f6' where ad = 'GARANTİ' and renk is null;
update public.fatura_durumu set renk = '#cbb24f' where ad = 'SONUÇ BEKLİYOR' and renk is null;
update public.fatura_durumu set renk = '#ef4444' where ad = 'İADE' and renk is null;
