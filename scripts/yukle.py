#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Name Teknik — İçe aktarma YÜKLEME adımı (Supabase'e yazar).

Önce `ice_aktarma.py` çalıştırılmış olmalı (scripts/_cikti/temiz_veri.json +
_cikti/fotolar/ üretir). Bu betik o çıktıyı okuyup:
  1) 29 Haziran 2026 ve öncesi tüm is_kaydi'yi (foto + storage dahil) SİLER,
  2) müşteri/durum/fatura/personel/grup eksiklerini oluşturur,
  3) satırları is_kaydi'ye ekler (grup = Excel sayfa adı; DİĞER = grupsuz),
  4) fotoğrafları Storage'a yükleyip foto satırlarını ekler.

Servis-rolü anahtarı GEREKİR (.env.local içindeki SUPABASE_SERVICE_ROLE_KEY).
Anahtar repoya girmez; betik yalnız yerelde çalışır.

Kullanım:  py -3 scripts/yukle.py
"""
import os
import sys
import json
import mimetypes
import urllib.request
import urllib.parse

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CIKTI = os.path.join(KOK, "scripts", "_cikti")
FOTO_DIZIN = os.path.join(CIKTI, "fotolar")
KESIM_TARIHI = "2026-06-30"  # bundan ÖNCESİ silinir (29 Haziran ve öncesi)


def env_yukle():
    kv = {}
    yol = os.path.join(KOK, ".env.local")
    for line in open(yol, encoding="utf-8"):
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
    print("HATA: NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY .env.local'de yok.")
    print("Supabase → Settings → API → service_role anahtarını .env.local'e ekleyin.")
    sys.exit(2)

BASLIK = {
    "apikey": KEY,
    "Authorization": "Bearer " + KEY,
    "Content-Type": "application/json",
}


def istek(yontem, yol, govde=None, ekbaslik=None, ham=False):
    veri = None
    if govde is not None:
        veri = govde if ham else json.dumps(govde).encode("utf-8")
    baslik = dict(BASLIK)
    if ekbaslik:
        baslik.update(ekbaslik)
    req = urllib.request.Request(URL + yol, data=veri, method=yontem, headers=baslik)
    try:
        with urllib.request.urlopen(req) as r:
            gövde = r.read()
            return r.status, gövde
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def rest_get(path):
    s, b = istek("GET", "/rest/v1/" + path)
    if s >= 300:
        raise RuntimeError(f"GET {path} -> {s} {b[:200]}")
    return json.loads(b or b"[]")


def rest_post(path, rows, dondur=False):
    ek = {"Prefer": "return=representation"} if dondur else {"Prefer": "return=minimal"}
    s, b = istek("POST", "/rest/v1/" + path, rows, ek)
    if s >= 300:
        raise RuntimeError(f"POST {path} -> {s} {b[:300]}")
    return json.loads(b) if (dondur and b) else None


def rest_delete(path):
    s, b = istek("DELETE", "/rest/v1/" + path, ekbaslik={"Prefer": "return=minimal"})
    if s >= 300:
        raise RuntimeError(f"DELETE {path} -> {s} {b[:200]}")


def storage_yukle(path, veri, tip):
    s, b = istek(
        "POST",
        "/storage/v1/object/foto/" + urllib.parse.quote(path),
        veri,
        {"Content-Type": tip, "x-upsert": "true"},
        ham=True,
    )
    if s >= 300:
        raise RuntimeError(f"STORAGE {path} -> {s} {b[:200]}")


def storage_sil(paths):
    if not paths:
        return
    istek("DELETE", "/storage/v1/object/foto", {"prefixes": paths})


# ---- Lookup önbellekleri (isim büyük harf -> id) ----
def onbellek(tablo, alanlar="id, ad"):
    d = {}
    for r in rest_get(f"{tablo}?select={urllib.parse.quote(alanlar)}"):
        if r.get("ad"):
            d[r["ad"].strip().upper()] = r["id"]
    return d


def main():
    yol = os.path.join(CIKTI, "temiz_veri.json")
    if not os.path.exists(yol):
        print("HATA: önce ice_aktarma.py çalıştırın (temiz_veri.json yok).")
        sys.exit(1)
    kayitlar = json.load(open(yol, encoding="utf-8"))
    print("Kayıt:", len(kayitlar))

    yuce = rest_get("kullanici_profil?sahip=is.true&select=id")
    if not yuce:
        print("HATA: yüceadmin (sahip) profili bulunamadı.")
        sys.exit(1)
    olusturan_id = yuce[0]["id"]

    # 1) ≤29 Haziran sil (foto + storage + is_kaydi)
    eski = rest_get(f"is_kaydi?gelis_tarihi=lt.{KESIM_TARIHI}&select=id")
    if eski:
        ids = ",".join(r["id"] for r in eski)
        fotolar = rest_get(f"foto?is_kaydi_id=in.({ids})&select=dosya_yolu")
        yollar = [f["dosya_yolu"] for f in fotolar if f.get("dosya_yolu")]
        for i in range(0, len(yollar), 100):
            storage_sil(yollar[i : i + 100])
        rest_delete(f"foto?is_kaydi_id=in.({ids})")
        rest_delete(f"is_kaydi?gelis_tarihi=lt.{KESIM_TARIHI}")
        print(f"Silindi: {len(eski)} eski iş, {len(yollar)} foto")

    # 2) Lookup önbellekleri + eksikleri oluştur
    durumlar = onbellek("durum")
    faturalar = onbellek("fatura_durumu")
    personeller = onbellek("teknik_personel")
    gruplar = onbellek("grup")
    musteriler = onbellek("musteri")
    bakilmadi_id = durumlar.get("BAKILMADI")

    def bul_olustur(ad, onb, tablo, ekstra=None):
        if not ad:
            return None
        k = ad.strip().upper()
        if k in onb:
            return onb[k]
        row = {"ad": ad.strip()}
        if ekstra:
            row.update(ekstra)
        yeni = rest_post(tablo, [row], dondur=True)
        onb[k] = yeni[0]["id"]
        return onb[k]

    # 3) is_kaydi ekle (parti parti), foto için id eşle
    PARTI = 100
    eklenen = 0
    fotolu = []  # (is_id, [dosya adları])
    for i in range(0, len(kayitlar), PARTI):
        grup = kayitlar[i : i + PARTI]
        satirlar = []
        for k in grup:
            musteri_ad = k.get("musteri") or k.get("grup") or "BİLİNMEYEN"
            satirlar.append({
                "musteri_id": bul_olustur(musteri_ad, musteriler, "musteri"),
                "cihaz_adi": (k.get("cihaz_adi") or "—")[:400],
                "seri_no": k.get("seri_no"),
                "servis_no": k.get("servis_no"),
                "gelis_tarihi": k.get("gelis_tarihi") or k.get("cikis_tarihi") or "2026-07-01",
                "cikis_tarihi": k.get("cikis_tarihi"),
                "durum_id": bul_olustur(k.get("durum"), durumlar, "durum", {"sira": 100}) or bakilmadi_id,
                "teknik_personel_id": bul_olustur(k.get("teknik_personel"), personeller, "teknik_personel"),
                "fatura_durumu_id": bul_olustur(k.get("fatura_durumu"), faturalar, "fatura_durumu"),
                "grup_id": bul_olustur(k.get("grup"), gruplar, "grup", {"sira": 99}),
                "ilgili_kisi": k.get("ilgili_kisi"),
                "fiyat_teklifi": k.get("fiyat_teklifi"),
                "fatura_tutari": k.get("fatura_tutari"),
                "aciklama": k.get("aciklama"),
                "olusturan_id": olusturan_id,
                "yonetici_gordu": True,
            })
        dönen = rest_post("is_kaydi", satirlar, dondur=True)
        eklenen += len(dönen)
        for kayit, yeni in zip(grup, dönen):
            if kayit.get("fotolar"):
                fotolu.append((yeni["id"], kayit["fotolar"]))
        print(f"  eklendi {eklenen}/{len(kayitlar)}")

    # 4) Fotoğrafları yükle
    foto_sayisi = 0
    for is_id, adlar in fotolu:
        for sira, ad in enumerate(adlar):
            fyol = os.path.join(FOTO_DIZIN, ad)
            if not os.path.exists(fyol):
                continue
            tip = mimetypes.guess_type(ad)[0] or "image/jpeg"
            with open(fyol, "rb") as f:
                veri = f.read()
            depo_yol = f"{is_id}/{ad}"
            storage_yukle(depo_yol, veri, tip)
            rest_post("foto", [{"is_kaydi_id": is_id, "dosya_yolu": depo_yol, "sira": sira}])
            foto_sayisi += 1
        if foto_sayisi and foto_sayisi % 25 == 0:
            print(f"  foto {foto_sayisi}")

    print(f"BİTTİ. {eklenen} iş, {foto_sayisi} foto yüklendi.")


if __name__ == "__main__":
    main()
