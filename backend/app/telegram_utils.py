# backend/app/telegram_utils.py
import os
import requests
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")


def send_telegram_message(text: str):
    """Send a plain text message to Telegram chat."""
    if not BOT_TOKEN or not CHAT_ID:
        print("[Telegram] Missing BOT_TOKEN or CHAT_ID")
        return False

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {"chat_id": CHAT_ID, "text": text, "parse_mode": "Markdown"}
    try:
        r = requests.post(url, data=payload, timeout=10)
        if r.status_code == 200:
            return True
        print("[Telegram] Error:", r.text)
        return False
    except Exception as e:
        print("[Telegram] Exception:", e)
        return False


def send_telegram_photo(image_path: str, caption: str = ""):
    """Send an image with caption."""
    if not BOT_TOKEN or not CHAT_ID:
        print("[Telegram] Missing BOT_TOKEN or CHAT_ID")
        return False

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
    try:
        with open(image_path, "rb") as img:
            files = {"photo": img}
            data = {"chat_id": CHAT_ID, "caption": caption}
            r = requests.post(url, files=files, data=data, timeout=20)
            if r.status_code == 200:
                return True
            print("[Telegram] Error sending photo:", r.text)
            return False
    except Exception as e:
        print("[Telegram] Exception:", e)
        return False
