import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getFacilities,
  getInspections,
  getFacilityAssessment,
  imageUrl,
  updateFacility,
  deleteFacility,
} from "../api";
import GradeBadge from "../components/GradeBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import FacilityQR from "../components/FacilityQR.jsx";

const STATUS_CLS = { "접수": "s0", "진단 의뢰": "s1", "조치 완료": "s2" };
const GRADE_RANK = { A: 1, B: 2, C: 3, D: 4, E: 5 };

// 시설물 단위 점검 이력 · 건물 종합 판정 · 재점검 비교
export default function FacilityDetail() {
  const { id } = useParams();
  const [facility, setFacility] = useState(null);
  const [items, setItems] = useState([]);
  const [assess, setAssess] = useState(null);
  const [compare, setCompare] = useState([]); // 비교 선택된 점검 id 2개
  const [editing, setEditing] = useState(null); // {name, type}
  const [showQR, setShowQR] = useState(false);
  const navigate = useNavigate();

  async function onSaveFacility(e) {
    e.preventDefault();
    await updateFacility(id, editing);
    setFacility({ ...facility, ...editing });
    setEditing(null);
  }

  async function onDeleteFacility() {
    if (!window.confirm("이 시설물을 삭제할까요? 점검 기록은 미지정 상태로 남습니다.")) return;
    await deleteFacility(id);
    navigate("/");
  }

  useEffect(() => {
    getFacilities().then((fs) =>
      setFacility(fs.find((f) => String(f.id) === String(id)) || null)
    );
    getInspections(null, id).then(setItems);
    getFacilityAssessment(id).then(setAssess).catch(() => {});
  }, [id]);

  const needsPro = items.filter((i) => ["D", "E"].includes(i.risk_grade));
  const pendingPro = needsPro.filter((i) => (i.status || "접수") !== "조치 완료");
  const trend = [...items].reverse(); // 과거 → 최신

  function toggleCompare(inspId) {
    setCompare((prev) =>
      prev.includes(inspId)
        ? prev.filter((x) => x !== inspId)
        : [...prev, inspId].slice(-2) // 최근 선택 2개 유지
    );
  }

  // 비교 대상 (과거, 최신 순으로 정렬)
  const pair = compare
    .map((cid) => items.find((i) => i.id === cid))
    .filter(Boolean)
    .sort((a, b) => a.id - b.id);

  let changeText = null;
  if (pair.length === 2) {
    const [before, after] = pair;
    const d = (GRADE_RANK[after.risk_grade] || 0) - (GRADE_RANK[before.risk_grade] || 0);
    const dd = (after.defect_count || 0) - (before.defect_count || 0);
    changeText =
      d > 0
        ? `등급이 ${before.risk_grade}에서 ${after.risk_grade}로 악화되었습니다. 결함이 진행 중일 가능성이 있어 정밀 확인이 필요합니다.`
        : d < 0
        ? `등급이 ${before.risk_grade}에서 ${after.risk_grade}로 개선되었습니다. 보수 효과가 반영된 것으로 보입니다.`
        : `등급은 ${after.risk_grade}로 유지되었습니다. 탐지 결함 수는 ${before.defect_count}개에서 ${after.defect_count}개로 ${
            dd > 0 ? `${dd}개 증가` : dd < 0 ? `${-dd}개 감소` : "변화 없음"
          }입니다.`;
  }

  return (
    <div className="detail">
      <Link className="link no-print" to="/">
        ← 대시보드로
      </Link>

      <div className="card facility-head">
        {editing ? (
          <form className="facility-edit no-print" onSubmit={onSaveFacility}>
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="시설물 이름"
            />
            <select
              value={editing.type}
              onChange={(e) => setEditing({ ...editing, type: e.target.value })}
            >
              {["상가건물", "다세대주택", "단독주택", "아파트", "복지시설", "옹벽", "지하차도", "기타"].map(
                (t) => (
                  <option key={t}>{t}</option>
                )
              )}
            </select>
            <button type="submit" className="action-btn primary-tone">
              저장
            </button>
            <button type="button" className="action-btn" onClick={() => setEditing(null)}>
              취소
            </button>
          </form>
        ) : (
          <div>
            <h2>{facility ? facility.name : `시설물 #${id}`}</h2>
            <p className="muted">
              {facility?.type}
              {facility?.schedule?.due_date && (
                <>
                  {" · 재점검 기한 "}
                  <span className={`due-chip ${facility.schedule.status}`}>
                    {facility.schedule.due_date}
                  </span>
                </>
              )}
            </p>
            {facility && (
              <div className="facility-actions no-print">
                <button className="action-btn primary-tone" onClick={() => setShowQR(true)}>
                  QR 라벨
                </button>
                <button
                  className="action-btn"
                  onClick={() => setEditing({ name: facility.name, type: facility.type })}
                >
                  정보 수정
                </button>
                <button className="action-btn danger-tone" onClick={onDeleteFacility}>
                  삭제
                </button>
              </div>
            )}
          </div>
        )}
        <div className="facility-kpis">
          <div className="kpi">
            <span className="kpi-label">최신 등급</span>
            <GradeBadge grade={items[0]?.risk_grade} />
          </div>
          <div className="kpi">
            <span className="kpi-label">누적 점검</span>
            <b>{items.length}건</b>
          </div>
          <div className="kpi">
            <span className="kpi-label">미조치 정밀진단</span>
            <b className={pendingPro.length ? "text-red" : ""}>{pendingPro.length}건</b>
          </div>
        </div>
      </div>

      {/* 건물 단위 종합 판정 */}
      {assess?.grade && (
        <div className={`card tone tone-${assess.grade.toLowerCase()}`}>
          <div className="result-head">
            <h3>건물 단위 종합 판정</h3>
            <GradeBadge grade={assess.grade} />
          </div>
          <p className="muted">
            부위별 점검 결과를 부재 중요도에 따라 종합한 결과입니다.
          </p>

          <div className={`pro-flag${assess.needs_pro_inspection ? "" : " ok"}`}>
            {assess.needs_pro_inspection
              ? "전문 정밀안전진단 필요"
              : "자가점검 관리 대상"}
          </div>

          <h4>부위별 최악 등급</h4>
          <div className="part-summary">
            {assess.part_summary.map((p) => (
              <Link
                key={p.part}
                to={`/inspection/${p.inspection_id}`}
                className={`part-row${p.structural ? " structural" : ""}`}
              >
                <span className="pr-name">
                  {p.part}
                  {p.structural && <em>주요부재</em>}
                </span>
                <span className="pr-note muted">{p.note}</span>
                <GradeBadge grade={p.grade} />
              </Link>
            ))}
          </div>

          <h4>판정 근거</h4>
          <ul className="reason-list">
            {assess.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>

          {assess.missing_structural?.length > 0 && (
            <p className="coverage-note">
              점검 범위 {Math.round(assess.coverage * 100)}% — 정확한 종합 판정을 위해
              미점검 부재({assess.missing_structural.join(", ")})도 촬영해 주세요.
            </p>
          )}
        </div>
      )}

      {trend.length > 1 && (
        <div className="card">
          <h3>등급 추이</h3>
          <div className="trend">
            {trend.map((i) => (
              <Link key={i.id} to={`/inspection/${i.id}`} className="trend-item">
                <GradeBadge grade={i.risk_grade} />
                <span className="muted">{(i.created_at || "").slice(5, 10)}</span>
              </Link>
            ))}
          </div>
          <p className="muted">
            과거에서 최신 순입니다. 등급이 나빠지는 추세면 결함이 진행 중일 수 있습니다.
          </p>
        </div>
      )}

      {/* 재점검 비교 */}
      {pair.length === 2 && (
        <div className="card compare-card">
          <h3>재점검 비교</h3>
          <div className="compare-grid">
            {pair.map((i, idx) => (
              <div key={i.id} className="cmp-col">
                <span className="cmp-label">{idx === 0 ? "이전" : "최근"}</span>
                <img src={imageUrl(i.id)} alt={`점검 ${i.id}`} />
                <div className="cmp-meta">
                  <GradeBadge grade={i.risk_grade} />
                  <span className="muted">
                    {i.part || "미지정"} · 결함 {i.defect_count}개
                  </span>
                  <span className="muted">{(i.created_at || "").slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="cmp-change">{changeText}</p>
          <button className="action-btn no-print" onClick={() => setCompare([])}>
            비교 해제
          </button>
        </div>
      )}

      <div className="card">
        <h3>점검 이력</h3>
        {items.length ? (
          <>
            <p className="muted no-print">
              두 건을 선택하면 사진과 등급을 나란히 비교할 수 있습니다.
            </p>
            <ul className="history">
              {items.map((i) => (
                <li key={i.id}>
                  <div className={`history-row${compare.includes(i.id) ? " picked" : ""}`}>
                    <label className="cmp-check no-print">
                      <input
                        type="checkbox"
                        checked={compare.includes(i.id)}
                        onChange={() => toggleCompare(i.id)}
                        aria-label="비교 대상 선택"
                      />
                    </label>
                    <Link to={`/inspection/${i.id}`} className="hist-link">
                      <GradeBadge grade={i.risk_grade} />
                      <span className="hist-main">
                        {i.part || "미지정"} · 결함 {i.defect_count}개
                        <span className="muted">
                          {" "}
                          · {(i.created_at || "").slice(0, 16).replace("T", " ")}
                        </span>
                      </span>
                      <span className={`status-chip sm ${STATUS_CLS[i.status || "접수"]}`}>
                        {i.status || "접수"}
                      </span>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState
            title="아직 점검 기록이 없습니다"
            desc="현장 점검에서 이 시설물을 선택해 촬영하면 이력이 쌓입니다."
            actionTo="/capture"
            actionLabel="점검 시작하기"
          />
        )}
      </div>

      {showQR && <FacilityQR facility={facility} onClose={() => setShowQR(false)} />}
    </div>
  );
}
