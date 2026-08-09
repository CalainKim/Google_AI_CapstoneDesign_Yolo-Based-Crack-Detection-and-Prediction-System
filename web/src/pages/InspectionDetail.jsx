import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getInspection, imageUrl, setInspectionStatus } from "../api";
import GradeBadge from "../components/GradeBadge.jsx";
import SummaryCard from "../components/SummaryCard.jsx";
import Lightbox from "../components/Lightbox.jsx";
import { DEFECT_KO, GRADE_MEANING, GROUP_ORDER, shareInspection } from "../lib/inspection.js";

// 탐지 기반 참고 지표 라벨
const FACTOR_LABELS = {
  severity: "결함 심각도",
  width: "균열 폭(미측정)",
  density: "결함 밀도",
  count: "결함 개수",
};

export default function InspectionDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [shareMsg, setShareMsg] = useState("");

  async function onShare() {
    const r = await shareInspection({
      id: data.id,
      facilityName: data.facility_name,
      grade: data.risk_grade,
      gradeLabel: (data.risk || {}).grade_label,
      needsPro: (data.risk || {}).needs_pro_inspection,
    });
    if (r === "copied") {
      setShareMsg("링크를 복사했어요");
      setTimeout(() => setShareMsg(""), 2000);
    }
  }

  useEffect(() => {
    getInspection(id).then(setData).catch((e) => setError(e.message));
  }, [id]);

  async function changeStatus(status) {
    await setInspectionStatus(data.id, status);
    setData({ ...data, status });
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">불러오는 중...</p>;

  const status = data.status || "접수";
  const risk = data.risk || {};
  const factors = risk.factors || {};
  const probs = risk.grade_probs || {};
  const byClassifier = risk.grade_source === "classifier";
  const defectSummary = risk.defect_summary || {};

  return (
    <div className="detail">
      <div className="detail-toolbar no-print">
        <Link className="link" to="/">
          ← 대시보드로
        </Link>
        <div className="toolbar-actions">
          <span className={`status-chip ${{ "접수": "s0", "진단 의뢰": "s1", "조치 완료": "s2" }[status]}`}>
            {status}
          </span>
          {status === "접수" && risk.needs_pro_inspection && (
            <button className="action-btn warn" onClick={() => changeStatus("진단 의뢰")}>
              정밀진단 의뢰
            </button>
          )}
          {status !== "조치 완료" && (
            <button className="action-btn ok" onClick={() => changeStatus("조치 완료")}>
              조치 완료 처리
            </button>
          )}
          <button className="action-btn" onClick={() => window.print()}>
            보고서 인쇄
          </button>
          <button className="action-btn" onClick={onShare}>
            공유
          </button>
          {shareMsg && <span className="share-msg">{shareMsg}</span>}
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>탐지 결과 이미지</h3>
          <img
            className="result-img zoomable"
            src={imageUrl(data.id)}
            alt="결과"
            onClick={() => setZoom(imageUrl(data.id))}
          />
          <p className="muted img-cap">
            붉게 표시된 영역이 AI가 탐지한 결함 위치입니다. 사진을 탭하면 크게 볼 수 있어요.
          </p>
        </div>

        <div className="card">
          <div className="result-head">
            <h3>{data.facility_name || "미지정 시설"}</h3>
            <GradeBadge grade={data.risk_grade} score={data.risk_score} />
          </div>
          <p className="muted">
            {data.facility_type} · {data.created_at}
            {data.is_mock ? " · mock" : " · AI 추론"}
          </p>

          {/* AI 종합 소견 */}
          <SummaryCard risk={risk} />

          {/* 판정 결과 */}
          {risk.needs_pro_inspection ? (
            <div className="pro-flag">
              전문 정밀안전진단 필요
              {risk.urgency ? (
                <span className="urgency now" style={{ marginLeft: 8 }}>{risk.urgency}</span>
              ) : null}
            </div>
          ) : (
            <div className="pro-flag ok">
              자가점검 관리 대상 (정밀진단 불필요)
              {risk.urgency ? (
                <span className="urgency later" style={{ marginLeft: 8 }}>{risk.urgency}</span>
              ) : null}
            </div>
          )}
          <p className="reco">{risk.recommendation}</p>

          {/* ① AI 등급 판정 근거 (분류 모델) */}
          <h4>
            AI 등급 판정 근거
            <span className="src-tag">{byClassifier ? "분류 모델" : "휴리스틱"}</span>
          </h4>
          <div className="grade-meaning">
            <div className="gm-head">
              <span className={`gm-grade g-${(data.risk_grade || "").toLowerCase()}`}>
                {data.risk_grade} · {risk.grade_label}
              </span>
              {risk.grade_confidence != null ? (
                <span className="gm-conf">
                  분류 신뢰도 {Math.round(risk.grade_confidence * 100)}%
                </span>
              ) : null}
            </div>
            <p className="gm-desc">{GRADE_MEANING[data.risk_grade]}</p>
          </div>

          {Object.keys(probs).length ? (
            <div className="probs">
              <div className="probs-label">등급별 분류 확률</div>
              {GROUP_ORDER.map(({ key, cls }) => {
                const v = probs[key] || 0;
                return (
                  <div className="prob-row" key={key}>
                    <span className="prob-name">{key}</span>
                    <div className="prob-bar">
                      <div className={`prob-fill ${cls}`} style={{ width: `${Math.round(v * 100)}%` }} />
                    </div>
                    <em className="prob-val">{Math.round(v * 100)}%</em>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* ② 탐지된 결함 (탐지 모델) */}
          <h4>
            탐지된 결함 ({data.detections.length}개)
            <span className="src-tag">탐지 모델</span>
          </h4>
          {Object.keys(defectSummary).length ? (
            <div className="defect-chips">
              {Object.entries(defectSummary).map(([k, n]) => (
                <span className="dchip" key={k}>
                  {DEFECT_KO[k] || k} <b>×{n}</b>
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">탐지된 결함이 없습니다.</p>
          )}
          {data.detections.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>종류</th>
                  <th>신뢰도</th>
                  <th>위치(x,y,w,h)</th>
                  <th>폭(px)</th>
                </tr>
              </thead>
              <tbody>
                {data.detections.map((d, i) => (
                  <tr key={i}>
                    <td>{DEFECT_KO[d.label] || d.label}</td>
                    <td>{(d.confidence * 100).toFixed(0)}%</td>
                    <td className="muted">{d.bbox.join(", ")}</td>
                    <td>{d.width_px ?? "미측정"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {/* ③ 참고: 탐지 기반 지표 (등급은 위 분류 결과 기준) */}
          <details className="aux">
            <summary>참고 · 탐지 기반 지표 (등급은 위 분류 결과 기준)</summary>
            <div className="factors">
              {Object.entries(factors).map(([k, v]) => (
                <div className="factor" key={k}>
                  <span>{FACTOR_LABELS[k] || k}</span>
                  <div className="bar">
                    <div className="bar-fill" style={{ width: `${Math.round(v * 100)}%` }} />
                  </div>
                  <em>{Math.round(v * 100)}%</em>
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>
      <Lightbox src={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}
