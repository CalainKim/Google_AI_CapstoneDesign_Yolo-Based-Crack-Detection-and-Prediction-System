# AI 균열 탐지 및 시설물 안전점검 선별 시스템 (캡스톤 디자인)

스마트폰으로 노후 시설물을 촬영하면 AI가 균열·결함을 탐지해 안전등급(A~E)을 매기고,
어디부터 전문 정밀진단을 받아야 하는지 선별(triage)해주는 저비용 안전점검 도구.
정밀안전진단을 대체하지 않고, 그 앞단에서 진단 우선순위를 골라주는 것이 목적이다.
자세한 방향은 `docs/00_프로젝트_개요.md` 참고.

## 폴더 구조 (진행하면서 채워짐)
- `notebooks/` : Colab 학습/실험용 노트북
- `ai-server/` : (예정) AI 추론 API 서버 (FastAPI)
- `mobile/`    : (예정) 모바일 앱 (Flutter)
- `web/`       : (예정) 관리자 웹 대시보드 (React)
- `docs/`      : 설계 문서, 아키텍처

## 진행 단계
-  1. AI-Hub 데이터 일부로 Colab 학습  ← notebooks/02_AIHub_데이터_학습.ipynb 준비됨
-  2. best.pt를 ai-server/models/에 연결
-  3. AI 추론 서버 + 위험도 엔진 (mock 모드로 동작 확인 완료)
-  4. 웹 대시보드 + 현장 촬영 화면 (연동 확인 완료)
-  5. AI-Hub 전체 데이터로 모델 고도화 (data-tools/aihub_to_yolo.py 준비됨)

> 시스템 뼈대(서버·위험도·웹·모바일촬영)는 완성되어 작동 중. 남은 핵심은 Colab 학습 → best.pt 연결.

## 빠른 시작
`실행가이드.md` 참고. 요약:
- AI 서버: `ai-server` 에서 `uvicorn app.main:app --reload --port 8000`
- 웹: `web` 에서 `npm run dev` → http://localhost:5173

## 데이터셋
- AI-Hub: SOC 시설물 균열패턴 이미지 데이터 (dataSetSn=71769)
- 초기 프로토타입: 공개 소형 균열 데이터셋 (Roboflow Universe)
