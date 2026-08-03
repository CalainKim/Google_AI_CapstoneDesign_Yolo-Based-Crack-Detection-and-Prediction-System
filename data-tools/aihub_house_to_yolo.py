"""AI-Hub '서울시 노후 주택 균열 데이터' 라벨(JSON) → YOLO 형식 변환기.

이 데이터셋은 SOC 균열패턴(aihub_to_yolo.py)과 JSON 구조가 다르다.
구조 예시:
{
  "Raw_Data_Info":     { "Resolution": [1440, 1080], "Structure": "M", "Equipment": "일반", ... },
  "Source_Data_Info":  { "Source_Data_ID": "S-...", "Large_ID": "M", ... },
  "Learning_Data_Info":{ "Json_Data_ID": "S-...",
      "Annotations": [ {"Class_ID": "3", "Type": "polygon", "polygon": [x,y,x,y,...]},
                       {"Class_ID": "1", "Type": "bbox",    "bbox": [x,y,w,h]}, ... ] }
}
- 좌표 키 이름 = "Type" 값과 동일("polygon" 또는 "bbox").
- 폭/높이 = Raw_Data_Info.Resolution = [width, height].

우리는 구조 안전 트리아지에 필요한 **구조물 3종(균열/박리·박락/철근노출)** 만 쓰고,
거주성 항목(대지/마감/생활/창호)은 제외한다.

★ 결함종류·등급(우수/보통/불량)은 Class_ID보다 **폴더 경로**로 추론하는 것이 안전하다.
  (AI-Hub는 보통 `.../구조물(균열)/불량/....json` 처럼 점검유형·등급이 폴더로 나뉜다.)
  경로에 키워드가 없으면 --defect-from classid + CLASS_ID_MAP 로 대체.

부가 산출물: `grades.json` — {이미지파일명: "우수|보통|불량"} 매니페스트.
  → Colab 학습 후 우리 A~E 등급 출력과 대조해 **등급 confusion matrix(실증)** 를 만든다.

사용 예:
  # 0) 먼저 구조 확인 (경로/JSON/클래스 분포 출력)
  python aihub_house_to_yolo.py --labels-dir ./라벨링데이터 --images-dir ./원천데이터 --inspect

  # 1) 변환 (구조물 3종, (결함×등급) 셀당 최대 800장 균형 샘플)
  python aihub_house_to_yolo.py --labels-dir ./라벨링데이터 --images-dir ./원천데이터 \
      --out-dir ./house_yolo --defect-from path --max-per-cell 800 --val-ratio 0.2
"""
import argparse
import json
import random
import shutil
from collections import Counter, defaultdict
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

from PIL import Image  # 실제 이미지 크기로 정규화 (JSON Resolution은 가로세로가 뒤바뀐 경우가 많음)

# 우리가 학습할 구조물 3종 (거주성 항목은 제외)
CLASS_NAMES = ["crack", "spalling", "rebar"]
CLASS_INDEX = {name: i for i, name in enumerate(CLASS_NAMES)}

# 경로/키워드 → 결함 클래스. 폴더명·파일명에 이 키워드가 있으면 매칭.
DEFECT_KEYWORDS = [
    ("철근", "rebar"), ("rebar", "rebar"),
    ("박리", "spalling"), ("박락", "spalling"), ("spall", "spalling"), ("detach", "spalling"),
    ("균열", "crack"), ("크랙", "crack"), ("crack", "crack"),
]
# 제외할 거주성 점검유형 키워드 (경로에 있으면 스킵)
EXCLUDE_KEYWORDS = ["대지", "마감", "생활", "창호"]

# 경로/키워드 → 등급
GRADE_KEYWORDS = [("우수", "우수"), ("보통", "보통"), ("불량", "불량")]

# --defect-from classid 로 쓸 때만 사용. 실제 매핑은 데이터 설명서로 확정할 것.
# (기본값은 추정 placeholder — --inspect 로 Class_ID 분포 확인 후 채우세요.)
CLASS_ID_MAP: Dict[str, str] = {
    # "1": "crack", "2": "spalling", "3": "rebar",
}

IMG_EXTS = [".jpg", ".jpeg", ".png", ".bmp"]


def _match_keyword(text: str, table) -> Optional[str]:
    low = text.lower()
    for kw, val in table:
        if kw.lower() in low:
            return val
    return None


def infer_defect_from_path(path: Path) -> Optional[str]:
    s = str(path)
    for ex in EXCLUDE_KEYWORDS:
        if ex in s:
            return None  # 거주성 항목 제외
    return _match_keyword(s, DEFECT_KEYWORDS)


def infer_grade_from_path(path: Path) -> Optional[str]:
    return _match_keyword(str(path), GRADE_KEYWORDS)


