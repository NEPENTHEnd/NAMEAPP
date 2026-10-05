-- ============================================================================
-- 0026 : Web'den kullanıcı yönetimi + yetki açıklarının kapatılması
-- ----------------------------------------------------------------------------
-- * Yöneticiler siteden kullanıcı davet eder (e-postaya bağlı, TEK kullanımlık kod),
--   erişimi kapatır/açar, iş kaydı olmayan hesabı kalıcı siler, rol değiştirir.
-- * İzin kuralları VERİTABANINDA: personeli her yönetici, yöneticileri yalnız sahip
--   yönetir; kimse kendi hesabını ya da sahibi değiştiremez.
-- * Kapatılan AÇIKLAR:
--   - profil_update_yonetici: her yönetici her profili (rol + SAHİP bayrağı dahil)
--     doğrudan güncelleyebiliyordu → kaldırıldı, yalnız aşağıdaki fonksiyonlar.
--   - kayit_tamamla: giriş yapmış HERHANGİ bir kullanıcı, bildiği bir kodla kendi
--     rolünü yükseltebiliyordu → yalnız 'bekliyor' (yeni) hesaplar.
-- * Erişimi kapatılan hesap (aktif=false) yetki fonksiyonlarında anında yetkisiz.
-- * Fiş no: ön ek 0-9 doldu; iki haneli ön ekte eski biçim ÇAKIŞIRDI
--   ('11'+'05' = '1'+'105'). Sıra artık en az (ön ek hane sayısı + 1) hane:
--   tek haneli ön ekler eskisi gibi, 11 → '005'. (Kalan teorik çakışma, tek kişinin
--   bir ayda 999'dan fazla fiş açmasını gerektirir.) lpad KULLANILMAZ (taşanı keser).
-- ============================================================================

-- 1) Profil: erişim açık/kapalı
alter table public.kullanici_profil
  add column if not exists aktif boolean not null default true;

-- 2) Davet: e-postaya bağlı, tek kullanımlık davetler (eposta null = eski sabit kod)
alter table public.davet_kisi
  add column if not exists eposta text,
  add column if not exists kullanildi boolean not null default false,
  add column if not exists davet_eden uuid references auth.users(id) on delete set null,
  add column if not exists davet_tarihi timestamptz;

-- 3) Yetki fonksiyonları — erişimi kapatılan hesap anında yetkisiz
create or replace function public.yonetici_mi()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.kullanici_profil
    where id = auth.uid() and rol = 'yonetici' and aktif
  );
$$;

create or replace function public.sahip_mi()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.kullanici_profil
    where id = auth.uid() and sahip and aktif
  );
$$;

create or replace function public.kayitli_mi()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.kullanici_profil
    where id = auth.uid() and rol in ('teknisyen','yonetici') and aktif
  );
$$;

-- 4) Profil artık yalnız aşağıdaki fonksiyonlarla güncellenir
drop policy if exists profil_update_yonetici on public.kullanici_profil;

-- Ortak izin kontrolü: çağıran, hedef hesabı yönetebilir mi? (yetkisizse hata)
create or replace function public.hesap_yonetim_kontrol(p_hedef uuid)
returns public.kullanici_profil
language plpgsql stable security definer set search_path to 'public' as $$
declare h public.kullanici_profil;
begin
  if not public.yonetici_mi() then raise exception 'Yetkisiz işlem'; end if;
  select * into h from public.kullanici_profil where id = p_hedef;
  if not found then raise exception 'Kullanıcı bulunamadı'; end if;
  if p_hedef = auth.uid() then raise exception 'Kendi hesabınızda bu işlemi yapamazsınız'; end if;
  if h.sahip then raise exception 'Sahip hesabı değiştirilemez'; end if;
  if h.rol = 'yonetici' and not public.sahip_mi() then
    raise exception 'Yönetici hesaplarını yalnız sahip yönetebilir';
  end if;
  return h;
end; $$;

