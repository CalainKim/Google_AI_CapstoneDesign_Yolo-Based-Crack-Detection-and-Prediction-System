"""HWP 5.0(OLE) 파일에서 본문 텍스트를 추출한다.

사용:  python hwp_to_text.py "파일.hwp" [출력.txt]
"""
import sys
import zlib
import struct
import olefile

# 8칸(16바이트)을 차지하는 인라인/확장 컨트롤 문자 코드
CTRL_8 = {1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23}
HWPTAG_PARA_TEXT = 67  # HWPTAG_BEGIN(16) + 51


def _is_compressed(ole) -> bool:
    header = ole.openstream("FileHeader").read()
    # 36번째 바이트의 비트0 = 압축 여부
    return bool(header[36] & 0x01)


def _parse_records(buf):
    """레코드 스트림을 (tag_id, level, payload)로 순회."""
    i, n = 0, len(buf)
    while i + 4 <= n:
        header = struct.unpack_from("<I", buf, i)[0]
        i += 4
        tag_id = header & 0x3FF
        size = (header >> 20) & 0xFFF
        if size == 0xFFF:
            size = struct.unpack_from("<I", buf, i)[0]
            i += 4
        payload = buf[i : i + size]
        i += size
        yield tag_id, payload


def _decode_para_text(payload) -> str:
    """PARA_TEXT 페이로드(UTF-16LE + 컨트롤)에서 글자만 추출."""
    out = []
    i, n = 0, len(payload) // 2
    wchars = struct.unpack_from("<%dH" % n, payload, 0)
    while i < n:
        c = wchars[i]
        if c in CTRL_8:
            i += 8
        elif c in (10, 13):
            out.append("\n")
            i += 1
        elif c >= 32:
            out.append(chr(c))
            i += 1
        else:
            i += 1
    return "".join(out)


def extract(path: str) -> str:
    ole = olefile.OleFileIO(path)
    compressed = _is_compressed(ole)

    # BodyText/Section0, Section1 ... 순서대로
    sections = sorted(
        ["/".join(e) for e in ole.listdir() if e[0] == "BodyText"],
        key=lambda s: int("".join(ch for ch in s if ch.isdigit()) or 0),
    )

    texts = []
    for sec in sections:
        data = ole.openstream(sec).read()
        if compressed:
            data = zlib.decompress(data, -15)  # raw deflate
        for tag_id, payload in _parse_records(data):
            if tag_id == HWPTAG_PARA_TEXT:
                texts.append(_decode_para_text(payload))
    ole.close()
    return "\n".join(texts)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    text = extract(sys.argv[1])
    if len(sys.argv) >= 3:
        with open(sys.argv[2], "w", encoding="utf-8") as f:
            f.write(text)
        print(f"저장 완료: {sys.argv[2]} ({len(text)}자)")
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(text)
