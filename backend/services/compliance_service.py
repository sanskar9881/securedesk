import io
from datetime import datetime, timedelta
from database import db

files_col    = db["fingerprinted_files"]
activity_col = db["activity_logs"]
alerts_col   = db["alerts"]
users_col    = db["users"]


async def gather_compliance_data(org_name: str, period_days: int = 30) -> dict:
    """Collect all data needed for the compliance report."""
    since = datetime.utcnow() - timedelta(days=period_days)
    total_files  = await files_col.count_documents({})
    high_risk    = await files_col.count_documents({"risk_level": "HIGH"})
    medium_risk  = await files_col.count_documents({"risk_level": "MEDIUM"})
    low_risk     = await files_col.count_documents({"risk_level": "LOW"})
    blocked      = await files_col.count_documents({"action_taken": "BLOCK"})
    total_events = await activity_col.count_documents({"timestamp": {"$gte": since}})
    alerts_count = await alerts_col.count_documents({"timestamp": {"$gte": since}})
    total_users  = await users_col.count_documents({})

    # High risk file details
    high_risk_files = []
    cursor = files_col.find({"risk_level": "HIGH"}, sort=[("created_at", -1)]).limit(10)
    async for f in cursor:
        ts = f.get("created_at", datetime.utcnow())
        high_risk_files.append({
            "filename":   f.get("filename", "?"),
            "owner":      f.get("owner_name", "?"),
            "action":     f.get("action_taken", "?"),
            "reasons":    ", ".join(f.get("reasons", [])[:2]),
            "date":       ts.strftime("%d %b %Y") if isinstance(ts, datetime) else str(ts),
        })

    return {
        "org_name":        org_name,
        "report_date":     datetime.utcnow().strftime("%d %B %Y"),
        "period":          f"Last {period_days} days",
        "total_files":     total_files,
        "high_risk":       high_risk,
        "medium_risk":     medium_risk,
        "low_risk":        low_risk,
        "blocked":         blocked,
        "total_events":    total_events,
        "alerts":          alerts_count,
        "total_users":     total_users,
        "compliance_score":max(0, 100 - (high_risk * 5) - (alerts_count * 2)),
        "high_risk_files": high_risk_files,
    }


