import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getFacilities, getInspections } from "../api";
import GradeBadge from "../components/GradeBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";

const STATUS_CLS = { "접수": "s0", "진단 의뢰": "s1", "조치 완료": "s2" };

// 시설물 단위 점검 이력 — 관리 도구의 핵심 (기록·추적)
export default function FacilityDetail() {
  const { id } = useParams();
  const [facility, setFacility] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    getFacilities().then((fs) =>
      setFacility(fs.find((f) => String(f.id) === String(id)) || null)
    );
    getInspections(null, id).then(setItems);
  }, [id]);

  const needsPro = items.filter((i) => ["D", "E"].includes(i.risk_grade));
  const pendingPro = needsPro.filter((i) => (i.status || "접수") !== "조치 완료");
  // 등급 추이: 과거 → 최신
  const trend = [...items].reverse();

  return (
    <div className="detail">
      <Link className="link" to="/">
        ← 대시보드로
      </Link>

      <div className="card facility-head">
        <div>
          <h2>{facility ? facility.name : `시설물 #${id}`}</h2>
          <p className="muted">{facility?.type}</p>
        </div>
        <div className="facility-kpis">
          <div className="kpi">
            <span className="kpi-label">최신 등급</span>
            <GradeBadge grade={items[0]?.risk_grade} score={items[0]?.risk_score} />
          </div>
          <div className="kpi">
            <span className="kpi-label">누적 점검</span>
            <b>{items.length}건</b>
          </div>
          <div className="kpi">
            <span className="kpi-label">미조치 정밀진단</span>
            <b className={pendingPro.length ? "text-red" : ""}>{pendingPro.length}건</b>
          </div>
        </div>
      </div>

      {trend.length > 1 && (
        <div className="card">
          <h3>등급 추이</h3>
          <div className="trend">
            {trend.map((i) => (
              <Link key={i.id} to={`/inspection/${i.id}`} className="trend-item">
                <GradeBadge grade={i.risk_grade} />
                <span className="muted">{(i.created_at || "").slice(5, 10)}</span>
              </Link>
            ))}
          </div>
          <p className="muted">
            과거 → 최신 순. 등급이 나빠지는 추세면 결함이 진행 중일 수 있습니다.
          </p>
        </div>
      )}

      <div className="card">
        <h3>점검 이력</h3>
        {items.length ? (
          <ul className="history">
            {items.map((i) => (
              <li key={i.id}>
                <Link to={`/inspection/${i.id}`} className="history-row">
                  <GradeBadge grade={i.risk_grade} score={i.risk_score} />
                  <span className="hist-main">
                    결함 {i.defect_count}개
                    <span className="muted"> · {(i.created_at || "").slice(0, 16).replace("T", " ")}</span>
                  </span>
                  <span className={`status-chip ${STATUS_CLS[i.status || "접수"]}`}>
                    {i.status || "접수"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="아직 점검 기록이 없습니다"
            desc="현장 점검에서 이 시설물을 선택해 촬영하면 이력이 쌓입니다."
            actionTo="/capture"
            actionLabel="점검 시작하기"
          />
        )}
      </div>
    </div>
  );
}
