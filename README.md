# Name Teknik — Teknik Servis Takip

Kayseri merkezli Name Teknik için endüstriyel elektronik onarım takip
uygulaması. Excel tabanlı eski sistemin yerini alır: tek ve normalize
veritabanı, aranabilir iş listesi, fotoğraf deposu, rollü kullanıcılar.
Arayüz tamamen **Türkçe** ve **mobil uyumludur**.

> Ürün şartnamesi için bkz. [docs/PRD.md](docs/PRD.md).

## Teknoloji

- **Next.js** (App Router, TypeScript)
- **Supabase** (Postgres + Auth + Storage)
- **Tailwind CSS + shadcn/ui**
- Yayın: **Vercel**

---

## Kurulum (adım adım)

Web/backend'de yeniysen sırayı bozmadan takip et. ~10 dakika sürer.

### 1. Gereksinimler
- [Node.js](https://nodejs.org) 20+ (bu projede 24 ile geliştirildi)
- Ücretsiz bir [Supabase](https://supabase.com) hesabı

### 2. Bağımlılıkları yükle
```bash
npm install
```

### 3. Supabase projesi oluştur
1. https://supabase.com → **New project**.
2. Bir proje adı + güçlü bir veritabanı şifresi belirle, bölge olarak
   **Frankfurt (eu-central)** seç (Türkiye'ye en yakını, daha hızlı).
3. Proje açıldıktan sonra: **Project Settings → API** ekranını aç.

### 4. Ortam değişkenlerini ayarla
`.env.example` dosyasını `.env.local` olarak kopyala ve doldur:
```bash
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
```
`.env.local` içine **Project Settings → API**'den şu iki değeri yapıştır:
- `NEXT_PUBLIC_SUPABASE_URL` → "Project URL"
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → "anon public" anahtarı

> `.env.local` repoya **gönderilmez** (gizli kalır). `SUPABASE_SERVICE_ROLE_KEY`
> şimdilik boş kalabilir; sadece sonraki Excel veri taşıma adımında gerekecek.

### 5. Veritabanını oluştur (migration)
En kolay yol — Supabase panelinden:
1. Sol menüden **SQL Editor → New query**.
2. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   dosyasının **tüm içeriğini** kopyalayıp editöre yapıştır.
3. **Run** de. Tablolar, indeksler, RLS politikaları, `foto` deposu ve
   başlangıç listeleri (durum / fatura durumu) oluşur.

> Supabase CLI kullanıyorsan alternatif olarak `supabase db push` da çalışır.

### 6. İlk kullanıcıyı oluştur
1. Supabase panelinde **Authentication → Users → Add user**.
2. E-posta + şifre gir, **"Auto Confirm User"** işaretle.
3. Bu kullanıcı varsayılan olarak `teknisyen` rolüyle açılır. **Yönetici**
   yapmak için **SQL Editor**'de çalıştır:
   ```sql
   update public.kullanici_profil
   set rol = 'yonetici', ad = 'Adınız'
   where id = (select id from auth.users where email = 'eposta@adresin.com');
   ```

### 7. Uygulamayı çalıştır
```bash
npm run dev
```
http://localhost:3000 → otomatik `/giris` sayfasına yönlenirsin. 6. adımdaki
e-posta/şifre ile giriş yap; ana sayfada e-posta ve rolünü görmelisin.

---

## Proje yapısı

```
src/
  app/
    giris/page.tsx        # Giriş (login) ekranı
    page.tsx              # Korunan ana sayfa (iskelet)
    actions/auth.ts       # Çıkış (logout) server action
  components/ui/          # shadcn/ui bileşenleri
  proxy.ts                # Next.js proxy (oturum tazeleme + yönlendirme girişi)
  lib/supabase/
    client.ts             # Tarayıcı istemcisi
    server.ts             # Sunucu istemcisi (cookie tabanlı)
    middleware.ts         # Oturum tazeleme yardımcısı
    raporlar/             # Raporlar + Excel (.xlsx) dışa aktarma
    pano/ tanimlar/       # Pano ve tanım yönetimi (yönetici)
    is/[id]/ yeni/        # İş detayı/düzenleme ve yeni iş
  components/ui/          # shadcn/ui bileşenleri
  proxy.ts                # Next.js proxy (oturum tazeleme + yönlendirme girişi)
  lib/supabase/           # client / server / middleware yardımcıları + db tipleri
supabase/
  migrations/0001_init.sql  # Veritabanı şeması + RLS + seed
scripts/ice_aktarma.py    # Excel -> uygulama içe aktarma (bkz docs/ICE-AKTARMA.md)
docs/PRD.md               # Ürün şartnamesi
```

## Yetkilendirme (RLS) özeti

- Giriş yapan herkes işleri **görür, ekler, günceller** ve müşteri ekleyebilir.
- **Kayıt silme** ve **tanım yönetimi** (personel, durum, fatura durumu
  düzenleme) yalnız **yönetici** rolündedir.
- Tüm kurallar veritabanı seviyesinde (Supabase RLS) zorunlu kılınır.

## Yayına alma (Vercel)

1. Projeyi bir **GitHub deposuna** gönder (`.env.local` gitignore'da, gizli kalır).
2. [vercel.com](https://vercel.com) → **Add New → Project** → bu repoyu içe aktar.
   Next.js otomatik algılanır; build ayarlarına dokunmana gerek yok.
3. **Environment Variables** bölümüne şunları ekle (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   > `SUPABASE_SERVICE_ROLE_KEY` Vercel'de **gerekmez** (yalnız yerel içe aktarma
   > script'inde kullanılır).
4. **Deploy**. Çıkan `https://...vercel.app` adresini not al.
5. Supabase paneli → **Authentication → URL Configuration**:
   - **Site URL**: Vercel adresin
   - **Redirect URLs**: `https://...vercel.app/**`
6. Aç, giriş yap. Bitti. 🎉

> Sonraki güncellemelerde `git push` yeterli — Vercel otomatik dağıtır.

### Yayın öncesi kontrol listesi
- [ ] `.env.local` repoda **yok** (gizli anahtarlar Vercel panelinde)
- [ ] Migration (`0001_init.sql`) Supabase'de uygulandı
- [ ] En az bir **yönetici** kullanıcı var
- [ ] Supabase Auth Site URL / Redirect URL'leri Vercel adresine ayarlı
- [ ] `npm run build` yerelde sorunsuz geçiyor

## Veri taşıma

Eski Excel'den (`MART_2026.xlsx`) içe aktarma için bkz.
[docs/ICE-AKTARMA.md](docs/ICE-AKTARMA.md).
