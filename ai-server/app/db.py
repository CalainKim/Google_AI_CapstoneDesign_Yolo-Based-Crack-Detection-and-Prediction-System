"""SQLite 데이터 계층 (표준 라이브러리만 사용 → 추가 설치 불필요)."""
import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

from . import config


def _conn():
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _conn() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS facility (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT,
                lat REAL,
                lng REAL
            );
            CREATE TABLE IF NOT EXISTS inspection (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                facility_id INTEGER,
                image_path TEXT,
                result_image_path TEXT,
                created_at TEXT,
                risk_grade TEXT,
                risk_score REAL,
                defect_count INTEGER,
                detections_json TEXT,
                risk_json TEXT,
                is_mock INTEGER DEFAULT 0,
                status TEXT DEFAULT '접수',
                part TEXT DEFAULT '미지정'
            );
            """
        )
        # 기존 DB 마이그레이션: 없는 컬럼만 추가
        for ddl in (
            "ALTER TABLE inspection ADD COLUMN status TEXT DEFAULT '접수'",
            "ALTER TABLE inspection ADD COLUMN part TEXT DEFAULT '미지정'",
        ):
            try:
                c.execute(ddl)
            except sqlite3.OperationalError:
                pass  # 이미 있음
    _seed_facilities()


def _seed_facilities():
    with _conn() as c:
        n = c.execute("SELECT COUNT(*) FROM facility").fetchone()[0]
        if n:
            return
        # 예산 부족한 관리 주체가 담당하는 소규모 노후 건축물·SOC (데모용 샘플).
        # 서울시 노후주택 데이터셋(건축물) + SOC 데이터셋 대상과 정합 → 상가/주택 데모 가능.
        samples = [
            ("행복상가 (노후 상가건물)", "상가건물", 37.5665, 126.9780),
            ("은빛경로당 (취약 복지시설)", "복지시설", 37.5648, 126.9895),
            ("한울다세대주택", "다세대주택", 37.5602, 126.9760),
            ("행복로 노후 옹벽", "옹벽", 37.5700, 126.9820),
            ("중앙지하차도", "지하차도", 37.5510, 126.9880),
        ]
        c.executemany(
            "INSERT INTO facility(name,type,lat,lng) VALUES (?,?,?,?)", samples
        )


def list_facilities() -> List[Dict[str, Any]]:
    with _conn() as c:
        rows = c.execute("SELECT * FROM facility ORDER BY id").fetchall()
        facilities = []
        for r in rows:
            latest = c.execute(
                "SELECT risk_grade, risk_score, created_at FROM inspection "
                "WHERE facility_id=? ORDER BY id DESC LIMIT 1",
                (r["id"],),
            ).fetchone()
            f = dict(r)
            f["latest_grade"] = latest["risk_grade"] if latest else None
            f["latest_score"] = latest["risk_score"] if latest else None
            f["latest_at"] = latest["created_at"] if latest else None
            facilities.append(f)
        return facilities


def create_facility(name: str, type_: str, lat: Optional[float], lng: Optional[float]) -> Dict[str, Any]:
    """시설물 등록. 좌표 미지정 시 서울 도심 근처로 배치(데모 지도용)."""
    import random
    if lat is None or lng is None:
        lat = 37.5665 + random.uniform(-0.01, 0.01)
        lng = 126.9780 + random.uniform(-0.012, 0.012)
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO facility(name,type,lat,lng) VALUES (?,?,?,?)",
            (name, type_, lat, lng),
        )
        return {"id": cur.lastrowid, "name": name, "type": type_, "lat": lat, "lng": lng}


# 조치 상태 워크플로우 (현업 점검 업무 흐름)
STATUSES = ["접수", "진단 의뢰", "조치 완료"]


def update_inspection_status(inspection_id: int, status: str) -> bool:
    if status not in STATUSES:
        return False
    with _conn() as c:
        cur = c.execute(
            "UPDATE inspection SET status=? WHERE id=?", (status, inspection_id)
        )
        return cur.rowcount > 0


def create_inspection(
    facility_id: Optional[int],
    image_path: str,
    result_image_path: str,
    detections: List[Dict[str, Any]],
    risk: Dict[str, Any],
    is_mock: bool,
    part: str = "미지정",
) -> int:
    with _conn() as c:
        cur = c.execute(
            """INSERT INTO inspection
               (facility_id,image_path,result_image_path,created_at,
                risk_grade,risk_score,defect_count,detections_json,risk_json,is_mock,part)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                facility_id,
                image_path,
                result_image_path,
                datetime.now().isoformat(timespec="seconds"),
                risk["risk_grade"],
                risk["risk_score"],
                len(detections),
                json.dumps(detections, ensure_ascii=False),
                json.dumps(risk, ensure_ascii=False),
                1 if is_mock else 0,
                part,
            ),
        )
        return cur.lastrowid


