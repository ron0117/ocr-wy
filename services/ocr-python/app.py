import io
import os
from typing import Any

import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from PIL import Image
from starlette.concurrency import run_in_threadpool

app = FastAPI(title="OCR Service")
ocr: Any = None
load_error: str | None = None
MAX_BYTES = 10 * 1024 * 1024


@app.on_event("startup")
def load_model() -> None:
    global ocr, load_error
    try:
        from rapidocr_onnxruntime import RapidOCR

        ocr = RapidOCR()
    except Exception as exc:  # noqa: BLE001
        load_error = "模型加载失败"
        ocr = None
        print(f"OCR load failed: {exc}")


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": ocr is not None, "error": load_error}


def line_center(box: list[list[float]]) -> tuple[float, float]:
    xs = [point[0] for point in box]
    ys = [point[1] for point in box]
    return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2


def read_lines(result: Any) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []
    for item in result or []:
        if not item or len(item) < 3:
            continue
        box, text, score = item
        lines.append(
            {
                "text": str(text).strip(),
                "confidence": float(score),
                "box": [[float(point[0]), float(point[1])] for point in box],
            }
        )
    return lines


def supplement_ranks(image: np.ndarray, lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """花纹圆徽里的个位数经常被整图检测漏掉，放大排名列再认一次。"""
    _height, width = image.shape[:2]
    name_edge = next(
        (min(point[0] for point in line["box"]) for line in lines if "玩家名称" in line["text"]),
        None,
    )
    right = int(name_edge) if name_edge else int(width * 0.22)
    right = max(1, min(right, width))
    crop = image[:, :right]
    scale = 2
    enlarged = Image.fromarray(crop).resize(
        (crop.shape[1] * scale, crop.shape[0] * scale),
        Image.Resampling.LANCZOS,
    )
    result, _elapse = ocr(np.array(enlarged))
    occupied = [line_center(line["box"]) for line in lines if line["text"].isdigit()]
    for item in result or []:
        if not item or len(item) < 3:
            continue
        box, text, score = item
        text = str(text).strip()
        if not text.isdigit() or float(score) < 0.8:
            continue
        mapped = [[float(point[0]) / scale, float(point[1]) / scale] for point in box]
        cx, cy = line_center(mapped)
        if any(abs(cy - ey) < 28 and abs(cx - ex) < 80 for ex, ey in occupied):
            continue
        lines.append({"text": text, "confidence": float(score), "box": mapped})
        occupied.append((cx, cy))
    return lines


def recognize_image(image: np.ndarray) -> list[dict[str, Any]]:
    result, _elapse = ocr(image)
    return supplement_ranks(image, read_lines(result))


def ensure_token(token: str | None) -> None:
    expected = os.getenv("OCR_AUTH_TOKEN", "")
    if expected and token != expected:
        raise HTTPException(status_code=401, detail="unauthorized")


@app.post("/recognize")
async def recognize(
    file: UploadFile = File(...),
    x_ocr_token: str | None = Header(default=None),
) -> dict[str, Any]:
    ensure_token(x_ocr_token)
    if ocr is None:
        raise HTTPException(status_code=503, detail="OCR 模型未就绪")

    raw = await file.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="图片超过 10 MB")

    try:
        image = np.array(Image.open(io.BytesIO(raw)).convert("RGB"))
        lines = await run_in_threadpool(recognize_image, image)
    except Exception as exc:  # noqa: BLE001
        print(f"OCR recognize failed: {exc}")
        raise HTTPException(status_code=500, detail="OCR 识别失败") from exc

    return {
        "text": "\n".join(line["text"] for line in lines),
        "lines": lines,
    }
