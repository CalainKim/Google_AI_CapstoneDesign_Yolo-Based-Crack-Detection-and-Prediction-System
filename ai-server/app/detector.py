"""균열 탐지기.

- models/best.pt 가 있고 ultralytics가 설치돼 있으면 → 진짜 YOLO 추론
- 없으면 → mock 모드 (이미지 기반으로 그럴듯한 가짜 탐지 생성)

mock 모드 덕분에 모델 학습 전에도 전체 시스템(웹/모바일/대시보드)을 데모할 수 있다.
"""
import hashlib
import random
from pathlib import Path
from typing import List, Dict, Any

from PIL import Image, ImageDraw, ImageFont

from . import config

# 등급별 박스 색상
LABEL_COLORS = {
    "균열": (255, 80, 80), "crack": (255, 80, 80),
    "철근노출": (220, 0, 0), "rebar": (220, 0, 0),
    "박락": (255, 140, 0), "spalling": (255, 140, 0),
    "누수": (0, 140, 255), "leak": (0, 140, 255),
    "백태": (180, 180, 0), "efflorescence": (180, 180, 0),
}
DEFAULT_COLOR = (255, 0, 128)

_MODEL = None
_MODEL_TRIED = False


def _try_load_model():
    """ultralytics + best.pt 로드 시도. 실패하면 None (mock 모드)."""
    global _MODEL, _MODEL_TRIED
    if _MODEL_TRIED:
        return _MODEL
    _MODEL_TRIED = True
    try:
        if not config.MODEL_PATH.exists():
            print(f"[detector] 모델 파일 없음 → mock 모드: {config.MODEL_PATH}")
            return None
        from ultralytics import YOLO  # 지연 임포트
        _MODEL = YOLO(str(config.MODEL_PATH))
        print(f"[detector] 모델 로드 성공: {config.MODEL_PATH}")
    except Exception as e:  # ultralytics 미설치 등
        print(f"[detector] 모델 로드 실패 → mock 모드: {e}")
        _MODEL = None
    return _MODEL


def is_mock() -> bool:
    return _try_load_model() is None


def _mock_detect(image_path: str, w: int, h: int) -> List[Dict[str, Any]]:
    """파일 내용 해시로 시드를 고정 → 같은 사진은 항상 같은 결과(데모 일관성)."""
    seed = int(hashlib.md5(Path(image_path).read_bytes()).hexdigest(), 16) % (2**32)
    rng = random.Random(seed)
    labels = ["균열", "박락", "철근노출", "누수", "백태"]
    n = rng.randint(1, 4)
    dets = []
    for _ in range(n):
        bw = rng.randint(int(w * 0.05), int(w * 0.30))
        bh = rng.randint(int(h * 0.05), int(h * 0.30))
        x = rng.randint(0, max(w - bw, 1))
        y = rng.randint(0, max(h - bh, 1))
        dets.append({
            "label": rng.choice(labels),
            "confidence": round(rng.uniform(0.45, 0.95), 2),
            "bbox": [x, y, bw, bh],
            "width_px": round(rng.uniform(2, 30), 1),
        })
    return dets


def _real_detect(model, image_path: str) -> List[Dict[str, Any]]:
    results = model.predict(image_path, conf=config.CONF_THRESHOLD, verbose=False)
    dets = []
    for r in results:
        names = r.names
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cls_id = int(box.cls[0])
            dets.append({
                "label": names.get(cls_id, str(cls_id)),
                "confidence": round(float(box.conf[0]), 2),
                "bbox": [int(x1), int(y1), int(x2 - x1), int(y2 - y1)],
                "width_px": None,  # 폭 추정은 분할 모델 단계에서 추가
            })
    return dets


def detect(image_path: str) -> Dict[str, Any]:
    """이미지에서 결함 탐지 → 탐지 목록 + 이미지 크기 반환."""
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    model = _try_load_model()
    if model is None:
        dets = _mock_detect(image_path, w, h)
    else:
        dets = _real_detect(model, image_path)
    return {"detections": dets, "width": w, "height": h, "mock": model is None}


def draw_result(image_path: str, detections: List[Dict[str, Any]], out_path: str) -> str:
    """탐지 박스를 그린 결과 이미지를 저장."""
    img = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("malgun.ttf", max(14, img.width // 60))  # 윈도우 한글 폰트
    except Exception:
        font = ImageFont.load_default()

    for d in detections:
        x, y, bw, bh = d["bbox"]
        color = LABEL_COLORS.get(str(d["label"]).lower(), LABEL_COLORS.get(d["label"], DEFAULT_COLOR))
        draw.rectangle([x, y, x + bw, y + bh], outline=color, width=3)
        tag = f"{d['label']} {d['confidence']:.2f}"
        draw.rectangle([x, max(y - 20, 0), x + len(tag) * 10, y], fill=color)
        draw.text((x + 2, max(y - 19, 0)), tag, fill=(255, 255, 255), font=font)

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    return out_path
