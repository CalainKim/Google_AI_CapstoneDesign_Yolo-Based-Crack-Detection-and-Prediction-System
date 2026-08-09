import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getHealth } from "./api";
import { isOnboarded } from "./lib/settings.js";

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" fill="currentColor" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="currentColor" opacity="0.45" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="currentColor" opacity="0.45" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="currentColor" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 8.5c0-1.1.9-2 2-2h1.6l1.2-1.8c.2-.3.5-.5.9-.5h4.6c.4 0 .7.2.9.5l1.2 1.8H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5Z"
        fill="currentColor"
        opacity="0.45"
      />
      <circle cx="12" cy="12.5" r="3.2" fill="currentColor" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3.5c.5 0 .9.3 1 .8l.2 1.3c.5.2 1 .4 1.4.7l1.2-.6c.4-.2.9-.1 1.2.3l1 1.7c.2.4.1.9-.2 1.2l-1 .8c.1.5.1 1 0 1.5l1 .8c.3.3.4.8.2 1.2l-1 1.7c-.3.4-.8.5-1.2.3l-1.2-.6c-.4.3-.9.5-1.4.7l-.2 1.3c-.1.5-.5.8-1 .8h-2c-.5 0-.9-.3-1-.8l-.2-1.3c-.5-.2-1-.4-1.4-.7l-1.2.6c-.4.2-.9.1-1.2-.3l-1-1.7c-.2-.4-.1-.9.2-1.2l1-.8c-.1-.5-.1-1 0-1.5l-1-.8c-.3-.3-.4-.8-.2-1.2l1-1.7c.3-.4.8-.5 1.2-.3l1.2.6c.4-.3.9-.5 1.4-.7l.2-1.3c.1-.5.5-.8 1-.8h2Z"
        fill="currentColor"
        opacity="0.45"
      />
      <circle cx="12" cy="12" r="2.8" fill="currentColor" />
    </svg>
  );
}

export default function App() {
  const [mock, setMock] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // 첫 방문이면 서비스 소개로 안내
  useEffect(() => {
    if (!isOnboarded() && location.pathname !== "/intro") {
      navigate("/intro", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    getHealth()
      .then((h) => setMock(h.mock_mode))
      .catch(() => setMock("error"));
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">AI</span>
          <div>
            <h1>안심점검</h1>
            <p>AI 시설물 안전 선별 서비스</p>
          </div>
        </div>
        <nav className="nav desktop-nav">
          <NavLink to="/" end>
            관리 대시보드
          </NavLink>
          <NavLink to="/capture">현장 점검</NavLink>
          <NavLink to="/settings">설정</NavLink>
        </nav>
        <div className="status">
          {mock === "error" && <span className="badge err">서버 연결 안됨</span>}
          {mock === true && <span className="badge warn">체험 모드</span>}
          {mock === false && <span className="badge ok">AI 연결됨</span>}
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="tabbar">
        <NavLink to="/" end>
          <IconHome />
          <span>대시보드</span>
        </NavLink>
        <NavLink to="/capture">
          <IconCamera />
          <span>현장 점검</span>
        </NavLink>
        <NavLink to="/settings">
          <IconSettings />
          <span>설정</span>
        </NavLink>
      </nav>
    </div>
  );
}
