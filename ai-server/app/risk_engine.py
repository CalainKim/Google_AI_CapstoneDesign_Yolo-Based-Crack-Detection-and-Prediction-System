"""붕괴 위험도 산정 엔진.

AI-Hub 데이터에는 '붕괴 위험 등급' 라벨이 없으므로,
탐지 결과(결함 종류 / 균열 폭 / 밀도 / 개수)를 입력으로 한
가중 스코어링 + 룰 기반으로 위험도를 산정한다.

추후 전문가 라벨이 확보되면 이 부분을 머신러닝 회귀로 교체할 수 있다.
"""
from typing import List, Dict, Any

# 결함 종류별 구조적 심각도 (0~1). 한글/영문/Roboflow 라벨 모두 매핑.
# 철근노출/박락/재료분리 = 구조 손상(높음), 백태/누수 = 표면 징후(낮음).
SEVERITY: Dict[str, float] = {
    # 영문 (AI-Hub annotation label)
    "crack": 0.55,
    "reticular crack": 0.65,
    "detachment": 0.70,
    "spalling": 0.85,
    "efflorescence": 0.30,
    "leak": 0.40,
    "rebar": 0.95,
    "material separation": 0.80,
    "exhilaration": 0.60,
    "damage": 0.90,
    # 한글
    "균열": 0.55,
    "망상균열": 0.65,
    "박리": 0.70,
    "박락": 0.85,
    "백태": 0.30,
    "누수": 0.40,
    "철근노출": 0.95,
    "재료분리": 0.80,
    "들뜸": 0.60,
    "파손": 0.90,
}

# 균열 폭(px) 기준 (이미지 해상도/촬영거리에 따라 보정 필요)
WIDTH_PX_FULL_RISK = 25.0   # 이 폭 이상이면 폭 위험도 만점

# 위험 점수(0~100) -> 등급
GRADE_BANDS = [
    (80, "E", "사용제한", "즉시 정밀안전진단 및 사용제한 검토"),
    (60, "D", "긴급보수", "긴급 보수 필요, 우선순위 최상위"),
    (40, "C", "보수필요", "보수 계획 수립 권장"),
    (20, "B", "주의관찰", "주기적 관찰 필요"),
    (0,  "A", "양호",     "정상 범위, 정기 점검 유지"),
]

# 종합 점수 가중치 (합 = 1.0)
W_SEVERITY = 0.45   # 가장 심각한 결함 종류
W_WIDTH    = 0.25   # 균열 폭
W_DENSITY  = 0.20   # 결함이 덮은 면적 비율
W_COUNT    = 0.10   # 결함 개수


def _label_severity(label: str) -> float:
    return SEVERITY.get(str(label).strip().lower(), SEVERITY.get(str(label).strip(), 0.5))


def assess(detections: List[Dict[str, Any]], image_w: int, image_h: int) -> Dict[str, Any]:
    """탐지 결과 리스트로 위험도를 산정.

    detections: [{label, confidence, bbox:[x,y,w,h], width_px(optional)}, ...]
    반환: {risk_score, risk_grade, grade_label, recommendation, factors, defect_summary}
    """
    if not detections:
        return {
            "risk_score": 0.0,
            "risk_grade": "A",
            "grade_label": "양호",
            "recommendation": "탐지된 결함 없음. 정기 점검 유지.",
            "factors": {"severity": 0, "width": 0, "density": 0, "count": 0},
            "defect_summary": {},
        }

    image_area = max(image_w * image_h, 1)

    # 1) 가장 심각한 결함 종류
    severity = max(_label_severity(d["label"]) for d in detections)

    # 2) 균열 폭 (가장 큰 폭 기준)
    widths = [float(d.get("width_px") or 0) for d in detections]
    max_width = max(widths) if widths else 0.0
    width_factor = min(max_width / WIDTH_PX_FULL_RISK, 1.0)

    # 3) 결함 밀도 (bbox 면적 합 / 이미지 면적)
    defect_area = sum(d["bbox"][2] * d["bbox"][3] for d in detections)
    density = min(defect_area / image_area, 1.0)

    # 4) 결함 개수 (10개 이상이면 만점)
    count_factor = min(len(detections) / 10.0, 1.0)

    score = 100.0 * (
        W_SEVERITY * severity
        + W_WIDTH * width_factor
        + W_DENSITY * density
        + W_COUNT * count_factor
    )
    score = round(score, 1)

    grade = grade_label = recommendation = None
    for threshold, g, gl, rec in GRADE_BANDS:
        if score >= threshold:
            grade, grade_label, recommendation = g, gl, rec
            break

    # 결함 종류별 개수 요약
    summary: Dict[str, int] = {}
    for d in detections:
        summary[d["label"]] = summary.get(d["label"], 0) + 1

    return {
        "risk_score": score,
        "risk_grade": grade,
        "grade_label": grade_label,
        "recommendation": recommendation,
        "factors": {
            "severity": round(severity, 2),
            "width": round(width_factor, 2),
            "density": round(density, 2),
            "count": round(count_factor, 2),
        },
        "defect_summary": summary,
    }
