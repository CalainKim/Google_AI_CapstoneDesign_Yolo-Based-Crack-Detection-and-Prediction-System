"""폴더를 zip으로 압축 (엔트리 경로에 슬래시 '/' 사용, UTF-8).

Windows 기본 Compress-Archive 는 경로 구분자를 '\\' 로 저장하는 버그가 있어
리눅스(Colab)에서 풀면 폴더가 안 만들어진다. 이 스크립트는 표준 '/' 로 저장한다.

사용: python make_zip.py --src <폴더> --out <zip경로>
"""
import argparse
import os
import zipfile


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    src = os.path.abspath(args.src)
    out = os.path.abspath(args.out)
    if os.path.exists(out):
        os.remove(out)

    n = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _dirs, files in os.walk(src):
            for f in files:
                full = os.path.join(root, f)
                arc = os.path.relpath(full, src).replace("\\", "/")
                z.write(full, arc)
                n += 1
    size_mb = os.path.getsize(out) / 1024 / 1024
    print(f"완료! {n}개 파일 -> {out}  ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
