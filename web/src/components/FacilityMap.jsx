import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { GRADE_COLORS } from "../api";

// react-leaflet 대신 leaflet을 직접 사용 (버전 호환 문제 회피)
export default function FacilityMap({ facilities, myLocation }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    mapRef.current = L.map(containerRef.current).setView([37.55, 126.98], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(mapRef.current);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers = [];

    facilities.forEach((f) => {
      if (f.lat == null || f.lng == null) return;
      const color = f.latest_grade ? GRADE_COLORS[f.latest_grade] : "#8b95a1";
      const overdue = f.schedule?.status === "overdue";

      const marker = L.circleMarker([f.lat, f.lng], {
        radius: 11,
        color: "#fff",
        weight: 2.5,
        fillColor: color,
        fillOpacity: 0.95,
      }).addTo(map);

      // 재점검 기한이 지난 시설은 테두리 링으로 한 번 더 표시
      if (overdue) {
        layers.push(
          L.circleMarker([f.lat, f.lng], {
            radius: 17,
            color,
            weight: 2,
            fill: false,
            dashArray: "4 3",
          }).addTo(map)
        );
      }

      marker.bindTooltip(f.name, { direction: "top", offset: [0, -8] });
      marker.bindPopup(
        `<div class="map-pop">
           <b>${f.name}</b>
           <span>${f.type || ""}</span>
           <span>최신 등급 ${f.latest_grade || "미점검"}${
          f.schedule?.due_date ? ` · 재점검 ${f.schedule.due_date}` : ""
        }</span>
           <button data-fid="${f.id}">이력 보기</button>
         </div>`
      );
      // 팝업의 버튼으로 시설물 화면 이동
      marker.on("popupopen", (e) => {
        const btn = e.popup.getElement()?.querySelector("button[data-fid]");
        if (btn) btn.onclick = () => navigate(`/facility/${f.id}`);
      });
      layers.push(marker);
    });

    // 내 위치
    if (myLocation) {
      layers.push(
        L.circleMarker([myLocation.lat, myLocation.lng], {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: "#3182f6",
          fillOpacity: 1,
        })
          .addTo(map)
          .bindTooltip("현재 위치", { direction: "top", offset: [0, -6] })
      );
    }

    // 표시할 지점들에 맞춰 화면 이동
    const pts = facilities
      .filter((f) => f.lat != null && f.lng != null)
      .map((f) => [f.lat, f.lng]);
    if (myLocation) pts.push([myLocation.lat, myLocation.lng]);
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 15 });

    return () => layers.forEach((l) => map.removeLayer(l));
  }, [facilities, myLocation, navigate]);

  return <div ref={containerRef} className="map" />;
}
