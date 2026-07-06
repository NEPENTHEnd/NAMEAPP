#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
Name Teknik - SUNUCUDA calisan bagimsiz yedek scripti.

Bu klasordeki AYARLAR.txt dosyasindan URL, KEY ve HEDEF'i okur; Supabase'deki
tum veriyi tek JSON'a cekip HEDEF klasorune tarih damgali kaydeder, eski
yedekleri dondurur. Tek dosyalik, tasinabilir - klasoru sunucuya kopyala yeter.
"""
import os
import sys
import json
import glob
import datetime
import urllib.request

BURA = os.path.dirname(os.path.abspath(__file__))
TABLOLAR = [
    "is_kaydi", "foto", "musteri", "grup", "durum", "fatura_durumu",
    "teknik_personel", "kullanici_profil", "davet_kisi", "fis_sayac",
]


def ayarlar():
    kv = {}
    yol = os.path.join(BURA, "AYARLAR.txt")
    if not os.path.exists(yol):
        print("HATA: AYARLAR.txt bulunamadi.")
        sys.exit(2)
    for line in open(yol, encoding="utf-8-sig"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        kv[k.strip().upper()] = v.strip().strip('"')
    return kv


def main():
    a = ayarlar()
    url = a.get("URL", "").rstrip("/")
    key = a.get("KEY", "")
    hedef = a.get("HEDEF", "") or os.path.join(BURA, "yedekler")
    tut = int(a.get("TUT", "90") or "90")
    if not url or not key:
        print("HATA: AYARLAR.txt icinde URL ve KEY dolu olmali.")
        sys.exit(2)

    os.makedirs(hedef, exist_ok=True)
    baslik = {"apikey": key, "Authorization": "Bearer " + key, "Range": "0-999999"}

    paket = {"_meta": {"tarih": datetime.datetime.now().isoformat()}}
    for t in TABLOLAR:
        try:
            req = urllib.request.Request(f"{url}/rest/v1/{t}?select=*", headers=baslik)
            with urllib.request.urlopen(req) as r:
                paket[t] = json.loads(r.read())
        except Exception as e:
            paket[t] = []
            print(f"UYARI: {t} okunamadi: {e}")
        print(f"  {t}: {len(paket[t])}")

    damga = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    dosya = os.path.join(hedef, f"nameteknik-yedek-{damga}.json")
    with open(dosya, "w", encoding="utf-8") as f:
        json.dump(paket, f, ensure_ascii=False)
    print(f"YEDEK: {dosya} ({os.path.getsize(dosya)/1024:.0f} KB)")

    eski = sorted(glob.glob(os.path.join(hedef, "nameteknik-yedek-*.json")))
    for y in (eski[:-tut] if tut > 0 else []):
        try:
            os.remove(y)
        except OSError:
            pass


if __name__ == "__main__":
    main()
