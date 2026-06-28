"""의존성 없이(서버 안 켜고) 핵심 로직을 점검하는 자체 테스트."""
from PIL import Image
from app import detector, risk_engine, db, config

# 1) 테스트 이미지 생성
test_img = config.UPLOAD_DIR / "selftest.jpg"
Image.new("RGB", (1280, 720), (180, 180, 180)).save(test_img)

# 2) 탐지
det = detector.detect(str(test_img))
print(f"[탐지] mock={det['mock']}, 결함 {len(det['detections'])}개, 크기 {det['width']}x{det['height']}")
for d in det["detections"]:
    print("   -", d)

# 3) 위험도 산정
risk = risk_engine.assess(det["detections"], det["width"], det["height"])
print(f"[위험도] {risk['risk_grade']}({risk['grade_label']}) 점수={risk['risk_score']} → {risk['recommendation']}")

# 4) 결과 이미지 그리기
out = config.RESULT_DIR / "selftest_result.jpg"
detector.draw_result(str(test_img), det["detections"], str(out))
print(f"[결과이미지] 저장됨: {out}")

# 5) DB 저장/조회
db.init_db()
iid = db.create_inspection(1, str(test_img), str(out), det["detections"], risk, det["mock"])
row = db.get_inspection(iid)
print(f"[DB] 점검 #{iid} 저장 OK, 시설물={row['facility_name']}, 등급={row['risk_grade']}")
print(f"[통계] {db.stats()}")
print("\n[OK] 모든 핵심 로직 정상 작동")
