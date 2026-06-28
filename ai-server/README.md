# AI 추론 서버 (FastAPI)

이미지를 받아 균열을 탐지하고 붕괴 위험도를 산정하는 서버.
**models/best.pt 가 없으면 자동으로 mock 모드**로 동작하여, 모델 학습 전에도 전체 시스템을 테스트할 수 있다.

## 실행
```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```
API 문서: http://localhost:8000/docs

## 핵심 로직 점검 (서버 안 켜고)
```powershell
.\.venv\Scripts\python.exe selftest.py
```

## 구조
| 파일 | 역할 |
|------|------|
| `app/main.py` | FastAPI 엔드포인트 |
| `app/detector.py` | YOLO 탐지 (모델 없으면 mock) |
| `app/risk_engine.py` | 붕괴 위험도 산정 (등급 A~E) |
| `app/db.py` | SQLite 점검 이력 |
| `app/config.py` | 경로·설정 |

## 진짜 모델 연결
1. Colab에서 학습한 `best.pt` 를 `models/best.pt` 로 복사
2. `pip install ultralytics` (torch 포함)
3. 서버 재시작 → 진짜 추론 모드

## 위험도 산정식
`점수 = 0.45·결함심각도 + 0.25·균열폭 + 0.20·결함밀도 + 0.10·결함개수` (0~100)
- 80↑ E(사용제한) / 60↑ D(긴급보수) / 40↑ C(보수필요) / 20↑ B(주의관찰) / 그 외 A(양호)
