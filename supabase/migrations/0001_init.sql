-- ============================================================================
-- Name Teknik — Teknik Servis Takip
-- 0001_init.sql : İlk veritabanı şeması + RLS + seed
--
-- Bu dosya veritabanının tek ve versiyonlanmış kaynağıdır.
-- Supabase SQL Editor'e tek seferde yapıştırılabilir veya `supabase db push`
-- ile uygulanabilir. Tekrar çalıştırılabilir olması için IF NOT EXISTS /
-- ON CONFLICT kullanıldı.
-- ============================================================================

-- Arama (cihaz adı / seri no / servis no üzerinden ILIKE) için trigram eklentisi.
-- Güvenlik: eklenti public yerine ayrı 'extensions' şemasına kurulur.
create extension if not exists pg_trgm with schema extensions;

-- ----------------------------------------------------------------------------
-- 1) TANIM TABLOLARI (listeler)
-- ----------------------------------------------------------------------------

-- Müşteriler
create table if not exists public.musteri (
  id          uuid primary key default gen_random_uuid(),
  ad          text not null,
  sube_sehir  text,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Teknik personel (onarımı yapan kişi)
create table if not exists public.teknik_personel (
  id     uuid primary key default gen_random_uuid(),
  ad     text not null,
  aktif  boolean not null default true
);

-- Onarım durumu listesi (ONARILDI, ONARIMDA, ...)
create table if not exists public.durum (
  id    uuid primary key default gen_random_uuid(),
  ad    text not null unique,
  sira  integer not null default 0,
  renk  text  -- rozet rengi (hex), örn '#16a34a'
);

-- Fatura / sonuç durumu listesi (FATURA EDİLDİ, TEKLİF VERİLDİ, ...)
create table if not exists public.fatura_durumu (
  id  uuid primary key default gen_random_uuid(),
  ad  text not null unique
);

-- ----------------------------------------------------------------------------
-- 2) ANA TABLO: is_kaydi (onarım kaydı / ticket)
-- ----------------------------------------------------------------------------
create table if not exists public.is_kaydi (
  id                  uuid primary key default gen_random_uuid(),
  musteri_id          uuid not null references public.musteri(id) on delete restrict,
  cihaz_adi           text not null,
  seri_no             text,
  servis_no           text,
  gelis_tarihi        date not null default current_date,
  cikis_tarihi        date,                 -- boşsa iş hâlâ serviste
  durum_id            uuid not null references public.durum(id) on delete restrict,
  teknik_personel_id  uuid references public.teknik_personel(id) on delete set null,
  fatura_durumu_id    uuid references public.fatura_durumu(id) on delete set null,
  ilgili_kisi         text,
  fiyat_teklifi       numeric(12,2),
  fatura_tutari       numeric(12,2),
  aciklama            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Filtre/sıralama için indeksler (PRD: indeksli, hızlı sorgu)
create index if not exists is_kaydi_musteri_idx          on public.is_kaydi (musteri_id);
create index if not exists is_kaydi_durum_idx            on public.is_kaydi (durum_id);
create index if not exists is_kaydi_personel_idx         on public.is_kaydi (teknik_personel_id);
create index if not exists is_kaydi_fatura_durumu_idx    on public.is_kaydi (fatura_durumu_id);
create index if not exists is_kaydi_gelis_tarihi_idx     on public.is_kaydi (gelis_tarihi desc);

-- Tek kutudan arama için trigram (ILIKE '%...%') indeksleri
create index if not exists is_kaydi_cihaz_adi_trgm  on public.is_kaydi using gin (cihaz_adi extensions.gin_trgm_ops);
create index if not exists is_kaydi_seri_no_trgm    on public.is_kaydi using gin (seri_no extensions.gin_trgm_ops);
create index if not exists is_kaydi_servis_no_trgm  on public.is_kaydi using gin (servis_no extensions.gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 3) FOTOĞRAFLAR (dosya deposunda; burada sadece yol/sıra tutulur)
-- ----------------------------------------------------------------------------
create table if not exists public.foto (
  id           uuid primary key default gen_random_uuid(),
  is_kaydi_id  uuid not null references public.is_kaydi(id) on delete cascade,
  dosya_yolu   text not null,   -- Supabase Storage içindeki yol
  sira         integer not null default 0
);

create index if not exists foto_is_kaydi_idx on public.foto (is_kaydi_id);

-- ----------------------------------------------------------------------------
-- 4) KULLANICI PROFİLİ (Supabase Auth kullanıcısına bağlı)
-- ----------------------------------------------------------------------------
create table if not exists public.kullanici_profil (
  id                  uuid primary key references auth.users(id) on delete cascade,
  ad                  text,
  rol                 text not null default 'teknisyen'
                        check (rol in ('teknisyen', 'yonetici')),
  teknik_personel_id  uuid references public.teknik_personel(id) on delete set null
);

