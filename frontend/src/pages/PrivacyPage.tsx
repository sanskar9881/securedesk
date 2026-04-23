import { useState } from "react";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import { ChevronDown, ShieldCheck } from "lucide-react";

const FAQ = [
  {
    q: "What data does SecureDesk collect?",
    a: "SecureDesk collects your name, email/phone, file metadata (name, size, type), email subject and body text for AI classification, and transaction timestamps. We do NOT store file contents permanently — files are analyzed and discarded."
  },
  {
    q: "How is my data stored and protected?",
    a: "All data is stored in a MongoDB database with access controls. Passwords are hashed using bcrypt with a cost factor of 12. JWT tokens with 24-hour expiry are used for session management. All API communication uses HTTPS in production."
  },
  {
    q: "How does the AI classification work?",
    a: "SecureDesk uses a Random Forest machine learning model trained on labeled email samples. It analyzes subject lines, body text, suspicious keywords, file extensions, URLs, and urgency signals to compute a risk score between 0–100%."
  },
  {
    q: "Who can see my transaction history?",
    a: "Only you can see your own transaction history. Admins can see all transactions system-wide for security monitoring purposes. No third parties have access to your data."
  },
  {
    q: "Can I delete my account and data?",
    a: "Yes. Contact your system administrator to request account deletion. Upon deletion, all your personal data, transaction logs, and chat history will be permanently removed from the database within 30 days."
  },
  {
    q: "How does phishing detection work?",
    a: "The phishing detector combines ML classification with rule-based analysis: it checks for suspicious URLs, IP-based links, brand impersonation, urgency manipulation language, spoofed sender patterns, and malicious keywords."
  },
  {
    q: "Is my file content read by anyone?",
    a: "No human reads your file content. Files are processed only by our automated AI system to extract metadata (filename, size, extension) for risk scoring. The file content is not stored on our servers."
  },
  {
    q: "How long is data retained?",
    a: "Transaction logs are retained for 90 days by default. Chat history is retained for 30 days. Admins can configure custom retention policies. Password reset tokens expire after 1 hour."
  },
  {
    q: "Does SecureDesk share data with third parties?",
    a: "No. SecureDesk does not sell, rent, or share your personal data with any third parties. The AI chatbot uses Anthropic's API — only your message text is sent, never personal identifiers."
  },
  {
    q: "How do I report a privacy concern?",
    a: "Contact your organization's IT security team or the SecureDesk administrator. All reports are acknowledged within 24 hours."
  },
];

export default function PrivacyPage() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8">
        <Header title="Privacy Center" subtitle="Your data privacy questions answered" />

        <div className="max-w-2xl">
          <div className="bg-gradient-to-br from-indigo-950/60 to-gray-900 border border-indigo-800/30 rounded-2xl p-6 mb-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">SecureDesk Privacy Commitment</h3>
              <p className="text-gray-400 text-sm mt-1">
                We are committed to protecting your data and being transparent about how we use it.
                SecureDesk is built for corporate security — not surveillance.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-800/40 transition"
                >
                  <span className="flex-1 text-white text-sm font-medium">{item.q}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`} />
                </button>
                {open === i && (
                  <div className="px-5 pb-4 border-t border-gray-800">
                    <p className="text-gray-400 text-sm leading-relaxed pt-3">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-gray-600 text-xs text-center mt-6">
            Last updated: April 2026 · Built with love from Sanskar Hadole ❤️
          </p>
        </div>
      </main>
    </div>
  );
}