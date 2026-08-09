"""재점검 주기 관리.

안전등급에 따라 다음 점검 시기를 정한다. risk_engine 의 긴급도(urgency) 문구와
동일한 기준을 날짜로 환산한 것이다.
  E 불량 → 즉시(2주)  /  D 미흡 → 1개월  /  C 보통 → 6개월  /  A·B → 12개월
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

INTERVAL_DAYS = {"E": 14, "D": 30, "C": 180, "B": 365, "A": 365}
DEFAULT_DAYS = 180
SOON_DAYS = 14  # 기한이 이 안으로 들어오면 '임박'


def _parse(dt: Optional[str]) -> Optional[datetime]:
    if not dt:
        return None
    try:
        return datetime.fromisoformat(dt)
    except ValueError:
        return None


def next_due(last_at: Optional[str], grade: Optional[str]) -> Dict[str, Any]:
    """마지막 점검일·등급 → 다음 점검 기한과 상태.

    status: overdue(기한 초과) | soon(임박) | ok | unknown(점검 이력 없음)
    """
    base = _parse(last_at)
    if base is None or not grade:
        return {"due_date": None, "days_left": None, "status": "unknown", "interval_days": None}

    days = INTERVAL_DAYS.get(grade, DEFAULT_DAYS)
    due = base + timedelta(days=days)
    left = (due.date() - datetime.now().date()).days
    status = "overdue" if left < 0 else ("soon" if left <= SOON_DAYS else "ok")
    return {
        "due_date": due.date().isoformat(),
        "days_left": left,
        "status": status,
        "interval_days": days,
    }
