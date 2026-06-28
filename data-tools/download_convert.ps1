# AI-Hub 데이터 다운로드 -> 변환 -> 업로드용 zip (한국 IP인 내 PC에서 실행)
#
# ※ 중요한 교훈(이미 해결됨):
#   - aihubshell 의 내장 병합(printf %q + find)은 한글 파일명에서 깨져 0바이트 zip을 만든다.
#   - Windows tar.exe(bsdtar)도 한글 tar 엔트리에서 "Invalid empty pathname" 으로 실패한다.
#   - 그래서 다운로드는 curl 로, tar해제/part병합/zip해제는 Python(prepare_from_tar.py)으로 한다.
#   - 작업은 OneDrive 밖 로컬 폴더에서 한다(동기화가 대용량 파일을 망가뜨림).
#
# 사용 예:
#   powershell -ExecutionPolicy Bypass -File download_convert.ps1 -FileKeys "521297,521308" -Limit 3000
param(
    [string]$FileKeys = "521297,521308",
    [int]$Limit = 3000,
    [string]$DatasetKey = "71769",
    [string]$WorkDir = "C:\Users\doeun\crack_data"   # OneDrive 밖!
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1) API 키
$key = (Get-Content (Join-Path $root "aihub_key.txt") -Raw).Trim()
if ($key -like "*붙여넣*" -or $key.Length -lt 10) { Write-Error "aihub_key.txt 에 실제 API 키를 넣어주세요."; exit 1 }

$venvpy = Join-Path $root "..\ai-server\.venv\Scripts\python.exe"
$dl = Join-Path $WorkDir "dl"
New-Item -ItemType Directory -Force -Path $dl | Out-Null
$tar = Join-Path $dl "download.tar"

# 2) 다운로드 (curl 로 download.tar 직접 받기)
Write-Output "=== 다운로드 (filekey: $FileKeys) ==="
if (Test-Path $tar) { Remove-Item $tar }
curl.exe -L -H "apikey:$key" -o $tar "https://api.aihub.or.kr/down/0.6/$DatasetKey.do?fileSn=$FileKeys"
$mb = [math]::Round((Get-Item -LiteralPath $tar).Length/1MB,1)
Write-Output "download.tar: $mb MB"
if ($mb -lt 1) { Write-Error "다운로드 실패(파일이 너무 작음). 에러내용:"; Get-Content $tar -Raw; exit 1 }

# 3) tar해제 + part병합 + zip해제 (Python, 한글 안전) -> labels/ , images/
$prepared = Join-Path $WorkDir "prepared"
Write-Output "=== 압축/병합/해제 (Python) ==="
& $venvpy (Join-Path $root "prepare_from_tar.py") --tar $tar --work $prepared

# 4) YOLO 변환
$out = Join-Path $WorkDir "yolo_dataset"
Write-Output "=== YOLO 변환 ==="
& $venvpy (Join-Path $root "aihub_to_yolo.py") --labels-dir (Join-Path $prepared "labels") --images-dir (Join-Path $prepared "images") --out-dir $out --task detect --limit $Limit

# 5) 업로드용 압축 (Python: 경로 구분자 '/' 사용 — Colab(리눅스) 호환)
$zip = Join-Path $WorkDir "yolo_dataset.zip"
Write-Output "=== 업로드용 압축 ==="
& $venvpy (Join-Path $root "make_zip.py") --src $out --out $zip
Write-Output ""
Write-Output "완료! 아래 파일을 구글 드라이브 My Drive 최상위에 업로드하세요:"
Write-Output $zip
