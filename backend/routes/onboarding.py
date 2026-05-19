import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import db
from routes.auth import get_current_user

router  = APIRouter()
nda_col = db["nda_agreements"]
onb_col = db["onboarding_records"]

NDA_TEXT = """
EMPLOYEE DATA CONFIDENTIALITY AGREEMENT

This agreement is between the Employee and the Company.

1. CONFIDENTIAL DATA: Employee agrees not to share, copy, transmit, 
   or disclose any confidential company data including but not limited to: 
   customer records, financial data, source code, trade secrets, PAN/Aadhaar 
   data, or any personally identifiable information.

2. MONITORING: Employee acknowledges that SecureDesk monitors file sharing 
   activity to protect company data and comply with DPDP Act 2023.

3. CONSEQUENCES: Unauthorized data sharing may result in immediate termination
   and legal action under IT Act 2000 and DPDP Act 2023.

4. DURATION: This agreement remains in effect during employment and 
   for 2 years after termination.

By signing digitally, Employee confirms they have read and agreed to these terms.
"""


class NDASigning(BaseModel):
    agreed: bool
    full_name: str
    employee_id: str = ""
    ip_address: str = ""


class OnboardingComplete(BaseModel):
    department: str = ""
    manager_name: str = ""
    start_date: str = ""


@router.get("/nda/text")
async def get_nda_text():
    """Get the NDA text to display to employee."""
    return {"nda_text": NDA_TEXT.strip(), "version": "1.0", "effective_date": "2024-01-01"}


@router.post("/nda/sign")
async def sign_nda(body: NDASigning, user=Depends(get_current_user)):
    """Employee digitally signs the NDA."""
    if not body.agreed:
        raise HTTPException(400, "You must agree to the NDA to proceed")

    existing = await nda_col.find_one({"user_id": user["_id"]})
    if existing:
        return {
            "signed":      True,
            "signed_at":   existing.get("signed_at","").isoformat() if hasattr(existing.get("signed_at"),"isoformat") else "",
            "message":     "NDA already signed",
            "agreement_id": str(existing["_id"]),
        }

    agreement_id = str(uuid.uuid4())
    signed_at    = datetime.utcnow()

    await nda_col.insert_one({
        "_id":         agreement_id,
        "user_id":     user["_id"],
        "user_name":   user["name"],
        "full_name":   body.full_name,
        "employee_id": body.employee_id,
        "agreed":      True,
        "nda_version": "1.0",
        "ip_address":  body.ip_address,
        "signed_at":   signed_at,
        "org_id":      user.get("org_id",""),
        "org_name":    user.get("org_name",""),
    })

    return {
        "signed":       True,
        "agreement_id": agreement_id,
        "signed_at":    signed_at.isoformat(),
        "message":      "NDA signed successfully. Welcome to the team.",
        "user":         user["name"],
    }


@router.get("/nda/status")
async def nda_status(user=Depends(get_current_user)):
    doc = await nda_col.find_one({"user_id": user["_id"]})
    if not doc:
        return {"signed": False, "message": "NDA not yet signed"}
    return {
        "signed":       True,
        "signed_at":    doc["signed_at"].isoformat() if hasattr(doc.get("signed_at"),"isoformat") else "",
        "agreement_id": str(doc["_id"]),
        "full_name":    doc.get("full_name",""),
    }


@router.get("/nda/list")
async def list_ndas(user=Depends(get_current_user)):
    if user.get("role") not in ("admin","manager"):
        raise HTTPException(403, "Admin access required")
    cur = nda_col.find({}, sort=[("signed_at",-1)])
    out = []
    async for d in cur:
        if hasattr(d.get("signed_at"),"isoformat"): d["signed_at"] = d["signed_at"].isoformat()
        out.append(d)
    return out


@router.post("/complete")
async def complete_onboarding(body: OnboardingComplete, user=Depends(get_current_user)):
    nda = await nda_col.find_one({"user_id": user["_id"]})
    if not nda:
        raise HTTPException(400, "Must sign NDA before completing onboarding")

    await onb_col.insert_one({
        "_id":          str(uuid.uuid4()),
        "user_id":      user["_id"],
        "user_name":    user["name"],
        "department":   body.department,
        "manager_name": body.manager_name,
        "start_date":   body.start_date,
        "nda_signed":   True,
        "completed_at": datetime.utcnow(),
        "org_id":       user.get("org_id",""),
    })
    return {"onboarding_complete": True, "message": "Welcome! Your account is fully set up."}


@router.get("/status")
async def onboarding_status(user=Depends(get_current_user)):
    nda    = await nda_col.find_one({"user_id": user["_id"]})
    onb    = await onb_col.find_one({"user_id": user["_id"]})
    return {
        "nda_signed":           bool(nda),
        "onboarding_complete":  bool(onb),
        "steps_completed":      (1 if nda else 0) + (1 if onb else 0),
        "steps_total":          2,
    }
