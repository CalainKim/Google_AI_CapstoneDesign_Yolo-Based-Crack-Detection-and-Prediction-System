"""AI-Hub 'SOC 시설물 균열패턴 이미지' 라벨(JSON) → YOLO 형식 변환기.

AI-Hub 라벨은 폴리곤/폴리라인 좌표(JSON)다. 이를 YOLO 학습용으로 바꾼다.
- task=detect  : 폴리곤/폴리라인의 외접 사각형(bbox)으로 변환 (YOLO 박스 탐지)
- task=segment : 폴리곤 좌표를 정규화해 그대로 사용 (YOLO 분할, 균열 폭/면적에 유리)

사용 예:
  python aihub_to_yolo.py --labels-dir ./라벨 --images-dir ./원천 \
      --out-dir ./yolo_dataset --task detect --val-ratio 0.2

⚠️ AI-Hub 배포본마다 JSON 키 구조가 약간 다를 수 있습니다.
   실제 파일을 한두 개 열어보고, 아래 parse_annotations()가 잘 읽는지 확인하세요.
   (스크립트는 여러 구조를 방어적으로 처리하도록 작성되어 있습니다.)
"""
import argparse
import json
import random
import shutil
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

# 결함 10종 → 클래스 인덱스 (영문/한글 모두 인식)
CLASS_NAMES = [
    "crack", "reticular_crack", "detachment", "spalling", "efflorescence",
    "leak", "rebar", "material_separation", "exhilaration", "damage",
]
LABEL_TO_ID = {
    "crack": 0, "균열": 0,
    "reticular crack": 1, "reticular_crack": 1, "망상균열": 1,
    "detachment": 2, "박리": 2,
    "spalling": 3, "박락": 3,
    "efflorescence": 4, "백태": 4,
    "leak": 5, "누수": 5,
    "rebar": 6, "철근노출": 6,
    "material separation": 7, "material_separation": 7, "재료분리": 7,
    "exhilaration": 8, "들뜸": 8,
    "damage": 9, "파손": 9,
}

IMG_EXTS = [".jpg", ".jpeg", ".png", ".bmp"]


def label_to_id(label: str) -> Optional[int]:
    key = str(label).strip().lower()
    if key in LABEL_TO_ID:
        return LABEL_TO_ID[key]
    return LABEL_TO_ID.get(str(label).strip())


def _flatten_points(points: Any) -> List[Tuple[float, float]]:
    """points가 [[x,y],...] 또는 [x1,y1,x2,y2,...] 형태 모두 처리."""
    pts: List[Tuple[float, float]] = []
    if not points:
        return pts
    if isinstance(points[0], (list, tuple)):
        for p in points:
            if len(p) >= 2:
                pts.append((float(p[0]), float(p[1])))
    else:
        for i in range(0, len(points) - 1, 2):
            pts.append((float(points[i]), float(points[i + 1])))
    return pts


def parse_annotations(data: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], int, int]:
    """JSON 1개에서 (annotations, width, height) 추출.

    반환 annotations: [{label, points:[(x,y),...]}, ...]
    """
    # image 노드 찾기 (dict 또는 list)
    image_node = data.get("image", data)
    if isinstance(image_node, list):
        image_node = image_node[0] if image_node else {}

    width = int(image_node.get("width") or data.get("width") or 0)
    height = int(image_node.get("height") or data.get("height") or 0)

    raw_anns = (
        image_node.get("annotations")
        or data.get("annotations")
        or image_node.get("polygon")
        or image_node.get("polyline")
        or []
    )
    if isinstance(raw_anns, dict):
        raw_anns = [raw_anns]

    anns: List[Dict[str, Any]] = []
    for a in raw_anns:
        if not isinstance(a, dict):
            continue
        label = a.get("label") or a.get("name")
        points = a.get("points") or a.get("point") or a.get("coordinates")
        pts = _flatten_points(points)
        if label is None or len(pts) < 2:
            continue
        anns.append({"label": label, "points": pts})
    return anns, width, height


