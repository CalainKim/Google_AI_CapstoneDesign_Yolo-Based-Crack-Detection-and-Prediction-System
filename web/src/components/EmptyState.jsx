import { Link } from "react-router-dom";

// 데이터가 없을 때의 안내 화면
export default function EmptyState({ title, desc, actionTo, actionLabel, compact }) {
  return (
    <div className={`empty-state${compact ? " compact" : ""}`}>
      <div className="es-mark" aria-hidden="true">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </div>
      <p className="es-title">{title}</p>
      {desc && <p className="es-desc">{desc}</p>}
      {actionTo && (
        <Link className="es-action" to={actionTo}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
