# AI-Hub 데이터 다운로드 + YOLO 변환 (한국 IP인 내 PC에서 실행)
# 사용: powershell -ExecutionPolicy Bypass -File download_convert.ps1 -FileKeys "521297,521308" -Limit 3000
param(
    [string]$FileKeys = "521297,521308",
    [int]$Limit = 3000,
    [string]$DatasetKey = "71769"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1) API 키 읽기 (aihub_key.txt)
$keyFile = Join-Path $root "aihub_key.txt"
$key = (Get-Content $keyFile -Raw).Trim()
if ($key -like "*붙여넣*" -or $key.Length -lt 10) {
    Write-Error "aihub_key.txt 에 실제 API 키를 붙여넣고 저장하세요."
    exit 1
}

$bash = "C:\Program Files\Git\bin\bash.exe"
$shell = Join-Path $root "aihubshell"
$raw = Join-Path $root "aihub_raw"
New-Item -ItemType Directory -Force -Path $raw | Out-Null

# 2) 다운로드 (aihubshell via Git Bash)
Write-Output "=== 다운로드 시작 (filekey: $FileKeys) ==="
Push-Location $raw
& $bash $shell -mode d -datasetkey $DatasetKey -filekey $FileKeys -aihubapikey $key
Pop-Location

# 3) YOLO 변환
$venvpy = Join-Path $root "..\ai-server\.venv\Scripts\python.exe"
$out = Join-Path $root "yolo_dataset"
Write-Output "=== YOLO 변환 시작 ==="
& $venvpy (Join-Path $root "aihub_to_yolo.py") --labels-dir $raw --images-dir $raw --out-dir $out --task detect --limit $Limit

# 4) 압축 (드라이브 업로드용)
$zip = Join-Path $root "yolo_dataset.zip"
if (Test-Path $zip) { Remove-Item $zip }
Write-Output "=== 압축 중 ==="
Compress-Archive -Path (Join-Path $out "*") -DestinationPath $zip
Write-Output "완료! 이 파일을 구글 드라이브에 업로드하세요:"
Write-Output $zip
