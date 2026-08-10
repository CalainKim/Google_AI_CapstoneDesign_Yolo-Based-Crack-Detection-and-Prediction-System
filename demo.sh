#!/usr/bin/env bash
# 데모 원커맨드 실행 — AI 서버 + 웹 + 공개 터널(QR 포함)
#
# 사용:
#   bash demo.sh              서버·웹·터널 실행, 공개 주소와 QR 출력
#   bash demo.sh --reseed     DB 초기화 + 데모 데이터 재구성까지
#   bash demo.sh --local      터널 없이 같은 네트워크에서만 (LAN)
#   bash demo.sh --stop       전부 종료
#
# 웹 서버가 /api 를 8000 포트로 중계하므로 밖으로는 포트 하나만 열면 된다.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

stop_all() {
  pkill -f "uvicorn app.main:app" 2>/dev/null
  pkill -f "vite" 2>/dev/null
  pkill -f "cloudflared tunnel" 2>/dev/null
  sleep 1
}

if [[ "${1:-}" == "--stop" ]]; then
  echo "== 종료 =="
  stop_all
  echo "   모두 종료했습니다."
  exit 0
fi

MODE="${1:-}"

echo "== 기존 프로세스 정리 =="
stop_all

if [[ "$MODE" == "--reseed" ]]; then
  echo "== DB 초기화 =="
  rm -f "$ROOT/ai-server/data/app.db" "$ROOT"/ai-server/data/uploads/* \
        "$ROOT"/ai-server/data/results/* 2>/dev/null
fi

echo "== AI 서버 시작 (8000) =="
cd "$ROOT/ai-server"
nohup .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  > /tmp/demo_server.log 2>&1 &
until curl -s "http://127.0.0.1:8000/api/health" >/dev/null; do sleep 1; done
echo "   $(curl -s http://127.0.0.1:8000/api/health)"

if [[ "$MODE" == "--reseed" ]]; then
  echo "== 데모 데이터 구성 (부위 포함 9건) =="
  D="$ROOT/demo_samples"
  up() { curl -s -X POST http://127.0.0.1:8000/api/inspections \
           -F "image=@$1;type=image/jpeg" -F "facility_id=$2" -F "part=$3" >/dev/null; }
  # 행복상가: 기둥(주요부재) 손상 → 건물 D, 정밀진단 대상 (시연 주인공)
  up "$D/불량/불량_1_conf93.jpg" 1 "기둥"
  up "$D/불량/불량_2_conf89.jpg" 1 "외벽"
  # 은빛경로당: 보통 등급
  up "$D/보통/보통_1_conf91.jpg" 2 "외벽"
  up "$D/보통/보통_2_conf99.jpg" 2 "보"
  # 한울다세대: 양호
  up "$D/우수/우수_1_conf97.jpg" 3 "외벽"
  up "$D/우수/우수_3_conf99.jpg" 3 "기둥"
  # 옹벽
  up "$D/우수/우수_2_conf82.jpg" 4 "옹벽"
  up "$D/보통/보통_3_conf98.jpg" 4 "옹벽"
  # 지하차도: 슬래브 손상
  up "$D/불량/불량_3_conf90.jpg" 5 "슬래브"
  echo "   $(curl -s http://127.0.0.1:8000/api/stats | head -c 150)"
fi

echo "== 웹 시작 (5173) =="
cd "$ROOT/web"
nohup npm run dev -- --host > /tmp/demo_web.log 2>&1 &
until curl -s "http://localhost:5173" >/dev/null 2>&1; do sleep 1; done

# ---- 접속 주소 결정 ----
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)"
PUBLIC_URL=""

if [[ "$MODE" != "--local" ]] && command -v cloudflared >/dev/null 2>&1; then
  echo "== 공개 터널 연결 =="
  rm -f /tmp/tunnel.log
  nohup cloudflared tunnel --url http://localhost:5173 > /tmp/tunnel.log 2>&1 &
  for _ in $(seq 1 30); do
    PUBLIC_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/tunnel.log | head -1)"
    [[ -n "$PUBLIC_URL" ]] && break
    sleep 1
  done
fi

URL="${PUBLIC_URL:-http://$LAN_IP:5173}"

echo ""
echo "────────────────────────────────────────────────"
echo "  접속 주소"
echo ""
echo "    $URL"
echo ""
if [[ -n "$PUBLIC_URL" ]]; then
  echo "  인터넷을 통해 접속합니다. 폰과 맥이 다른 네트워크여도 됩니다."
  [[ -n "$LAN_IP" ]] && echo "  (같은 네트워크라면 http://$LAN_IP:5173 도 사용 가능)"
else
  echo "  같은 네트워크(Wi-Fi)에 연결된 기기에서만 접속됩니다."
fi
echo ""
echo "  Safari에서 열고 공유 → '홈 화면에 추가' 하면 앱처럼 실행됩니다."
echo "────────────────────────────────────────────────"
echo ""

# ---- QR 출력 (터미널 + PNG 파일) ----
if command -v qrencode >/dev/null 2>&1; then
  echo "  아래 QR을 폰 카메라로 스캔하세요"
  echo ""
  qrencode -t ANSIUTF8 -m 2 "$URL"
  qrencode -o "$ROOT/demo_qr.png" -s 10 -m 2 "$URL" 2>/dev/null \
    && echo "  QR 이미지: $ROOT/demo_qr.png"
else
  echo "  QR을 보려면: brew install qrencode  (설치 후 다시 실행)"
fi

echo ""
echo "  종료하려면: bash demo.sh --stop"
