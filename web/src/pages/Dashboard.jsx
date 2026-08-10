import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getStats,
  getFacilities,
  getInspections,
  getParts,
  GRADE_COLORS,
  RISK_LEVELS,
} from "../api";
import { SegmentBar, BarList, StageFlow } from "../components/charts.jsx";
import usePullToRefresh from "../lib/usePullToRefresh.js";
import GradeBadge from "../components/GradeBadge.jsx";
import FacilityMap from "../components/FacilityMap.jsx";
import EmptyState from "../components/EmptyState.jsx";

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
  const [fGrade, setFGrade] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPart, setFPart] = useState("");
  const [query, setQuery] = useState("");
  const [parts, setParts] = useState([]);

  const load = useCallback(
    () =>
      Promise.all([
        getStats().then(setStats).catch(() => {}),
        getFacilities().then(setFacilities).catch(() => {}),
        getInspections().then(setInspections).catch(() => {}),
        getParts().then(setParts).catch(() => {}),
      ]),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const { pull, busy, threshold } = usePullToRefresh(load);

  const gradeDist = stats?.grade_distribution || {};

  // 조치 수준별 집계 (색은 3단계, 정확한 등급은 아래 목록에 표기)
  const levelSegments = RISK_LEVELS.map((lv) => ({
    key: lv.key,
    label: lv.label,
    color: lv.color,
    sub: lv.sub,
    value: lv.grades.reduce((a, g) => a + (gradeDist[g] || 0), 0),
  }));

  const DEFECT_KO = { crack: "균열", spalling: "박리·박락", rebar: "철근노출" };
  const defectRows = Object.entries(stats?.defect_distribution || {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k, label: DEFECT_KO[k] || k, value: v, color: "#3182f6" }));

  // 부위별 위험 현황 — 주요부재를 강조 (우리 판정 로직의 핵심)
  const structuralSet = new Set(parts.filter((p) => p.structural).map((p) => p.name));
  const partMap = {};
  inspections.forEach((i) => {
    const p = i.part || "미지정";
    if (!partMap[p]) partMap[p] = { total: 0, danger: 0 };
    partMap[p].total += 1;
    if (NEEDS_PRO.has(i.risk_grade)) partMap[p].danger += 1;
  });
  const partRows = Object.entries(partMap)
    .sort((a, b) => b[1].danger - a[1].danger || b[1].total - a[1].total)
    .map(([name, v]) => ({
      key: name,
      label: name,
      value: v.total,
      emphasis: structuralSet.has(name),
      color: v.danger ? "#c8102e" : "#12866b",
      note: v.danger
        ? `${v.danger}건이 정밀진단 대상`
        : "정밀진단 대상 없음",
    }));

  // 조치 진행 단계
  const stageCount = { "접수": 0, "진단 의뢰": 0, "조치 완료": 0 };
  inspections.forEach((i) => {
    stageCount[i.status || "접수"] = (stageCount[i.status || "접수"] || 0) + 1;
  });
  const stages = Object.entries(stageCount).map(([label, value]) => ({
    key: label,
    label,
    value,
  }));

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

  // 미조치 정밀진단 대상 (D·E인데 조치 완료가 아닌 것) — 관리자 경고
  const unresolved = inspections.filter(
    (i) => NEEDS_PRO.has(i.risk_grade) && (i.status || "접수") !== "조치 완료"
  ).length;

  // 재점검 기한 (초과 · 임박)
  const dueList = facilities
    .filter((f) => ["overdue", "soon"].includes(f.schedule?.status))
    .sort((a, b) => (a.schedule?.days_left ?? 0) - (b.schedule?.days_left ?? 0));

  // 최근 내역 필터
  const filtered = inspections.filter((i) => {
    if (fGrade && i.risk_grade !== fGrade) return false;
    if (fStatus && (i.status || "접수") !== fStatus) return false;
    if (fPart && (i.part || "미지정") !== fPart) return false;
    if (query) {
      const hay = `${i.facility_name || ""} ${i.part || ""} ${i.note || ""}`.toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  function exportCsv() {
    const head = ["번호", "시설물", "부위", "등급", "점수", "결함수", "조치상태", "메모", "점검일시"];
    const rows = filtered.map((i) => [
      i.id,
      i.facility_name || "",
      i.part || "미지정",
      i.risk_grade || "",
      i.risk_score ?? "",
      i.defect_count ?? "",
      i.status || "접수",
      (i.note || "").replace(/[\r\n]+/g, " "),
      i.created_at || "",
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    // 엑셀에서 한글이 깨지지 않도록 BOM 추가
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `점검이력_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="dashboard" style={{ transform: pull ? `translateY(${pull}px)` : undefined }}>
      {pull > 0 && (
        <div className="ptr" style={{ top: -pull }}>
          {busy ? "새로고침 중" : pull >= threshold ? "놓으면 새로고침" : "당겨서 새로고침"}
        </div>
      )}
      {unresolved > 0 && (
        <div className="alert-banner">
          미조치 정밀진단 대상이 <b>{unresolved}건</b> 있습니다. 우선 조치가 필요합니다.
        </div>
      )}

      {dueList.length > 0 && (
        <div className="due-banner">
          <div className="db-title">
            재점검 기한 안내 · {dueList.length}곳
          </div>
          <ul className="due-list">
            {dueList.map((f) => (
              <li key={f.id}>
                <Link to={`/facility/${f.id}`}>
                  <span className="due-name">{f.name}</span>
                  <span className={`due-chip ${f.schedule.status}`}>
                    {f.schedule.status === "overdue"
                      ? `기한 ${-f.schedule.days_left}일 초과`
                      : `${f.schedule.days_left}일 남음`}
                  </span>
                  <span className="muted">
                    {f.latest_grade}등급 · {f.schedule.due_date}까지
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="dash-head">
        <h2 className="page-title">관리 대시보드</h2>
        <Link className="action-btn primary-tone" to="/report">
          점검 리포트 작성
        </Link>
      </div>

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

      <section className="card">
        <div className="list-head">
          <h3>조치 수준별 분포</h3>
          <span className="muted">
            등급별 {GRADE_ORDER.filter((g) => gradeDist[g]).map((g) => `${g} ${gradeDist[g]}`).join(" · ")}
          </span>
        </div>
        <SegmentBar segments={levelSegments} total={stats?.total_inspections} />
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>시설물 위치 · 안전등급</h3>
          <FacilityMap facilities={facilities} />
        </div>
        <div className="card">
          <h3>부위별 점검 현황</h3>
          <p className="muted chart-sub">
            주요부재의 손상은 건물 전체 안전에 영향을 줍니다.
          </p>
          <BarList rows={partRows} />
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>조치 진행 현황</h3>
          <p className="muted chart-sub">접수에서 조치 완료까지의 처리 단계입니다.</p>
          <StageFlow stages={stages} total={inspections.length} />

          <h3 style={{ marginTop: 22 }}>결함 종류</h3>
          <BarList rows={defectRows} unit="개" />
        </div>
        <div className="card">
          <h3>정밀진단 우선 대상 (D·E)</h3>
          {priority.length ? (
            <ol className="priority-list">
              {priority.map((i) => {
                const u = i.risk?.urgency
                  ? { text: i.risk.urgency, cls: URGENCY_BY_GRADE[i.risk_grade]?.cls || "later" }
                  : URGENCY_BY_GRADE[i.risk_grade] || { text: "-", cls: "later" };
                return (
                  <li key={i.id}>
                    <Link to={`/inspection/${i.id}`}>
                      <GradeBadge grade={i.risk_grade} />
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
            <EmptyState
              compact
              title="정밀진단 대상이 없습니다"
              desc="현재 등록된 점검 결과는 모두 자가점검으로 관리 가능한 상태입니다."
            />
          )}
        </div>
      </section>

      <section className="card">
          <div className="list-head">
            <h3>점검 내역</h3>
            <button className="action-btn" onClick={exportCsv} disabled={!filtered.length}>
              엑셀 내려받기
            </button>
          </div>

          <div className="filters no-print">
            <input
              type="search"
              placeholder="시설물·부위·메모 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={fGrade} onChange={(e) => setFGrade(e.target.value)}>
              <option value="">등급 전체</option>
              {GRADE_ORDER.map((g) => (
                <option key={g} value={g}>
                  {g}등급
                </option>
              ))}
            </select>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">상태 전체</option>
              <option>접수</option>
              <option>진단 의뢰</option>
              <option>조치 완료</option>
            </select>
            <select value={fPart} onChange={(e) => setFPart(e.target.value)}>
              <option value="">부위 전체</option>
              {[...new Set(inspections.map((i) => i.part || "미지정"))].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            {(fGrade || fStatus || fPart || query) && (
              <button
                className="action-btn"
                onClick={() => {
                  setFGrade("");
                  setFStatus("");
                  setFPart("");
                  setQuery("");
                }}
              >
                초기화
              </button>
            )}
            <span className="muted filter-count">
              {filtered.length}건 / 전체 {inspections.length}건
            </span>
          </div>

          <table className="table inspections">
            <thead>
              <tr>
                <th>#</th>
                <th>시설물</th>
                <th>등급</th>
                <th>상태</th>
                <th>일시</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 12).map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link to={`/inspection/${i.id}`}>{i.id}</Link>
                  </td>
                  <td>
                    {i.facility_id ? (
                      <Link to={`/facility/${i.facility_id}`}>{i.facility_name}</Link>
                    ) : (
                      i.facility_name || "-"
                    )}
                  </td>
                  <td>
                    <GradeBadge grade={i.risk_grade} />
                  </td>
                  <td>
                    <span
                      className={`status-chip sm ${
                        { "접수": "s0", "진단 의뢰": "s1", "조치 완료": "s2" }[i.status || "접수"]
                      }`}
                    >
                      {i.status || "접수"}
                    </span>
                  </td>
                  <td className="muted">{(i.created_at || "").slice(5, 16)}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan="5">
                    <EmptyState
                      compact
                      title={
                        inspections.length
                          ? "조건에 맞는 점검이 없습니다"
                          : "아직 점검 기록이 없습니다"
                      }
                      desc={
                        inspections.length
                          ? "검색어나 필터를 바꿔 보세요."
                          : "현장 점검에서 첫 사진을 올려보세요."
                      }
                      actionTo={inspections.length ? undefined : "/capture"}
                      actionLabel="첫 점검 시작하기"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </section>
    </div>
  );
}