def to_yolo_detect(anns, w, h) -> List[str]:
    lines = []
    for a in anns:
        cid = label_to_id(a["label"])
        if cid is None:
            continue
        xs = [p[0] for p in a["points"]]
        ys = [p[1] for p in a["points"]]
        x1, x2, y1, y2 = min(xs), max(xs), min(ys), max(ys)
        cx = (x1 + x2) / 2 / w
        cy = (y1 + y2) / 2 / h
        bw = (x2 - x1) / w
        bh = (y2 - y1) / h
        if bw <= 0 or bh <= 0:
            continue
        lines.append(f"{cid} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")
    return lines


def to_yolo_segment(anns, w, h) -> List[str]:
    lines = []
    for a in anns:
        cid = label_to_id(a["label"])
        if cid is None or len(a["points"]) < 3:
            continue  # 분할은 최소 3점(면적) 필요
        coords = []
        for x, y in a["points"]:
            coords.append(f"{x / w:.6f}")
            coords.append(f"{y / h:.6f}")
        lines.append(f"{cid} " + " ".join(coords))
    return lines


def find_image(images_dir: Path, stem: str) -> Optional[Path]:
    for ext in IMG_EXTS:
        cand = images_dir / f"{stem}{ext}"
        if cand.exists():
            return cand
    # 하위 폴더까지 탐색 (AI-Hub는 다단계 폴더 구조)
    for ext in IMG_EXTS:
        hits = list(images_dir.rglob(f"{stem}{ext}"))
        if hits:
            return hits[0]
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels-dir", required=True, help="JSON 라벨 폴더")
    ap.add_argument("--images-dir", required=True, help="원천 이미지 폴더")
    ap.add_argument("--out-dir", required=True, help="출력 YOLO 데이터셋 폴더")
    ap.add_argument("--task", choices=["detect", "segment"], default="detect")
    ap.add_argument("--val-ratio", type=float, default=0.2)
    ap.add_argument("--limit", type=int, default=0, help="테스트용: 처리할 최대 개수(0=전체)")
    args = ap.parse_args()

    labels_dir = Path(args.labels_dir)
    images_dir = Path(args.images_dir)
    out_dir = Path(args.out_dir)

    for split in ("train", "val"):
        (out_dir / "images" / split).mkdir(parents=True, exist_ok=True)
        (out_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    json_files = list(labels_dir.rglob("*.json"))
    if args.limit:
        json_files = json_files[: args.limit]
    random.seed(42)
    random.shuffle(json_files)
    n_val = int(len(json_files) * args.val_ratio)

    ok, skip = 0, 0
    for i, jf in enumerate(json_files):
        split = "val" if i < n_val else "train"
        try:
            data = json.loads(jf.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[skip] JSON 읽기 실패 {jf.name}: {e}")
            skip += 1
            continue

        anns, w, h = parse_annotations(data)
        if w == 0 or h == 0:
            skip += 1
            continue

        # 라벨 파일명이 "이름.jpg.json" 형태일 수 있으므로 이미지 확장자를 제거
        stem = jf.stem
        low = stem.lower()
        for ext in IMG_EXTS:
            if low.endswith(ext):
                stem = stem[: -len(ext)]
                break

        img_path = find_image(images_dir, stem)
        if img_path is None:
            skip += 1
            continue

        if args.task == "detect":
            lines = to_yolo_detect(anns, w, h)
        else:
            lines = to_yolo_segment(anns, w, h)
        if not lines:
            skip += 1
            continue

        shutil.copy(img_path, out_dir / "images" / split / img_path.name)
        (out_dir / "labels" / split / f"{img_path.stem}.txt").write_text(
            "\n".join(lines), encoding="utf-8"
        )
        ok += 1
        if ok % 500 == 0:
            print(f"  진행: {ok}건 변환...")

    # data.yaml 생성
    yaml_text = (
        f"path: {out_dir.resolve()}\n"
        f"train: images/train\n"
        f"val: images/val\n"
        f"nc: {len(CLASS_NAMES)}\n"
        f"names: {CLASS_NAMES}\n"
    )
    (out_dir / "data.yaml").write_text(yaml_text, encoding="utf-8")

    print(f"\n완료! 변환 {ok}건, 건너뜀 {skip}건")
    print(f"data.yaml → {out_dir / 'data.yaml'}")


if __name__ == "__main__":
    main()
