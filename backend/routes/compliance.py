"""
Compliance Routes — DPDP Act 2023 compliance reports.
GET  /api/compliance/report        → HTML report
GET  /api/compliance/score         → Quick compliance score
GET  /api/compliance/report/data   → Raw JSON, same data the report is built from
"""
from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse

from core.database import get_db
from core.dependencies import get_tenant_id
from routes.auth import get_current_user
from services.compliance_service import gather_compliance_data, generate_html_report

router = APIRouter()


@router.get("/report", response_class=HTMLResponse)
async def compliance_report(
    period: int = 30, user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    org_name = user.get("org_name", "Your Organization")
    data     = await gather_compliance_data(db, org_id, org_name, period)
    html     = generate_html_report(data)
    return HTMLResponse(content=html)


@router.get("/score")
async def compliance_score(
    user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    org_name = user.get("org_name", "Your Organization")
    data     = await gather_compliance_data(db, org_id, org_name, 30)
    return {
        "score":           data["compliance_score"],
        "label":           "COMPLIANT" if data["compliance_score"] >= 80 else "NEEDS ATTENTION" if data["compliance_score"] >= 60 else "AT RISK",
        "total_files":     data["total_files"],
        "high_risk":       data["high_risk"],
        "blocked":         data["blocked"],
        "total_events":    data["total_events"],
        "alerts":          data["alerts"],
        "period_days":     30,
    }


@router.get("/report/data")
async def compliance_data(
    user=Depends(get_current_user),
    org_id: str = Depends(get_tenant_id), db=Depends(get_db),
):
    org_name = user.get("org_name", "Your Organization")
    return await gather_compliance_data(db, org_id, org_name, 30)
