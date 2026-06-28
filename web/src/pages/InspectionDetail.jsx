import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getInspection, imageUrl } from "../api";
import GradeBadge from "../components/GradeBadge.jsx";

const FACTOR_LABELS = {
  severity: "결함 심각도",
  width: "균열 폭",
  density: "결함 밀도",
  count: "결함 개수",
};

export default function InspectionDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getInspection(id).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">⚠️ {error}</p>;
  if (!data) return <p className="muted">불러오는 중...</p>;

  const risk = data.risk || {};
  const factors = risk.factors || {};

  return (
    <div className="detail">
      <Link className="link" to="/">
        ← 대시보드로
      </Link>
      <div className="grid-2">
        <div className="card">
          <h3>탐지 결과 이미지</h3>
          <img className="result-img" src={imageUrl(data.id)} alt="결과" />
        </div>
        <div className="card">
          <div className="result-head">
            <h3>{data.facility_name || "미지정 시설"}</h3>
            <GradeBadge grade={data.risk_grade} score={data.risk_score} />
          </div>
          <p className="muted">
            {data.facility_type} · {data.created_at}
          </p>
          <p className="reco">💡 {risk.recommendation}</p>

          <h4>위험도 요인 분석</h4>
          <div className="factors">
            {Object.entries(factors).map(([k, v]) => (
              <div className="factor" key={k}>
                <span>{FACTOR_LABELS[k] || k}</span>
                <div className="bar">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.round(v * 100)}%` }}
                  />
                </div>
                <em>{Math.round(v * 100)}%</em>
              </div>
            ))}
          </div>

          <h4>탐지된 결함 ({data.detections.length}개)</h4>
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
                  <td>{d.label}</td>
                  <td>{(d.confidence * 100).toFixed(0)}%</td>
                  <td className="muted">{d.bbox.join(", ")}</td>
                  <td>{d.width_px ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
