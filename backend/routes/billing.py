import os, uuid, hmac, hashlib
from core.errors import safe_502
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.config import get_settings
from database import db
from routes.auth import get_current_user

router  = APIRouter()
sub_col = db["subscriptions"]
pay_col = db["payments"]

PLANS = {
    "starter": {
        "name":        "Starter",
        "price_inr":   2999,
        "price_id":    "plan_starter",
        "users":       10,
        "scans":       50,
        "features":    ["DLP Scanner","Phishing Detector","Activity Logs","Basic Compliance Report"],
        "description": "Perfect for small teams up to 10 users",
    },
    "business": {
        "name":        "Business",
        "price_inr":   8999,
        "price_id":    "plan_business",
        "users":       100,
        "scans":       -1,   # unlimited
        "features":    ["Everything in Starter","Unlimited scans","AI Copilot","UEBA Behavior Analytics",
                        "WhatsApp DLP","Email Alerts","Organization Management","Priority Support"],
        "description": "For growing teams up to 100 users",
    },
    "enterprise": {
        "name":        "Enterprise",
        "price_inr":   24999,
        "price_id":    "plan_enterprise",
        "users":       -1,   # unlimited
        "scans":       -1,
        "features":    ["Everything in Business","Unlimited users","Custom integrations",
                        "Dedicated support","SLA guarantee","On-premise option","API access"],
        "description": "For large organizations with 100+ users",
    },
}


class CreateOrder(BaseModel):
    plan_id: str   # starter | business | enterprise


class VerifyPayment(BaseModel):
    razorpay_order_id:   str
    razorpay_payment_id: str
    razorpay_signature:  str
    plan_id:             str


@router.get("/plans")
async def list_plans():
    return {"plans": PLANS}


@router.get("/subscription")
async def get_subscription(user=Depends(get_current_user)):
    sub = await sub_col.find_one({"user_id": user["_id"]}, sort=[("created_at",-1)])
    if not sub:
        return {
            "plan":    "trial",
            "status":  "active",
            "expires": None,
            "message": "You are on the free trial",
            "limits":  {"users":3,"scans":20},
        }
    expires = sub.get("expires_at")
    return {
        "plan":       sub.get("plan","trial"),
        "status":     "active" if not expires or expires > datetime.now(timezone.utc) else "expired",
        "expires":    expires.isoformat() if isinstance(expires,datetime) else None,
        "payment_id": sub.get("payment_id",""),
        "created_at": sub["created_at"].isoformat() if hasattr(sub.get("created_at"),"isoformat") else "",
        "limits":     PLANS.get(sub.get("plan","starter"),{}).get("users",-1),
    }


@router.post("/create-order")
async def create_order(body: CreateOrder, user=Depends(get_current_user)):
    plan = PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(400, f"Invalid plan: {body.plan_id}")

    razorpay_key = os.getenv("RAZORPAY_KEY_ID","")
    razorpay_secret = os.getenv("RAZORPAY_KEY_SECRET","")

    if not razorpay_key or not razorpay_secret:
        # Demo mode - return fake order for testing
        return {
            "order_id":  f"demo_order_{uuid.uuid4().hex[:12]}",
            "amount":    plan["price_inr"] * 100,  # paise
            "currency":  "INR",
            "plan_id":   body.plan_id,
            "plan_name": plan["name"],
            "key_id":    "demo_mode",
            "demo":      True,
            "message":   "Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to Render env vars for live payments",
        }

    try:
        import razorpay
        client = razorpay.Client(auth=(razorpay_key, razorpay_secret))
        order  = client.order.create({
            "amount":   plan["price_inr"] * 100,
            "currency": "INR",
            "notes":    {"user_id": user["_id"], "plan": body.plan_id, "user_name": user["name"]},
        })
        return {
            "order_id":  order["id"],
            "amount":    order["amount"],
            "currency":  "INR",
            "plan_id":   body.plan_id,
            "plan_name": plan["name"],
            "key_id":    razorpay_key,
        }
    except Exception as e:
        # The gateway's message can carry key ids and internal detail — log it,
        # return a clean reference to the caller.
        raise safe_502("razorpay create_order", e)


@router.post("/verify")
async def verify_payment(body: VerifyPayment, user=Depends(get_current_user)):
    """
    Record a subscription against a gateway-confirmed payment.

    This endpoint decides whether someone has paid, so it fails closed at
    every branch. Two ways it previously failed open:

    1. The HMAC check was wrapped in `if razorpay_secret:`. With the secret
       unset — which is every environment today — the signature was not
       checked at all and the subscription was still written as verified.
       A missing secret is now a hard 503: we cannot verify, so we refuse.

    2. Demo mode keyed off `razorpay_order_id.startswith("demo_")`, which is
       caller-supplied. Any signed-in user could post an order id beginning
       "demo_" and be granted a paid plan outright — with real keys
       configured, because the demo branch ran before the signature check.
       Demo mode is now a server-side decision: never in production, and
       only when no gateway credentials are configured at all.

    The router is currently unmounted in main.py; self-serve checkout is off
    the roadmap and first customers are invoiced manually. These guards are
    what has to hold before it is ever mounted again.
    """
    settings = get_settings()
    razorpay_key    = os.getenv("RAZORPAY_KEY_ID", "")
    razorpay_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

    # Demo mode: decided by server configuration only, never by the request.
    demo_mode = not settings.is_production and not razorpay_key and not razorpay_secret

    if demo_mode:
        plan_info = PLANS.get(body.plan_id, {})
        await sub_col.insert_one({
            "_id":        str(uuid.uuid4()),
            "user_id":    user["_id"],
            "user_name":  user["name"],
            "plan":       body.plan_id,
            "payment_id": "demo_payment",
            "order_id":   body.razorpay_order_id,
            "amount":     plan_info.get("price_inr",0),
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
            "demo":       True,
        })
        return {"verified":True,"plan":body.plan_id,"message":"Demo payment recorded","demo":True}

    # No secret means no way to verify. Refuse — never skip.
    if not razorpay_secret:
        raise HTTPException(
            503,
            "Payments are not configured on this server, so this payment cannot be verified.",
        )

    expected = hmac.new(
        razorpay_secret.encode(),
        f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode(),
        hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(400, "Payment verification failed - invalid signature")

    plan_info = PLANS.get(body.plan_id, {})
    await sub_col.insert_one({
        "_id":        str(uuid.uuid4()),
        "user_id":    user["_id"],
        "user_name":  user["name"],
        "plan":       body.plan_id,
        "payment_id": body.razorpay_payment_id,
        "order_id":   body.razorpay_order_id,
        "amount":     plan_info.get("price_inr",0),
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
    })
    await pay_col.insert_one({
        "_id":        str(uuid.uuid4()),
        "user_id":    user["_id"],
        "payment_id": body.razorpay_payment_id,
        "plan":       body.plan_id,
        "amount":     plan_info.get("price_inr",0),
        "timestamp":  datetime.now(timezone.utc),
    })
    return {"verified":True,"plan":body.plan_id,"message":f"Payment successful! You are now on {plan_info.get('name','?')} plan."}
