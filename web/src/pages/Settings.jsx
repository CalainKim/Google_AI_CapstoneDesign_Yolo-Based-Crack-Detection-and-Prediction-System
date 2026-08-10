import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStats, getHealth, getFacilities } from "../api";
import CostImpact from "../components/CostImpact.jsx";
import {
  getCostPerDiagnosis,
  setCostPerDiagnosis,
  DEFAULT_COST,
  setOnboarded,
  FONT_SCALES,
  getFontScale,
  applyFontScale,
} from "../lib/settings.js";

export default function Settings() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [cost, setCost] = useState(getCostPerDiagnosis());
  const [saved, setSaved] = useState(false);
  const [fontScale, setFontScale] = useState(getFontScale());

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
    getHealth().then(setHealth).catch(() => {});
    getFacilities().then(setFacilities).catch(() => {});
  }, []);

  function onSaveCost(e) {
    e.preventDefault();
    const v = Number(cost);
    if (!Number.isFinite(v) || v <= 0) return;
    setCostPerDiagnosis(v);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const triage = stats?.triage || {};

  return (
    <div className="settings">
      <h2 className="page-title">설정</h2>

      <CostImpact
        total={stats?.total_inspections}
        needsPro={triage.needs_pro_inspection}
        unitCost={Number(cost) || DEFAULT_COST}
      />

      <div className="card">
        <h3>진단 비용 기준</h3>
        <p className="muted">
          정밀안전진단 1건당 예상 비용입니다. 관리 주체의 실제 계약 단가에 맞춰 조정하면
          절감 효과가 더 정확하게 계산됩니다.
        </p>
        <form className="cost-form" onSubmit={onSaveCost}>
          <div className="cost-input">
            <input
              type="number"
              min="1"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              aria-label="진단 1건당 비용"
            />
            <span className="unit">만 원</span>
          </div>
          <button type="submit" className="action-btn primary-tone">
            저장
          </button>
          {saved && <span className="share-msg">저장했습니다</span>}
        </form>
      </div>

      <div className="card">
        <h3>글자 크기</h3>
        <p className="muted">현장에서 화면이 잘 보이지 않을 때 조절하세요.</p>
        <div className="font-picker">
          {FONT_SCALES.map((f) => (
            <button
              key={f.key}
              className={`font-chip${fontScale === f.key ? " on" : ""}`}
              onClick={() => {
                applyFontScale(f.key);
                setFontScale(f.key);
              }}
              style={{ fontSize: `${13 * f.value}px` }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>서비스 정보</h3>
        <ul className="info-list">
          <li>
            <span>AI 모델 상태</span>
            <b className={health?.mock_mode === false ? "text-ok" : "text-red"}>
              {health == null
                ? "확인 중"
                : health.mock_mode
                ? "체험 모드"
                : "정상 연결"}
            </b>
          </li>
          <li>
            <span>등급 판정 방식</span>
            <b>{health?.grade_classifier ? "학습 분류 모델" : "규칙 기반"}</b>
          </li>
          <li>
            <span>등록 시설물</span>
            <b>{facilities.length}곳</b>
          </li>
          <li>
            <span>누적 점검</span>
            <b>{stats?.total_inspections ?? 0}건</b>
          </li>
        </ul>
      </div>

      <div className="card">
        <h3>안내</h3>
        <p className="muted">
          본 서비스는 정밀안전진단을 대체하지 않는 1차 선별 도구입니다. 안전등급 표기는
          시설물안전법 시행령의 등급 체계를 참고한 것이며, 법정 등급을 부여하지 않습니다.
          최종 판단은 전문 진단으로 확인하시기 바랍니다.
        </p>
        <button
          className="action-btn"
          onClick={() => {
            setOnboarded(false);
            navigate("/intro");
          }}
        >
          서비스 소개 다시 보기
        </button>
      </div>
    </div>
  );
}
