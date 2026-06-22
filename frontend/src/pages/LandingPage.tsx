import { Link } from "react-router-dom";
import { Shield, CheckCircle, ArrowRight, Zap, Brain, MessageCircle, FileCheck, TrendingUp, Building2 } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-gray-800 px-4 md:px-8 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white"/>
          </div>
          <span className="font-bold text-base md:text-lg">SecureDesk</span>
        </div>
        <div className="hidden md:flex items-center gap-4 lg:gap-6 text-xs md:text-sm text-gray-400">
          <Link to="/pricing" className="hover:text-white transition">Pricing</Link>
          <a href="mailto:sanskar@securedesk.in" className="hover:text-white transition">Contact</a>
          <Link to="/login" className="hover:text-white transition">Login</Link>
          <Link to="/register" className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 md:px-4 py-2 rounded-xl font-medium transition">
            Get Started
          </Link>
        </div>
        <div className="md:hidden">
          <Link to="/register" className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-xs rounded-lg font-medium transition">
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-12 md:pt-20 pb-10 md:pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-950/60 border border-indigo-800/40 text-indigo-400 text-xs font-semibold px-3 md:px-4 py-1.5 md:py-2 rounded-full mb-4 md:mb-6 flex-wrap justify-center">
          🇮🇳 Built for Indian Companies — DPDP Act 2023 Compliant
        </div>
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6 leading-tight">
          Stop Data Leaks<br/>
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Before They Happen
          </span>
        </h1>
        <p className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto mb-6 md:mb-8 px-2">
          AI-powered Data Loss Prevention for Indian startups and companies.
          Scans every file, monitors WhatsApp sharing, and alerts managers in real-time.
        </p>
        <div className="flex items-center justify-center gap-3 md:gap-4 flex-wrap">
          <Link to="/register"
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 md:px-8 py-2.5 md:py-4 rounded-xl font-semibold text-sm md:text-lg flex items-center gap-2 transition shadow-xl shadow-indigo-500/20">
            Start Free Trial <ArrowRight className="w-4 md:w-5 h-4 md:h-5"/>
          </Link>
          <Link to="/pricing"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white px-5 md:px-8 py-2.5 md:py-4 rounded-xl font-semibold text-sm md:text-lg transition">
            View Pricing
          </Link>
        </div>
        <p className="text-gray-600 text-xs md:text-sm mt-3 md:mt-4">No credit card required · 3 users free forever</p>

        {/* Social proof */}
        <div className="mt-8 md:mt-12 flex items-center justify-center gap-3 md:gap-8 text-xs md:text-sm text-gray-500 flex-wrap">
          <div className="flex items-center gap-1.5"><CheckCircle className="w-3 md:w-4 h-3 md:h-4 text-green-400"/>DPDP Act 2023 Ready</div>
          <div className="flex items-center gap-1.5"><CheckCircle className="w-3 md:w-4 h-3 md:h-4 text-green-400"/>WhatsApp Monitoring</div>
          <div className="flex items-center gap-1.5"><CheckCircle className="w-3 md:w-4 h-3 md:h-4 text-green-400"/>AI Risk Detection</div>
          <div className="flex items-center gap-1.5"><CheckCircle className="w-3 md:w-4 h-3 md:h-4 text-green-400"/>Compliance Report</div>
        </div>
      </section>

      {/* The problem */}
      <section className="bg-gray-900/50 border-y border-gray-800 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center">
          <p className="text-gray-500 text-xs md:text-sm uppercase tracking-wider mb-2 md:mb-3">The Real Problem</p>
          <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Indian companies lose data through <span className="text-red-400">WhatsApp</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-3xl mx-auto">
            {[
              ["₹250 Crore", "DPDP Act max penalty per violation"],
              ["74%", "of Indian companies faced phishing in 2023"],
              ["#1", "WhatsApp is India's top data leak channel"],
            ].map(([n, l]) => (
              <div key={l as string} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 md:p-6 text-center">
                <p className="text-2xl md:text-3xl font-bold text-red-400 mb-2">{n}</p>
                <p className="text-gray-400 text-xs md:text-sm">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-20">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3">Everything you need to protect company data</h2>
          <p className="text-gray-500 text-sm md:text-base">Built specifically for Indian companies. No IT team required.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[
            { icon:<Brain className="w-6 h-6"/>, color:"text-indigo-400 bg-indigo-950/50 border-indigo-800/40", title:"AI Risk Detection", desc:"Automatically scans every file for PAN cards, Aadhaar, credit cards, API keys. Know the risk before sharing." },
            { icon:<MessageCircle className="w-6 h-6"/>, color:"text-green-400 bg-green-950/50 border-green-800/40", title:"WhatsApp DLP — India First", desc:"Only tool that monitors WhatsApp Web file sharing. Catches 60%+ of corporate data leaks in Indian companies." },
            { icon:<FileCheck className="w-6 h-6"/>, color:"text-amber-400 bg-amber-950/50 border-amber-800/40", title:"DPDP Compliance Report", desc:"One-click professional compliance report. Show auditors, clients, and legal teams you take data seriously." },
            { icon:<TrendingUp className="w-6 h-6"/>, color:"text-purple-400 bg-purple-950/50 border-purple-800/40", title:"Behavior Analytics (UEBA)", desc:"Learns each employee's normal patterns. Instantly alerts when someone downloads 200 files at midnight." },
            { icon:<Shield className="w-6 h-6"/>, color:"text-teal-400 bg-teal-950/50 border-teal-800/40", title:"Chrome Extension", desc:"Monitors file uploads on every website — Gmail, Google Drive, Dropbox, WhatsApp Web — automatically." },
            { icon:<Building2 className="w-6 h-6"/>, color:"text-red-400 bg-red-950/50 border-red-800/40", title:"Digital NDA & Onboarding", desc:"Employees sign a digital NDA when joining. Every signature legally recorded with timestamp and IP address." },
          ].map(f => (
            <div key={f.title} className={`bg-gray-900 border rounded-2xl p-4 md:p-6`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border mb-4 ${f.color}`}>
                {f.icon}
              </div>
              <h3 className="text-white font-semibold mb-2 text-sm md:text-base">{f.title}</h3>
              <p className="text-gray-500 text-xs md:text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="bg-gradient-to-r from-indigo-950/50 to-purple-950/50 border-y border-indigo-800/30 py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-4 md:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3">10x cheaper than enterprise tools</h2>
          <p className="text-gray-400 mb-6 md:mb-8 text-sm md:text-base">Symantec DLP costs ₹50 lakh/year. SecureDesk starts at ₹2,999/month.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
            {[
              ["Starter", "₹2,999/mo", "Up to 10 users"],
              ["Business", "₹8,999/mo", "Up to 100 users"],
              ["Enterprise", "₹24,999/mo", "Unlimited users"],
            ].map(([name, price, users]) => (
              <div key={name as string} className="bg-gray-900 border border-gray-800 rounded-xl p-3 md:p-4 text-center">
                <p className="text-white font-semibold text-xs md:text-sm">{name}</p>
                <p className="text-xl md:text-2xl font-bold text-indigo-400 my-1">{price}</p>
                <p className="text-gray-500 text-xs">{users}</p>
              </div>
            ))}
          </div>
          <Link to="/pricing" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 md:px-8 py-2.5 md:py-3 rounded-xl font-semibold text-sm md:text-base transition inline-flex items-center gap-2">
            See Full Pricing <ArrowRight className="w-4 h-4"/>
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-20 text-center">
        <h2 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">Ready to protect your company's data?</h2>
        <p className="text-gray-500 text-base md:text-lg mb-6 md:mb-8">
          Join companies using SecureDesk to stay DPDP compliant and prevent data leaks.
        </p>
        <Link to="/register"
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-8 md:px-10 py-3 md:py-4 rounded-xl font-semibold text-base md:text-lg inline-flex items-center gap-2 transition shadow-xl shadow-indigo-500/20">
          Start Free — No Credit Card <ArrowRight className="w-5 h-5"/>
        </Link>
        <p className="text-gray-700 text-xs md:text-sm mt-6 md:mt-8">
          Built with ❤️ by Sanskar Hadole · securedesk.in
        </p>
      </section>
    </div>
  );
}
