-- ============================================================================
-- 0014 : Büyük şirket grupları (sol menü) + fatura tarihi
-- DİĞER = grup_id NULL (sanal, tabloda yok). (Canlıya MCP ile uygulandı.)
-- ============================================================================
create table if not exists public.grup (
  id uuid primary key default gen_random_uuid(),
  ad text not null unique,
  sira int not null default 0,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.grup enable row level security;

drop policy if exists grup_select on public.grup;
create policy grup_select on public.grup for select to authenticated using (true);
drop policy if exists grup_insert on public.grup;
create policy grup_insert on public.grup for insert to authenticated with check (public.yonetici_mi());
drop policy if exists grup_update on public.grup;
create policy grup_update on public.grup for update to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
drop policy if exists grup_delete on public.grup;
create policy grup_delete on public.grup for delete to authenticated using (public.yonetici_mi());

insert into public.grup (ad, sira) values
  ('SOLAR', 1), ('ŞİRKİŞOĞLU', 2), ('BOYTEKS', 3), ('BOYDAK GRUP', 4),
  ('BOYTAŞ-3', 5), ('HASÇELİK KABLO', 6), ('HASÇELİK HALAT', 7), ('TEXHONG', 8),
  ('MEGA METAL', 9), ('ŞALT', 10), ('TCDD', 11), ('KİH', 12), ('SERSİM', 13),
  ('BORSAN', 14), ('BAŞYAZICIOĞLU', 15), ('MES ET', 16), ('DOĞUŞ', 17),
  ('SİTAŞ', 18), ('RES', 19), ('K.B.Ş.B.', 20)
on conflict (ad) do nothing;

alter table public.is_kaydi add column if not exists grup_id uuid references public.grup(id) on delete set null;
create index if not exists is_kaydi_grup_idx on public.is_kaydi (grup_id);
alter table public.is_kaydi add column if not exists fatura_tarihi date;
