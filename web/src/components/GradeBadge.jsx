import { GRADE_COLORS } from "../api";

const LABELS = {
  A: "양호",
  B: "주의관찰",
  C: "보수필요",
  D: "긴급보수",
  E: "사용제한",
};

export default function GradeBadge({ grade, score }) {
  if (!grade) return <span className="grade-badge none">미점검</span>;
  return (
    <span
      className="grade-badge"
      style={{ background: GRADE_COLORS[grade] || "#888" }}
    >
      {grade} · {LABELS[grade]}
      {score != null && <em> {score}</em>}
    </span>
  );
}
