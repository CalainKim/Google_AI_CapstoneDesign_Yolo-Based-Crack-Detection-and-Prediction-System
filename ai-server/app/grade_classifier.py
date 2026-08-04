"""안전등급 분류기 (우수/보통/불량).

탐지+휴리스틱(risk_engine)으로는 등급 판정이 안 돼서(정확도 22%),
등급 라벨을 직접 학습한 YOLO-cls 모델로 판정한다(정확도 75%, 위험누락 12%).

- models/grade_cls.pt 가 있으면 → 분류기가 등급 판정
- 없으면 → None 반환 → 호출부가 기존 risk_engine 휴리스틱으로 폴백
"""
from typing import Optional, Dict, Any

from . import config

_MODEL = None
_TRIED = False

# 학습 클래스(영문 폴더) → 우리 등급 그룹
GROUP_KO = {"good": "우수", "fair": "보통", "poor": "불량"}


def _load():
    global _MODEL, _TRIED
    if _TRIED:
        return _MODEL
    _TRIED = True
    try:
        if not config.GRADE_MODEL_PATH.exists():
            print(f"[grade] 분류 모델 없음 → 등급은 휴리스틱 사용: {config.GRADE_MODEL_PATH}")
            return None
        from ultralytics import YOLO
        _MODEL = YOLO(str(config.GRADE_MODEL_PATH))
        print(f"[grade] 분류 모델 로드 성공: {config.GRADE_MODEL_PATH}")
    except Exception as e:
        print(f"[grade] 분류 모델 로드 실패 → 휴리스틱 사용: {e}")
        _MODEL = None
    return _MODEL


def available() -> bool:
    return _load() is not None


def classify(image_path: str) -> Optional[Dict[str, Any]]:
    """이미지 → {group, confidence, probs} 또는 None(모델 없음)."""
    model = _load()
    if model is None:
        return None
    r = model.predict(image_path, imgsz=config.GRADE_IMGSZ, verbose=False)[0]
    probs = r.probs
    names = model.names
    dist = {GROUP_KO[names[i]]: round(float(probs.data[i]), 4) for i in range(len(names))}
    group = GROUP_KO[names[int(probs.top1)]]
    return {"group": group, "confidence": round(float(probs.top1conf), 4), "probs": dist}
