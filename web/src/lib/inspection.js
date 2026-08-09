// 점검 결과 표시 공통 로직 (Capture / InspectionDetail 공유)

// 탐지 결함 영문 → 한글
export const DEFECT_KO = {
  crack: "균열",
  spalling: "박리·박락",
  rebar: "철근노출",
};

// 결함 종류별 위험 성격 설명
export const DEFECT_NOTE = {
  rebar: "철근노출은 부식·단면 손실로 구조 내력 저하로 이어질 수 있는 심각한 신호",
  spalling: "박리·박락은 콘크리트가 떨어져 나온 열화 진행 신호",
  crack: "균열은 하중·열화로 생기는 대표 손상으로 폭·방향에 따라 위험도가 달라짐",
};

// 안전등급 의미 (시설물안전법 시행령 별표 8, 요약)
export const GRADE_MEANING = {
  A: "문제점이 없는 최상의 상태",
  B: "보조부재에 경미한 결함, 일부 보수 필요",
  C: "주요부재에 경미한 결함 — 보수·정밀점검 권장",
  D: "주요부재에 결함 — 긴급 보수·보강, 사용제한 여부 검토",
  E: "주요부재의 심각한 결함 — 즉각 사용금지, 보강·개축",
};

// 분류 확률 표시 순서·색
export const GROUP_ORDER = [
  { key: "우수", cls: "good" },
  { key: "보통", cls: "fair" },
  { key: "불량", cls: "poor" },
];

// 탐지 + 분류 + 등급을 읽어 '왜 이런 결과인지' 자연어 종합 소견 생성
export function buildSummary(risk) {
  if (!risk) return [];
  const summary = risk.defect_summary || {};
  const lines = [];

  // 1) 무엇이 탐지됐나
  const items = Object.entries(summary).map(([k, n]) => `${DEFECT_KO[k] || k} ${n}건`);
  lines.push(
    items.length
      ? `이 부위에서 ${items.join(", ")}이(가) 탐지되었습니다.`
      : "이 부위에서는 뚜렷한 결함이 탐지되지 않았습니다."
  );

  // 2) AI가 어떻게 판정했나 (분류 확률 최상위 그룹으로 표현)
  const probs = risk.grade_probs || {};
  const top = Object.entries(probs).sort((a, b) => b[1] - a[1])[0];
  if (risk.grade_source === "classifier" && top) {
    lines.push(
      `AI 분류 모델은 이 이미지를 '${top[0]}'(${Math.round(top[1] * 100)}%)으로 판정 → 안전등급 ${risk.risk_grade}(${risk.grade_label})에 해당합니다.`
    );
  } else {
    lines.push(`안전등급은 ${risk.risk_grade}(${risk.grade_label})로 평가되었습니다.`);
  }

  // 3) 탐지된 결함의 위험 성격
  const notes = Object.keys(summary)
    .map((k) => DEFECT_NOTE[k])
    .filter(Boolean);
  if (notes.length) lines.push(notes.join("; ") + ".");

  // 4) 그래서 무엇을 해야 하나
  lines.push(
    risk.needs_pro_inspection
      ? `→ ${risk.urgency ? risk.urgency + " " : ""}전문 정밀안전진단이 필요합니다.`
      : "→ 정기 자가점검으로 관리 가능한 상태입니다."
  );

  return lines;
}
