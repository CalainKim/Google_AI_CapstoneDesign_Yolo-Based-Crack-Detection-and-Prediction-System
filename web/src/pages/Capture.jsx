import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getFacilities,
  uploadInspection,
  imageUrl,
} from "../api";
import GradeBadge from "../components/GradeBadge.jsx";

export default function Capture() {
  const [facilities, setFacilities] = useState([]);
  const [facilityId, setFacilityId] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getFacilities().then(setFacilities).catch(() => {});
  }, []);

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
        <h2>📷 현장 시설물 촬영</h2>
        <p className="muted">
          교량·터널·외벽을 촬영하면 AI가 균열을 탐지하고 위험도를 분석합니다.
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

        {error && <p className="error">⚠️ {error}</p>}
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
          <p className="reco">💡 {result.risk.recommendation}</p>
          <h4>탐지된 결함 ({result.detections.length}개)</h4>
          <ul className="detect-list">
            {result.detections.map((d, i) => (
              <li key={i}>
                <b>{d.label}</b> · 신뢰도 {(d.confidence * 100).toFixed(0)}%
                {d.width_px ? ` · 폭 ${d.width_px}px` : ""}
              </li>
            ))}
            {!result.detections.length && <li>탐지된 결함 없음</li>}
          </ul>
          <Link className="link" to={`/inspection/${result.id}`}>
            상세 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}
