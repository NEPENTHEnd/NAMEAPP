-- Geliş saati — gelis_tarihi (date) bozulmadan, ayrı saat alanı.
-- Böylece mevcut ay aralığı filtreleri / raporlar / Excel çıktısı etkilenmez.
alter table public.is_kaydi add column if not exists gelis_saat time;
