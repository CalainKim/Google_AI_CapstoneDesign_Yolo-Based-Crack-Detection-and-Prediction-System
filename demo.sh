#!/usr/bin/env bash
# 아이폰 데모용 원커맨드 실행: 서버(0.0.0.0) + 웹(--host, API를 Mac IP로)
# 사용: bash demo.sh          (현재 네트워크 IP 자동 감지)
#       bash demo.sh --reseed (DB 초기화 + 데모 스토리 재시드까지)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)"
[[ -n "$IP" ]] || { echo "네트워크 IP를 못 찾음 — Wi-Fi/핫스팟 연결 확인"; exit 1; }

echo "== 기존 프로세스 정리 =="
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

if [[ "${1:-}" == "--reseed" ]]; then
  echo "== DB 초기화 =="
  rm -f "$ROOT/ai-server/data/app.db" "$ROOT"/ai-server/data/uploads/* "$ROOT"/ai-server/data/results/* 2>/dev/null || true
fi

echo "== AI 서버 시작 (0.0.0.0:8000) =="
cd "$ROOT/ai-server"
nohup .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  > /tmp/demo_server.log 2>&1 &
until curl -s "http://127.0.0.1:8000/api/health" >/dev/null; do sleep 1; done
echo "   health: $(curl -s http://127.0.0.1:8000/api/health)"

if [[ "${1:-}" == "--reseed" ]]; then
  echo "== 데모 스토리 시드 (부위 포함 9건) =="
  D="$ROOT/demo_samples"
  # up <사진> <시설id> <부위>
  up() { curl -s -X POST http://127.0.0.1:8000/api/inspections \
           -F "image=@$1;type=image/jpeg" -F "facility_id=$2" -F "part=$3" >/dev/null; }
  # 행복상가: 기둥(주요부재) 손상 → 건물 D, 정밀진단 대상 (시연 주인공)
  up "$D/불량/불량_1_conf93.jpg" 1 "기둥"
  up "$D/불량/불량_2_conf89.jpg" 1 "외벽"
  # 은빛경로당: 보통 등급 (외벽·보)
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
  echo "   stats: $(curl -s http://127.0.0.1:8000/api/stats | head -c 160)"
fi

echo "== 웹 시작 (API → http://$IP:8000) =="
cd "$ROOT/web"
VITE_API_BASE="http://$IP:8000" nohup npm run dev -- --host > /tmp/demo_web.log 2>&1 &
until curl -s "http://localhost:5173" >/dev/null 2>&1; do sleep 1; done

echo ""
echo "================================================"
echo "  아이폰 Safari에서 접속:  http://$IP:5173"
echo "  (같은 Wi-Fi/핫스팟이어야 함)"
echo "  공유 버튼 → '홈 화면에 추가' 하면 앱처럼 실행"
echo "================================================"
