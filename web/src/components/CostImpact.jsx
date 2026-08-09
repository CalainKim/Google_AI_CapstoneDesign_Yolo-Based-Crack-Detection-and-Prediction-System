import { useEffect, useState } from "react";

// 정밀안전진단 1건당 비용 가정 (만원). 실제 수백만~수천만 원 수준에서 보수적으로 설정.
const COST_PER_DIAGNOSIS = 500;

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

const won = (man) =>
  man >= 10000
    ? `${(man / 10000).toFixed(man % 10000 === 0 ? 0 : 1)}억 원`
    : `${man.toLocaleString()}만 원`;

// 선별로 절감한 진단 비용 — 발표의 핵심 메시지
export default function CostImpact({ total, needsPro }) {
  const before = (total || 0) * COST_PER_DIAGNOSIS;
  const after = (needsPro || 0) * COST_PER_DIAGNOSIS;
  const saved = before - after;
  const rate = before ? Math.round((saved / before) * 100) : 0;
  const shown = useCountUp(saved);

  if (!total) return null;

  return (
    <section className="cost-impact">
      <div className="ci-main">
        <span className="ci-label">AI 선별로 절감한 진단 비용</span>
        <strong className="ci-value">{won(shown)}</strong>
        <span className="ci-sub">
          점검 {total}건 중 {needsPro}건만 정밀진단 대상으로 선별 · 절감률 {rate}%
        </span>
      </div>
      <div className="ci-compare">
        <div className="ci-row">
          <span>전수 진단 시</span>
          <b className="ci-before">{won(before)}</b>
        </div>
        <div className="ci-bar">
          <div className="ci-bar-fill" style={{ width: `${100 - rate}%` }} />
        </div>
        <div className="ci-row">
          <span>AI 선별 후</span>
          <b className="ci-after">{won(after)}</b>
        </div>
        <p className="ci-note">정밀안전진단 1건당 {COST_PER_DIAGNOSIS}만 원 가정</p>
      </div>
    </section>
  );
}
