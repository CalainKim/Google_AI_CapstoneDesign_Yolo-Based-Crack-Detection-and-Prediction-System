import { useState } from "react";
import { sendFeedback } from "../api";

const GRADES = [
  { g: "A", label: "우수" },
  { g: "C", label: "보통" },
  { g: "D", label: "불량" },
];

// 판정 피드백 — 축적된 기록은 모델 재학습에 사용한다.
export default function FeedbackBox({ inspectionId, initial, initialGrade }) {
  const [state, setState] = useState(initial || null);
  const [picking, setPicking] = useState(false);
  const [actual, setActual] = useState(initialGrade || null);
  const [err, setErr] = useState("");

  async function submit(kind, grade) {
    try {
      await sendFeedback(inspectionId, kind, grade);
      setState(kind);
      setActual(grade || null);
      setPicking(false);
      setErr("");
    } catch (e) {
      setErr(e.message);
    }
  }

  if (state === "agree") {
    return (
      <div className="feedback done">
        판정이 정확하다고 응답해 주셨습니다. 모델 개선에 반영됩니다.
      </div>
    );
  }
  if (state === "disagree") {
    return (
      <div className="feedback done">
        실제 상태를 {actual ? `${actual}등급으로 ` : ""}알려주셨습니다. 재학습 데이터로
        활용해 판정 정확도를 높이겠습니다.
      </div>
    );
  }

  return (
    <div className="feedback no-print">
      <p className="fb-q">이 판정이 실제 상태와 맞나요?</p>
      {!picking ? (
        <div className="fb-actions">
          <button className="action-btn ok" onClick={() => submit("agree")}>
            정확합니다
          </button>
          <button className="action-btn" onClick={() => setPicking(true)}>
            실제와 다릅니다
          </button>
        </div>
      ) : (
        <div className="fb-actions">
          <span className="muted">실제 상태를 선택해 주세요</span>
          {GRADES.map(({ g, label }) => (
            <button key={g} className="action-btn" onClick={() => submit("disagree", g)}>
              {g} · {label}
            </button>
          ))}
          <button className="action-btn" onClick={() => setPicking(false)}>
            취소
          </button>
        </div>
      )}
      <p className="fb-note">응답은 판정 개선에만 사용되며 등급이 즉시 바뀌지 않습니다.</p>
      {err && <p className="error">{err}</p>}
    </div>
  );
}
