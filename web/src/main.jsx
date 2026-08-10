import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Capture from "./pages/Capture.jsx";
import InspectionDetail from "./pages/InspectionDetail.jsx";
import FacilityDetail from "./pages/FacilityDetail.jsx";
import Settings from "./pages/Settings.jsx";
import Report from "./pages/Report.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import "./styles.css";
import { getFontScale, applyFontScale } from "./lib/settings.js";

// 저장된 글자 크기 적용
applyFontScale(getFontScale());

// 오프라인에서도 앱 화면이 뜨도록 서비스워커 등록
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* 서비스 소개는 앱 셸(상단바·탭바) 밖에서 전체 화면으로 */}
        <Route path="/intro" element={<Onboarding />} />
        <Route path="/" element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="capture" element={<Capture />} />
          <Route path="settings" element={<Settings />} />
          <Route path="report" element={<Report />} />
          <Route path="inspection/:id" element={<InspectionDetail />} />
          <Route path="facility/:id" element={<FacilityDetail />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
