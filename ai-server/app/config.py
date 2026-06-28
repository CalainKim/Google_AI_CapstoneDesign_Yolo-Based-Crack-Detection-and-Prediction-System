"""서버 설정. 경로/모델 위치를 한 곳에서 관리."""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # ai-server/

DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"        # 원본 업로드 이미지
RESULT_DIR = DATA_DIR / "results"        # 탐지 박스를 그린 결과 이미지
DB_PATH = DATA_DIR / "app.db"            # SQLite DB 파일

# 학습한 YOLO 모델 가중치 위치. 이 파일이 있으면 진짜 추론, 없으면 mock 모드.
MODEL_PATH = BASE_DIR / "models" / "best.pt"

# 탐지 신뢰도 임계값
CONF_THRESHOLD = 0.25

for d in (DATA_DIR, UPLOAD_DIR, RESULT_DIR, MODEL_PATH.parent):
    d.mkdir(parents=True, exist_ok=True)
