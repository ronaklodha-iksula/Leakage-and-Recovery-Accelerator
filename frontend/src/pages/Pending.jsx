import { useClerk } from "@clerk/react";
import { Clock } from "lucide-react";
import { useMe } from "@/context/MeContext";

export default function Pending() {
  const { me, reload } = useMe();
  const { signOut } = useClerk();
  return (
    <div className="min-h-screen grid place-items-center p-6 mesh bg-slate-50">
      <div className="panel p-8 max-w-md text-center rise shadow-lg" data-testid="pending-approval">
        <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 grid place-items-center mx-auto"><Clock className="h-6 w-6" /></div>
        <h1 className="text-2xl font-bold mt-4">Waiting for access</h1>
        <p className="text-sm text-slate-500 mt-2">You're signed in as <span className="text-slate-900 font-semibold">{me.email}</span>. An Admin needs to assign you a role (Analyst, Approver, Assurance, Rule Author or Viewer / CFO) before you can see financial data.</p>
        <p className="text-xs text-slate-400 mt-3">Are you the owner? Sign out and sign in with your admin email, or ask your Admin to approve you in Team &amp; Settings.</p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <button onClick={reload} data-testid="pending-refresh-button" className="btn-primary">Check again</button>
          <button onClick={() => signOut({ redirectUrl: "/sign-in" })} data-testid="pending-signout-button" className="btn-secondary">Sign out / switch account</button>
        </div>
      </div>
    </div>
  );
}