-- ----------------------------------------------------------------------------
-- 5) updated_at OTOMATİK GÜNCELLEME
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger fonksiyonu hiçbir rolün doğrudan (RPC ile) çağırmasına gerek duymaz.
revoke all on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists is_kaydi_set_updated_at on public.is_kaydi;
create trigger is_kaydi_set_updated_at
  before update on public.is_kaydi
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6) YENİ KULLANICI -> OTOMATİK PROFİL
-- Auth'a yeni kullanıcı eklendiğinde boş bir profil satırı açılır.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.kullanici_profil (id, ad)
  values (new.id, coalesce(new.raw_user_meta_data->>'ad', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Yalnız trigger ile çalışır; doğrudan RPC çağrısına kapalı.
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 7) ROL YARDIMCISI (RLS için)
-- SECURITY DEFINER: kullanici_profil'in RLS'ini atlayarak sonsuz döngüyü önler.
-- ----------------------------------------------------------------------------
create or replace function public.yonetici_mi()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.kullanici_profil
    where id = auth.uid() and rol = 'yonetici'
  );
$$;

-- RLS politikalarında authenticated tarafından çağrılır; anon'a kapatılır.
revoke all on function public.yonetici_mi() from public, anon;
grant execute on function public.yonetici_mi() to authenticated;

-- ----------------------------------------------------------------------------
-- 8) RLS (Row Level Security)
-- Kural: Giriş yapan herkes okur ve iş ekler/günceller.
--        Tanımların yönetimi ve kayıt silme yalnız yöneticide.
-- ----------------------------------------------------------------------------
alter table public.musteri          enable row level security;
alter table public.teknik_personel  enable row level security;
alter table public.durum            enable row level security;
alter table public.fatura_durumu    enable row level security;
alter table public.is_kaydi         enable row level security;
alter table public.foto             enable row level security;
alter table public.kullanici_profil enable row level security;

-- ---- musteri: herkes okur; herkes ekler (Yeni İş'te anında müşteri); düzenle/sil yönetici
drop policy if exists musteri_select on public.musteri;
create policy musteri_select on public.musteri
  for select to authenticated using (true);

drop policy if exists musteri_insert on public.musteri;
create policy musteri_insert on public.musteri
  for insert to authenticated with check (true);

drop policy if exists musteri_update on public.musteri;
create policy musteri_update on public.musteri
  for update to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());

drop policy if exists musteri_delete on public.musteri;
create policy musteri_delete on public.musteri
  for delete to authenticated using (public.yonetici_mi());

-- ---- teknik_personel: herkes okur; yönetimi yönetici
drop policy if exists teknik_personel_select on public.teknik_personel;
create policy teknik_personel_select on public.teknik_personel
  for select to authenticated using (true);

drop policy if exists teknik_personel_write on public.teknik_personel;
create policy teknik_personel_write on public.teknik_personel
  for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());

-- ---- durum: herkes okur; yönetimi yönetici
drop policy if exists durum_select on public.durum;
create policy durum_select on public.durum
  for select to authenticated using (true);

