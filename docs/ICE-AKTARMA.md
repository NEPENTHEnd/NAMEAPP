# Excel → Uygulama İçe Aktarma

Eski/yeni Excel aynı düzende (başlık 2. satırda). İki sayfa tipi var:

- **Müşteri sayfaları** (müşteri = sayfa adı): `ÜRÜNÜN ADI VEYA KODU, GELİŞ/ÇIKIŞ TARİHİ, DURUM BİLGİSİ, TEKNİK PERSONEL, SONUÇ, TEKNİK SERVİS NO, AÇIKLAMA, FATURA BİRİM TUTARI, RESİM-1/2`
- **DİĞER** (müşteri = FİRMA ADI sütunu): `FİRMA ADI, KARTIN ADI, GELİŞ/ÇIKIŞ, DURUM, TEKNİK PERSONEL, FATURA, İLGİLİ KİŞİ, FİYAT TEKLİFİ, FATURA BİRİM TUTARI, FİŞ NO, AÇIKLAMA/SERİ NO, RESİM-1/2`

`DURUM` ve `Sayfa6` veri değil → atlanır.

## Şema eşlemesi (`is_kaydi`)

| Excel başlığı | Alan |
|---|---|
| ÜRÜNÜN ADI VEYA KODU / KARTIN ADI | cihaz_adi |
| (sayfa adı) / FİRMA ADI | musteri |
| GELİŞ TARİHİ / ÇIKIŞ TARİHİ | gelis_tarihi / cikis_tarihi |
| DURUM (BİLGİSİ) | durum |
| TEKNİK PERSONEL | teknik_personel |
| SONUÇ / FATURA | fatura_durumu |
| TEKNİK SERVİS NO / FİŞ NO | servis_no |
| AÇIKLAMA (/ SERİ NO) | aciklama (+ "SN:…" → seri_no) |
| İLGİLİ KİŞİ | ilgili_kisi |
| FİYAT TEKLİFİ / FATURA BİRİM TUTARI | fiyat_teklifi / fatura_tutari |
| RESİM-1, RESİM-2 (gömülü) | foto (Storage) |

## Çalıştırma (kuru / dry-run)

```bash
python scripts/ice_aktarma.py [EXCEL_YOLU]   # varsayılan: MART_2026.xlsx
```

Çıktı (repoya girmez, `scripts/_cikti/`):
- `temiz_veri.json` — normalize kayıtlar (her birinde `fotolar: [...]`)
- `ozet.json` — sayımlar + distinct müşteri/personel/durum/fatura
- `fotolar/` — çıkarılmış görseller (satıra eşli)

Gereksinim: `pip install openpyxl Pillow`.

## Notlar / temizleme

- Boş/biçim satırları **cihaz adı yoksa** atlanır.
- Durum/fatura/personel/müşteri: trim + boşluk sadeleştirme + Türkçe büyük harf.
- Eski Excel'de seed'de olmayan değerler görüldü (durum: `SAĞLAM`; fatura:
  `TEKLİF VERİLECEK`, `ÇALIŞMADI`, `SAĞLAM`). Bunlar yükleme sırasında ilgili
  tanım tablolarına **otomatik eklenecek** (yoksa).
- Personel eski dosyada 5 görünüyor (OKAN, ALAHATTİN, ÖMER, REMZİ, AHMET);
  NAZIM/FARUK dropdown'da var ama kayıtta yok — final dosyada değişebilir.

## Gerçek yükleme (final Excel gelince — yapılacak)

1. Mevcut **örnek/test verisini** temizle (6 iş + test müşteri/personel).
2. `temiz_veri.json`'dan: eksik müşteri/personel/durum/fatura tanımlarını ekle,
   sonra `is_kaydi` satırlarını yaz (id eşlemesiyle).
3. `fotolar/`'ı Supabase Storage `foto` bucket'ına yükle, her dosyayı ilgili
   `is_kaydi`'ye `foto` satırı olarak bağla.
4. Yazma için yalnız **yerelde** `SUPABASE_SERVICE_ROLE_KEY` kullanılır (RLS'i
   aşar); repoya girmez. (Veya küçük setlerde Supabase MCP ile SQL.)