def parse_house_json(data: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], int, int]:
    """(annotations, width, height) 추출. annotations: [{class_id, type, points|bbox}]"""
    raw = data.get("Raw_Data_Info", {}) or {}
    res = raw.get("Resolution") or [0, 0]
    try:
        width, height = int(res[0]), int(res[1])
    except (ValueError, IndexError, TypeError):
        width = height = 0

    ldi = data.get("Learning_Data_Info", {}) or {}
    anns_raw = ldi.get("Annotations") or []
    if isinstance(anns_raw, dict):
        anns_raw = [anns_raw]

    anns = []
    for a in anns_raw:
        if not isinstance(a, dict):
            continue
        atype = str(a.get("Type", "")).lower()
        coords = a.get(atype) or a.get("polygon") or a.get("bbox") or a.get("Coordinates")
        anns.append({"class_id": str(a.get("Class_ID", "")), "type": atype, "coords": coords})
    return anns, width, height


def _poly_to_bbox(coords: List[float]) -> Optional[Tuple[float, float, float, float]]:
    """[x,y,x,y,...] → (x1,y1,x2,y2)."""
    if not coords or len(coords) < 4:
        return None
    xs = coords[0::2]
    ys = coords[1::2]
    return min(xs), min(ys), max(xs), max(ys)


def _bbox_to_xyxy(coords: List[float]) -> Optional[Tuple[float, float, float, float]]:
    """AI-Hub bbox는 대개 [x,y,w,h]. 4개면 [x,y,w,h]로 간주."""
    if not coords or len(coords) < 4:
        return None
    x, y, w, h = float(coords[0]), float(coords[1]), float(coords[2]), float(coords[3])
    return x, y, x + w, y + h


def ann_to_yolo_line(ann: Dict[str, Any], cls: str, w: int, h: int) -> Optional[str]:
    coords = ann.get("coords")
    if not coords:
        return None
    # 좌표가 [[x,y],...] 중첩이면 평탄화
    if coords and isinstance(coords[0], (list, tuple)):
        flat = []
        for p in coords:
            flat.extend([float(p[0]), float(p[1])])
        coords = flat
    if ann["type"] == "bbox" and len(coords) == 4:
        rect = _bbox_to_xyxy(coords)
    else:
        rect = _poly_to_bbox([float(c) for c in coords])
    if not rect:
        return None
    x1, y1, x2, y2 = rect
    # 이미지 경계로 clamp (테두리에 걸친 박스가 버려지지 않도록)
    x1 = min(max(x1, 0.0), w); x2 = min(max(x2, 0.0), w)
    y1 = min(max(y1, 0.0), h); y2 = min(max(y2, 0.0), h)
    cx = (x1 + x2) / 2 / w
    cy = (y1 + y2) / 2 / h
    bw = (x2 - x1) / w
    bh = (y2 - y1) / h
    if bw <= 0 or bh <= 0 or not (0 <= cx <= 1 and 0 <= cy <= 1):
        return None
    return f"{CLASS_INDEX[cls]} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}"


def find_image(images_dir: Path, stem: str, cache: Dict[str, Path]) -> Optional[Path]:
    if not cache:  # 최초 1회 이미지 인덱스 구축 (rglob 반복 방지)
        for ext in IMG_EXTS:
            for p in images_dir.rglob(f"*{ext}"):
                cache.setdefault(p.stem, p)
    return cache.get(stem)


