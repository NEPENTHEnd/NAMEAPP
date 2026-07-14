-- İş kaydına ayrı telefon alanı ve fiyat teklifi para birimi
alter table public.is_kaydi add column if not exists telefon text;
alter table public.is_kaydi add column if not exists teklif_birim text not null default 'TL';
