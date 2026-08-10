import { GRADE_COLORS } from "../api";

export const GRADE_LABELS = {
  A: "양호",
  B: "주의관찰",
  C: "보수필요",
  D: "긴급보수",
  E: "사용제한",
};

/**
 * 안전등급 배지.
 * 기본은 등급 문자만 표시해 목록·표에서 줄바꿈 없이 정렬된다.
 * withLabel 을 주면 상세 화면처럼 여유가 있는 곳에서 등급명을 함께 보여준다.
 */
export default function GradeBadge({ grade, withLabel = false }) {
  if (!grade) return <span className="grade-badge none">미점검</span>;
  return (
    <span
      className={`grade-badge${withLabel ? " with-label" : ""}`}
      style={{ background: GRADE_COLORS[grade] || "#888" }}
      title={`${grade}등급 · ${GRADE_LABELS[grade] || ""}`}
    >
      {grade}
      {withLabel && <em>{GRADE_LABELS[grade]}</em>}
    </span>
  );
}