drop policy if exists durum_write on public.durum;
create policy durum_write on public.durum
  for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());

-- ---- fatura_durumu: herkes okur; yönetimi yönetici
drop policy if exists fatura_durumu_select on public.fatura_durumu;
create policy fatura_durumu_select on public.fatura_durumu
  for select to authenticated using (true);

drop policy if exists fatura_durumu_write on public.fatura_durumu;
create policy fatura_durumu_write on public.fatura_durumu
  for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());

-- ---- is_kaydi: herkes okur/ekler/günceller; sadece yönetici siler
drop policy if exists is_kaydi_select on public.is_kaydi;
create policy is_kaydi_select on public.is_kaydi
  for select to authenticated using (true);

drop policy if exists is_kaydi_insert on public.is_kaydi;
create policy is_kaydi_insert on public.is_kaydi
  for insert to authenticated with check (true);

drop policy if exists is_kaydi_update on public.is_kaydi;
create policy is_kaydi_update on public.is_kaydi
  for update to authenticated using (true) with check (true);

drop policy if exists is_kaydi_delete on public.is_kaydi;
create policy is_kaydi_delete on public.is_kaydi
  for delete to authenticated using (public.yonetici_mi());

-- ---- foto: herkes okur/ekler/siler (iş düzenlemenin parçası)
drop policy if exists foto_select on public.foto;
create policy foto_select on public.foto
  for select to authenticated using (true);

drop policy if exists foto_insert on public.foto;
create policy foto_insert on public.foto
  for insert to authenticated with check (true);

drop policy if exists foto_delete on public.foto;
create policy foto_delete on public.foto
  for delete to authenticated using (true);

-- ---- kullanici_profil: herkes kendi satırını okur; yönetici hepsini okur/yönetir
drop policy if exists profil_select_self on public.kullanici_profil;
create policy profil_select_self on public.kullanici_profil
  for select to authenticated using (id = auth.uid() or public.yonetici_mi());

drop policy if exists profil_update_self on public.kullanici_profil;
create policy profil_update_self on public.kullanici_profil
  for update to authenticated
  using (id = auth.uid() or public.yonetici_mi())
  with check (id = auth.uid() or public.yonetici_mi());

-- ----------------------------------------------------------------------------
-- 9) STORAGE: fotoğraflar için özel (private) bucket
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('foto', 'foto', false)
on conflict (id) do nothing;

drop policy if exists foto_bucket_select on storage.objects;
create policy foto_bucket_select on storage.objects
  for select to authenticated using (bucket_id = 'foto');

drop policy if exists foto_bucket_insert on storage.objects;
create policy foto_bucket_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'foto');

drop policy if exists foto_bucket_delete on storage.objects;
create policy foto_bucket_delete on storage.objects
  for delete to authenticated using (bucket_id = 'foto');

-- ----------------------------------------------------------------------------
-- 10) SEED — başlangıç liste değerleri (PRD'den)
-- ----------------------------------------------------------------------------
insert into public.durum (ad, sira, renk) values
  ('BAKILMADI',  10, '#94a3b8'),
  ('ONARIMDA',   20, '#f59e0b'),
  ('ONARILDI',   30, '#10b981'),
  ('GERİ GELEN', 40, '#ef4444'),
  ('İADE',       50, '#a855f7'),
  ('SATIŞ',      60, '#3b82f6')
on conflict (ad) do nothing;

insert into public.fatura_durumu (ad) values
  ('SONUÇ BEKLİYOR'),
  ('TEKLİF HAZIRLANDI'),
  ('TEKLİF VERİLDİ'),
  ('FATURA EDİLECEK'),
  ('FATURA EDİLDİ'),
  ('ÜCRET ALINACAK'),
  ('PEŞİN ALINDI'),
  ('GARANTİ'),
  ('BEDELSİZ'),
  ('İADE')
on conflict (ad) do nothing;
