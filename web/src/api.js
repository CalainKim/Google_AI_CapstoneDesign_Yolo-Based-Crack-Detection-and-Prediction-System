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

export async function getInspections(grade) {
  const url = new URL(`${API_BASE}/api/inspections`);
  if (grade) url.searchParams.set("grade", grade);
  const r = await fetch(url);
  return r.json();
}

export async function getInspection(id) {
  const r = await fetch(`${API_BASE}/api/inspections/${id}`);
  if (!r.ok) throw new Error("점검 기록을 찾을 수 없습니다");
  return r.json();
}

export async function uploadInspection(file, facilityId) {
  const form = new FormData();
  form.append("image", file);
  if (facilityId) form.append("facility_id", facilityId);
  const r = await fetch(`${API_BASE}/api/inspections`, {
    method: "POST",
    body: form,
  });
  if (!r.ok) throw new Error("분석 요청 실패");
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
