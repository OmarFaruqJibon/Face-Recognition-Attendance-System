# backend/app/signalwire.py
import os
from signalwire.rest import Client

# Load environment variables
SIGNALWIRE_PROJECT_ID = os.getenv("SIGNALWIRE_PROJECT_ID")
SIGNALWIRE_API_TOKEN = os.getenv("SIGNALWIRE_API_TOKEN")
SIGNALWIRE_SPACE_URL = os.getenv("SIGNALWIRE_SPACE_URL")
CALL_TO_NUMBER = os.getenv("CALL_TO_NUMBER")
CALL_FROM_NUMBER = os.getenv("CALL_FROM_NUMBER")  # Must be a purchased SignalWire number

def send_signalwire_call():
    """Initiates a phone call via SignalWire."""
    try:
        client = Client(
            SIGNALWIRE_PROJECT_ID,
            SIGNALWIRE_API_TOKEN,
            signalwire_space_url=SIGNALWIRE_SPACE_URL
        )

        call = client.calls.create(
            to=CALL_TO_NUMBER,
            from_=CALL_FROM_NUMBER,
            url="http://demo.twilio.com/docs/voice.xml"  # Default demo XML
        )
        print(f"[CALL] SignalWire call initiated! SID: {call.sid}")
    except Exception as e:
        print("[CALL] Error initiating SignalWire call:", e)
