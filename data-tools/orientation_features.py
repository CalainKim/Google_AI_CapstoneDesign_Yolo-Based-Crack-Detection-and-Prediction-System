"""균열 방향 특징 추출 (라벨 없이 이미지에서 직접 계산).

교수님 자문: "역학 정보는 convolution 하지 말고 별도 feature로 넣어라."
논문 근거: 균열 방향(orientation)으로 전단(대각)/휨(수직)을 구분하고 손상을 지수화.

구조텐서(structure tensor)로 국소 경사 방향을 구한 뒤, 균열로 보이는 강한 경사
픽셀만 골라 방향 히스토그램(수평/대각/수직)과 이방성을 특징으로 만든다.
실제 서비스 추론 시에도 사용 가능(라벨 불필요).
"""
import numpy as np
import cv2


def orientation_features(img_path: str, mag_percentile: float = 92.0) -> dict:
    """이미지 → 균열 방향 특징 8개.

    반환 키:
      ori_horiz / ori_diag / ori_vert : 방향대별 에지 픽셀 비율 (합=1)
      ori_mean_deg   : 평균 방향(0=수평, 90=수직)
      ori_std_deg    : 방향 산포 (낮을수록 한 방향으로 정렬)
      anisotropy     : 이방성 (선형 구조가 뚜렷할수록 1에 가까움)
      edge_density   : 강한 에지 픽셀 비율 (결함 면적 대리 지표)
      grad_mean      : 평균 경사 강도 (대비/심각도 대리 지표)
    """
    img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return {}
    # 해상도 정규화(속도·스케일 일관성)
    h, w = img.shape
    scale = 640.0 / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    img = cv2.GaussianBlur(img, (5, 5), 0)

    gx = cv2.Sobel(img, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(img, cv2.CV_32F, 0, 1, ksize=3)

    # 구조텐서 성분을 국소 평균 → 선형 구조 강조
    jxx = cv2.boxFilter(gx * gx, cv2.CV_32F, (9, 9))
    jyy = cv2.boxFilter(gy * gy, cv2.CV_32F, (9, 9))
    jxy = cv2.boxFilter(gx * gy, cv2.CV_32F, (9, 9))

    # 고유값 → 이방성, 주방향
    tmp = np.sqrt((jxx - jyy) ** 2 + 4 * jxy ** 2)
    lam1 = 0.5 * (jxx + jyy + tmp)   # 큰 고유값
    lam2 = 0.5 * (jxx + jyy - tmp)
    coh = (lam1 - lam2) / (lam1 + lam2 + 1e-6)          # 이방성 0~1
    # 구조텐서 주축은 경사에 수직 → +90°로 보정해 '선(균열) 방향'으로 변환
    theta = 0.5 * np.arctan2(2 * jxy, jxx - jyy)
    line_deg = (np.degrees(theta) + 90.0) % 180.0        # 0~180 (0=수평, 90=수직)

    mag = np.sqrt(gx * gx + gy * gy)
    thr = np.percentile(mag, mag_percentile)
    mask = (mag >= thr) & (coh > 0.3)                    # 강하고 선형적인 픽셀만
    if mask.sum() < 50:
        mask = mag >= thr
    if mask.sum() < 10:
        return {}

    d = line_deg[mask]
    # 0~180을 0~90으로 접기 (수평 0, 수직 90)
    d = np.where(d > 90, 180 - d, d)

    horiz = float(np.mean(d < 30))
    diag = float(np.mean((d >= 30) & (d < 60)))
    vert = float(np.mean(d >= 60))

    return {
        "ori_horiz": round(horiz, 4),
        "ori_diag": round(diag, 4),
        "ori_vert": round(vert, 4),
        "ori_mean_deg": round(float(d.mean()), 2),
        "ori_std_deg": round(float(d.std()), 2),
        "anisotropy": round(float(coh[mask].mean()), 4),
        "edge_density": round(float(mask.mean()), 4),
        "grad_mean": round(float(mag[mask].mean()), 2),
    }


FEATURE_KEYS = [
    "ori_horiz", "ori_diag", "ori_vert", "ori_mean_deg",
    "ori_std_deg", "anisotropy", "edge_density", "grad_mean",
]
