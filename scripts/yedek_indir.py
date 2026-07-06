#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
Name Teknik — SUNUCUYA YEDEK İNDİRME.

Supabase'deki tüm veriyi (tablo tablo) tek JSON dosyasına çeker ve verilen
klasöre TARİH DAMGALI kaydeder. Eski yedekleri döndürür (varsayılan son 60).
Şirket yedek sunucusundaki bir paylaşıma (ör. \\SUNUCU\yedek\nameteknik)
Görev Zamanlayıcı ile her gün çalıştırılabilir.

Anahtar:  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ortam değişkeni ya da
          betiğin yanındaki .env.local'den okunur). Anahtar GİZLİDİR.

Kullanım:
    py -3 scripts/yedek_indir.py "\\\\SUNUCU\\yedek\\nameteknik"
    py -3 scripts/yedek_indir.py "D:\\Yedek\\NameTeknik" --tut 90
"""
import os
import sys
import json
import glob
import datetime
import urllib.request

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Yedeklenecek tablolar (tüm veri + tanımlar)
TABLOLAR = [
    "is_kaydi", "foto", "musteri", "grup", "durum", "fatura_durumu",
    "teknik_personel", "kullanici_profil", "davet_kisi", "fis_sayac",
]


def env(anahtar):
    v = os.environ.get(anahtar)
    if v:
        return v
    yol = os.path.join(KOK, ".env.local")
    if os.path.exists(yol):
        for line in open(yol, encoding="utf-8"):
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            k, val = line.split("=", 1)
            if k.strip() == anahtar:
                return val.strip().strip('"').strip("'")
    return ""


def main():
    hedef = None
    tut = 60
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--tut" and i + 1 < len(args):
            tut = int(args[i + 1]); i += 2
        else:
            hedef = args[i]; i += 1
    if not hedef:
        hedef = os.path.join(KOK, "scripts", "_cikti", "yedekler")

    url = (env("NEXT_PUBLIC_SUPABASE_URL") or env("SUPABASE_URL")).rstrip("/")
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("HATA: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY bulunamadı.")
        sys.exit(2)

    os.makedirs(hedef, exist_ok=True)
    baslik = {"apikey": key, "Authorization": "Bearer " + key}

    paket = {"_meta": {"tarih": datetime.datetime.now().isoformat(), "url": url}}
    for tablo in TABLOLAR:
        req = urllib.request.Request(
            f"{url}/rest/v1/{tablo}?select=*",
            headers={**baslik, "Range": "0-999999"},
        )
        try:
            with urllib.request.urlopen(req) as r:
                paket[tablo] = json.loads(r.read())
        except Exception as e:
            paket[tablo] = []
            print(f"UYARI: {tablo} okunamadı: {e}")
        print(f"  {tablo}: {len(paket[tablo])}")

    damga = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    dosya = os.path.join(hedef, f"nameteknik-yedek-{damga}.json")
    with open(dosya, "w", encoding="utf-8") as f:
        json.dump(paket, f, ensure_ascii=False)
    boyut = os.path.getsize(dosya) / 1024
    print(f"YEDEK: {dosya} ({boyut:.0f} KB)")

    # Eski yedekleri döndür (en yeni {tut} tanesi kalsın)
    eski = sorted(glob.glob(os.path.join(hedef, "nameteknik-yedek-*.json")))
    for y in eski[:-tut] if tut > 0 else []:
        try:
            os.remove(y)
            print("silindi (eski):", os.path.basename(y))
        except OSError:
            pass


if __name__ == "__main__":
    main()
