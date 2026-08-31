# Name Teknik - Windows'ta calisan yedek (PowerShell; kurulum gerektirmez).
# Ayni klasordeki AYARLAR.txt'den URL/KEY/HEDEF okur, tum veriyi tek JSON'a
# ceker, HEDEF klasorune tarih damgali kaydeder, eski yedekleri dondurur.
$ErrorActionPreference = "Stop"
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$bura = Split-Path -Parent $MyInvocation.MyCommand.Path
$ayarYol = Join-Path $bura "AYARLAR.txt"
if (-not (Test-Path $ayarYol)) { Write-Host "HATA: AYARLAR.txt bulunamadi."; exit 2 }

$a = @{}
foreach ($line in Get-Content -LiteralPath $ayarYol -Encoding UTF8) {
  $s = $line.Trim()
  if ($s -eq "" -or $s.StartsWith("#") -or ($s -notmatch "=")) { continue }
  $i = $s.IndexOf("=")
  $a[$s.Substring(0, $i).Trim().ToUpperInvariant()] = $s.Substring($i + 1).Trim().Trim('"')
}

$url = ("" + $a["URL"]).TrimEnd("/")
$key = "" + $a["KEY"]
$hedef = "" + $a["HEDEF"]
if ([string]::IsNullOrWhiteSpace($hedef)) { $hedef = Join-Path $bura "yedekler" }
$tut = 90
if ($a.ContainsKey("TUT") -and $a["TUT"]) { $tut = [int]$a["TUT"] }
if ([string]::IsNullOrWhiteSpace($url) -or [string]::IsNullOrWhiteSpace($key)) {
  Write-Host "HATA: AYARLAR.txt icinde URL ve KEY dolu olmali."; exit 2
}

New-Item -ItemType Directory -Force -Path $hedef | Out-Null
# NOT: "Range" baslgi PowerShell 5.1'de kisitlidir; sayfalama limit/offset ile yapilir.
$h = @{ "apikey" = $key; "Authorization" = "Bearer $key" }
$tablolar = @("is_kaydi", "foto", "musteri", "grup", "sube", "durum", "fatura_durumu",
              "teknik_personel", "kullanici_profil", "davet_kodu", "davet_kisi",
              "fis_sayac", "firma_hedef", "push_abonelik")
$limit = 1000

$parcalar = New-Object System.Collections.ArrayList
[void]$parcalar.Add('"_meta":{"tarih":"' + (Get-Date).ToString("s") + '"}')
foreach ($t in $tablolar) {
  $satirlar = New-Object System.Collections.ArrayList
  $offset = 0
  try {
    while ($true) {
      $u = "$url/rest/v1/$($t)?select=*&limit=$limit&offset=$offset"
      $resp = Invoke-WebRequest -Uri $u -Headers $h -UseBasicParsing
      $arr = $resp.Content
      $n = @($arr | ConvertFrom-Json).Count
      if ($n -gt 0) { [void]$satirlar.Add($arr.Substring(1, $arr.Length - 2)) }
      if ($n -lt $limit) { break }
      $offset += $limit
    }
    $icerik = "[" + (($satirlar | Where-Object { $_ -ne "" }) -join ",") + "]"
  } catch {
    $icerik = "[]"
    Write-Host "UYARI: $t okunamadi ($($_.Exception.Message))"
  }
  [void]$parcalar.Add('"' + $t + '":' + $icerik)
  Write-Host "  $t"
}

$json = "{" + ($parcalar -join ",") + "}"
$damga = (Get-Date).ToString("yyyyMMdd-HHmmss")
$dosya = Join-Path $hedef ("nameteknik-yedek-" + $damga + ".json")
[System.IO.File]::WriteAllText($dosya, $json, (New-Object System.Text.UTF8Encoding($false)))
$kb = [math]::Round((Get-Item -LiteralPath $dosya).Length / 1KB)
Write-Host "YEDEK: $dosya ($kb KB)"

# Eski yedekleri dondur (en yeni $tut tanesi kalsin)
$eski = @(Get-ChildItem -LiteralPath $hedef -Filter "nameteknik-yedek-*.json" | Sort-Object Name)
if ($tut -gt 0 -and $eski.Count -gt $tut) {
  $eski[0..($eski.Count - $tut - 1)] | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
}
