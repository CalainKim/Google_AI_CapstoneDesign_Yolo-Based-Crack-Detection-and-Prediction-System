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
                is_mock INTEGER DEFAULT 0
            );
            """
        )
    _seed_facilities()


def _seed_facilities():
    with _conn() as c:
        n = c.execute("SELECT COUNT(*) FROM facility").fetchone()[0]
        if n:
            return
        samples = [
            ("한강대교", "도로교량", 37.5176, 126.9576),
            ("남산1호터널", "도로터널", 37.5536, 126.9882),
            ("성수대교", "도로교량", 37.5446, 127.0378),
            ("월드컵대교", "도로교량", 37.5610, 126.8870),
            ("북악터널", "도로터널", 37.6028, 126.9760),
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


def create_inspection(
    facility_id: Optional[int],
    image_path: str,
    result_image_path: str,
    detections: List[Dict[str, Any]],
    risk: Dict[str, Any],
    is_mock: bool,
) -> int:
    with _conn() as c:
        cur = c.execute(
            """INSERT INTO inspection
               (facility_id,image_path,result_image_path,created_at,
                risk_grade,risk_score,defect_count,detections_json,risk_json,is_mock)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
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
            ),
        )
        return cur.lastrowid


def _row_to_inspection(r: sqlite3.Row) -> Dict[str, Any]:
    d = dict(r)
    d["detections"] = json.loads(d.pop("detections_json") or "[]")
    d["risk"] = json.loads(d.pop("risk_json") or "{}")
    return d


def list_inspections(grade: Optional[str] = None) -> List[Dict[str, Any]]:
    with _conn() as c:
        q = (
            "SELECT i.*, f.name AS facility_name, f.type AS facility_type, "
            "f.lat AS lat, f.lng AS lng "
            "FROM inspection i LEFT JOIN facility f ON i.facility_id=f.id "
        )
        params: tuple = ()
        if grade:
            q += "WHERE i.risk_grade=? "
            params = (grade,)
        q += "ORDER BY i.id DESC"
        rows = c.execute(q, params).fetchall()
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
        return {
            "total_inspections": total,
            "grade_distribution": grade_dist,
            "defect_distribution": defect_dist,
        }
