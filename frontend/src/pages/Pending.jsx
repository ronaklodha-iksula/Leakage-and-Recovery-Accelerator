import { useClerk } from "@clerk/react";
import { Clock } from "lucide-react";
import { useMe } from "@/context/MeContext";

export default function Pending() {
  const { me, reload } = useMe();
  const { signOut } = useClerk();
  return (
    <div className="min-h-screen grid place-items-center p-6 grid-bg">
      <div className="panel p-8 max-w-md text-center rise" data-testid="pending-approval">
        <Clock className="h-8 w-8 text-amber-400 mx-auto" />
        <h1 className="text-2xl font-semibold text-white mt-4">Waiting for access</h1>
        <p className="text-sm text-slate-400 mt-2">You're signed in as <span className="text-white">{me.email}</span>. An Admin needs to assign you a role (Analyst, Approver, Assurance, Rule Author or Viewer / CFO) before you can see financial data.</p>
        <p className="text-xs text-slate-500 mt-3">Are you the owner? Sign out and sign in with your admin email, or ask your Admin to approve you in Team &amp; Settings.</p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={reload} data-testid="pending-refresh-button" className="px-4 py-2 text-sm rounded-sm bg-emerald-500 text-[#0b0f19] font-semibold hover:bg-emerald-400">Check again</button>
          <button onClick={() => signOut({ redirectUrl: "/sign-in" })} data-testid="pending-signout-button" className="px-4 py-2 text-sm rounded-sm border border-border text-slate-200 hover:bg-slate-800 hover:text-white">Sign out / switch account</button>
        </div>
      </div>
    </div>
  );
}
