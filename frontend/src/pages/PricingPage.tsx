import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

interface RazorpayResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}
import { apiErrorMessage } from "../api/errors";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { Shield, CheckCircle, Zap, Building2, Loader2, Crown } from "lucide-react";

interface Plan {
  name: string; price_inr: number; users: number; scans: number;
  features: string[]; description: string;
}

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans]           = useState<Record<string, Plan>>({});
  const [currentPlan, setCurrentPlan] = useState<string>("trial");
  const [loading, setLoading]       = useState<string | null>(null);

  useEffect(() => {
    api.get("/billing/plans").then(({ data }) => setPlans(data.plans)).catch(() => {});
    api.get("/billing/subscription").then(({ data }) => setCurrentPlan(data.plan)).catch(() => {});
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (!user) { navigate("/login"); return; }
    setLoading(planId);
    try {
      const { data } = await api.post("/billing/create-order", { plan_id: planId });

      if (data.demo) {
        // Demo mode — simulate payment success
        await api.post("/billing/verify", {
          razorpay_order_id:   data.order_id,
          razorpay_payment_id: `demo_pay_${Date.now()}`,
          razorpay_signature:  "demo_sig",
          plan_id:             planId,
        });
        toast.success(`✅ Upgraded to ${plans[planId]?.name}! (Demo mode)`);
        setCurrentPlan(planId);
        return;
      }

      // Real Razorpay checkout
      const rzp = new window.Razorpay!({
        key:         data.key_id,
        amount:      data.amount,
        currency:    "INR",
        name:        "SecureDesk",
        description: `${plans[planId]?.name} Plan - Monthly`,
        order_id:    data.order_id,
        handler: async (response: RazorpayResult) => {
          try {
            await api.post("/billing/verify", {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              plan_id:             planId,
            });
            toast.success(`✅ Payment successful! You are now on ${plans[planId]?.name}`);
            setCurrentPlan(planId);
          } catch { toast.error("Payment verification failed"); }
        },
        prefill: { name: user?.name || "", email: "" },
        theme: { color: "#1657C4" },
      });
      rzp.open();
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e, "Payment failed"));
    } finally { setLoading(null); }
  };

  const planOrder = ["starter", "business", "enterprise"];
  const planIcons: Record<string, React.ReactNode> = {
    starter:    <Zap className="w-5 h-5" />,
    business:   <Shield className="w-5 h-5" />,
    enterprise: <Building2 className="w-5 h-5" />,
  };
  const planColors: Record<string, string> = {
    starter:    "border-teal-600/40 hover:border-teal-500/70",
    business:   "border-indigo-600/60 hover:border-indigo-500/80",
    enterprise: "border-amber-600/40 hover:border-amber-500/70",
  };
  const btnColors: Record<string, string> = {
    starter:    "bg-teal-600 hover:bg-teal-500",
    business:   "bg-indigo-600 hover:bg-indigo-500",
    enterprise: "bg-amber-600 hover:bg-amber-500",
  };
  const badgeColors: Record<string, string> = {
    starter:    "bg-teal-950/60 text-teal-400",
    business:   "bg-indigo-950/60 text-indigo-400",
    enterprise: "bg-amber-950/60 text-amber-400",
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      {/* Header */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 text-center mb-8 md:mb-12">
        <div className="inline-flex items-center gap-2 bg-indigo-950/40 border border-indigo-800/40 text-indigo-400 text-xs md:text-sm font-semibold px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-4 md:mb-6">
          <Crown className="w-3.5 h-3.5" /> Simple, transparent pricing
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 md:mb-3">Choose Your Plan</h1>
        <p className="text-gray-500 text-base md:text-lg max-w-xl mx-auto mb-4">
          Protect your company's data. Start free, upgrade when you're ready.
          Cancel anytime.
        </p>
        <div className="mt-4 bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 md:px-5 py-2.5 md:py-3 inline-block">
          <p className="text-amber-400 text-xs md:text-sm">
            ⚖️ DPDP Act 2023 violation penalty: up to <strong>₹250 Crore</strong> —
            SecureDesk costs a fraction of that risk.
          </p>
        </div>
      </div>

      {/* Plans */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12 px-4 md:px-8">
        {planOrder.map(planId => {
          const plan = plans[planId];
          if (!plan) return null;
          const isCurrent  = currentPlan === planId;
          const isPopular  = planId === "business";

          return (
            <div key={planId}
              className={`relative bg-gray-900 border-2 rounded-2xl p-6 flex flex-col transition-all duration-200 ${planColors[planId]}`}>
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                    MOST POPULAR
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold mb-4 w-fit ${badgeColors[planId]}`}>
                {planIcons[planId]}
                {plan.name}
              </div>

              <div className="mb-1">
                <span className="text-4xl font-bold text-white">₹{plan.price_inr.toLocaleString("en-IN")}</span>
                <span className="text-gray-500 text-sm">/month</span>
              </div>
              <p className="text-gray-500 text-sm mb-5">{plan.description}</p>

              <div className="border-t border-gray-800 pt-5 mb-5 space-y-2">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3">What's included</p>
                {plan.features.map(f => (
                  <div key={f} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm">{f}</span>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-4 space-y-2">
                <div className="flex justify-between text-xs text-gray-500 mb-3">
                  <span>👤 Users: <strong className="text-white">{plan.users === -1 ? "Unlimited" : plan.users}</strong></span>
                  <span>🔍 Scans: <strong className="text-white">{plan.scans === -1 ? "Unlimited" : plan.scans + "/mo"}</strong></span>
                </div>

                {isCurrent ? (
                  <div className="w-full py-3 rounded-xl border border-green-700 bg-green-950/30 text-green-400 text-sm font-semibold text-center flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(planId)}
                    disabled={loading === planId}
                    className={`w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition shadow-lg disabled:opacity-50 ${btnColors[planId]}`}>
                    {loading === planId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {loading === planId ? "Processing..." : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust signals */}
      <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center mb-8">
        {[
          ["🔒", "Secure Payments", "Powered by Razorpay — India's most trusted payment gateway"],
          ["↩️", "Cancel Anytime", "No lock-in. Cancel your subscription at any time, no questions asked"],
          ["🧾", "GST Invoice", "Receive proper GST invoice for all payments — tax deductible"],
        ].map(([icon, title, desc]) => (
          <div key={title as string} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-2xl mb-2">{icon}</div>
            <p className="text-white text-sm font-semibold">{title}</p>
            <p className="text-gray-500 text-xs mt-1">{desc}</p>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto">
        <h3 className="text-white text-lg font-semibold text-center mb-4">Common Questions</h3>
        <div className="space-y-3">
          {[
            ["Can I try before paying?", "Yes — the trial plan gives you 3 users and 20 scans free. No credit card required."],
            ["What happens when I upgrade?", "Immediately unlocks all features for your plan. Your existing data is preserved."],
            ["Is my payment data safe?", "We never store card details. All payments go through Razorpay's PCI-DSS certified gateway."],
            ["Can I upgrade mid-month?", "Yes — you pay pro-rated for the remaining days of the month."],
          ].map(([q, a]) => (
            <div key={q as string} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-white text-sm font-medium mb-1">{q}</p>
              <p className="text-gray-500 text-sm">{a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Add Razorpay script */}
      {typeof window !== "undefined" && !document.getElementById("razorpay-script") && (() => {
        const s = document.createElement("script");
        s.id = "razorpay-script";
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        document.head.appendChild(s);
        return null;
      })()}
    </div>
  );
}
