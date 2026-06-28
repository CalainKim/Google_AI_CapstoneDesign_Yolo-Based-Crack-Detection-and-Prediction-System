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

  // 보수 우선순위: 최신 위험등급 높은 순
  const priority = [...inspections]
    .filter((i) => i.risk_grade)
    .sort(
      (a, b) =>
        (GRADE_RANK[b.risk_grade] || 0) - (GRADE_RANK[a.risk_grade] || 0) ||
        b.risk_score - a.risk_score
    )
    .slice(0, 6);

  return (
    <div className="dashboard">
      <section className="cards">
        <div className="card stat">
          <span className="stat-label">총 점검 건수</span>
          <span className="stat-value">{stats?.total_inspections ?? "-"}</span>
        </div>
        <div className="card stat danger">
          <span className="stat-label">긴급(D·E) 시설</span>
          <span className="stat-value">
            {(stats?.grade_distribution?.D || 0) +
              (stats?.grade_distribution?.E || 0)}
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">등록 시설물</span>
          <span className="stat-value">{facilities.length}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">결함 유형 수</span>
          <span className="stat-value">{defectData.length}</span>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>시설물 위치 · 위험도</h3>
          <FacilityMap facilities={facilities} />
        </div>
        <div className="card">
          <h3>위험등급 분포</h3>
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
          <h3>🚨 보수 우선순위 추천</h3>
          {priority.length ? (
            <ol className="priority-list">
              {priority.map((i) => (
                <li key={i.id}>
                  <Link to={`/inspection/${i.id}`}>
                    <GradeBadge grade={i.risk_grade} score={i.risk_score} />
                    <span className="pl-name">
                      {i.facility_name || "미지정 시설"}
                    </span>
                    <span className="muted">결함 {i.defect_count}개</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">점검 기록이 쌓이면 우선순위가 표시됩니다.</p>
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
