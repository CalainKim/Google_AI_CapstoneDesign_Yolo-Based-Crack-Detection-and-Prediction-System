import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

// 시설물 QR — 출입구에 붙여두고 스캔하면 그 시설물 점검 화면으로 바로 진입.
// 실내·지하처럼 위치 추천이 어려운 곳에서도 확실하게 동작한다.
export default function FacilityQR({ facility, onClose }) {
  const canvasRef = useRef(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!facility) return;
    const link = `${window.location.origin}/capture?facility=${facility.id}`;
    setUrl(link);
    QRCode.toCanvas(canvasRef.current, link, {
      width: 220,
      margin: 1,
      color: { dark: "#191f28", light: "#ffffff" },
    }).catch(() => {});
  }, [facility]);

  if (!facility) return null;

  async function download() {
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = `QR_${facility.name}.png`;
    a.click();
  }

  return (
    <div className="qr-overlay" onClick={onClose}>
      <div className="qr-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="qr-print">
          <p className="qr-brand">안심점검</p>
          <canvas ref={canvasRef} />
          <p className="qr-name">{facility.name}</p>
          <p className="qr-type">{facility.type}</p>
          <p className="qr-guide">스캔하면 이 시설물의 점검 화면이 열립니다</p>
        </div>
        <p className="qr-url muted">{url}</p>
        <div className="qr-actions no-print">
          <button className="action-btn primary-tone" onClick={() => window.print()}>
            라벨 인쇄
          </button>
          <button className="action-btn" onClick={download}>
            이미지 저장
          </button>
          <button className="action-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
