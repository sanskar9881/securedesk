import os, smtplib, ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime


def send_alert_email(
    to_email: str,
    manager_name: str,
    event_type: str,
    employee_name: str,
    filename: str,
    risk_level: str,
    reasons: list,
    action_taken: str,
):
    """Send security alert email to manager."""
    smtp_user = os.getenv("SMTP_EMAIL", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    if not smtp_user or not smtp_pass:
        print(f"[Email Alert] SMTP not configured — alert for {employee_name} not sent")
        return False

    risk_emoji = "🔴" if risk_level == "HIGH" else "🟡" if risk_level == "MEDIUM" else "🟢"
    reasons_html = "".join(f"<li>{r}</li>" for r in reasons[:5])

    html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:24px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;font-size:20px">🛡️ SecureDesk Security Alert</h1>
    <p style="margin:8px 0 0;opacity:.7;font-size:14px">{datetime.utcnow().strftime('%d %b %Y, %H:%M')} UTC</p>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none">
    <p style="font-size:16px">Hi <strong>{manager_name}</strong>,</p>
    <p>A security event requires your attention:</p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 8px;font-weight:700;font-size:16px">{risk_emoji} {risk_level} RISK — {action_taken}</p>
      <p style="margin:0;color:#374151"><strong>Employee:</strong> {employee_name}</p>
      <p style="margin:4px 0 0;color:#374151"><strong>File:</strong> {filename}</p>
      <p style="margin:4px 0 0;color:#374151"><strong>Event:</strong> {event_type}</p>
    </div>

    <p><strong>Reasons flagged:</strong></p>
    <ul style="color:#374151">{reasons_html}</ul>

    <a href="{os.getenv('FRONTEND_URL','https://securedesk-beige.vercel.app')}/activity"
       style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
      View Activity Dashboard →
    </a>
  </div>
  <div style="background:#f8fafc;padding:16px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;font-size:12px;color:#94a3b8;text-align:center">
    SecureDesk — AI-Powered Data Protection | Manage alerts in your dashboard
  </div>
</div>"""

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[SecureDesk Alert] {risk_emoji} {risk_level} risk — {employee_name} — {filename[:30]}"
        msg["From"]    = smtp_user
        msg["To"]      = to_email
        msg.attach(MIMEText(html, "html"))
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx) as srv:
            srv.login(smtp_user, smtp_pass)
            srv.sendmail(smtp_user, to_email, msg.as_string())
        print(f"[Email Alert] Sent to {to_email}")
        return True
    except Exception as e:
        print(f"[Email Alert] Failed: {e}")
        return False
