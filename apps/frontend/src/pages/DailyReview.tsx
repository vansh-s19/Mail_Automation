import { useEffect, useState } from "react";
import { api, ApiError, DailyQueueRow } from "../lib/api";
import { RefreshIcon } from "../components/icons";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_STYLES: Record<string, string> = {
  pending_review: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  excluded: "bg-slate-100 text-slate-500",
  dispatched: "bg-brand-50 text-brand-700",
};

export default function DailyReview() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<DailyQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { rows } = await api.getDailyQueue(date);
      setRows(rows);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function handleBuild() {
    setBuilding(true);
    setError(null);
    try {
      await api.buildDailyQueue(date);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to build queue");
    } finally {
      setBuilding(false);
    }
  }

  async function handleBulkAction(action: "approve" | "exclude") {
    if (selected.size === 0) return;
    try {
      await api.bulkQueueAction(Array.from(selected), action);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pendingRows = rows.filter((r) => r.status === "pending_review");
  const allPendingSelected = pendingRows.length > 0 && pendingRows.every((r) => selected.has(r.id));

  function toggleAll() {
    if (allPendingSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingRows.map((r) => r.id)));
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Daily Review</h1>
          <p className="text-sm text-slate-500">
            Approve exactly who gets emailed on this date - nothing sends without your sign-off.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <button
            onClick={handleBuild}
            disabled={building}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshIcon className={building ? "animate-spin" : ""} />
            {building ? "Building..." : "Refresh Due List"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {selected.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
          <span className="text-sm font-medium text-brand-800">{selected.size} selected</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction("approve")}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Approve Selected
            </button>
            <button
              onClick={() => handleBulkAction("exclude")}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Exclude Selected
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-4 py-3">
                {pendingRows.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allPendingSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-100"
                  />
                )}
              </th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Step</th>
              <th className="px-4 py-3">Send time (local)</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Nothing due for {date} yet. Click "Refresh Due List" to check active campaigns.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    {r.status === "pending_review" && (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-100"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{r.contact.name ?? r.contact.email}</p>
                    <p className="text-xs text-slate-400">{r.contact.company ?? r.contact.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.campaign.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    Step {r.step.stepOrder + 1} - {r.step.templateName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(r.scheduledLocalSendTime).toLocaleString("en-US", {
                      timeZone: r.contact.resolvedTimezone ?? undefined,
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                    {r.contact.resolvedTimezone && (
                      <span className="ml-1 text-xs text-slate-400">({r.contact.resolvedTimezone})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>
                      {r.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
