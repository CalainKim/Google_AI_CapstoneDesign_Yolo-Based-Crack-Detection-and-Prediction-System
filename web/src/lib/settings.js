// 사용자 설정 (localStorage 보관)
const KEY_COST = "ansim.costPerDiagnosis";
const KEY_ONBOARD = "ansim.onboarded";

export const DEFAULT_COST = 500; // 정밀안전진단 1건당 비용 (만원)

export function getCostPerDiagnosis() {
  const v = Number(localStorage.getItem(KEY_COST));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_COST;
}

export function setCostPerDiagnosis(man) {
  localStorage.setItem(KEY_COST, String(man));
}

export function isOnboarded() {
  return localStorage.getItem(KEY_ONBOARD) === "1";
}

export function setOnboarded(done = true) {
  if (done) localStorage.setItem(KEY_ONBOARD, "1");
  else localStorage.removeItem(KEY_ONBOARD);
}

// 만원 단위 → 읽기 쉬운 금액
export function formatWon(man) {
  if (!man) return "0원";
  return man >= 10000
    ? `${(man / 10000).toFixed(man % 10000 === 0 ? 0 : 1)}억 원`
    : `${man.toLocaleString()}만 원`;
}
