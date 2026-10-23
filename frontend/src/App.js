import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Show, SignIn, SignUp } from "@clerk/react";
import { Toaster } from "@/components/ui/sonner";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import { MeProvider, useMe } from "@/context/MeContext";
import AppShell from "@/components/AppShell";
import Landing from "@/pages/Landing";
import Pending from "@/pages/Pending";
import Dashboard from "@/pages/Dashboard";
import Leakages from "@/pages/Leakages";
import CaseDetail from "@/pages/CaseDetail";
import Pipeline from "@/pages/Pipeline";
import Ingest from "@/pages/Ingest";
import Contracts from "@/pages/Contracts";
import Assurance from "@/pages/Assurance";
import Copilot from "@/pages/Copilot";
import AuditLog from "@/pages/AuditLog";
import Admin from "@/pages/Admin";
import Scenarios from "@/pages/Scenarios";

const AuthPage = ({ children }) => (
  <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
    <div className="hidden lg:flex relative mesh dots flex-col justify-between p-12 border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5"><div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center text-white font-extrabold text-xs font-mono">LR</div><span className="font-bold text-slate-900" style={{ fontFamily: "Outfit" }}>L&amp;R Accelerator</span></div>
      <div>
        <h2 className="text-4xl font-bold max-w-md">Every fee, deduction, invoice and payment — checked against what was agreed.</h2>
        <p className="text-slate-500 mt-4 max-w-md text-sm">Detect leakage across partners, suppliers and customers, route it to the right approver, and recover it with an evidence-backed claim.</p>
      </div>
      <div className="text-xs text-slate-500">Role-based access · Dual control · Immutable audit trail</div>
    </div>
    <div className="flex items-center justify-center p-6">{children}</div>
  </div>
);

const Gate = () => {
  const { me } = useMe();
  if (me.role === "pending") return <Pending />;
  return <AppShell />;
};

const Protected = () => (
  <>
    <Show when="signed-in"><MeProvider><Outlet /></MeProvider></Show>
    <Show when="signed-out"><Navigate to="/sign-in" replace /></Show>
  </>
);

const Home = () => (
  <>
    <Show when="signed-in"><Navigate to="/app" replace /></Show>
    <Show when="signed-out"><Landing /></Show>
  </>
);

function App() {
  return (
    <BrowserRouter>
      <ClerkAuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sign-in/*" element={<AuthPage><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp /></AuthPage>} />
          <Route path="/sign-up/*" element={<AuthPage><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></AuthPage>} />
          <Route element={<Protected />}>
            <Route path="/app" element={<Gate />}>
              <Route index element={<Dashboard />} />
              <Route path="leakages" element={<Leakages />} />
              <Route path="leakages/:id" element={<CaseDetail />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="ingest" element={<Ingest />} />
              <Route path="contracts" element={<Contracts />} />
              <Route path="assurance" element={<Assurance />} />
              <Route path="copilot" element={<Copilot />} />
              <Route path="audit" element={<AuditLog />} />
              <Route path="admin" element={<Admin />} />
              <Route path="scenarios" element={<Scenarios />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster theme="light" position="top-right" richColors />
      </ClerkAuthProvider>
    </BrowserRouter>
  );
}

export default App;