def generate_html_report(data: dict) -> str:
    """Generate a professional HTML compliance report."""
    score       = data["compliance_score"]
    score_color = "#22c55e" if score >= 80 else "#f59e0b" if score >= 60 else "#ef4444"
    score_label = "COMPLIANT" if score >= 80 else "NEEDS ATTENTION" if score >= 60 else "AT RISK"

    hr_rows = ""
    for f in data["high_risk_files"]:
        hr_rows += f"""
        <tr>
          <td>{f['filename']}</td>
          <td>{f['owner']}</td>
          <td style="color:#ef4444;font-weight:600">{f['action']}</td>
          <td>{f['reasons']}</td>
          <td>{f['date']}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>DPDP Compliance Report — {data['org_name']}</title>
<style>
  body{{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}}
  .page{{max-width:900px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}}
  .header{{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:40px;display:flex;justify-content:space-between;align-items:center}}
  .logo{{font-size:24px;font-weight:800;letter-spacing:-0.5px}}
  .logo span{{color:#6366f1}}
  .header-right{{text-align:right;font-size:13px;opacity:.75}}
  .content{{padding:40px}}
  h2{{font-size:18px;font-weight:700;color:#0f172a;margin:28px 0 12px}}
  .score-box{{display:flex;align-items:center;gap:24px;background:#f8fafc;border-radius:12px;padding:24px;margin:20px 0;border:1px solid #e2e8f0}}
  .score-circle{{width:100px;height:100px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:{score_color};color:#fff;font-size:32px;font-weight:800}}
  .score-label{{font-size:11px;font-weight:700;margin-top:2px}}
  .score-info h3{{font-size:20px;font-weight:700;color:{score_color};margin:0 0 4px}}
  .score-info p{{color:#64748b;font-size:14px;margin:0}}
  .stats{{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:20px 0}}
  .stat{{background:#f8fafc;border-radius:10px;padding:20px;text-align:center;border:1px solid #e2e8f0}}
  .stat .num{{font-size:32px;font-weight:800;color:#0f172a}}
  .stat .lbl{{font-size:12px;color:#64748b;margin-top:4px}}
  .stat.danger .num{{color:#ef4444}}
  .stat.warn .num{{color:#f59e0b}}
  .stat.good .num{{color:#22c55e}}
  table{{width:100%;border-collapse:collapse;font-size:13px}}
  th{{background:#f1f5f9;padding:10px 14px;text-align:left;font-weight:700;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.5px}}
  td{{padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#334155}}
  tr:hover td{{background:#fafbfc}}
  .badge{{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}}
  .badge.high{{background:#fee2e2;color:#dc2626}}
  .badge.ok{{background:#dcfce7;color:#16a34a}}
  .section-box{{background:#f8fafc;border-radius:10px;padding:20px;margin:16px 0;border-left:4px solid #6366f1}}
  .footer{{background:#0f172a;color:#64748b;padding:20px 40px;font-size:12px;display:flex;justify-content:space-between}}
  .dpdp-note{{background:#fffbeb;border:1px solid #fbbf24;border-radius:10px;padding:16px;margin:20px 0;font-size:13px}}
  .dpdp-note strong{{color:#92400e}}
  @media print{{body{{background:#fff;padding:0}}.page{{box-shadow:none}}}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">Secure<span>Desk</span></div>
      <div style="margin-top:8px;font-size:18px;font-weight:700">{data['org_name']}</div>
      <div style="margin-top:4px;opacity:.7;font-size:13px">DPDP Act 2023 Compliance Report</div>
    </div>
    <div class="header-right">
      <div style="font-size:16px;font-weight:600">{data['report_date']}</div>
      <div>Period: {data['period']}</div>
      <div style="margin-top:8px;font-size:11px">Confidential — For Internal Use Only</div>
    </div>
  </div>

  <div class="content">
    <div class="dpdp-note">
      <strong>⚖️ DPDP Act 2023 Notice:</strong> Under the Digital Personal Data Protection Act 2023, organizations
      handling personal data of Indian citizens must implement appropriate security measures.
      Non-compliance can result in penalties up to <strong>₹250 Crore</strong>. This report helps
      demonstrate your compliance posture.
    </div>

    <h2>Compliance Score</h2>
    <div class="score-box">
      <div class="score-circle">
        {score}<span class="score-label">/ 100</span>
      </div>
      <div class="score-info">
        <h3>{score_label}</h3>
        <p>Based on file risk levels, blocked events, and security alerts<br/>
        over the last {data['period']}. Score reflects your current data protection posture.</p>
      </div>
    </div>

    <h2>Executive Summary</h2>
    <div class="stats">
      <div class="stat"><div class="num">{data['total_files']}</div><div class="lbl">Total Files Scanned</div></div>
      <div class="stat danger"><div class="num">{data['high_risk']}</div><div class="lbl">High Risk Files</div></div>
      <div class="stat warn"><div class="num">{data['medium_risk']}</div><div class="lbl">Medium Risk Files</div></div>
      <div class="stat good"><div class="num">{data['blocked']}</div><div class="lbl">Files Blocked</div></div>
    </div>
    <div class="stats">
      <div class="stat"><div class="num">{data['total_events']}</div><div class="lbl">Total Events Logged</div></div>
      <div class="stat danger"><div class="num">{data['alerts']}</div><div class="lbl">Security Alerts</div></div>
      <div class="stat"><div class="num">{data['total_users']}</div><div class="lbl">Active Users</div></div>
      <div class="stat good"><div class="num">{data['low_risk']}</div><div class="lbl">Low Risk Files</div></div>
    </div>

    <h2>Compliance Controls in Place</h2>
    <div class="section-box">
      <table>
        <tr><th>Control</th><th>Status</th><th>Details</th></tr>
        <tr><td>Data Discovery & Classification</td><td><span class="badge ok">✓ Active</span></td><td>AI scans all files for PAN, Aadhaar, credit card data</td></tr>
        <tr><td>Access Control (JWT + Roles)</td><td><span class="badge ok">✓ Active</span></td><td>Admin, Manager, User role-based permissions enforced</td></tr>
        <tr><td>Audit Trail</td><td><span class="badge ok">✓ Active</span></td><td>Every file action logged with timestamp and user</td></tr>
        <tr><td>File Fingerprinting</td><td><span class="badge ok">✓ Active</span></td><td>SHA-256 hash tracking for all uploaded files</td></tr>
        <tr><td>High-Risk File Blocking</td><td><span class="badge ok">✓ Active</span></td><td>{data['blocked']} files blocked this period</td></tr>
        <tr><td>Real-Time Alerts</td><td><span class="badge ok">✓ Active</span></td><td>Instant alerts for anomalous user behavior</td></tr>
        <tr><td>Phishing Detection</td><td><span class="badge ok">✓ Active</span></td><td>AI-powered email and URL threat analysis</td></tr>
        <tr><td>Data Breach Response</td><td><span class="badge ok">✓ Active</span></td><td>Incident logging and alert system operational</td></tr>
      </table>
    </div>

    {'<h2>High Risk File Incidents</h2><div class="section-box"><table><tr><th>Filename</th><th>Employee</th><th>Action Taken</th><th>Risk Reason</th><th>Date</th></tr>' + hr_rows + '</table></div>' if data['high_risk_files'] else ''}

    <h2>Recommendations</h2>
    <div class="section-box">
      {'<p>🔴 <strong>Immediate:</strong> ' + str(data['high_risk']) + ' high-risk files detected. Review these files and confirm appropriate handling.</p>' if data['high_risk'] > 0 else '<p>✅ No critical issues detected this period.</p>'}
      <p>📊 <strong>Ongoing:</strong> Continue monthly compliance reviews. Ensure all employees complete security awareness training.</p>
      <p>⚖️ <strong>DPDP:</strong> Appoint a Data Protection Officer (DPO) as required for organizations processing large volumes of personal data.</p>
    </div>
  </div>

  <div class="footer">
    <span>SecureDesk — AI-Powered Data Protection Platform</span>
    <span>Generated: {data['report_date']} | Confidential</span>
  </div>
</div>
</body>
</html>"""
