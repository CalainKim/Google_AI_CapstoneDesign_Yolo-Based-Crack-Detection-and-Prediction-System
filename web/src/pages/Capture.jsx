import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  getFacilities,
  uploadInspection,
  imageUrl,
  createFacility,
  getParts,
  getFacilityAssessment,
} from "../api";
import GradeBadge from "../components/GradeBadge.jsx";
import SummaryCard from "../components/SummaryCard.jsx";
import Lightbox from "../components/Lightbox.jsx";
import { DEFECT_KO, shareInspection } from "../lib/inspection.js";
import { enqueue } from "../lib/offlineQueue.js";

export default function Capture() {
  const [facilities, setFacilities] = useState([]);
  const [facilityId, setFacilityId] = useState("");
  const [parts, setParts] = useState([]);
  const [part, setPart] = useState("외벽");

  const [mode, setMode] = useState("single"); // single | series
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [queuedMsg, setQueuedMsg] = useState("");

  // 연속 촬영 세션
  const [session, setSession] = useState([]); // [{id, part, grade, score, defects}]
  const [assessment, setAssessment] = useState(null);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("상가건물");
  const [zoom, setZoom] = useState(null);
  const [shareMsg, setShareMsg] = useState("");
  const [note, setNote] = useState("");
  const [useGps, setUseGps] = useState(true);
  const [coords, setCoords] = useState(null);
  const resultRef = useRef(null);

  // 촬영 위치 기록 (권한 거부 시 조용히 생략)
  useEffect(() => {
    if (!useGps || !navigator.geolocation) return setCoords(null);
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setCoords(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, [useGps]);

  useEffect(() => {
    getFacilities().then(setFacilities).catch(() => {});
    getParts().then(setParts).catch(() => {});
  }, []);

  useEffect(() => {
    if ((result || assessment) && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result, assessment]);

  function switchMode(next) {
    setMode(next);
    setResult(null);
    setAssessment(null);
    setSession([]);
    setFile(null);
    setPreview(null);
    setError(null);
  }

  function onPick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setQueuedMsg("");
    setPreview(URL.createObjectURL(f));
  }

  async function onAnalyze() {
    if (!file) return;
    setLoading(true);
    setError(null);

    // 오프라인이면 대기열에 저장했다가 연결 후 자동 전송
    if (!navigator.onLine) {
      try {
        await enqueue({ file, facilityId: facilityId || null, part, note, coords });
        window.dispatchEvent(new Event("ansim:queued"));
        setQueuedMsg("오프라인 상태입니다. 촬영을 저장했고 연결되면 자동으로 분석합니다.");
        setFile(null);
        setPreview(null);
      } catch {
        setError("촬영을 저장하지 못했습니다.");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await uploadInspection(file, facilityId || null, part, {
        note: note || undefined,
        lat: coords?.lat,
        lng: coords?.lng,
      });
      if (mode === "series") {
        // 결과를 세션에 쌓고 바로 다음 촬영 준비
        setSession((prev) => [
          ...prev,
          {
            id: res.id,
            part: res.part,
            grade: res.risk.risk_grade,
            score: res.risk.risk_score,
            defects: res.detections.length,
            needsPro: res.risk.needs_pro_inspection,
          },
        ]);
        setFile(null);
        setPreview(null);
        setResult(null);
        setNote("");
      } else {
        setResult(res);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function finishSeries() {
    if (!facilityId) return;
    setLoading(true);
    try {
      setAssessment(await getFacilityAssessment(facilityId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onAddFacility(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const f = await createFacility({ name: newName.trim(), type: newType });
    setFacilities(await getFacilities());
    setFacilityId(String(f.id));
    setNewName("");
  }

  async function onShare() {
    const r = await shareInspection({
      id: result.id,
      facilityName: facilities.find((f) => String(f.id) === String(facilityId))?.name,
      grade: result.risk.risk_grade,
      gradeLabel: result.risk.grade_label,
      needsPro: result.risk.needs_pro_inspection,
    });
    if (r === "copied") {
      setShareMsg("링크를 복사했어요");
      setTimeout(() => setShareMsg(""), 2000);
    }
  }

  const seriesReady = mode === "series" && facilityId;
  const shotParts = new Set(session.map((s) => s.part));
  const structuralParts = parts.filter((p) => p.structural);
  const currentPart = parts.find((p) => p.name === part);

  return (
    <div className="capture">
      <div className="card capture-card">
        <h2>현장 점검</h2>
        <p className="muted">
          노후 건물·외벽을 촬영하면 AI가 결함을 탐지하고 안전등급을 산정합니다.
        </p>

        <div className="mode-switch no-print" role="tablist">
          <button
            role="tab"
            aria-selected={mode === "single"}
            className={mode === "single" ? "on" : ""}
            onClick={() => switchMode("single")}
          >
            단일 촬영
          </button>
          <button
            role="tab"
            aria-selected={mode === "series"}
            className={mode === "series" ? "on" : ""}
            onClick={() => switchMode("series")}
          >
            연속 촬영
          </button>
        </div>
        {mode === "series" && (
          <p className="mode-hint">
            한 건물의 여러 부위를 이어서 촬영합니다. 촬영을 마치면 부재 중요도를 반영한
            건물 단위 종합 판정을 확인할 수 있습니다.
          </p>
        )}

        <label className="field">
          <span>시설물 선택{mode === "series" && " (연속 촬영에는 필수)"}</span>
          <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
            <option value="">(선택 안 함)</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.type})
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span>촬영 부위</span>
          <div className="part-picker">
            {parts.map((p) => (
              <button
                key={p.name}
                type="button"
                className={`part-chip${part === p.name ? " on" : ""}${
                  shotParts.has(p.name) ? " shot" : ""
                }`}
                onClick={() => setPart(p.name)}
                title={p.note}
              >
                {p.name}
                {p.structural && <em>주요</em>}
                {shotParts.has(p.name) && <i className="chip-check" aria-label="촬영 완료" />}
              </button>
            ))}
          </div>
          <p className="part-hint">
            {currentPart?.structural
              ? "주요부재입니다. 손상 시 건물 전체 안전에 영향을 줍니다."
              : "비구조 부위입니다. 구조 안전과는 구분해 평가합니다."}
          </p>
        </div>

        {mode === "series" && session.length > 0 && (
          <div className="series-progress">
            <div className="sp-head">
              <b>촬영 {session.length}건</b>
              <span className="muted">
                주요부재 {structuralParts.filter((p) => shotParts.has(p.name)).length}/
                {structuralParts.length}
              </span>
            </div>
            <ul className="sp-list">
              {session.map((s) => (
                <li key={s.id}>
                  <GradeBadge grade={s.grade} />
                  <span className="sp-part">{s.part}</span>
                  <span className="muted">결함 {s.defects}개</span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
            <button type="submit" className="action-btn">
              등록
            </button>
          </form>
        </details>

        <label className="field">
          <span>현장 메모 (선택)</span>
          <input
            type="text"
            className="note-input"
            placeholder="예: 3층 계단실 우측"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <label className="gps-toggle no-print">
          <input
            type="checkbox"
            checked={useGps}
            onChange={(e) => setUseGps(e.target.checked)}
          />
          <span>
            촬영 위치 기록
            <em className="muted">
              {useGps
                ? coords
                  ? ` · ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                  : " · 위치 확인 중"
                : " · 사용 안 함"}
            </em>
          </span>
        </label>

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
          <input type="file" accept="image/*" capture="environment" onChange={onPick} hidden />
          {preview ? "다시 촬영 / 선택" : "사진 촬영 또는 선택"}
        </label>

        {preview && (
          <div className="preview">
            <img src={preview} alt="미리보기" />
          </div>
        )}

        <button
          className="primary"
          disabled={!file || loading || (mode === "series" && !facilityId)}
          onClick={onAnalyze}
        >
          {loading
            ? "AI 분석 중..."
            : mode === "series"
            ? `${part} 분석하기`
            : "AI 분석하기"}
        </button>

        {mode === "series" && session.length > 0 && (
          <button className="action-btn finish-btn" onClick={finishSeries} disabled={loading}>
            점검 완료 · 건물 종합 판정 보기
          </button>
        )}

        {mode === "series" && !facilityId && (
          <p className="part-hint">연속 촬영은 종합 판정을 위해 시설물 선택이 필요합니다.</p>
        )}

        {error && <p className="error">{error}</p>}
        {queuedMsg && <p className="queued-msg">{queuedMsg}</p>}
      </div>

      {loading && (
        <div className="card analyzing">
          <div className="spinner" />
          <p className="analyzing-title">AI가 분석하고 있어요</p>
          <p className="muted">결함 탐지 → 등급 판정 → 종합 소견 생성</p>
        </div>
      )}

      {/* 연속 촬영 종합 결과 */}
      {assessment?.grade && !loading && (
        <div
          className={`card tone tone-${assessment.grade.toLowerCase()}`}
          ref={resultRef}
        >
          <div className="result-head">
            <h3>건물 단위 종합 판정</h3>
            <GradeBadge grade={assessment.grade} />
          </div>
          <div className={`pro-flag${assessment.needs_pro_inspection ? "" : " ok"}`}>
            {assessment.needs_pro_inspection
              ? "전문 정밀안전진단 필요"
              : "자가점검 관리 대상"}
          </div>

          <h4>부위별 최악 등급</h4>
          <div className="part-summary">
            {assessment.part_summary.map((p) => (
              <Link
                key={p.part}
                to={`/inspection/${p.inspection_id}`}
                className={`part-row${p.structural ? " structural" : ""}`}
              >
                <span className="pr-name">
                  {p.part}
                  {p.structural && <em>주요부재</em>}
                </span>
                <span className="pr-note muted">{p.note}</span>
                <GradeBadge grade={p.grade} />
              </Link>
            ))}
          </div>

          <h4>판정 근거</h4>
          <ul className="reason-list">
            {assessment.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>

          {assessment.missing_structural?.length > 0 && (
            <p className="coverage-note">
              점검 범위 {Math.round(assessment.coverage * 100)}% — 미점검 부재(
              {assessment.missing_structural.join(", ")})를 추가로 촬영하면 판정이 정확해집니다.
            </p>
          )}

          <div className="result-actions">
            <Link className="link btn-detail" to={`/facility/${facilityId}`}>
              시설물 이력 보기 →
            </Link>
            <button className="action-btn" onClick={() => switchMode("series")}>
              새 점검 시작
            </button>
          </div>
        </div>
      )}

      {/* 단일 촬영 결과 */}
      {result && !loading && (
        <div
          className={`card result-card tone tone-${(result.risk.risk_grade || "").toLowerCase()}`}
          ref={resultRef}
        >
          <div className="result-head">
            <h3>분석 결과</h3>
            <GradeBadge grade={result.risk.risk_grade} score={result.risk.risk_score} />
          </div>
          {result.mock_mode && (
            <p className="badge warn inline">
              체험 모드 — 학습된 모델 연결 전 임시 결과입니다.
            </p>
          )}
          <img
            className="result-img zoomable"
            src={imageUrl(result.id)}
            alt="탐지 결과"
            onClick={() => setZoom(imageUrl(result.id))}
          />
          <p className="muted img-cap">
            {result.part} 부위 · 사진을 탭하면 크게 볼 수 있어요.
          </p>

          {result.risk.needs_pro_inspection ? (
            <div className="pro-flag">
              전문 정밀안전진단 필요
              {result.risk.urgency && (
                <span className="urgency now" style={{ marginLeft: 8 }}>
                  {result.risk.urgency}
                </span>
              )}
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

          <div className="result-actions">
            <Link className="link btn-detail" to={`/inspection/${result.id}`}>
              상세 분석 보기 →
            </Link>
            <button className="action-btn" onClick={onShare}>
              결과 공유
            </button>
            {shareMsg && <span className="share-msg">{shareMsg}</span>}
          </div>
        </div>
      )}

      <Lightbox src={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
