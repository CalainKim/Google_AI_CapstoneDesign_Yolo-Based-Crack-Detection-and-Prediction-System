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

from . import config, db, detector, risk_engine

app = FastAPI(title="AI 균열 탐지 및 붕괴 위험 예측 시스템", version="0.1.0")

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
    return {"status": "ok", "mock_mode": detector.is_mock()}


@app.get("/api/facilities")
def facilities():
    return db.list_facilities()


@app.post("/api/inspections")
async def create_inspection(
    image: UploadFile = File(...),
    facility_id: Optional[int] = Form(None),
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

    result_path = config.RESULT_DIR / f"{uid}_result.{ext}"
    detector.draw_result(str(upload_path), det["detections"], str(result_path))

    inspection_id = db.create_inspection(
        facility_id=facility_id,
        image_path=str(upload_path),
        result_image_path=str(result_path),
        detections=det["detections"],
        risk=risk,
        is_mock=det["mock"],
    )

    return {
        "id": inspection_id,
        "mock_mode": det["mock"],
        "image_size": {"width": det["width"], "height": det["height"]},
        "detections": det["detections"],
        "risk": risk,
        "result_image_url": f"/api/inspections/{inspection_id}/image",
    }


@app.get("/api/inspections")
def inspections(grade: Optional[str] = None):
    return db.list_inspections(grade=grade)


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
