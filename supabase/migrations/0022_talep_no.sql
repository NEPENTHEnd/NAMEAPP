-- Talep no: takip no'nun (garanti_no) yanında ayrı alan
alter table public.is_kaydi add column if not exists talep_no text;
