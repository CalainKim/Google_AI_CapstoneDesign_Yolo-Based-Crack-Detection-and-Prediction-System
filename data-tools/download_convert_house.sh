#!/usr/bin/env bash
# 노후주택 데이터(AI-Hub) 다운로드 → YOLO 변환 → house_yolo.zip 생성.
# ※ AI-Hub는 해외(Colab) IP 직접 다운로드를 막으므로 반드시 한국 IP의 Mac/PC에서 실행.
#
# 사용:
#   1) data-tools/aihub_key.txt 에 AI-Hub API 키 넣기
#   2) bash download_convert_house.sh <dataSetSn> "<fileSn들>" [셀당최대] [작업폴더]
#      예) bash download_convert_house.sh 00000 "1,2,3" 800
#
#   dataSetSn / fileSn 은 AI-Hub '서울시 노후 주택 균열 데이터' 페이지에서 확인.
#   (SOC용 기존 값: dataSetSn=71769. 노후주택은 값이 다르므로 반드시 교체.)
set -euo pipefail

DATASET_KEY="${1:?dataSetSn(노후주택 데이터셋 번호)를 첫 인자로 주세요}"
FILEKEYS="${2:?다운로드할 fileSn들(콤마구분)을 두번째 인자로 주세요}"
MAX_PER_CELL="${3:-800}"                 # (결함×등급) 셀당 최대 이미지 수
WORK_DIR="${4:-$HOME/house_data}"        # 대용량 작업 폴더 (repo/클라우드 동기화 폴더 밖 권장)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="python3"

# --- API 키 ---
KEY_FILE="$ROOT/aihub_key.txt"
[[ -f "$KEY_FILE" ]] || { echo "ERROR: $KEY_FILE 없음. AI-Hub API 키를 넣어주세요." >&2; exit 1; }
KEY="$(tr -d '[:space:]' < "$KEY_FILE")"
[[ "${#KEY}" -ge 10 ]] || { echo "ERROR: aihub_key.txt 에 실제 키를 넣어주세요." >&2; exit 1; }

DL_DIR="$WORK_DIR/dl"; TAR="$DL_DIR/download.tar"; mkdir -p "$DL_DIR"

# --- 1) 다운로드 ---
echo "=== 다운로드 (dataSetSn=$DATASET_KEY, fileSn=$FILEKEYS) ==="
rm -f "$TAR"
curl -L -H "apikey:$KEY" -o "$TAR" \
  "https://api.aihub.or.kr/down/0.6/$DATASET_KEY.do?fileSn=$FILEKEYS"
SIZE_MB=$(( $(wc -c < "$TAR") / 1024 / 1024 ))
echo "download.tar: ${SIZE_MB} MB"
[[ "$SIZE_MB" -ge 1 ]] || { echo "ERROR: 다운로드 실패. 응답:" >&2; cat "$TAR" >&2 || true; exit 1; }

# --- 2) tar 해제 + part 병합 + zip 해제 (★폴더 구조 보존: 등급이 폴더에 있음) ---
PREPARED="$WORK_DIR/prepared"
echo "=== 압축/병합/해제 (구조 보존) ==="
"$PY" "$ROOT/prepare_house_from_tar.py" --tar "$TAR" --work "$PREPARED"

# 라벨(json)·이미지가 같은 트리에 섞여 있음 → 둘 다 extracted 루트를 가리킴(converter가 rglob).
LABELS_DIR="$PREPARED/extracted"
IMAGES_DIR="$PREPARED/extracted"

# --- 3) 구조 확인 (자동, 참고용) ---
echo "=== 구조 확인 (inspect) ==="
"$PY" "$ROOT/aihub_house_to_yolo.py" --labels-dir "$LABELS_DIR" --images-dir "$IMAGES_DIR" --inspect || true

# --- 4) YOLO 변환 (구조물 3종, 등급 균형 샘플) ---
OUT="$WORK_DIR/house_yolo"
echo "=== YOLO 변환 (셀당 최대 $MAX_PER_CELL) ==="
"$PY" "$ROOT/aihub_house_to_yolo.py" \
  --labels-dir "$LABELS_DIR" --images-dir "$IMAGES_DIR" \
  --out-dir "$OUT" --defect-from path --max-per-cell "$MAX_PER_CELL" --val-ratio 0.2

# --- 5) 업로드용 zip (Colab 리눅스 호환 경로구분자) ---
ZIP="$WORK_DIR/house_yolo.zip"
echo "=== 업로드용 압축 ==="
"$PY" "$ROOT/make_zip.py" --src "$OUT" --out "$ZIP"

echo ""
echo "완료! 아래 파일을 구글 드라이브 My Drive 최상위에 업로드 → notebooks/03_노후주택_YOLO_학습.ipynb 실행:"
echo "$ZIP"
