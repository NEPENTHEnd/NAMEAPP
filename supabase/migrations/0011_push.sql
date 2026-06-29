-- ============================================================================
-- 0011 : Telefon push bildirimleri (Web Push) — abonelik tablosu + RPC'ler
-- (Canlıya MCP ile uygulandı; kayıt için burada da tutulur.)
-- ============================================================================
create table if not exists public.push_abonelik (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_abonelik_kullanici_idx on public.push_abonelik (kullanici_id);

alter table public.push_abonelik enable row level security;

drop policy if exists push_abonelik_select on public.push_abonelik;
create policy push_abonelik_select on public.push_abonelik
  for select to authenticated using (kullanici_id = auth.uid());

drop policy if exists push_abonelik_insert on public.push_abonelik;
create policy push_abonelik_insert on public.push_abonelik
  for insert to authenticated with check (kullanici_id = auth.uid());

drop policy if exists push_abonelik_delete on public.push_abonelik;
create policy push_abonelik_delete on public.push_abonelik
  for delete to authenticated using (kullanici_id = auth.uid());

-- Cihazı kaydet (yeniden abone olunca temiz çalışsın diye önce siler).
create or replace function public.push_kaydet(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  delete from public.push_abonelik where endpoint = p_endpoint;
  insert into public.push_abonelik (kullanici_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end $$;
revoke all on function public.push_kaydet(text, text, text) from public, anon;
grant execute on function public.push_kaydet(text, text, text) to authenticated;

-- Yöneticilerin aboneliklerini döndürür (push göndermek için).
create or replace function public.push_yonetici_abonelikleri()
returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select s.endpoint, s.p256dh, s.auth
  from public.push_abonelik s
  join public.kullanici_profil p on p.id = s.kullanici_id
  where p.rol = 'yonetici';
$$;
revoke all on function public.push_yonetici_abonelikleri() from public, anon;
grant execute on function public.push_yonetici_abonelikleri() to authenticated;

-- Bayat (410 Gone) aboneliği endpoint'e göre siler.
create or replace function public.push_abonelik_temizle(p_endpoint text)
returns void language sql volatile security definer set search_path = public as $$
  delete from public.push_abonelik where endpoint = p_endpoint;
$$;
revoke all on function public.push_abonelik_temizle(text) from public, anon;
grant execute on function public.push_abonelik_temizle(text) to authenticated;
