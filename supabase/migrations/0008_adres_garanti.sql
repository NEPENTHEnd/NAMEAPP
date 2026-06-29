-- ============================================================================
-- 0008 : İş kaydına adres + garanti no alanları
-- SQL Editor'de YENİ sorgu açıp çalıştırın.
-- ============================================================================
alter table public.is_kaydi add column if not exists adres text;
alter table public.is_kaydi add column if not exists garanti_no text;
