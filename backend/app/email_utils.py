# backend/app/email_utils.py
import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")

def send_alert_email(subject: str, body: str, image_path: str = None): 
    """
    Send an alert email with optional attached image.
    """
    try:
        msg = EmailMessage()
        msg["From"] = EMAIL_USER
        msg["To"] = ADMIN_EMAIL
        msg["Subject"] = subject
        msg.set_content(body)

        # Attach image if provided
        if image_path and os.path.exists(image_path):
            with open(image_path, "rb") as f:
                img_data = f.read()
            msg.add_attachment(
                img_data,
                maintype="image",
                subtype="jpeg",
                filename=os.path.basename(image_path),
            )

        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.starttls()
            server.login(EMAIL_USER, EMAIL_PASS)
            server.send_message(msg)

        print(f"[EMAIL] Sent alert email to {ADMIN_EMAIL}")
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send email: {e}")
