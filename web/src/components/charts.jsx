// 대시보드 차트 — 디자인 시스템(라이트 테마)에 맞춰 순수 HTML/CSS로 구성.
// 색은 조치 수준(양호/주의/위험) 3단계만 사용하고, 세부 값은 항상 라벨로 표기한다.

/** 가로 스택 세그먼트 바 — 부분과 전체 (segments: [{key,label,value,color,sub}]) */
export function SegmentBar({ segments, total, unit = "건" }) {
  const sum = total || segments.reduce((a, s) => a + s.value, 0);
  if (!sum) return <p className="muted">집계할 데이터가 없습니다.</p>;

  return (
    <div className="segbar-wrap">
      <div className="segbar" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}${unit}`).join(", ")}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.key}
              className="segbar-part"
              style={{ width: `${(s.value / sum) * 100}%`, background: s.color }}
              title={`${s.label} ${s.value}${unit} (${Math.round((s.value / sum) * 100)}%)`}
            >
              {s.value / sum > 0.1 && <span>{s.value}</span>}
            </div>
          ))}
      </div>
      <ul className="segbar-legend">
        {segments.map((s) => (
          <li key={s.key}>
            <i style={{ background: s.color }} />
            <span className="sl-label">{s.label}</span>
            <b>
              {s.value}
              {unit}
            </b>
            {s.sub && <span className="sl-sub muted">{s.sub}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 가로 막대 목록 — 크기 비교 (rows: [{key,label,value,color,note,emphasis}]) */
export function BarList({ rows, unit = "건", max }) {
  if (!rows.length) return <p className="muted">집계할 데이터가 없습니다.</p>;
  const top = max || Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.key} className={r.emphasis ? "emph" : ""}>
          <div className="bl-head">
            <span className="bl-label">
              {r.label}
              {r.emphasis && <em>주요부재</em>}
            </span>
            <b className="bl-value">
              {r.value}
              {unit}
            </b>
          </div>
          <div className="bl-track">
            <div
              className="bl-fill"
              style={{ width: `${(r.value / top) * 100}%`, background: r.color || "#3182f6" }}
              title={`${r.label} ${r.value}${unit}`}
            />
          </div>
          {r.note && <span className="bl-note muted">{r.note}</span>}
        </li>
      ))}
    </ul>
  );
}

/** 단계 진행 — 접수 → 진단 의뢰 → 조치 완료 (stages: [{key,label,value}]) */
export function StageFlow({ stages, total }) {
  const sum = total || stages.reduce((a, s) => a + s.value, 0);
  if (!sum) return <p className="muted">집계할 데이터가 없습니다.</p>;
  // 단계는 순서가 있으므로 한 색상의 명도 단계(ordinal)를 쓴다.
  const tones = ["#a8c7f5", "#5b9bf8", "#1b64da"];

  return (
    <ol className="stageflow">
      {stages.map((s, i) => (
        <li key={s.key}>
          <div className="sf-top">
            <span className="sf-label">{s.label}</span>
            <b>{s.value}건</b>
          </div>
          <div className="sf-track">
            <div
              className="sf-fill"
              style={{ width: `${(s.value / sum) * 100}%`, background: tones[i] }}
              title={`${s.label} ${s.value}건 (${Math.round((s.value / sum) * 100)}%)`}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
