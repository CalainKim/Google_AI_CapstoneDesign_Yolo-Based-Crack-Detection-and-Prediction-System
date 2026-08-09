"""AI 추론 서버 (FastAPI).

실행:  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
문서:  http://localhost:8000/docs
"""
import shutil
import uuid
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from . import config, db, detector, risk_engine, grade_classifier, building

app = FastAPI(title="AI 균열 탐지 및 시설물 안전점검 선별 시스템", version="0.1.0")

# 개발 단계에서는 모든 출처 허용 (배포 시 도메인 제한 권장)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    db.init_db()


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "mock_mode": detector.is_mock(),
        "grade_classifier": grade_classifier.available(),
    }


@app.get("/api/facilities")
def facilities():
    return db.list_facilities()


class FacilityIn(BaseModel):
    name: str
    type: str = "건축물"
    lat: Optional[float] = None
    lng: Optional[float] = None


@app.post("/api/facilities")
def create_facility(body: FacilityIn):
    """시설물 등록 (관리 대상 건물 추가)."""
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "시설물 이름을 입력하세요.")
    return db.create_facility(name, body.type.strip() or "건축물", body.lat, body.lng)


class StatusIn(BaseModel):
    status: str


@app.patch("/api/inspections/{inspection_id}/status")
def update_status(inspection_id: int, body: StatusIn):
    """조치 상태 변경 (접수 → 진단 의뢰 → 조치 완료)."""
    if body.status not in db.STATUSES:
        raise HTTPException(400, f"허용 상태: {db.STATUSES}")
    if not db.update_inspection_status(inspection_id, body.status):
        raise HTTPException(404, "점검 기록을 찾을 수 없습니다.")
    return {"id": inspection_id, "status": body.status}


@app.post("/api/inspections")
async def create_inspection(
    image: UploadFile = File(...),
    facility_id: Optional[int] = Form(None),
    part: str = Form("미지정"),
    note: Optional[str] = Form(None),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
):
    """이미지 업로드 → 균열 탐지 → 위험도 산정 → 저장 → 결과 반환."""
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "이미지 파일만 업로드 가능합니다.")

    uid = uuid.uuid4().hex[:12]
    ext = (image.filename or "img.jpg").split(".")[-1].lower()
    upload_path = config.UPLOAD_DIR / f"{uid}.{ext}"
    with open(upload_path, "wb") as f:
        shutil.copyfileobj(image.file, f)

    det = detector.detect(str(upload_path))
    risk = risk_engine.assess(det["detections"], det["width"], det["height"])

    # 등급 판정: 분류 모델이 있으면 그 결과로 등급을 덮어씀(휴리스틱보다 정확).
    cls = grade_classifier.classify(str(upload_path))
    if cls:
        risk = risk_engine.apply_grade(risk, cls)

    result_path = config.RESULT_DIR / f"{uid}_result.{ext}"
    detector.draw_result(str(upload_path), det["detections"], str(result_path))

    part_name = part if part in building.PARTS else "미지정"
    inspection_id = db.create_inspection(
        facility_id=facility_id,
        image_path=str(upload_path),
        result_image_path=str(result_path),
        detections=det["detections"],
        risk=risk,
        is_mock=det["mock"],
        part=part_name,
        note=(note or None),
        shot_lat=lat,
        shot_lng=lng,
    )

    return {
        "id": inspection_id,
        "part": part_name,
        "note": note,
        "mock_mode": det["mock"],
        "image_size": {"width": det["width"], "height": det["height"]},
        "detections": det["detections"],
        "risk": risk,
        "result_image_url": f"/api/inspections/{inspection_id}/image",
    }


@app.get("/api/inspections")
def inspections(grade: Optional[str] = None, facility_id: Optional[int] = None):
    return db.list_inspections(grade=grade, facility_id=facility_id)


class FeedbackIn(BaseModel):
    feedback: str                      # agree | disagree
    actual_grade: Optional[str] = None # disagree 시 사용자가 판단한 등급


@app.patch("/api/inspections/{inspection_id}/feedback")
def update_feedback(inspection_id: int, body: FeedbackIn):
    """판정 피드백 저장. 축적된 기록은 모델 재학습 데이터로 활용한다."""
    if not db.update_inspection_feedback(inspection_id, body.feedback, body.actual_grade):
        raise HTTPException(400, "피드백을 저장하지 못했습니다.")
    return {"id": inspection_id, "feedback": body.feedback, "actual_grade": body.actual_grade}


class NoteIn(BaseModel):
    note: str


@app.patch("/api/inspections/{inspection_id}/note")
def update_note(inspection_id: int, body: NoteIn):
    """점검 메모 (AI가 볼 수 없는 현장 맥락 보완)."""
    if not db.update_inspection_note(inspection_id, body.note):
        raise HTTPException(404, "점검 기록을 찾을 수 없습니다.")
    return {"id": inspection_id, "note": body.note}


@app.patch("/api/facilities/{facility_id}")
def edit_facility(facility_id: int, body: FacilityIn):
    if not body.name.strip():
        raise HTTPException(400, "시설물 이름을 입력하세요.")
    if not db.update_facility(facility_id, body.name.strip(), body.type.strip() or "건축물"):
        raise HTTPException(404, "시설물을 찾을 수 없습니다.")
    return {"id": facility_id, "name": body.name, "type": body.type}


@app.delete("/api/facilities/{facility_id}")
def remove_facility(facility_id: int):
    if not db.delete_facility(facility_id):
        raise HTTPException(404, "시설물을 찾을 수 없습니다.")
    return {"deleted": facility_id}


@app.get("/api/parts")
def parts():
    """점검 부위 목록 (구조적 중요도 포함)."""
    return [
        {"name": n, "structural": v["structural"], "note": v["note"]}
        for n, v in building.PARTS.items()
        if n != "미지정"
    ]


@app.get("/api/facilities/{facility_id}/assessment")
def facility_assessment(facility_id: int):
    """부위별 점검 결과를 종합한 건물 단위 판정."""
    items = db.list_inspections(facility_id=facility_id)
    return building.assess_building(items)


@app.get("/api/inspections/{inspection_id}")
def inspection_detail(inspection_id: int):
    row = db.get_inspection(inspection_id)
    if not row:
        raise HTTPException(404, "점검 기록을 찾을 수 없습니다.")
    return row


@app.get("/api/inspections/{inspection_id}/image")
def inspection_image(inspection_id: int):
    row = db.get_inspection(inspection_id)
    if not row or not row.get("result_image_path"):
        raise HTTPException(404, "결과 이미지를 찾을 수 없습니다.")
    return FileResponse(row["result_image_path"])


@app.get("/api/stats")
def stats():
    return db.stats()
