"""건물 단위 종합 판정.

자문 반영: "사진 한 장·균열 하나로 건물 등급은 알 수 없다. 건물 전체에서 균열이
어느 부재에 어떤 분포로 있는지를 봐야 한다. 보에 생긴 균열보다 기둥에 생긴 균열이
훨씬 위험하다(기둥은 건물 붕괴, 보는 해당 층)."

→ 부위(부재)별 점검 결과를 모아, 부재 중요도를 반영해 건물 단위 등급을 산정한다.
"""
from typing import List, Dict, Any

# 점검 부위. is_structural = 주요부재 여부, weight = 구조적 중요도
PARTS: Dict[str, Dict[str, Any]] = {
    "기둥": {"structural": True, "weight": 1.00, "note": "붕괴 직결 부재"},
    "내력벽": {"structural": True, "weight": 0.90, "note": "수직 하중 지지"},
    "보": {"structural": True, "weight": 0.80, "note": "해당 층 손상 범위"},
    "슬래브": {"structural": True, "weight": 0.75, "note": "바닥 구조"},
    "접합부": {"structural": True, "weight": 0.95, "note": "지진 시 취약"},
    "외벽": {"structural": False, "weight": 0.50, "note": "비구조 마감"},
    "옹벽": {"structural": False, "weight": 0.60, "note": "부속 구조물"},
    "미지정": {"structural": False, "weight": 0.55, "note": "부재 미기입"},
}
PART_NAMES = list(PARTS.keys())

GRADE_RANK = {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5}
RANK_GRADE = {v: k for k, v in GRADE_RANK.items()}
GRADE_LABEL = {"A": "우수", "B": "양호", "C": "보통", "D": "미흡", "E": "불량"}


def _part_of(insp: Dict[str, Any]) -> str:
    p = insp.get("part") or "미지정"
    return p if p in PARTS else "미지정"


def assess_building(inspections: List[Dict[str, Any]]) -> Dict[str, Any]:
    """시설물의 점검 기록들 → 건물 단위 종합 판정.

    규칙
      1) 부위별로 가장 나쁜 등급을 대표값으로 삼는다(같은 부위 반복 점검 시 최악 기준).
      2) 주요부재(기둥·보·내력벽·슬래브·접합부)에 D 이상이 있으면 건물 등급도 그대로 반영.
      3) 비구조 부위(외벽 등)만 D 이상이면 한 단계 완화한다(마감 손상은 구조 안전과 구분).
      4) 주요부재가 여러 곳에서 동시에 C 이상이면 분포 손상으로 보아 한 단계 상향한다.
    """
    if not inspections:
        return {"grade": None, "covered_parts": [], "reasons": [], "part_summary": []}

    # 1) 부위별 최악 등급
    worst: Dict[str, Dict[str, Any]] = {}
    for i in inspections:
        g = i.get("risk_grade")
        if not g:
            continue
        p = _part_of(i)
        if p not in worst or GRADE_RANK[g] > GRADE_RANK[worst[p]["grade"]]:
            worst[p] = {"grade": g, "inspection_id": i.get("id"), "at": i.get("created_at")}

    if not worst:
        return {"grade": None, "covered_parts": [], "reasons": [], "part_summary": []}

    reasons: List[str] = []
    structural = {p: v for p, v in worst.items() if PARTS[p]["structural"]}
    nonstructural = {p: v for p, v in worst.items() if not PARTS[p]["structural"]}

    # 2) 주요부재 기준 등급
    if structural:
        top_part, top = max(structural.items(), key=lambda kv: GRADE_RANK[kv[1]["grade"]])
        rank = GRADE_RANK[top["grade"]]
        reasons.append(
            f"주요부재인 {top_part}에서 {top['grade']}등급({GRADE_LABEL[top['grade']]})이 확인되었습니다."
        )
    else:
        top_part, top = max(nonstructural.items(), key=lambda kv: GRADE_RANK[kv[1]["grade"]])
        rank = GRADE_RANK[top["grade"]]
        # 3) 비구조 부위만 있으면 완화
        if rank >= 4:
            rank -= 1
            reasons.append(
                f"{top_part}은(는) 비구조 부위로, 구조 안전과 직결되지 않아 한 단계 완화했습니다."
            )
        reasons.append(f"점검된 부위가 비구조 부위({', '.join(nonstructural)})에 한정됩니다.")

    # 4) 주요부재 다중 손상 → 분포 손상 가중
    multi = [p for p, v in structural.items() if GRADE_RANK[v["grade"]] >= 3]
    if len(multi) >= 2 and rank < 5:
        rank += 1
        reasons.append(
            f"주요부재 {len(multi)}곳({', '.join(multi)})에서 동시에 손상이 확인되어 분포 손상으로 판단했습니다."
        )

    grade = RANK_GRADE[min(rank, 5)]

    # 미점검 주요부재 안내 (판정 신뢰도)
    missing = [p for p, v in PARTS.items() if v["structural"] and p not in worst]
    if missing:
        reasons.append(
            f"미점검 부재({', '.join(missing)})가 있어 종합 판정의 신뢰도가 제한됩니다."
        )

    part_summary = [
        {
            "part": p,
            "grade": v["grade"],
            "structural": PARTS[p]["structural"],
            "note": PARTS[p]["note"],
            "inspection_id": v["inspection_id"],
        }
        for p, v in sorted(worst.items(), key=lambda kv: -GRADE_RANK[kv[1]["grade"]])
    ]

    return {
        "grade": grade,
        "grade_label": GRADE_LABEL[grade],
        "needs_pro_inspection": grade in ("D", "E"),
        "covered_parts": list(worst.keys()),
        "structural_covered": list(structural.keys()),
        "missing_structural": missing,
        "coverage": round(len(worst) / len([p for p in PARTS if p != "미지정"]), 2),
        "reasons": reasons,
        "part_summary": part_summary,
    }
