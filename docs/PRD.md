# Name Teknik — Teknik Servis Takip Sistemi (PRD)

> Bu belge, Name Teknik'in mevcut Excel tabanlı arıza-onarım takip sistemini
> modern bir web uygulamasına taşımak için hazırlanmış ürün şartnamesidir.
> Claude Code bu belgeyi baştan sona okuyup uygulamayı buna göre kurar.

---

## 1. Amaç ve Problem

Name Teknik (Kayseri merkezli endüstriyel elektronik onarım firması) tüm onarım
kayıtlarını tek bir Excel dosyasında tutuyor. Mevcut durum:

- 22 sayfa: ~19'u müşteri bazlı onarım defteri, 1 "DİĞER" (tek seferlik müşteriler),
  1 "DURUM" (müşteri başına toplam tutar panosu), 1 "Sayfa6" (dropdown listeleri).
- ~494 onarım kaydı.
- 208 cihaz fotoğrafı sayfalara gömülü (~42 MB).

Excel'in yarattığı dertler:
- "Her müşteri ayrı sayfa" yüzünden tüm işler tek yerden aranamıyor; sütunlar
  sayfadan sayfaya kayıyor; bazı sayfalarda `#REF!` kırık referanslar var.
- 42 MB gömülü fotoğraf dosyayı yavaş, kırılgan, paylaşması/yedeklemesi zor yapıyor.
- DURUM panosu elle yazılmış hücre referanslarıyla (`=BOYTEKS!K1`) çalışıyor ve
  şu an boş/kopuk.
- Çok kullanıcı, iş akışı, gerçek raporlama ve tezgah başından mobil giriş yok.

**Hedef:** Tek ve normalize bir veritabanı, tüm işlerin arandığı/filtrelendiği tek
liste, fotoğraflar dosya deposunda, rollü çok kullanıcı, Türkçe ve mobil uyumlu
bir web uygulaması.

---

## 2. Kapsam

### v1 (bu sürümde yapılacak)
- Giriş/oturum (auth) ve iki rol: **teknisyen**, **yönetici**.
- İş (onarım kaydı) ekleme, düzenleme, listeleme, arama, filtreleme.
- Her işe fotoğraf yükleme (telefon kamerasından da), görüntüleme, silme.
- Pano (dashboard): durum/personel dağılımı, açık iş, teklif bekleyen, aylık ciro,
  ortalama onarım süresi.
- Raporlar: tarih aralığı + filtreyle dökme ve Excel/CSV dışa aktarma.
- Tanım yönetimi (yönetici): müşteri, teknik personel, durum listesi, fatura durumu
  listesi; kullanıcı/rol yönetimi.
- Mevcut Excel verisinin (494 kayıt + 208 fotoğraf) içe aktarımı.

### Kapsam dışı (v2'de değerlendirilecek)
- Müşteri takip portalı.
- E-posta/SMS bildirimleri.
- Teklif/fatura PDF üretimi.
- Barkod/QR ile cihaz takibi, stok yönetimi.

---

## 3. Kullanıcı Rolleri

| Rol | Yetkiler |
|-----|----------|
| **teknisyen** | İş ekler/günceller, fotoğraf yükler, iş listesini görür ve filtreler. Kendi işleri vurgulanır. Kayıt silme yetkisi kısıtlı. |
| **yönetici** | Teknisyenin tüm yetkileri + pano + raporlar + tanım yönetimi + kullanıcı/rol yönetimi + silme. |

---

## 4. Veri Modeli

İlişkisel model (Supabase / Postgres). Tablo ve alan adları Türkçe, küçük harf,
snake_case.

### `musteri`
| alan | tip | not |
|------|-----|-----|
| id | uuid (PK) | |
| ad | text | Örn. "BOYTEKS", "ENS ELEKTRİK-ALİCAN" |
| sube_sehir | text, null | TCDD'de şehir, RES'te şube gibi alt kırılım |
| aktif | bool | varsayılan true |
| created_at | timestamptz | |

### `teknik_personel`
| alan | tip | not |
|------|-----|-----|
| id | uuid (PK) | |
| ad | text | OKAN, ALAHATTİN, ÖMER, REMZİ, AHMET, NAZIM, FARUK |
| aktif | bool | |

### `durum` (onarım durumu — liste)
| alan | tip | not |
|------|-----|-----|
| id | uuid (PK) | |
| ad | text | ONARILDI, ONARIMDA, BAKILMADI, GERİ GELEN, İADE, SATIŞ |
| sira | int | listeleme/sıralama sırası |
| renk | text | rozet rengi (hex) |

### `fatura_durumu` (sonuç/fatura — liste)
| alan | tip | not |
|------|-----|-----|
| id | uuid (PK) | |
| ad | text | FATURA EDİLDİ, FATURA EDİLECEK, TEKLİF VERİLDİ, TEKLİF HAZIRLANDI, SONUÇ BEKLİYOR, ÜCRET ALINACAK, PEŞİN ALINDI, GARANTİ, BEDELSİZ, İADE |

