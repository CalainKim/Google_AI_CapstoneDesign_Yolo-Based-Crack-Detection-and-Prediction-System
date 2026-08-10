// AI 서버 주소.
// 기본은 빈 문자열 = 같은 출처. 개발 서버가 /api 를 8000 포트로 중계하므로
// 포트를 하나만 열면 되고, IP가 바뀌거나 외부 터널을 거쳐도 그대로 동작한다.
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function getHealth() {
  const r = await fetch(`${API_BASE}/api/health`);
  return r.json();
}

export async function getFacilities() {
  const r = await fetch(`${API_BASE}/api/facilities`);
  return r.json();
}

export async function getStats() {
  const r = await fetch(`${API_BASE}/api/stats`);
  return r.json();
}

export async function getInspections(grade, facilityId) {
  const url = new URL(`${API_BASE}/api/inspections`);
  if (grade) url.searchParams.set("grade", grade);
  if (facilityId) url.searchParams.set("facility_id", facilityId);
  const r = await fetch(url);
  return r.json();
}

export async function createFacility({ name, type }) {
  const r = await fetch(`${API_BASE}/api/facilities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, type }),
  });
  if (!r.ok) throw new Error("시설물 등록 실패");
  return r.json();
}

export async function setInspectionStatus(id, status) {
  const r = await fetch(`${API_BASE}/api/inspections/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) throw new Error("상태 변경 실패");
  return r.json();
}

export async function getInspection(id) {
  const r = await fetch(`${API_BASE}/api/inspections/${id}`);
  if (!r.ok) throw new Error("점검 기록을 찾을 수 없습니다");
  return r.json();
}

export async function uploadInspection(file, facilityId, part, extra = {}) {
  const form = new FormData();
  form.append("image", file);
  if (facilityId) form.append("facility_id", facilityId);
  if (part) form.append("part", part);
  if (extra.note) form.append("note", extra.note);
  if (extra.lat != null) form.append("lat", extra.lat);
  if (extra.lng != null) form.append("lng", extra.lng);
  const r = await fetch(`${API_BASE}/api/inspections`, {
    method: "POST",
    body: form,
  });
  if (!r.ok) throw new Error("분석 요청 실패");
  return r.json();
}

export async function sendFeedback(id, feedback, actualGrade) {
  const r = await fetch(`${API_BASE}/api/inspections/${id}/feedback`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback, actual_grade: actualGrade || null }),
  });
  if (!r.ok) throw new Error("피드백 저장 실패");
  return r.json();
}

export async function saveNote(id, note) {
  const r = await fetch(`${API_BASE}/api/inspections/${id}/note`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  if (!r.ok) throw new Error("메모 저장 실패");
  return r.json();
}

export async function updateFacility(id, { name, type }) {
  const r = await fetch(`${API_BASE}/api/facilities/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, type }),
  });
  if (!r.ok) throw new Error("시설물 수정 실패");
  return r.json();
}

export async function deleteFacility(id) {
  const r = await fetch(`${API_BASE}/api/facilities/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("시설물 삭제 실패");
  return r.json();
}

export async function getParts() {
  const r = await fetch(`${API_BASE}/api/parts`);
  return r.json();
}

export async function getFacilityAssessment(facilityId) {
  const r = await fetch(`${API_BASE}/api/facilities/${facilityId}/assessment`);
  if (!r.ok) throw new Error("종합 판정을 불러오지 못했습니다");
  return r.json();
}

export function imageUrl(id) {
  return `${API_BASE}/api/inspections/${id}/image`;
}

// 안전등급 색상.
// 색은 '조치 수준' 3단계를 나타내고, 정확한 등급은 배지의 문자가 알려준다.
// (5개 등급을 색만으로 구분하면 색각 이상에서 인접 등급이 뭉개진다 — 팔레트 검증 실패)
//   양호(A·B) 자가점검 / 주의(C) 보수 권장 / 위험(D·E) 정밀진단
export const GRADE_COLORS = {
  A: "#12866b",
  B: "#12866b",
  C: "#c08a00",
  D: "#c8102e",
  E: "#96061f",
};

// 조치 수준 (범례·집계용)
export const RISK_LEVELS = [
  { key: "safe", label: "양호", sub: "자가점검 관리", color: "#12866b", grades: ["A", "B"] },
  { key: "watch", label: "주의", sub: "보수 계획 권장", color: "#c08a00", grades: ["C"] },
  { key: "danger", label: "위험", sub: "정밀진단 필요", color: "#c8102e", grades: ["D", "E"] },
];
