# backend/app/whatsapp_utils.py
import os
import requests
from dotenv import load_dotenv

load_dotenv()

WHATSAPP_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN")
PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")

def send_whatsapp_message(to_number: str, message: str):
    """
    Send a WhatsApp text message using Meta Cloud API.
    """
    url = f"https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {
            "body": message
        }
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        print("[WhatsApp] ✅ Message sent successfully")
    except requests.exceptions.RequestException as e:
        print("[WhatsApp] ❌ Error:", e, response.text if 'response' in locals() else "")
