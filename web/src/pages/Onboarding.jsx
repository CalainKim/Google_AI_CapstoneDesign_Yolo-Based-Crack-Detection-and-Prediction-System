import { useNavigate } from "react-router-dom";
import { setOnboarded } from "../lib/settings.js";

const STEPS = [
  {
    n: "01",
    title: "찍는다",
    desc: "균열이 걱정되는 벽면을 스마트폰으로 촬영합니다. 별도 장비가 필요 없습니다.",
  },
  {
    n: "02",
    title: "판정한다",
    desc: "AI가 균열·박리·철근노출을 찾아내고 안전등급을 매깁니다.",
  },
  {
    n: "03",
    title: "선별한다",
    desc: "정밀진단이 필요한 곳만 골라내어 진단 예산을 꼭 필요한 곳에 씁니다.",
  },
];

export default function Onboarding() {
  const navigate = useNavigate();

  function start() {
    setOnboarded(true);
    navigate("/");
  }

  return (
    <div className="intro">
      <div className="intro-inner">
        <div className="intro-head">
          <span className="intro-logo">AI</span>
          <h1>안심점검</h1>
          <p className="intro-tagline">스마트폰으로 하는 시설물 안전 1차 점검</p>
        </div>

        <p className="intro-problem">
          정밀안전진단은 한 건에 수백만 원이 듭니다. 그래서 노후 상가와 다세대주택은
          점검 없이 방치되기 쉽습니다.
        </p>

        <ol className="intro-steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="is-num">{s.n}</span>
              <div>
                <b>{s.title}</b>
                <p>{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="intro-note">
          전문 진단을 대체하지 않습니다. 진단이 필요한 곳을 빠르게 가려내는 도구입니다.
        </p>

        <button className="primary intro-cta" onClick={start}>
          시작하기
        </button>
      </div>
    </div>
  );
}
