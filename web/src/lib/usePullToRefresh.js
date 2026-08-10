import { useEffect, useState } from "react";

// 당겨서 새로고침 — 모바일에서 맨 위에서 아래로 당기면 데이터를 다시 불러온다.
// 데스크톱이나 스크롤 중에는 동작하지 않는다.
const THRESHOLD = 70;

export default function usePullToRefresh(onRefresh) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let startY = null;

    const onStart = (e) => {
      if (window.scrollY > 0 || busy) return;
      startY = e.touches[0].clientY;
    };
    const onMove = (e) => {
      if (startY == null) return;
      const d = e.touches[0].clientY - startY;
      if (d > 0 && window.scrollY === 0) {
        setPull(Math.min(d * 0.5, THRESHOLD + 24)); // 저항감
      } else {
        startY = null;
        setPull(0);
      }
    };
    const onEnd = async () => {
      if (startY == null) return;
      const reached = pull >= THRESHOLD;
      startY = null;
      if (reached) {
        setBusy(true);
        setPull(THRESHOLD);
        try {
          await onRefresh();
        } finally {
          setBusy(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pull, busy, onRefresh]);

  return { pull, busy, threshold: THRESHOLD };
}
