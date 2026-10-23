import { UserButton } from "@clerk/react";
import { Clock } from "lucide-react";
import { useMe } from "@/context/MeContext";

export default function Pending() {
  const { me, reload } = useMe();
  return (
    <div className="min-h-screen grid place-items-center p-6 grid-bg">
      <div className="panel p-8 max-w-md text-center rise" data-testid="pending-approval">
        <Clock className="h-8 w-8 text-amber-400 mx-auto" />
        <h1 className="text-2xl font-semibold text-white mt-4">Waiting for access</h1>
        <p className="text-sm text-slate-400 mt-2">You're signed in as <span className="text-white">{me.email}</span>. An Admin needs to assign you a role (Analyst, Approver, Assurance, Rule Author or Viewer / CFO) before you can see financial data.</p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={reload} data-testid="pending-refresh-button" className="px-4 py-2 text-sm rounded-sm bg-emerald-500 text-[#0b0f19] font-semibold hover:bg-emerald-400">Check again</button>
          <UserButton />
        </div>
      </div>
    </div>
  );
}
