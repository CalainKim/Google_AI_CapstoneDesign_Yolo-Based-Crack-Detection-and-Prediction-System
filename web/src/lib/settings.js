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

// 글자 크기 (현장에서 작은 글씨가 안 보이는 경우 대비)
const KEY_FONT = "ansim.fontScale";
export const FONT_SCALES = [
  { key: "normal", label: "보통", value: 1 },
  { key: "large", label: "크게", value: 1.12 },
  { key: "xlarge", label: "더 크게", value: 1.25 },
];

export function getFontScale() {
  return localStorage.getItem(KEY_FONT) || "normal";
}

export function applyFontScale(key) {
  const s = FONT_SCALES.find((f) => f.key === key) || FONT_SCALES[0];
  document.documentElement.style.setProperty("--font-scale", s.value);
  localStorage.setItem(KEY_FONT, s.key);
}

// 최근 점검한 시설물 (빠른 선택용)
const KEY_RECENT = "ansim.recentFacilities";

export function getRecentFacilities() {
  try {
    return JSON.parse(localStorage.getItem(KEY_RECENT) || "[]");
  } catch {
    return [];
  }
}

export function pushRecentFacility(id) {
  if (!id) return;
  const list = [String(id), ...getRecentFacilities().filter((x) => x !== String(id))];
  localStorage.setItem(KEY_RECENT, JSON.stringify(list.slice(0, 4)));
}

// 두 좌표 사이 거리(m) — 가까운 시설물 추천용
export function distanceM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

// 만원 단위 → 읽기 쉬운 금액
export function formatWon(man) {
  if (!man) return "0원";
  return man >= 10000
    ? `${(man / 10000).toFixed(man % 10000 === 0 ? 0 : 1)}억 원`
    : `${man.toLocaleString()}만 원`;
}