def _row_to_inspection(r: sqlite3.Row) -> Dict[str, Any]:
    d = dict(r)
    d["detections"] = json.loads(d.pop("detections_json") or "[]")
    d["risk"] = json.loads(d.pop("risk_json") or "{}")
    return d


def list_inspections(
    grade: Optional[str] = None, facility_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    with _conn() as c:
        q = (
            "SELECT i.*, f.name AS facility_name, f.type AS facility_type, "
            "f.lat AS lat, f.lng AS lng "
            "FROM inspection i LEFT JOIN facility f ON i.facility_id=f.id "
        )
        conds, params = [], []
        if grade:
            conds.append("i.risk_grade=?")
            params.append(grade)
        if facility_id is not None:
            conds.append("i.facility_id=?")
            params.append(facility_id)
        if conds:
            q += "WHERE " + " AND ".join(conds) + " "
        q += "ORDER BY i.id DESC"
        rows = c.execute(q, tuple(params)).fetchall()
        return [_row_to_inspection(r) for r in rows]


def get_inspection(inspection_id: int) -> Optional[Dict[str, Any]]:
    with _conn() as c:
        r = c.execute(
            "SELECT i.*, f.name AS facility_name, f.type AS facility_type, "
            "f.lat AS lat, f.lng AS lng "
            "FROM inspection i LEFT JOIN facility f ON i.facility_id=f.id "
            "WHERE i.id=?",
            (inspection_id,),
        ).fetchone()
        return _row_to_inspection(r) if r else None


def stats() -> Dict[str, Any]:
    with _conn() as c:
        grade_rows = c.execute(
            "SELECT risk_grade, COUNT(*) AS n FROM inspection GROUP BY risk_grade"
        ).fetchall()
        grade_dist = {r["risk_grade"]: r["n"] for r in grade_rows if r["risk_grade"]}

        rows = c.execute("SELECT detections_json FROM inspection").fetchall()
        defect_dist: Dict[str, int] = {}
        for r in rows:
            for d in json.loads(r["detections_json"] or "[]"):
                defect_dist[d["label"]] = defect_dist.get(d["label"], 0) + 1

        total = c.execute("SELECT COUNT(*) FROM inspection").fetchone()[0]

        # 트리아지(선별) 집계: D·E 등급만 전문 정밀안전진단으로 에스컬레이션.
        # 나머지는 저비용 자가점검으로 관리 → 진단 예산 선별 절감.
        needs_pro = (grade_dist.get("D", 0) or 0) + (grade_dist.get("E", 0) or 0)
        screened_out = total - needs_pro
        saving_rate = round(screened_out / total * 100, 1) if total else 0.0

        return {
            "total_inspections": total,
            "grade_distribution": grade_dist,
            "defect_distribution": defect_dist,
            "triage": {
                "needs_pro_inspection": needs_pro,   # 정밀진단 필요(D·E) 건수
                "screened_out": screened_out,        # 자가점검으로 선별된(진단 불필요) 건수
                "saving_rate": saving_rate,          # 진단 대상 선별 절감률(%)
            },
        }
