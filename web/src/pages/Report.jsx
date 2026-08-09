import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getStats, getInspections, getFacilities } from "../api";
import { generateReport } from "../lib/report.js";
import EmptyState from "../components/EmptyState.jsx";

// 생성 단계 (진행 상황을 사용자에게 보여주기 위함)
const PHASES = [
  "점검 데이터 수집",
  "안전등급 집계",
  "우선 조치 대상 선별",
  "문장 생성",
];

export default function Report() {
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [phase, setPhase] = useState(-1);
  const [revealed, setRevealed] = useState(0); // 섹션 순차 공개
  const timers = useRef([]);

  useEffect(() => {
    Promise.all([getStats(), getInspections(), getFacilities()])
      .then(([stats, inspections, facilities]) =>
        setData({ stats, inspections, facilities })
      )
      .catch(() => setData({ stats: null, inspections: [], facilities: [] }));
    return () => timers.current.forEach(clearTimeout);
  }, []);

  async function run() {
    setReport(null);
    setRevealed(0);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    // 생성 단계 표시
    PHASES.forEach((_, i) => {
      timers.current.push(setTimeout(() => setPhase(i), i * 420));
    });

    const [r] = await Promise.all([
      generateReport(data),
      new Promise((res) => setTimeout(res, PHASES.length * 420 + 200)),
    ]);
    setPhase(-1);
    setReport(r);

    // 섹션을 순차적으로 공개해 생성되는 느낌을 준다
    r.sections.forEach((_, i) => {
      timers.current.push(setTimeout(() => setRevealed(i + 1), 160 * (i + 1)));
    });
  }

  const generating = phase >= 0;
  const hasData = (data?.inspections || []).length > 0;

  return (
    <div className="report-page">
      <div className="report-top no-print">
        <div>
          <h2 className="page-title">점검 리포트</h2>
          <p className="muted">
            등록된 점검 결과를 종합해 관리용 보고서를 자동 작성합니다.
          </p>
        </div>
        <div className="toolbar-actions">
          {report && (
            <button className="action-btn" onClick={() => window.print()}>
              인쇄
            </button>
          )}
          <button
            className="action-btn primary-tone"
            onClick={run}
            disabled={!data || generating || !hasData}
          >
            {generating ? "작성 중" : report ? "다시 작성" : "리포트 작성"}
          </button>
        </div>
      </div>

      {!hasData && data && (
        <div className="card">
          <EmptyState
            title="작성할 점검 기록이 없습니다"
            desc="현장 점검을 먼저 진행하면 리포트를 만들 수 있습니다."
            actionTo="/capture"
            actionLabel="점검 시작하기"
          />
        </div>
      )}

      {generating && (
        <div className="card gen-card">
          <div className="spinner" />
          <ul className="gen-phases">
            {PHASES.map((p, i) => (
              <li key={p} className={i <= phase ? "done" : ""}>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report && !generating && (
        <article className="card report-doc">
          <header className="rd-head">
            <h3>{report.title}</h3>
            <p className="muted">{report.meta}</p>
          </header>

          {report.sections.map((s, i) => (
            <section
              key={s.h}
              className={`rd-section${i < revealed ? " show" : ""}`}
            >
              <h4>{s.h}</h4>
              {s.p && <p>{s.p}</p>}
              {s.list && (
                <ul className="rd-list">
                  {s.list.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <footer className="rd-foot">
            <p>
              본 리포트는 AI 1차 선별 결과를 정리한 것으로, 정밀안전진단 결과를
              대체하지 않습니다. 최종 판단은 전문 진단 기관의 확인이 필요합니다.
            </p>
            <p className="rd-engine">문장 생성: {report.engine}</p>
          </footer>
        </article>
      )}

      {!report && !generating && hasData && (
        <div className="card">
          <EmptyState
            title="아직 작성된 리포트가 없습니다"
            desc="리포트 작성을 누르면 현재까지의 점검 결과를 종합합니다."
          />
        </div>
      )}

      <p className="muted no-print report-back">
        <Link className="link" to="/">
          ← 대시보드로
        </Link>
      </p>
    </div>
  );
}
