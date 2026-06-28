import { useEffect, useRef } from "react";
import L from "leaflet";
import { GRADE_COLORS } from "../api";

// react-leaflet 대신 leaflet을 직접 사용 (버전 호환 문제 회피)
export default function FacilityMap({ facilities }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);

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
    const markers = [];
    facilities.forEach((f) => {
      if (f.lat == null || f.lng == null) return;
      const color = f.latest_grade ? GRADE_COLORS[f.latest_grade] : "#9aa";
      const marker = L.circleMarker([f.lat, f.lng], {
        radius: 10,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.9,
      }).addTo(map);
      marker.bindPopup(
        `<b>${f.name}</b><br/>${f.type || ""}<br/>최신 등급: ${
          f.latest_grade || "미점검"
        }`
      );
      markers.push(marker);
    });
    return () => markers.forEach((m) => map.removeLayer(m));
  }, [facilities]);

  return <div ref={containerRef} className="map" />;
}
