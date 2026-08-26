import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { SidebarProvider } from "./context/SidebarContext";
import ProtectedRoute from "./components/ProtectedRoute";

import LandingPage          from "./pages/LandingPage";
import LoginPage            from "./pages/LoginPage";
import RegisterPage         from "./pages/RegisterPage";
import ForgotPasswordPage   from "./pages/ForgotPasswordPage";
import OnboardingPage       from "./pages/OnboardingPage";
import UserDashboard        from "./pages/UserDashboard";
import FileSharePage        from "./pages/FileSharePage";
import HistoryPage          from "./pages/HistoryPage";
import AdminDashboard       from "./pages/AdminDashboard";
import AdminUsersPage       from "./pages/AdminUsersPage";
import ProfilePage          from "./pages/ProfilePage";
import SettingsPage         from "./pages/SettingsPage";
import LanguagePage         from "./pages/LanguagePage";
import PrivacyPage          from "./pages/PrivacyPage";
import PhishingPage         from "./pages/PhishingPage";
import ChatPage             from "./pages/ChatPage";
import DLPScanPage          from "./pages/DLPScanPage";
import AICopilotPage        from "./pages/AICopilotPage";
import ActivityLogsPage     from "./pages/ActivityLogsPage";
import FileFingerprintPage  from "./pages/FileFingerprintPage";
import CompliancePage       from "./pages/CompliancePage";
import UEBAPage             from "./pages/UEBAPage";
import OrganizationPage     from "./pages/OrganizationPage";
import WhatsAppLogsPage     from "./pages/WhatsAppLogsPage";
import PricingPage          from "./pages/PricingPage";
import DevicesPage          from "./pages/DevicesPage";
import MyDevicesPage        from "./pages/MyDevicesPage";
import EvidencePage         from "./pages/EvidencePage";
import ExtensionPage        from "./pages/ExtensionPage";

export default function App() {
  return (
    <AuthProvider>
      <SidebarProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { background: "#1f2937", color: "#f9fafb", border: "1px solid #374151" },
          duration: 4000,
        }}/>
        <Routes>
          {/* Public */}
          <Route path="/"              element={<LandingPage />} />
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/register"      element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/pricing"       element={<PricingPage />} />
          <Route path="/extension"     element={<ExtensionPage />} />
          <Route path="/onboarding"    element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

          {/* User */}
          <Route path="/dashboard"  element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
          <Route path="/share"      element={<ProtectedRoute><FileSharePage /></ProtectedRoute>} />
          <Route path="/history"    element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin"          element={<ProtectedRoute allow={["admin", "manager"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users"    element={<ProtectedRoute allow={["admin"]}><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/admin/devices"  element={<ProtectedRoute allow={["admin"]}><DevicesPage /></ProtectedRoute>} />
          <Route path="/admin/evidence" element={<ProtectedRoute allow={["admin", "manager"]}><EvidencePage /></ProtectedRoute>} />

          {/* Shared */}
          <Route path="/profile"           element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/settings"          element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/settings/language" element={<ProtectedRoute><LanguagePage /></ProtectedRoute>} />
          <Route path="/settings/privacy"  element={<ProtectedRoute><PrivacyPage /></ProtectedRoute>} />
          <Route path="/settings/devices"  element={<ProtectedRoute><MyDevicesPage /></ProtectedRoute>} />
          <Route path="/phishing"          element={<ProtectedRoute><PhishingPage /></ProtectedRoute>} />
          <Route path="/chat"              element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

          {/* DLP */}
          <Route path="/dlp"          element={<ProtectedRoute><DLPScanPage /></ProtectedRoute>} />
          <Route path="/ai-copilot"   element={<ProtectedRoute><AICopilotPage /></ProtectedRoute>} />
          <Route path="/activity"     element={<ProtectedRoute><ActivityLogsPage /></ProtectedRoute>} />
          <Route path="/fingerprints" element={<ProtectedRoute allow={["admin", "manager"]}><FileFingerprintPage /></ProtectedRoute>} />

          {/* Enterprise */}
          <Route path="/compliance"    element={<ProtectedRoute allow={["admin", "manager"]}><CompliancePage /></ProtectedRoute>} />
          <Route path="/ueba"          element={<ProtectedRoute allow={["admin", "manager"]}><UEBAPage /></ProtectedRoute>} />
          <Route path="/organization"  element={<ProtectedRoute allow={["admin"]}><OrganizationPage /></ProtectedRoute>} />
          <Route path="/whatsapp-logs" element={<ProtectedRoute allow={["admin", "manager"]}><WhatsAppLogsPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </SidebarProvider>
    </AuthProvider>
  );
}