def inspect(labels_dir: Path, images_dir: Path):
    jsons = list(labels_dir.rglob("*.json"))
    imgs = [p for ext in IMG_EXTS for p in images_dir.rglob(f"*{ext}")]
    print(f"라벨 JSON: {len(jsons)}개 / 이미지: {len(imgs)}개\n")

    if jsons:
        sample = jsons[0]
        print(f"--- 샘플 JSON 경로: {sample}")
        try:
            print(json.dumps(json.loads(sample.read_text(encoding="utf-8")),
                             ensure_ascii=False, indent=2)[:1500])
        except Exception as e:
            print(f"(읽기 실패: {e})")

    # 경로 기반 (결함, 등급) 분포 + Class_ID 분포
    defect_cnt, grade_cnt, classid_cnt = Counter(), Counter(), Counter()
    for jf in jsons[:5000]:
        defect_cnt[infer_defect_from_path(jf)] += 1
        grade_cnt[infer_grade_from_path(jf)] += 1
        try:
            anns, _, _ = parse_house_json(json.loads(jf.read_text(encoding="utf-8")))
            for a in anns:
                classid_cnt[a["class_id"]] += 1
        except Exception:
            pass
    print("\n--- 경로 추론 결함 분포:", dict(defect_cnt))
    print("--- 경로 추론 등급 분포:", dict(grade_cnt))
    print("--- Class_ID 분포(상위):", dict(classid_cnt.most_common(10)))
    print("\n※ 결함 분포가 대부분 None이면 폴더 키워드가 다른 것 → DEFECT_KEYWORDS 수정 필요.")
    print("※ Class_ID로 매핑하려면 위 분포 + 데이터 설명서로 CLASS_ID_MAP 채우고 --defect-from classid.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels-dir", required=True)
    ap.add_argument("--images-dir", required=True)
    ap.add_argument("--out-dir")
    ap.add_argument("--defect-from", choices=["path", "classid"], default="path")
    ap.add_argument("--max-per-cell", type=int, default=0,
                    help="(결함×등급) 셀당 최대 이미지 수. 0=제한없음(Colab은 400~1000 권장)")
    ap.add_argument("--val-ratio", type=float, default=0.2)
    ap.add_argument("--inspect", action="store_true", help="구조만 출력하고 종료")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    labels_dir, images_dir = Path(args.labels_dir), Path(args.images_dir)

    if args.inspect:
        inspect(labels_dir, images_dir)
        return
    if not args.out_dir:
        ap.error("--out-dir 가 필요합니다 (또는 --inspect).")

    out_dir = Path(args.out_dir)
    for split in ("train", "val"):
        (out_dir / "images" / split).mkdir(parents=True, exist_ok=True)
        (out_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    json_files = list(labels_dir.rglob("*.json"))
    random.seed(args.seed)
    random.shuffle(json_files)

    img_cache: Dict[str, Path] = {}
    cell_count: Dict[Tuple[str, str], int] = defaultdict(int)  # (defect, grade) → 사용량
    grades_manifest: Dict[str, str] = {}
    ok = skip = 0
    stats = Counter()

    for jf in json_files:
        # 1) 결함 클래스 결정
        if args.defect_from == "path":
            defect = infer_defect_from_path(jf)
        else:
            # classid 모드: 첫 annotation의 Class_ID로 결정 (필요시 확장)
            defect = None
        if args.defect_from == "path" and defect is None:
            skip += 1
            continue

        grade = infer_grade_from_path(jf) or "미상"

        # 2) 균형 샘플링 (셀당 상한)
        if args.max_per_cell and cell_count[(defect or "?", grade)] >= args.max_per_cell:
            continue

        try:
            data = json.loads(jf.read_text(encoding="utf-8"))
        except Exception:
            skip += 1
            continue
        anns, _jw, _jh = parse_house_json(data)  # JSON 해상도는 신뢰 불가(가로세로 뒤바뀜 다수)

        # classid 모드 결함 결정
        if args.defect_from == "classid":
            cids = {a["class_id"] for a in anns}
            mapped = {CLASS_ID_MAP.get(c) for c in cids} - {None}
            defect = next(iter(mapped)) if mapped else None
            if defect is None:
                skip += 1
                continue

        stem = data.get("Source_Data_Info", {}).get("Source_Data_ID") or jf.stem
        img_path = find_image(images_dir, stem, img_cache)
        if img_path is None:
            skip += 1
            continue

        # ★ 실제 이미지 크기로 정규화 (JSON Resolution 무시)
        try:
            with Image.open(img_path) as im:
                w, h = im.size
        except Exception:
            skip += 1
            continue
        if w == 0 or h == 0:
            skip += 1
            continue

        lines = []
        for a in anns:
            ln = ann_to_yolo_line(a, defect, w, h)
            if ln:
                lines.append(ln)
        if not lines:
            skip += 1
            continue

        split = "val" if random.random() < args.val_ratio else "train"
        dst_img = out_dir / "images" / split / img_path.name
        shutil.copy(img_path, dst_img)
        (out_dir / "labels" / split / f"{img_path.stem}.txt").write_text(
            "\n".join(lines), encoding="utf-8")
        grades_manifest[img_path.name] = grade
        cell_count[(defect, grade)] += 1
        stats[f"{defect}/{grade}"] += 1
        ok += 1
        if ok % 500 == 0:
            print(f"  진행: {ok}건...")

    # data.yaml + grades.json
    (out_dir / "data.yaml").write_text(
        f"path: {out_dir.resolve()}\ntrain: images/train\nval: images/val\n"
        f"nc: {len(CLASS_NAMES)}\nnames: {CLASS_NAMES}\n", encoding="utf-8")
    (out_dir / "grades.json").write_text(
        json.dumps(grades_manifest, ensure_ascii=False, indent=0), encoding="utf-8")

    print(f"\n완료! 변환 {ok}건 / 건너뜀 {skip}건")
    print("결함×등급 분포:", dict(stats))
    print(f"data.yaml  → {out_dir / 'data.yaml'}")
    print(f"grades.json → {out_dir / 'grades.json'} (등급 실증용)")


if __name__ == "__main__":
    main()
