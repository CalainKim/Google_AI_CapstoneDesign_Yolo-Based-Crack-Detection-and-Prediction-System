// AI 서버 주소. 휴대폰에서 접속할 때는 PC의 실제 IP로 바꾸세요. (예: http://192.168.0.10:8000)
export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8000";

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

// 위험등급 색상 (대시보드/배지 공통)
export const GRADE_COLORS = {
  A: "#2e9e5b",
  B: "#7cb342",
  C: "#f9a825",
  D: "#fb8c00",
  E: "#e53935",
};
