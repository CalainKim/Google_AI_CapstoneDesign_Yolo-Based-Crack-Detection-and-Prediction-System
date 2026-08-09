// 이미지 전체화면 확대 (탭하면 닫힘) — 모바일 시연용
export default function Lightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-label="이미지 확대">
      <img src={src} alt="확대 보기" />
      <span className="lightbox-hint">화면을 탭하면 닫힙니다</span>
    </div>
  );
}
