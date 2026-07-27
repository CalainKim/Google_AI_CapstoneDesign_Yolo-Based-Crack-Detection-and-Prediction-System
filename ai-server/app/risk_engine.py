"""시설물 안전등급 산정 엔진 (1차 선별용).

이 엔진은 정밀안전진단을 대체하지 않는다. 탐지 결과(결함 종류 / 균열 폭 / 밀도 / 개수)를
입력으로 안전등급(A~E)을 매겨, "어느 시설부터 전문 정밀진단을 받아야 하는지"를
선별(triage)하는 것이 목적이다.

등급 체계는 국토부 「시설물 안전 및 유지관리 특별법」의 안전등급(A 우수 ~ E 불량)을 따른다.
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
    "steel damage": 0.85,   # 강재손상 (드론 데이터셋)
    "paint damage": 0.35,   # 도장손상 (표면 징후)
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
    "강재손상": 0.85,
    "도장손상": 0.35,
}
# ※ 실제 클래스 목록은 학습 데이터(YOLO data.yaml)에서 확정됨. 학습 후 이 맵을 그에 맞춰 정렬.

# 균열 폭(px) 기준 (이미지 해상도/촬영거리에 따라 보정 필요)
WIDTH_PX_FULL_RISK = 25.0   # 이 폭 이상이면 폭 위험도 만점

# 점수(0~100) -> 안전등급 (국토부 법정 안전등급 체계, 선별용 권장조치 포함)
# (임계점수, 등급, 등급명, 권장조치, 긴급도, 정밀진단필요)
# needs_pro_inspection = 저비용 자가점검에서 전문 정밀안전진단으로 에스컬레이션할지 여부(트리아지 핵심)
GRADE_BANDS = [
    (80, "E", "불량", "즉시 정밀안전진단 및 사용제한 검토", "즉시", True),
    (60, "D", "미흡", "정밀안전진단 우선 대상", "1개월 내", True),
    (40, "C", "보통", "보수 계획 수립 및 정밀점검 권장", "6개월 내", False),
    (20, "B", "양호", "주기적 자가점검 유지", "정기 점검", False),
    (0,  "A", "우수", "정상 범위, 정기 자가점검 유지", "정기 점검", False),
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
            "grade_label": "우수",
            "recommendation": "탐지된 결함 없음. 정기 자가점검 유지.",
            "needs_pro_inspection": False,
            "urgency": "정기 점검",
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

    grade = grade_label = recommendation = urgency = None
    needs_pro = False
    for threshold, g, gl, rec, urg, pro in GRADE_BANDS:
        if score >= threshold:
            grade, grade_label, recommendation, urgency, needs_pro = g, gl, rec, urg, pro
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
        "needs_pro_inspection": needs_pro,
        "urgency": urgency,
        "factors": {
            "severity": round(severity, 2),
            "width": round(width_factor, 2),
            "density": round(density, 2),
            "count": round(count_factor, 2),
        },
        "defect_summary": summary,
    }