### `is_kaydi` (onarım kaydı / ticket — ana tablo)
| alan | tip | not |
|------|-----|-----|
| id | uuid (PK) | |
| musteri_id | uuid (FK → musteri) | |
| cihaz_adi | text | Cihaz adı veya kodu (Excel'de "ÜRÜNÜN ADI VEYA KODU" / "KARTIN ADI") |
| seri_no | text, null | |
| servis_no | text, null | Fiş/teknik servis no (örn. "26-B0252", "8606", "G0150") |
| gelis_tarihi | date | |
| cikis_tarihi | date, null | boşsa iş hâlâ serviste |
| durum_id | uuid (FK → durum) | |
| teknik_personel_id | uuid (FK → teknik_personel), null | |
| fatura_durumu_id | uuid (FK → fatura_durumu), null | |
| ilgili_kisi | text, null | Excel'de serbest metin (isim + telefon) |
| fiyat_teklifi | numeric, null | |
| fatura_tutari | numeric, null | |
| aciklama | text, null | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `foto`
| alan | tip | not |
|------|-----|-----|
| id | uuid (PK) | |
| is_kaydi_id | uuid (FK → is_kaydi) | |
| dosya_yolu | text | Supabase Storage yolu |
| sira | int | RESİM-1 / RESİM-2 sırası |

### `kullanici_profil`
Supabase Auth kullanıcıya bağlı profil.
| alan | tip | not |
|------|-----|-----|
| id | uuid (PK, = auth.users.id) | |
| ad | text | |
| rol | text | "teknisyen" / "yonetici" |
| teknik_personel_id | uuid (FK), null | personel kaydıyla eşleştirme |

> Not: Erişim kontrolü için Supabase RLS (Row Level Security) politikaları kullanılacak.

---

## 5. Ekranlar ve Özellikler

### 5.1 İşler Listesi (ana ekran)
- Tablo sütunları: servis no, müşteri, cihaz, geliş, çıkış, durum (renkli rozet),
  teknik personel, fatura durumu, tutar.
- **Arama**: cihaz adı / seri no / müşteri / servis no üzerinden tek kutudan.
- **Filtreler**: durum, teknik personel, fatura durumu, müşteri, tarih aralığı.
- Sıralama ve sayfalama. Varsayılan: en yeni gelen üstte.
- Mobilde tablo yerine kart görünümü.

### 5.2 İş Detayı
- Tüm alanlar + fotoğraflar (büyütme, yükleme, silme).
- "Düzenle" ile aynı ekrandan güncelleme.
- Geçmiş/değişiklik bilgisi (created/updated).

### 5.3 Yeni İş
- Form: müşteri seç (yoksa anında yeni müşteri ekle), cihaz adı, seri no,
  geliş tarihi, durum, teknik personel, fatura durumu, servis no, açıklama,
  fiyat teklifi, tutar.
- Fotoğraf yükleme — mobilde doğrudan kameradan.

### 5.4 Pano (yönetici)
- Kartlar: toplam açık iş, teklif bekleyen, bu ay gelen, bu ay çıkan, bu ay ciro.
- Grafikler: duruma göre dağılım, teknik personele göre dağılım.
- Ortalama onarım süresi (çıkış − geliş, kapanan işler).

### 5.5 Raporlar
- Tarih aralığı + filtrelerle liste dökme.
- Excel/CSV dışa aktarma.

### 5.6 Tanımlar (yönetici)
- Müşteri, teknik personel, durum, fatura durumu listelerini yönet (ekle/düzenle/pasifleştir).
- Kullanıcı ekle ve rol ata.

---

## 6. İş Akışı / Durumlar

Tipik akış: **BAKILMADI → ONARIMDA → ONARILDI** (veya **İADE / GERİ GELEN / SATIŞ**).
Fatura tarafı bağımsız ilerler: **SONUÇ BEKLİYOR → TEKLİF VERİLDİ/HAZIRLANDI →
FATURA EDİLECEK → FATURA EDİLDİ** (ya da GARANTİ / BEDELSİZ / PEŞİN ALINDI / İADE).

Durum ve fatura durumu ayrı alanlar; ikisi de liste tablolarından gelir, yönetici
listeyi genişletebilir.

---

## 7. Teknoloji Yığını

- **Next.js** (App Router, TypeScript) — arayüz + sunucu.
- **Supabase** — Postgres veritabanı + Auth + Storage (fotoğraflar).
- **Tailwind CSS + shadcn/ui** — bileşenler.
- Arayüz **tamamen Türkçe**, **mobil uyumlu**.
- Yayın: **Vercel**.

---

## 8. Veri Taşıma (Excel → Uygulama)

Mevcut `Name_Teknik_MART_2026.xlsx` dosyasından:
- 22 sayfadaki ~494 kayıt birleştirilip tek `is_kaydi` tablosuna eşlenecek
  (farklı sütun adları/sıraları tek şemaya normalize edilir).
- Durum / personel / fatura durumu değerleri temizlenir (boşluk, büyük-küçük harf,
  "TEXONG"→"TEXHONG" gibi yazım düzeltmeleri).
- 208 gömülü fotoğraf çıkarılıp ilgili kayda bağlanır, Supabase Storage'a yüklenir.
- Çıktı: temiz `musteri` + `is_kaydi` veri seti (JSON/CSV) + isimlendirilmiş foto
  klasörü ve eşleme dosyası. Taşıma script'i bu veriye göre yazılır.

> Bu temiz veri seti ayrıca hazırlanıp repoya eklenecek; Claude Code taşıma
> script'ini bu sete göre yazar.

---

## 9. Olmazsa Olmazlar

- Türkçe arayüz ve Türkçe veri (UTF-8, Türkçe karakterler sorunsuz).
- Mobil uyumlu — teknisyenler tezgah başından telefonla kullanacak.
- Hızlı arama/filtre (494 → büyüyecek kayıt için indeksli sorgular).
- Fotoğraflar veritabanında değil, dosya deposunda.
- Rollere göre yetki (RLS).
