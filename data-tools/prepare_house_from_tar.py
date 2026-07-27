"""노후주택 download.tar -> (part 병합) -> zip 해제 (★폴더 구조 보존).

기존 prepare_from_tar.py 는 labels/images로 '평탄화'하지만, 노후주택 데이터는
등급(우수/보통/불량)·점검유형(구조물(균열) 등)이 **폴더 경로에만** 있어서
평탄화하면 등급 정보가 사라진다. 그래서 이 스크립트는 폴더 구조를 그대로 보존한다.

tar 해제 + part 병합 로직은 prepare_from_tar.py 를 재사용한다.

사용:
  python prepare_house_from_tar.py --tar ~/house_data/dl/download.tar --work ~/house_data/prepared
출력:
  <work>/extracted/...(원본 폴더구조 유지)...  ← converter의 --labels-dir/--images-dir 로 사용
"""
import argparse
import shutil
import zipfile
from pathlib import Path

from prepare_from_tar import extract_tar, merge_parts, IMG_EXTS


def _hangul(s: str) -> int:
    return sum(1 for ch in s if "가" <= ch <= "힣")


def _fixname(info: zipfile.ZipInfo) -> str:
    """한글 zip 파일명 복원 (Python/제작OS 무관).

    UTF-8 플래그가 있으면 그대로. 없으면 Python이 cp437로 디코딩한 상태이므로
    원본 바이트를 되살려(utf-8 / cp949) 각각 디코딩 후 '한글이 더 많은' 쪽을 선택.
    (실제 AI-Hub=Windows cp949, macOS zip=UTF-8 둘 다 올바르게 복원)
    """
    name = info.filename
    if info.flag_bits & 0x800:  # UTF-8 플래그 → 이미 정상
        return name.replace("\\", "/")
    try:
        raw = name.encode("cp437")
    except UnicodeEncodeError:
        return name.replace("\\", "/")
    best, best_score = name, -1
    for enc in ("utf-8", "cp949"):
        try:
            cand = raw.decode(enc)
        except UnicodeDecodeError:
            continue
        score = _hangul(cand)
        if score > best_score:
            best, best_score = cand, score
    return best.replace("\\", "/")


def extract_zips_keep_structure(root: Path, out: Path) -> tuple[int, int]:
    print("[3/3] zip 해제 (폴더 구조 보존)")
    out.mkdir(parents=True, exist_ok=True)
    n_json = n_img = 0
    for zp in root.rglob("*.zip"):
        # macOS 정크(._AppleDouble, __MACOSX)·손상 파일 스킵
        if zp.name.startswith("._") or "__MACOSX" in zp.parts:
            continue
        if not zipfile.is_zipfile(zp):
            print(f"   [skip] zip 아님: {zp.name}")
            continue
        with zipfile.ZipFile(zp) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                rel = Path(_fixname(info))
                if rel.name.startswith("._") or "__MACOSX" in rel.parts:
                    continue
                ext = rel.suffix.lower()
                if ext != ".json" and ext not in IMG_EXTS:
                    continue
                target = out / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(info) as src, open(target, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                if ext == ".json":
                    n_json += 1
                else:
                    n_img += 1
    return n_json, n_img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tar", required=True)
    ap.add_argument("--work", required=True)
    args = ap.parse_args()

    work = Path(args.work)
    raw = work / "raw"
    if raw.exists():
        shutil.rmtree(raw)
    raw.mkdir(parents=True, exist_ok=True)

    extract_tar(Path(args.tar), raw)
    merge_parts(raw)
    out = work / "extracted"
    if out.exists():
        shutil.rmtree(out)
    n_json, n_img = extract_zips_keep_structure(raw, out)

    print(f"\n완료! json: {n_json}개, images: {n_img}개 (구조 보존)")
    print(f"추출 폴더: {out}")
    print("→ converter의 --labels-dir, --images-dir 에 이 폴더를 그대로 사용")


if __name__ == "__main__":
    main()
