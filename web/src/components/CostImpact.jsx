import { useEffect, useState } from "react";
import { getCostPerDiagnosis, formatWon } from "../lib/settings.js";

function useCountUp(target, duration = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!target) return setN(0);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setN(target);
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / duration, 1);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3)))); // ease-out
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
}

// 선별로 절감한 진단 비용 — 서비스의 핵심 가치
export default function CostImpact({ total, needsPro, unitCost }) {
  const cost = unitCost || getCostPerDiagnosis();
  const before = (total || 0) * cost;
  const after = (needsPro || 0) * cost;
  const saved = before - after;
  const rate = before ? Math.round((saved / before) * 100) : 0;
  const shown = useCountUp(saved);

  if (!total) {
    return (
      <section className="cost-impact empty">
        <div className="ci-main">
          <span className="ci-label">AI 선별로 절감한 진단 비용</span>
          <strong className="ci-value">0원</strong>
          <span className="ci-sub">점검 기록이 쌓이면 절감 효과가 계산됩니다.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="cost-impact">
      <div className="ci-main">
        <span className="ci-label">AI 선별로 절감한 진단 비용</span>
        <strong className="ci-value">{formatWon(shown)}</strong>
        <span className="ci-sub">
          점검 {total}건 중 {needsPro}건만 정밀진단 대상으로 선별 · 절감률 {rate}%
        </span>
      </div>
      <div className="ci-compare">
        <div className="ci-row">
          <span>전수 진단 시</span>
          <b className="ci-before">{formatWon(before)}</b>
        </div>
        <div className="ci-bar">
          <div className="ci-bar-fill" style={{ width: `${100 - rate}%` }} />
        </div>
        <div className="ci-row">
          <span>AI 선별 후</span>
          <b className="ci-after">{formatWon(after)}</b>
        </div>
        <p className="ci-note">정밀안전진단 1건당 {cost.toLocaleString()}만 원 기준</p>
      </div>
    </section>
  );
}
