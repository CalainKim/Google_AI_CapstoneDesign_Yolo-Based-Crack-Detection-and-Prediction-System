import { buildSummary } from "../lib/inspection.js";

// 탐지+분류+등급을 자연어로 종합한 'AI 종합 소견' 카드 (Capture / Detail 공용)
export default function SummaryCard({ risk }) {
  const lines = buildSummary(risk);
  if (!lines.length) return null;
  const g = (risk?.risk_grade || "").toLowerCase();
  return (
    <div className={`summary-card grade-${g}`}>
      <div className="sc-title">AI 종합 소견</div>
      <ul className="sc-lines">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <p className="sc-caveat">
        ※ 1차 스크리닝 참고용입니다. 최종 판단은 전문 진단으로 확인하세요.
      </p>
    </div>
  );
}
