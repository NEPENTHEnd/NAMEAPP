-- Şube (branch) sistemi + müşteri silince işler "müşterisiz" kalsın

-- 1) is_kaydi.musteri_id: NOT NULL kalksın, FK RESTRICT → SET NULL
alter table public.is_kaydi alter column musteri_id drop not null;
alter table public.is_kaydi drop constraint if exists is_kaydi_musteri_id_fkey;
alter table public.is_kaydi
  add constraint is_kaydi_musteri_id_fkey
  foreign key (musteri_id) references public.musteri(id) on delete set null;

-- 2) grup (sol menü firması) hangi müşteriden geldi (opsiyonel referans)
alter table public.grup
  add column if not exists musteri_id uuid references public.musteri(id) on delete set null;

-- 3) şube tablosu — bir sol-menü firmasının alt firmaları
create table if not exists public.sube (
  id uuid primary key default gen_random_uuid(),
  grup_id uuid not null references public.grup(id) on delete cascade,
  ad text not null,
  ilgili_kisi text,
  telefon text,
  sira int not null default 0,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists sube_grup_id_idx on public.sube(grup_id);

alter table public.sube enable row level security;
drop policy if exists sube_select on public.sube;
drop policy if exists sube_insert on public.sube;
drop policy if exists sube_update on public.sube;
drop policy if exists sube_delete on public.sube;
create policy sube_select on public.sube for select using (true);
create policy sube_insert on public.sube for insert with check (yonetici_mi());
create policy sube_update on public.sube for update using (yonetici_mi()) with check (yonetici_mi());
create policy sube_delete on public.sube for delete using (yonetici_mi());

-- 4) is_kaydi.sube_id — iş hangi şubeye ait (şube silinirse null)
alter table public.is_kaydi
  add column if not exists sube_id uuid references public.sube(id) on delete set null;
create index if not exists is_kaydi_sube_id_idx on public.is_kaydi(sube_id);
