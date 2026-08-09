// 점검 리포트 생성
//
// 현재: 점검 데이터를 규칙 기반으로 문장화한다.
// 향후: 동일한 입력(context)을 로컬 LLM에 넘겨 문장 생성만 교체한다.
//       서버에 /api/report 를 추가하고 generateReport 내부의 분기만 바꾸면 된다.
import { getCostPerDiagnosis, formatWon } from "./settings.js";

const NEEDS_PRO = new Set(["D", "E"]);

// 리포트 입력 컨텍스트 (LLM 프롬프트로도 그대로 사용 가능한 형태)
export function buildContext({ stats, inspections, facilities }) {
  const list = inspections || [];
  const pro = list.filter((i) => NEEDS_PRO.has(i.risk_grade));
  const unresolved = pro.filter((i) => (i.status || "접수") !== "조치 완료");
  const cost = getCostPerDiagnosis();
  const total = stats?.total_inspections || list.length;
  const needsPro = stats?.triage?.needs_pro_inspection ?? pro.length;

  const statusCount = { "접수": 0, "진단 의뢰": 0, "조치 완료": 0 };
  list.forEach((i) => {
    statusCount[i.status || "접수"] = (statusCount[i.status || "접수"] || 0) + 1;
  });

  return {
    date: new Date().toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    total,
    needsPro,
    screenedOut: total - needsPro,
    savingRate: stats?.triage?.saving_rate ?? 0,
    savedCost: (total - needsPro) * cost,
    fullCost: total * cost,
    gradeDist: stats?.grade_distribution || {},
    defectDist: stats?.defect_distribution || {},
    facilityCount: (facilities || []).length,
    statusCount,
    priority: pro
      .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
      .slice(0, 5)
      .map((i) => ({
        id: i.id,
        facility: i.facility_name || "미지정 시설",
        grade: i.risk_grade,
        status: i.status || "접수",
        defects: i.defect_count,
        at: (i.created_at || "").slice(0, 10),
      })),
    unresolvedCount: unresolved.length,
  };
}

const DEFECT_KO = { crack: "균열", spalling: "박리·박락", rebar: "철근노출" };

// 규칙 기반 문장화 (LLM 교체 지점)
function composeSections(c) {
  const topDefect = Object.entries(c.defectDist).sort((a, b) => b[1] - a[1])[0];
  const gradeSummary = ["A", "B", "C", "D", "E"]
    .filter((g) => c.gradeDist[g])
    .map((g) => `${g}등급 ${c.gradeDist[g]}건`)
    .join(", ");

  const sections = [
    {
      h: "점검 개요",
      p: `${c.date} 기준으로 등록된 시설물 ${c.facilityCount}곳에 대해 총 ${c.total}건의 점검이 수행되었습니다. 안전등급 분포는 ${gradeSummary || "집계 없음"}이며, 이 중 ${c.needsPro}건이 전문 정밀안전진단 대상으로 선별되었습니다.`,
    },
    {
      h: "선별 결과",
      p:
        c.needsPro > 0
          ? `정밀진단이 필요한 ${c.needsPro}건을 제외한 ${c.screenedOut}건은 자가점검으로 관리 가능한 상태로 판정되었습니다. 전수 진단 시 ${formatWon(c.fullCost)}이 소요되나, 선별을 통해 ${formatWon(c.savedCost)}의 진단 비용을 절감할 수 있습니다.`
          : `현재 정밀진단이 필요한 시설물은 없으며, 전체 ${c.total}건이 자가점검으로 관리 가능한 상태입니다.`,
    },
  ];

  if (c.priority.length) {
    sections.push({
      h: "우선 조치 대상",
      list: c.priority.map(
        (p) =>
          `${p.facility} — ${p.grade}등급, 결함 ${p.defects}개 (${p.at}, 현재 ${p.status})`
      ),
    });
  }

  sections.push({
    h: "조치 현황",
    p: `접수 ${c.statusCount["접수"]}건, 진단 의뢰 ${c.statusCount["진단 의뢰"]}건, 조치 완료 ${c.statusCount["조치 완료"]}건입니다.${
      c.unresolvedCount
        ? ` 정밀진단 대상 중 ${c.unresolvedCount}건이 아직 조치되지 않아 우선 처리가 필요합니다.`
        : " 정밀진단 대상은 모두 처리되었습니다."
    }`,
  });

  if (topDefect) {
    sections.push({
      h: "결함 경향",
      p: `탐지된 결함 중 ${DEFECT_KO[topDefect[0]] || topDefect[0]}이(가) ${topDefect[1]}건으로 가장 많이 발생했습니다. 동일 유형이 반복되는 시설물은 재점검 주기를 단축하는 것이 바람직합니다.`,
    });
  }

  sections.push({
    h: "권고 사항",
    p:
      c.unresolvedCount > 0
        ? `미조치 상태인 정밀진단 대상 ${c.unresolvedCount}건에 대해 전문 진단 기관 의뢰를 우선 진행하시기 바랍니다. 자가점검 관리 대상은 6개월 주기로 재촬영하여 등급 변화를 확인하시기 바랍니다.`
        : `현재 긴급 조치가 필요한 사항은 없습니다. 자가점검 관리 대상은 6개월 주기로 재촬영하여 등급 변화를 확인하시기 바랍니다.`,
  });

  return sections;
}

/**
 * 리포트 생성.
 * @param {object} data { stats, inspections, facilities }
 * @returns {Promise<{title, meta, sections, engine}>}
 */
export async function generateReport(data) {
  const c = buildContext(data);

  // 로컬 LLM 연동 지점.
  // 서버에 /api/report 가 준비되면 아래 주석을 해제하고 컨텍스트를 그대로 전달한다.
  //
  // try {
  //   const r = await fetch(`${API_BASE}/api/report`, {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify(c),
  //   });
  //   if (r.ok) return { ...(await r.json()), engine: "로컬 LLM" };
  // } catch { /* 실패 시 규칙 기반으로 폴백 */ }

  return {
    title: `시설물 안전점검 리포트`,
    meta: `${c.date} · 점검 ${c.total}건 · 정밀진단 대상 ${c.needsPro}건`,
    sections: composeSections(c),
    engine: "규칙 기반",
  };
}
