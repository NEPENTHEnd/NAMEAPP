#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Name Teknik — TAM VERİ TEMİZLİĞİ (yeniden içe aktarma öncesi).

Siler: TÜM foto depo dosyaları, foto satırları, is_kaydi satırları, musteri
satırları. Tanımlara (durum/fatura/grup/teknik_personel/davet/profil) DOKUNMAZ.

Kullanım:  py -3 scripts/temizle.py --onay
"""
import os
import sys
import json
import urllib.request
import urllib.parse

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def env_yukle():
    kv = {}
    for line in open(os.path.join(KOK, ".env.local"), encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        kv[k.strip()] = v.strip().strip('"').strip("'")
    return kv


ENV = env_yukle()
URL = ENV.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not URL or not KEY:
    print("HATA: URL/SERVICE_ROLE_KEY yok (.env.local)")
    sys.exit(2)

BASLIK = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"}


def istek(yontem, yol, govde=None, ekbaslik=None):
    veri = json.dumps(govde).encode() if govde is not None else None
    b = dict(BASLIK)
    if ekbaslik:
        b.update(ekbaslik)
    req = urllib.request.Request(URL + yol, data=veri, method=yontem, headers=b)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def main():
    if "--onay" not in sys.argv:
        print("Güvenlik: --onay bayrağı olmadan çalışmaz.")
        sys.exit(1)

    # 1) Foto deposunu boşalt (klasörlü listeleme: her is_kaydi id'si bir klasör)
    silinen_dosya = 0
    while True:
        s, b = istek("POST", "/storage/v1/object/list/foto",
                     {"prefix": "", "limit": 1000, "offset": 0})
        if s >= 300:
            print("depo listeleme hatası:", s, b[:200]); break
        girdiler = json.loads(b)
        if not girdiler:
            break
        yollar = []
        for g in girdiler:
            ad = g.get("name")
            if not ad:
                continue
            if g.get("id") is None:  # klasör → içini listele
                s2, b2 = istek("POST", "/storage/v1/object/list/foto",
                               {"prefix": ad + "/", "limit": 1000, "offset": 0})
                if s2 < 300:
                    yollar += [f"{ad}/{x['name']}" for x in json.loads(b2) if x.get("name")]
            else:
                yollar.append(ad)
        if not yollar:
            break
        for i in range(0, len(yollar), 100):
            s3, b3 = istek("DELETE", "/storage/v1/object/foto",
                           {"prefixes": yollar[i:i + 100]})
            if s3 >= 300:
                print("depo silme hatası:", s3, b3[:200])
        silinen_dosya += len(yollar)
        if len(girdiler) < 1000 and not any(g.get("id") is None for g in girdiler):
            break
        if not girdiler:
            break
        # klasörler silinen dosyalarla boşaldı; döngü tekrar listeler, boşsa çıkar
        if silinen_dosya > 5000:
            break
    print("Depo: silinen dosya ~", silinen_dosya)

    # 2) Tablolar: foto -> is_kaydi -> musteri
    for tablo in ("foto", "is_kaydi", "musteri"):
        s, b = istek("DELETE", f"/rest/v1/{tablo}?id=not.is.null",
                     ekbaslik={"Prefer": "return=minimal"})
        print(tablo, "->", "OK" if s < 300 else f"HATA {s} {b[:200]}")

    # 3) Doğrulama
    for tablo in ("foto", "is_kaydi", "musteri"):
        s, b = istek("GET", f"/rest/v1/{tablo}?select=id&limit=1")
        kalan = len(json.loads(b)) if s < 300 else "?"
        print(f"kalan {tablo}: {kalan}")


if __name__ == "__main__":
    main()
