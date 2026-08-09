import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getFacilities,
  uploadInspection,
  imageUrl,
  createFacility,
} from "../api";
import GradeBadge from "../components/GradeBadge.jsx";
import SummaryCard from "../components/SummaryCard.jsx";
import { DEFECT_KO } from "../lib/inspection.js";

export default function Capture() {
  const [facilities, setFacilities] = useState([]);
  const [facilityId, setFacilityId] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("상가건물");

  useEffect(() => {
    getFacilities().then(setFacilities).catch(() => {});
  }, []);

  async function onAddFacility(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const f = await createFacility({ name: newName.trim(), type: newType });
    const list = await getFacilities();
    setFacilities(list);
    setFacilityId(String(f.id)); // 방금 등록한 시설을 바로 선택
    setNewName("");
  }

  function onPick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setPreview(URL.createObjectURL(f));
  }

  async function onAnalyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await uploadInspection(file, facilityId || null);
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="capture">
      <div className="card capture-card">
        <h2>현장 시설물 촬영</h2>
        <p className="muted">
          노후 건물·외벽을 촬영하면 AI가 균열을 탐지하고 안전등급을 산정합니다.
        </p>

        <label className="field">
          <span>시설물 선택</span>
          <select
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
          >
            <option value="">(선택 안 함)</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.type})
              </option>
            ))}
          </select>
        </label>

        <details className="add-facility no-print">
          <summary>새 시설물 등록</summary>
          <form className="add-facility-form" onSubmit={onAddFacility}>
            <input
              type="text"
              placeholder="시설물 이름 (예: OO상가 3동)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <select value={newType} onChange={(e) => setNewType(e.target.value)}>
              <option>상가건물</option>
              <option>다세대주택</option>
              <option>단독주택</option>
              <option>아파트</option>
              <option>복지시설</option>
              <option>기타</option>
            </select>
            <button type="submit" className="action-btn">등록</button>
          </form>
        </details>

        <div className="shoot-guide">
          <b>촬영 가이드</b>
          <ul>
            <li>결함 부위를 화면 중앙에, 정면에서 촬영하세요.</li>
            <li>30~50cm 거리에서 초점을 맞춰 흔들림 없이.</li>
            <li>그늘·역광을 피하고 밝은 상태에서 촬영하세요.</li>
          </ul>
        </div>

        <label className="capture-btn">
          {/* capture=environment → 휴대폰에서 후면 카메라 바로 실행 */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPick}
            hidden
          />
          {preview ? "다시 촬영 / 선택" : "사진 촬영 또는 선택"}
        </label>

        {preview && (
          <div className="preview">
            <img src={preview} alt="미리보기" />
          </div>
        )}

        <button
          className="primary"
          disabled={!file || loading}
          onClick={onAnalyze}
        >
          {loading ? "AI 분석 중..." : "AI 분석하기"}
        </button>

        {error && <p className="error">{error}</p>}
      </div>

      {result && (
        <div className="card result-card">
          <div className="result-head">
            <h3>분석 결과</h3>
            <GradeBadge
              grade={result.risk.risk_grade}
              score={result.risk.risk_score}
            />
          </div>
          {result.mock_mode && (
            <p className="badge warn inline">
              목(Mock) 모드 — 학습된 모델 연결 전 임시 결과입니다.
            </p>
          )}
          <img
            className="result-img"
            src={imageUrl(result.id)}
            alt="탐지 결과"
          />

          {result.risk.needs_pro_inspection ? (
            <div className="pro-flag">
              전문 정밀안전진단 필요
              {result.risk.urgency ? (
                <span className="urgency now" style={{ marginLeft: 8 }}>
                  {result.risk.urgency}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="pro-flag ok">자가점검 관리 대상 (정밀진단 불필요)</div>
          )}

          <SummaryCard risk={result.risk} />

          <h4>탐지된 결함 ({result.detections.length}개)</h4>
          <ul className="detect-list">
            {result.detections.map((d, i) => (
              <li key={i}>
                <b>{DEFECT_KO[d.label] || d.label}</b> · 신뢰도{" "}
                {(d.confidence * 100).toFixed(0)}%
                {d.width_px ? ` · 폭 ${d.width_px}px` : ""}
              </li>
            ))}
            {!result.detections.length && <li>탐지된 결함 없음</li>}
          </ul>
          <Link className="link btn-detail" to={`/inspection/${result.id}`}>
            상세 분석 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}
