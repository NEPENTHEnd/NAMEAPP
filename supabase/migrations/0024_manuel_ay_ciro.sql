-- ============================================================================
-- 0024 : manuel_ay_ciro — matriste GEÇMİŞ ayların ciro/adet'ini müdür ELLE girer
-- ----------------------------------------------------------------------------
-- Firma × Ay matrisi ciroyu is_kaydi'den (fatura ayı) hesaplar. Sistemin
-- başlamasından ÖNCEKİ aylar (Oca–Tem) boş kalıyor. Müdür o eski ayların
-- gerçek değerlerini (Excel "2026 GENEL"den) elle girebilsin diye bu tablo.
-- Kural (raporlar sayfasında birleştirme): sistemde veri VARSA sistem değeri
-- kazanır; yalnız sistem değeri 0 olan GEÇMİŞ ay hücresi elle doldurulur —
-- böylece asla çift sayım olmaz, güncel ay elle girilemez.
-- grup_id null = DİĞER (grupsuz). Yalnız yönetici yazar; herkes okur.
-- (Canlıya MCP ile uygulandı; kayıt için burada da tutulur.)
-- ============================================================================
create table if not exists public.manuel_ay_ciro (
  id uuid primary key default gen_random_uuid(),
  grup_id uuid references public.grup(id) on delete cascade,  -- null = DİĞER
  yil int not null,
  ay int not null check (ay between 1 and 12),
  tutar numeric,   -- ₺ ciro (para modu)
  adet int,        -- iş adedi (adet modu)
  updated_at timestamptz not null default now()
);
-- (grup, yıl, ay) benzersiz — null grup_id (DİĞER) dahil (coalesce sentinel).
create unique index if not exists manuel_ay_ciro_key
  on public.manuel_ay_ciro (coalesce(grup_id, '00000000-0000-0000-0000-000000000000'::uuid), yil, ay);

alter table public.manuel_ay_ciro enable row level security;
create policy manuel_ay_ciro_select on public.manuel_ay_ciro for select using (true);
create policy manuel_ay_ciro_insert on public.manuel_ay_ciro for insert with check (public.yonetici_mi());
create policy manuel_ay_ciro_update on public.manuel_ay_ciro for update using (public.yonetici_mi()) with check (public.yonetici_mi());
create policy manuel_ay_ciro_delete on public.manuel_ay_ciro for delete using (public.yonetici_mi());
