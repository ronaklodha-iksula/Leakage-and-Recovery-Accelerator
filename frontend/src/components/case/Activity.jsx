import { useState } from "react";
import { toast } from "sonner";
import { useApi, errMsg } from "@/lib/api";
import { useMe } from "@/context/MeContext";
import { fmtDateTime } from "@/lib/format";
import { Panel } from "@/components/common";

export default function Activity({ c, onChange }) {
  const api = useApi();
  const { can } = useMe();
  const [text, setText] = useState("");
  const [tab, setTab] = useState("comments");
  const post = async (e) => {
    e.preventDefault();
    try { await api.post(`/cases/${c.id}/comments`, { text }); setText(""); onChange(); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <Panel testId="case-activity">
      <div className="flex gap-4 border-b border-border mb-4 -mt-1">
        {[["comments", `Comments (${c.comments.length})`], ["history", "Audit trail"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`activity-tab-${k}`} className={`pb-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? "border-emerald-600 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-900"}`}>{l}</button>
        ))}
      </div>
      {tab === "comments" ? (
        <div>
          <div className="space-y-3 max-h-80 overflow-auto">
            {!c.comments.length && <div className="text-sm text-slate-500">No comments yet.</div>}
            {c.comments.map((m) => (
              <div key={m.id} className="text-sm" data-testid={`comment-${m.id}`}>
                <div className="text-xs"><span className="font-semibold text-slate-900">{m.name}</span> <span className="text-slate-400">· {m.role} · {fmtDateTime(m.ts)}</span></div>
                <div className="text-slate-700 mt-0.5 whitespace-pre-wrap">{m.text}</div>
              </div>
            ))}
          </div>
          {can("comment") && (
            <form onSubmit={post} className="mt-3 flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add context, @mention in text…" className="field flex-1 min-w-0" data-testid="comment-input" />
              <button disabled={!text.trim()} className="btn-secondary px-3" data-testid="comment-submit-button">Post</button>
            </form>
          )}
        </div>
      ) : (
        <ol className="relative border-l border-slate-200 ml-1 space-y-4 max-h-96 overflow-auto" data-testid="case-history">
          {c.history.map((h) => (
            <li key={h.id} className="pl-4 relative">
              <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-white border-2 border-emerald-500" />
              <div className="text-xs font-semibold text-slate-900 capitalize">{h.action.replace("case.", "").replace(/_/g, " ")}</div>
              <div className="text-[11px] text-slate-500">{h.actor_name} · {h.actor_role} · {fmtDateTime(h.ts)}</div>
              {h.detail && <div className="text-xs text-slate-500 mt-0.5">{h.detail}</div>}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
