import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getHealth } from "./api";

export default function App() {
  const [mock, setMock] = useState(null);

  useEffect(() => {
    getHealth()
      .then((h) => setMock(h.mock_mode))
      .catch(() => setMock("error"));
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🛰️</span>
          <div>
            <h1>AI 균열 탐지 · 저비용 시설물 안전점검</h1>
            <p>스마트폰 자가점검 · 유지보수 우선순위 선별 시스템</p>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            관리자 대시보드
          </NavLink>
          <NavLink to="/capture">현장 촬영</NavLink>
        </nav>
        <div className="status">
          {mock === "error" && <span className="badge err">서버 연결 안됨</span>}
          {mock === true && <span className="badge warn">목(Mock) 모드</span>}
          {mock === false && <span className="badge ok">AI 모델 연결됨</span>}
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
