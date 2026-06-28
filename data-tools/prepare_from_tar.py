"""AI-Hub download.tar -> (part 병합) -> zip 해제 -> labels/images 평탄화.

Windows에서 tar.exe(bsdtar)와 bash의 aihubshell 병합이 한글 파일명을 깨뜨리는 문제를
모두 우회하기 위해, 한글을 안전하게 다루는 Python으로 전 과정을 처리한다.

사용:
  python prepare_from_tar.py --tar C:\\Users\\doeun\\crack_data\\dl\\download.tar \
      --work C:\\Users\\doeun\\crack_data\\prepared
출력:
  <work>/labels/*.json , <work>/images/*.{jpg,png,...}
"""
import argparse
import shutil
import tarfile
import zipfile
from pathlib import Path

IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}


def extract_tar(tar_path: Path, dest: Path) -> None:
    print(f"[1/3] tar 해제: {tar_path.name}")
    with tarfile.open(tar_path, "r:*") as tf:
        tf.extractall(dest)


def merge_parts(root: Path) -> list[Path]:
    """*.partN 파일들을 prefix 단위로 정렬·병합하여 prefix(zip) 생성. 반환: 생성된 zip 목록."""
    print("[2/3] part 병합")
    groups: dict[Path, list[Path]] = {}
    for p in root.rglob("*"):
        if p.is_file() and ".part" in p.name:
            name = p.name
            idx = name.rfind(".part")
            suffix = name[idx + len(".part"):]
            if suffix.isdigit():
                prefix = p.with_name(name[:idx])
                groups.setdefault(prefix, []).append(p)
    merged = []
    for prefix, parts in groups.items():
        parts.sort(key=lambda x: int(x.name[x.name.rfind(".part") + 5:]))
        with open(prefix, "wb") as out:
            for part in parts:
                with open(part, "rb") as f:
                    shutil.copyfileobj(f, out, length=1024 * 1024)
        for part in parts:
            part.unlink()
        merged.append(prefix)
        print(f"   - {prefix.name}  <= {len(parts)} part  ({prefix.stat().st_size/1024/1024:.1f} MB)")
    return merged


def extract_zips_flat(root: Path, out_labels: Path, out_images: Path) -> tuple[int, int]:
    """root 아래 모든 .zip을 열어 json/이미지를 평탄화하여 저장 (한글명 cp949)."""
    print("[3/3] zip 해제 (labels/images 평탄화)")
    out_labels.mkdir(parents=True, exist_ok=True)
    out_images.mkdir(parents=True, exist_ok=True)
    n_json = n_img = 0
    zips = [p for p in root.rglob("*.zip")]
    for zp in zips:
        try:
            zf = zipfile.ZipFile(zp, metadata_encoding="cp949")
        except TypeError:
            zf = zipfile.ZipFile(zp)  # 구버전 파이썬 호환
        with zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                base = Path(info.filename.replace("\\", "/")).name
                ext = Path(base).suffix.lower()
                if ext == ".json":
                    target = out_labels / base
                    with zf.open(info) as src, open(target, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    n_json += 1
                elif ext in IMG_EXTS:
                    target = out_images / base
                    with zf.open(info) as src, open(target, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    n_img += 1
    return n_json, n_img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tar", required=True)
    ap.add_argument("--work", required=True)
    args = ap.parse_args()

    tar_path = Path(args.tar)
    work = Path(args.work)
    raw = work / "raw"
    if raw.exists():
        shutil.rmtree(raw)
    raw.mkdir(parents=True, exist_ok=True)

    extract_tar(tar_path, raw)
    merge_parts(raw)
    n_json, n_img = extract_zips_flat(raw, work / "labels", work / "images")

    print(f"\n완료! labels(json): {n_json}개, images: {n_img}개")
    print(f"labels 폴더: {work / 'labels'}")
    print(f"images 폴더: {work / 'images'}")


if __name__ == "__main__":
    main()
