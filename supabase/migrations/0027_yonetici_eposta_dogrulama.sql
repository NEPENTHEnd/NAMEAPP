-- ============================================================================
-- 0027 : Yönetici e-posta doğrulaması (güvenlik penceresi) — cihaz bazlı, 60 gün
-- ----------------------------------------------------------------------------
-- Akış: yönetici yeni bir cihazda girince e-postasına 6 haneli kod gider; doğrulayınca
-- o cihaz 60 gün güvenilir sayılır (httpOnly çerez + burada hash'i). Güvenilir cihazdaki
-- her Supabase oturumu (session_id) "doğrulanmış" diye işaretlenir.
--
-- VERİTABANI SEVİYESİNDE ZORUNLU: bayrak açıkken yonetici_mi()/sahip_mi() ancak
-- oturum doğrulanmışsa true döner. Yani şifresi çalınan bir yönetici hesabıyla, site
-- atlanıp doğrudan API'ye gidilse bile yönetici yetkisi ALINAMAZ (kod e-postaya gider).
--
-- GÜVENLİ AÇILIŞ: bayrak KAPALI başlar. Yalnız sahip açabilir ve açmadan önce KENDİ
-- cihazını e-posta koduyla doğrulamak zorundadır — e-posta gitmiyorsa bayrak açılamaz,
-- kimse kilitlenmez.
-- ACİL KAPATMA (SQL Editor):  update public.guvenlik_ayar set yonetici_dogrulama = false;
--
-- Kod / cihaz / oturum tabloları yalnız sunucu (service role) içindir: RLS açık,
-- politika YOK. Token/kod hash'leri e-posta yedeğine (YEDEK_TABLOLARI) KONMAZ.
-- ============================================================================

-- 1) Tek satırlık ayar (aç/kapa bayrağı)
create table if not exists public.guvenlik_ayar (
  id int primary key default 1 check (id = 1),
  yonetici_dogrulama boolean not null default false,
  guncelleyen uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.guvenlik_ayar (id, yonetici_dogrulama) values (1, false)
  on conflict (id) do nothing;
alter table public.guvenlik_ayar enable row level security;

-- 2) Güvenilir cihazlar (çerezdeki rastgele token'ın SHA-256 hash'i)
create table if not exists public.guvenilir_cihaz (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  cihaz text,
  dogrulandi_at timestamptz not null default now(),
  gecerlilik timestamptz not null,
  son_kullanim timestamptz
);
create index if not exists guvenilir_cihaz_user on public.guvenilir_cihaz (user_id);
alter table public.guvenilir_cihaz enable row level security;

-- 3) Bekleyen doğrulama kodu (kullanıcı başına bir tane; HMAC'li, 10 dk)
create table if not exists public.dogrulama_kodu (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kod_hash text not null,
  son_gecerlilik timestamptz not null,
  deneme int not null default 0,
  gonderim_sayisi int not null default 1,
  ilk_gonderim timestamptz not null default now(),
  son_gonderim timestamptz not null default now()
);
alter table public.dogrulama_kodu enable row level security;

-- 4) Doğrulanmış oturumlar (Supabase JWT session_id)
create table if not exists public.dogrulanmis_oturum (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  gecerlilik timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists dogrulanmis_oturum_user on public.dogrulanmis_oturum (user_id);
alter table public.dogrulanmis_oturum enable row level security;

-- 5) Bu isteğin oturumu doğrulanmış mı?
create or replace function public.oturum_dogrulandi()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.dogrulanmis_oturum d
     where d.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
       and d.user_id = auth.uid()
       and d.gecerlilik > now()
  );
$$;

-- 6) Yetki fonksiyonları: bayrak açıkken doğrulanmış oturum şart
create or replace function public.yonetici_mi()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
           select 1 from public.kullanici_profil
            where id = auth.uid() and rol = 'yonetici' and aktif
         )
     and (
           not coalesce((select yonetici_dogrulama from public.guvenlik_ayar where id = 1), false)
           or public.oturum_dogrulandi()
         );
$$;

create or replace function public.sahip_mi()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
           select 1 from public.kullanici_profil
            where id = auth.uid() and sahip and aktif
         )
     and (
           not coalesce((select yonetici_dogrulama from public.guvenlik_ayar where id = 1), false)
           or public.oturum_dogrulandi()
         );
$$;

-- 7) Uygulamanın tek sorguda ihtiyaç duyduğu durum (sunucu çağırır)
create or replace function public.oturum_durumu()
returns table(
  o_session_id text, o_zorunlu boolean, o_dogrulandi boolean,
  o_profil_yonetici boolean, o_profil_sahip boolean
)
language sql stable security definer set search_path to 'public' as $$
  select nullif(auth.jwt() ->> 'session_id', ''),
         coalesce((select yonetici_dogrulama from public.guvenlik_ayar where id = 1), false),
         public.oturum_dogrulandi(),
         exists (select 1 from public.kullanici_profil
                  where id = auth.uid() and rol = 'yonetici' and aktif),
         exists (select 1 from public.kullanici_profil
                  where id = auth.uid() and sahip and aktif);
$$;

-- 8) Bayrağı aç/kapa: yalnız sahip, ve BU oturumu e-posta koduyla doğrulamış olmalı
create or replace function public.guvenlik_ayarla(p_acik boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.kullanici_profil
                  where id = auth.uid() and sahip and aktif) then
    raise exception 'Bu ayarı yalnız sahip değiştirebilir';
  end if;
  if not public.oturum_dogrulandi() then
    raise exception 'Önce bu cihazı e-posta koduyla doğrulayın';
  end if;
  update public.guvenlik_ayar
     set yonetici_dogrulama = p_acik, guncelleyen = auth.uid(), updated_at = now()
   where id = 1;
end; $$;

-- 9) Erişimi kapatılan hesabın güvenilir cihaz + doğrulanmış oturumları da silinir
create or replace function public.kullanici_erisim_ayarla(p_hedef uuid, p_aktif boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare h public.kullanici_profil;
begin
  h := public.hesap_yonetim_kontrol(p_hedef);
  update public.kullanici_profil set aktif = p_aktif where id = p_hedef;
  if not p_aktif then
    delete from public.push_abonelik where kullanici_id = p_hedef;
    delete from public.guvenilir_cihaz where user_id = p_hedef;
    delete from public.dogrulanmis_oturum where user_id = p_hedef;
    delete from public.dogrulama_kodu where user_id = p_hedef;
    if h.fis_prefix is not null then
      update public.davet_kisi set aktif = false where fis_prefix = h.fis_prefix;
    end if;
  end if;
end; $$;

-- 10) Yetkiler
revoke execute on function public.oturum_dogrulandi() from public, anon;
revoke execute on function public.oturum_durumu() from public, anon;
revoke execute on function public.guvenlik_ayarla(boolean) from public, anon;
grant execute on function public.oturum_dogrulandi() to authenticated;
grant execute on function public.oturum_durumu() to authenticated;
grant execute on function public.guvenlik_ayarla(boolean) to authenticated;
