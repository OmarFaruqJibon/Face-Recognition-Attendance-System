import cv2
import asyncio
from ultralytics import YOLO
import easyocr
import datetime
from app.ws_manager import manager
import os

# -------------------------
# Load models
# -------------------------
plate_model = None
ocr_reader = None

def load_models():
    global plate_model, ocr_reader
    if plate_model is None:
        # Lightweight YOLO for CPU

        BASE_DIR = os.path.dirname(__file__)
        WEIGHTS_PATH = os.path.join(BASE_DIR, "models", "yolov8n-plate.pt")
        plate_model = YOLO(WEIGHTS_PATH)

        plate_model.to("cpu")
        plate_model.fuse()  # small speed-up
    if ocr_reader is None:
        ocr_reader = easyocr.Reader(["en"], gpu=False)

# -------------------------
# Detection function
# -------------------------
async def detect_number_plate(frame):
    """
    Detect license plates in a frame, perform OCR,
    and broadcast results via WebSocket.
    Returns annotated frame.
    """
    global plate_model, ocr_reader
    load_models()

    loop = asyncio.get_running_loop()
    annotated = frame.copy()

    # Run detection in executor to avoid blocking
    # results = await loop.run_in_executor(None, plate_model, frame)
    results = await loop.run_in_executor(None, lambda: plate_model(frame, verbose=False))

    for r in results:
        boxes = r.boxes.xyxy
        for box in boxes:
            x1, y1, x2, y2 = map(int, box)
            plate_img = frame[y1:y2, x1:x2]

            # OCR on cropped plate
            try:
                ocr_result = await loop.run_in_executor(None, ocr_reader.readtext, plate_img)
                plate_text = ""
                for (_, text, prob) in ocr_result:
                    if prob > 0.3:  # confidence threshold
                        plate_text = text
                        break

                # Broadcast detected plate
                now = datetime.datetime.utcnow()
                await manager.broadcast_json({
                    "type": "plate",
                    "plate": plate_text,
                    "timestamp": now.isoformat()
                })

                # Draw rectangle + text
                cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
                if plate_text:
                    cv2.putText(annotated, plate_text, (x1, y1-10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2, cv2.LINE_AA)

            except Exception as ex:
                print("[number_plate] OCR error:", ex)

    return annotated