create or replace function public.kullanici_rol_ayarla(p_hedef uuid, p_rol text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_rol not in ('teknisyen','yonetici') then raise exception 'Geçersiz rol'; end if;
  perform public.hesap_yonetim_kontrol(p_hedef);
  if p_rol = 'yonetici' and not public.sahip_mi() then
    raise exception 'Yönetici yetkisini yalnız sahip verebilir';
  end if;
  update public.kullanici_profil set rol = p_rol where id = p_hedef;
end; $$;

-- Erişimi kapat/aç (girişi engelleme Auth API ile sunucuda ayrıca yapılır)
create or replace function public.kullanici_erisim_ayarla(p_hedef uuid, p_aktif boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare h public.kullanici_profil;
begin
  h := public.hesap_yonetim_kontrol(p_hedef);
  update public.kullanici_profil set aktif = p_aktif where id = p_hedef;
  if not p_aktif then
    delete from public.push_abonelik where kullanici_id = p_hedef;
    -- eski (tekrar kullanılabilir) davet koduyla yeniden hesap açılamasın
    if h.fis_prefix is not null then
      update public.davet_kisi set aktif = false where fis_prefix = h.fis_prefix;
    end if;
  end if;
end; $$;

-- Kalıcı silme ön kontrolü (silmeyi sunucu Auth API ile yapar). İşi olan silinemez.
create or replace function public.kullanici_silme_kontrol(p_hedef uuid)
returns void language plpgsql stable security definer set search_path to 'public' as $$
begin
  perform public.hesap_yonetim_kontrol(p_hedef);
  if exists (select 1 from public.is_kaydi where olusturan_id = p_hedef) then
    raise exception 'Bu kullanıcının iş kayıtları var; kalıcı silinemez (erişimi kapatın)';
  end if;
end; $$;

-- Yönetim ekranı listesi (e-posta + son giriş + iş sayısı) — yalnız yönetici
create or replace function public.kullanici_listesi()
returns table(
  o_id uuid, o_ad text, o_rol text, o_sahip boolean, o_aktif boolean, o_fis_prefix int,
  o_eposta text, o_son_giris timestamptz, o_olusturma timestamptz, o_is_sayisi bigint
)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.yonetici_mi() then raise exception 'Yetkisiz işlem'; end if;
  return query
    select p.id, p.ad, p.rol, p.sahip, p.aktif, p.fis_prefix, u.email::text,
           u.last_sign_in_at, u.created_at,
           (select count(*) from public.is_kaydi i where i.olusturan_id = p.id)
      from public.kullanici_profil p join auth.users u on u.id = p.id
     order by p.aktif desc, (p.rol = 'yonetici') desc, p.ad;
end; $$;

-- 5) Davetler (e-postaya bağlı, tek kullanımlık)
create or replace function public.davet_olustur(p_ad text, p_eposta text, p_rol text)
returns table(o_id uuid, o_kod text, o_fis_prefix int)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_ad text := trim(coalesce(p_ad, ''));
  v_eposta text := lower(trim(coalesce(p_eposta, '')));
  v_prefix int; v_kod text; v_id uuid;
begin
  if not public.yonetici_mi() then raise exception 'Yetkisiz işlem'; end if;
  if p_rol not in ('teknisyen','yonetici') then raise exception 'Geçersiz rol'; end if;
  if p_rol = 'yonetici' and not public.sahip_mi() then
    raise exception 'Yönetici davetini yalnız sahip gönderebilir';
  end if;
  if v_ad = '' then raise exception 'Ad soyad gerekli'; end if;
  if v_eposta !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Geçerli bir e-posta adresi girin';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_eposta) then
    raise exception 'Bu e-posta ile zaten bir hesap var';
  end if;
  if exists (select 1 from public.davet_kisi d
              where lower(d.eposta) = v_eposta and d.aktif and not d.kullanildi) then
    raise exception 'Bu e-postaya bekleyen bir davet zaten var';
  end if;
  -- ön ek tahsisi yarışmasın
  lock table public.davet_kisi in share row exclusive mode;
  select greatest(
           coalesce((select max(d.fis_prefix) from public.davet_kisi d), 0),
           coalesce((select max(p.fis_prefix) from public.kullanici_profil p), 0)
         ) + 1
    into v_prefix;
  v_kod := 'NT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.davet_kisi
    (ad, rol, fis_prefix, kod, aktif, eposta, kullanildi, davet_eden, davet_tarihi)
  values
    (v_ad, p_rol, v_prefix, v_kod, true, v_eposta, false, auth.uid(), now())
  returning id into v_id;
  return query select v_id, v_kod, v_prefix;
end; $$;

-- Bekleyen (kullanılmamış) e-postalı daveti iptal et — satır silinir, ön ek boşa çıkar
create or replace function public.davet_iptal(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_rol text;
begin
  if not public.yonetici_mi() then raise exception 'Yetkisiz işlem'; end if;
  select rol into v_rol from public.davet_kisi
   where id = p_id and eposta is not null and not kullanildi;
  if v_rol is null then raise exception 'Davet bulunamadı'; end if;
  if v_rol = 'yonetici' and not public.sahip_mi() then
    raise exception 'Yönetici davetini yalnız sahip iptal edebilir';
  end if;
  delete from public.davet_kisi where id = p_id;
end; $$;

-- Davet linkinden gelen kişinin formunu doldurmak için (oturum öncesi)
create or replace function public.davet_bilgi(p_kod text)
returns table(o_ad text, o_eposta text, o_rol text)
language sql stable security definer set search_path to 'public' as $$
  select d.ad, d.eposta, d.rol from public.davet_kisi d
   where d.kod = p_kod and d.aktif and not d.kullanildi and d.eposta is not null
   limit 1;
$$;

create or replace function public.kod_rol(p_kod text)
returns text language sql stable security definer set search_path to 'public' as $$
  select rol from public.davet_kisi where kod = p_kod and aktif and not kullanildi limit 1;
$$;

-- Yalnız YENİ ('bekliyor') hesap; e-postalı davette e-posta eşleşmeli + tek kullanım
create or replace function public.kayit_tamamla(p_kod text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_mevcut text; v_id uuid; v_rol text; v_prefix int; v_eposta text; v_ben text;
begin
  select rol into v_mevcut from public.kullanici_profil where id = auth.uid();
  if v_mevcut is distinct from 'bekliyor' then return null; end if;
  select id, rol, fis_prefix, eposta into v_id, v_rol, v_prefix, v_eposta
    from public.davet_kisi
   where kod = p_kod and aktif and not kullanildi
   limit 1 for update;
  if v_rol is null then return null; end if;
  if v_eposta is not null then
    select email into v_ben from auth.users where id = auth.uid();
    if lower(coalesce(v_ben, '')) <> lower(v_eposta) then return null; end if;
    update public.davet_kisi set kullanildi = true where id = v_id;
  end if;
  update public.kullanici_profil
     set rol = v_rol, fis_prefix = coalesce(v_prefix, fis_prefix), aktif = true
   where id = auth.uid();
  return v_rol;
end; $$;

-- 6) Fiş no: sıra en az (ön ek hane sayısı + 1) hane; kapalı hesap fiş üretemez
create or replace function public.fis_no_uret()
returns text language plpgsql security definer set search_path to 'public' as $function$
declare v_prefix int; v_donem text; v_sayac int; v_min int; v_sira text;
begin
  select fis_prefix into v_prefix from public.kullanici_profil
   where id = auth.uid() and aktif;
  if v_prefix is null then return null; end if;
  v_donem := to_char(now() at time zone 'Europe/Istanbul', 'MMYYYY');
  insert into public.fis_sayac (prefix, donem, sayac) values (v_prefix, v_donem, 1)
    on conflict (prefix, donem) do update set sayac = public.fis_sayac.sayac + 1
    returning sayac into v_sayac;
  v_min := length(v_prefix::text) + 1;
  v_sira := repeat('0', greatest(0, v_min - length(v_sayac::text))) || v_sayac::text;
  return to_char(now() at time zone 'Europe/Istanbul', 'MMYY') || v_prefix::text || v_sira;
end;
$function$;

-- 7) Anonim erişim yalnız kayıt akışı fonksiyonlarına (kod_rol, davet_bilgi, kayit_tamamla)
revoke execute on function public.hesap_yonetim_kontrol(uuid) from public, anon;
revoke execute on function public.kullanici_rol_ayarla(uuid, text) from public, anon;
revoke execute on function public.kullanici_erisim_ayarla(uuid, boolean) from public, anon;
revoke execute on function public.kullanici_silme_kontrol(uuid) from public, anon;
revoke execute on function public.kullanici_listesi() from public, anon;
revoke execute on function public.davet_olustur(text, text, text) from public, anon;
revoke execute on function public.davet_iptal(uuid) from public, anon;
grant execute on function public.hesap_yonetim_kontrol(uuid) to authenticated;
grant execute on function public.kullanici_rol_ayarla(uuid, text) to authenticated;
grant execute on function public.kullanici_erisim_ayarla(uuid, boolean) to authenticated;
grant execute on function public.kullanici_silme_kontrol(uuid) to authenticated;
grant execute on function public.kullanici_listesi() to authenticated;
grant execute on function public.davet_olustur(text, text, text) to authenticated;
grant execute on function public.davet_iptal(uuid) to authenticated;
