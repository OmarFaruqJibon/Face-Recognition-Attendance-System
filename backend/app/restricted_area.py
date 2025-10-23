import cv2
import numpy as np
import datetime
import pytz
from app.email_utils import send_alert_email
from app.telegram_utils import send_telegram_photo

DHAKA_TZ = pytz.timezone("Asia/Dhaka")

# ==========================
# CONFIGURABLE ZONE
# ==========================
RESTRICTED_AREA = np.array([
    (380, 78), (358, 236), (582, 302), (614, 90)
], np.int32)  # Update this polygon to match your camera view


# ==========================
# CORE FUNCTIONS
# ==========================

def draw_restricted_area(frame):
    """Draw red polygon on live video frame."""
    return cv2.polylines(frame, [RESTRICTED_AREA], True, (0, 0, 255), 2)


def is_inside_restricted_area(x1, y1, x2, y2):
    """Check if a detected person is inside the restricted polygon."""
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    inside = (
        cv2.pointPolygonTest(RESTRICTED_AREA, (cx, cy), False) >= 0 or
        cv2.pointPolygonTest(RESTRICTED_AREA, (x1, y1), False) >= 0 or
        cv2.pointPolygonTest(RESTRICTED_AREA, (x2, y2), False) >= 0 or
        cv2.pointPolygonTest(RESTRICTED_AREA, (x1, y2), False) >= 0
    )
    return inside


async def send_restricted_area_alert(person_type, name, pid, reason, frame):
    """Send restricted area alert for Unknown/Bad person."""
    now = datetime.datetime.now(DHAKA_TZ).replace(tzinfo=None)
    filename = f"restricted_{pid}_{int(now.timestamp())}.jpg"
    cv2.imwrite(filename, frame)

    subject = f"🚨 ALERT: {person_type} Entered Restricted Area"
    body = (
        f"Type: {person_type}\n"
        f"Name: {name}\n"
        f"ID: {pid}\n"
        f"Reason/Note: {reason or 'N/A'}\n"
        f"Time: {now.strftime('%Y-%m-%d %I:%M:%S %p %Z')}"
    )

    try:
        send_alert_email(subject=subject, body=body, image_path=filename)
        print(f"[Email] Restricted area alert sent for {person_type}: {name}")
    except Exception as e:
        print("[Email] Restricted area alert failed:", e)

    try:
        send_telegram_photo(filename, caption=body)
        print(f"[Telegram] Restricted area alert sent for {person_type}: {name}")
    except Exception as e:
        print("[Telegram] Restricted area telegram failed:", e)
