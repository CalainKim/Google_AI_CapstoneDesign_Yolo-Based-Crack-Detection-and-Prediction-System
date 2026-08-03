import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getStats, getFacilities, getInspections, GRADE_COLORS } from "../api";
import GradeBadge from "../components/GradeBadge.jsx";
import FacilityMap from "../components/FacilityMap.jsx";

const GRADE_ORDER = ["A", "B", "C", "D", "E"];
// 보수 우선순위 정렬용 위험도 순위
const GRADE_RANK = { E: 5, D: 4, C: 3, B: 2, A: 1 };
// D·E = 전문 정밀안전진단으로 에스컬레이션 대상 (트리아지 핵심)
const NEEDS_PRO = new Set(["D", "E"]);
// 등급별 긴급도(백엔드 GRADE_BANDS와 동일). 구 기록엔 risk.urgency가 없어 등급으로 보정.
const URGENCY_BY_GRADE = {
  E: { text: "즉시", cls: "now" },
  D: { text: "1개월 내", cls: "soon" },
  C: { text: "6개월 내", cls: "later" },
  B: { text: "정기 점검", cls: "later" },
  A: { text: "정기 점검", cls: "later" },
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [inspections, setInspections] = useState([]);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
    getFacilities().then(setFacilities).catch(() => {});
    getInspections().then(setInspections).catch(() => {});
  }, []);

  const gradeData = GRADE_ORDER.map((g) => ({
    grade: g,
    count: stats?.grade_distribution?.[g] || 0,
  }));

  const defectData = Object.entries(stats?.defect_distribution || {}).map(
    ([name, value]) => ({ name, value })
  );

  // 정밀진단 우선 대상: D·E 등급만 선별, 위험 높은 순
  const priority = [...inspections]
    .filter((i) => NEEDS_PRO.has(i.risk_grade))
    .sort(
      (a, b) =>
        (GRADE_RANK[b.risk_grade] || 0) - (GRADE_RANK[a.risk_grade] || 0) ||
        b.risk_score - a.risk_score
    )
    .slice(0, 6);

  const triage = stats?.triage || {};

  return (
    <div className="dashboard">
      <section className="cards">
        <div className="card stat">
          <span className="stat-label">총 점검 건수</span>
          <span className="stat-value">{stats?.total_inspections ?? "-"}</span>
        </div>
        <div className="card stat danger">
          <span className="stat-label">정밀진단 필요 (D·E)</span>
          <span className="stat-value">{triage.needs_pro_inspection ?? 0}</span>
          <span className="stat-sub">전문 정밀안전진단 에스컬레이션</span>
        </div>
        <div className="card stat good">
          <span className="stat-label">진단 선별 절감률</span>
          <span className="stat-value">{triage.saving_rate ?? 0}%</span>
          <span className="stat-sub">
            {stats?.total_inspections
              ? `${stats.total_inspections}건 중 ${triage.screened_out ?? 0}건 자가점검 관리`
              : "자가점검으로 선별"}
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">등록 시설물</span>
          <span className="stat-value">{facilities.length}</span>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>시설물 위치 · 안전등급</h3>
          <FacilityMap facilities={facilities} />
        </div>
        <div className="card">
          <h3>안전등급 분포</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={gradeData}>
              <XAxis dataKey="grade" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count">
                {gradeData.map((d) => (
                  <Cell key={d.grade} fill={GRADE_COLORS[d.grade]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <h3 style={{ marginTop: 16 }}>결함 종류 분포</h3>
          {defectData.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={defectData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={70}
                  label
                >
                  {defectData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"][
                          i % 6
                        ]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">아직 데이터가 없습니다.</p>
          )}
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>🚨 정밀진단 우선 대상 (D·E)</h3>
          {priority.length ? (
            <ol className="priority-list">
              {priority.map((i) => {
                const u = i.risk?.urgency
                  ? { text: i.risk.urgency, cls: URGENCY_BY_GRADE[i.risk_grade]?.cls || "later" }
                  : URGENCY_BY_GRADE[i.risk_grade] || { text: "-", cls: "later" };
                return (
                  <li key={i.id}>
                    <Link to={`/inspection/${i.id}`}>
                      <GradeBadge grade={i.risk_grade} score={i.risk_score} />
                      <span className="pl-name">
                        {i.facility_name || "미지정 시설"}
                      </span>
                      <span className={`urgency ${u.cls}`}>{u.text}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="muted">
              정밀진단이 필요한 D·E 등급 시설이 없습니다. 자가점검으로 관리 가능한 상태입니다.
            </p>
          )}
        </div>
        <div className="card">
          <h3>최근 점검 내역</h3>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>시설물</th>
                <th>등급</th>
                <th>결함</th>
                <th>일시</th>
              </tr>
            </thead>
            <tbody>
              {inspections.slice(0, 8).map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link to={`/inspection/${i.id}`}>{i.id}</Link>
                  </td>
                  <td>{i.facility_name || "-"}</td>
                  <td>
                    <GradeBadge grade={i.risk_grade} score={i.risk_score} />
                  </td>
                  <td>{i.defect_count}</td>
                  <td className="muted">{(i.created_at || "").slice(5, 16)}</td>
                </tr>
              ))}
              {!inspections.length && (
                <tr>
                  <td colSpan="5" className="muted">
                    아직 점검 기록이 없습니다. '현장 촬영'에서 사진을 올려보세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
