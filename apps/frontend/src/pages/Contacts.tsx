import { useEffect, useState } from "react";
import { api, ApiError, Contact, SyncReport } from "../lib/api";

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadContacts() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getContacts();
      setContacts(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setReport(null);
    try {
      const result = await api.syncSheet();
      setReport(result);
      await loadContacts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500">{contacts.length} contacts</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync from Sheet"}
        </button>
      </div>

      {report && (
        <div className="mb-6 grid grid-cols-5 gap-3">
          <StatChip label="New" value={report.new} tone="green" />
          <StatChip label="Updated" value={report.updated} tone="blue" />
          <StatChip label="Skipped" value={report.skipped} tone="slate" />
          <StatChip label="Invalid" value={report.invalid} tone="red" />
          <StatChip label="Needs review" value={report.needsReview} tone="amber" />
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Timezone</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No contacts yet. Click "Sync from Sheet" to import.
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{c.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.title ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.company ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email}</td>
                  <td className="px-4 py-3 text-slate-600">{c.locationRaw ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.resolvedTimezone ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatChip({ label, value, tone }: { label: string; value: number; tone: "green" | "blue" | "slate" | "red" | "amber" }) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${tones[tone]}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
