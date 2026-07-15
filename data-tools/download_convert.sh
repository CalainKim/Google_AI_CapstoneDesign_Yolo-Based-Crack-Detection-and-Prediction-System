#!/usr/bin/env bash
# AI-Hub 데이터 다운로드 -> 변환 -> 업로드용 zip (한국 IP인 내 Mac/Linux에서 실행)
#
# download_convert.ps1(Windows)의 macOS/Linux 버전.
# 실제 작업 스크립트(prepare_from_tar.py, aihub_to_yolo.py, make_zip.py)는
# 표준 라이브러리만 쓰므로 별도 설치 없이 python3 로 그대로 실행된다.
#
# ※ 중요: AI-Hub 는 Colab(해외) IP 직접 다운로드를 막는다. 반드시 한국 IP의 PC에서 실행할 것.
#
# 사용 예:
#   1) data-tools/aihub_key.txt 에 AI-Hub API 인증키를 붙여넣는다.
#   2) bash download_convert.sh                     # 기본값(filekey 521297,521308 / limit 3000)
#      bash download_convert.sh "521297,521308" 3000
set -euo pipefail

# ---- 파라미터 (인자로 덮어쓰기 가능) ----
FILEKEYS="${1:-521297,521308}"   # 다운로드할 파일 세그먼트(fileSn). 콤마로 여러 개
LIMIT="${2:-3000}"               # YOLO 변환 시 처리할 최대 개수(파이프라인 검증용 소량)
DATASET_KEY="${3:-71769}"        # SOC 시설물 균열패턴 이미지
WORK_DIR="${4:-$HOME/crack_data}" # 대용량 작업 폴더 (repo 밖, 클라우드 동기화 폴더 밖 권장)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="python3"

# ---- 1) API 키 ----
KEY_FILE="$ROOT/aihub_key.txt"
if [[ ! -f "$KEY_FILE" ]]; then
  echo "ERROR: $KEY_FILE 가 없습니다. AI-Hub API 인증키를 이 파일에 넣어주세요." >&2
  exit 1
fi
KEY="$(tr -d '[:space:]' < "$KEY_FILE")"
if [[ "${#KEY}" -lt 10 ]]; then
  echo "ERROR: aihub_key.txt 에 실제 API 키를 넣어주세요." >&2
  exit 1
fi

DL_DIR="$WORK_DIR/dl"
TAR="$DL_DIR/download.tar"
mkdir -p "$DL_DIR"

# ---- 2) 다운로드 (curl 로 download.tar 직접 받기) ----
echo "=== 다운로드 (filekey: $FILEKEYS) ==="
rm -f "$TAR"
curl -L -H "apikey:$KEY" -o "$TAR" \
  "https://api.aihub.or.kr/down/0.6/$DATASET_KEY.do?fileSn=$FILEKEYS"

SIZE_MB=$(( $(wc -c < "$TAR") / 1024 / 1024 ))
echo "download.tar: ${SIZE_MB} MB"
if [[ "$SIZE_MB" -lt 1 ]]; then
  echo "ERROR: 다운로드 실패(파일이 너무 작음). 응답 내용:" >&2
  cat "$TAR" >&2 || true
  exit 1
fi

# ---- 3) tar해제 + part병합 + zip해제 (Python, 한글 안전) -> labels/ , images/ ----
PREPARED="$WORK_DIR/prepared"
echo "=== 압축/병합/해제 (Python) ==="
"$PY" "$ROOT/prepare_from_tar.py" --tar "$TAR" --work "$PREPARED"

# ---- 4) YOLO 변환 ----
OUT="$WORK_DIR/yolo_dataset"
echo "=== YOLO 변환 ==="
"$PY" "$ROOT/aihub_to_yolo.py" \
  --labels-dir "$PREPARED/labels" \
  --images-dir "$PREPARED/images" \
  --out-dir "$OUT" --task detect --limit "$LIMIT"

# ---- 5) 업로드용 압축 (경로 구분자 '/' — Colab(리눅스) 호환) ----
ZIP="$WORK_DIR/yolo_dataset.zip"
echo "=== 업로드용 압축 ==="
"$PY" "$ROOT/make_zip.py" --src "$OUT" --out "$ZIP"

echo ""
echo "완료! 아래 파일을 구글 드라이브 My Drive 최상위에 업로드하세요:"
echo "$ZIP"
