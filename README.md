# AI 균열 탐지 및 붕괴 위험 예측 시스템 (캡스톤 디자인)

현장 작업자가 모바일로 시설물을 촬영하면 AI가 균열 위치·손상 정도를 탐지하고
붕괴 위험도를 예측하는 스마트 안전관리 시스템.

## 폴더 구조 (진행하면서 채워짐)
- `notebooks/` : Colab 학습/실험용 노트북
- `ai-server/` : (예정) AI 추론 API 서버 (FastAPI)
- `mobile/`    : (예정) 모바일 앱 (Flutter)
- `web/`       : (예정) 관리자 웹 대시보드 (React)
- `docs/`      : 설계 문서, 아키텍처

## 진행 단계
- [ ] 1. AI-Hub 데이터 일부로 Colab 학습  ← notebooks/02_AIHub_데이터_학습.ipynb 준비됨
- [ ] 2. best.pt를 ai-server/models/에 연결
- [x] 3. AI 추론 서버 + 위험도 엔진 (mock 모드로 동작 확인 완료)
- [x] 4. 웹 대시보드 + 현장 촬영 화면 (연동 확인 완료)
- [ ] 5. AI-Hub 전체 데이터로 모델 고도화 (data-tools/aihub_to_yolo.py 준비됨)

> 시스템 뼈대(서버·위험도·웹·모바일촬영)는 완성되어 작동 중. 남은 핵심은 Colab 학습 → best.pt 연결.

## 빠른 시작
`실행가이드.md` 참고. 요약:
- AI 서버: `ai-server` 에서 `uvicorn app.main:app --reload --port 8000`
- 웹: `web` 에서 `npm run dev` → http://localhost:5173

## 데이터셋
- AI-Hub: SOC 시설물 균열패턴 이미지 데이터 (dataSetSn=71769)
- 초기 프로토타입: 공개 소형 균열 데이터셋 (Roboflow Universe)
