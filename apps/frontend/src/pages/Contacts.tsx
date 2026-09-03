import { useEffect, useMemo, useState } from "react";
import { api, ApiError, Contact, SyncReport } from "../lib/api";
import { formatRelativeTime } from "../lib/relativeTime";
import { SearchIcon, RefreshIcon } from "../components/icons";

const LAST_SYNCED_KEY = "mail_automation_last_synced";

type StatusFilter = "all" | "active" | "suppressed";

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
    const stored = localStorage.getItem(LAST_SYNCED_KEY);
    return stored ? new Date(stored) : null;
  });
  const [now, setNow] = useState(() => new Date());

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

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
      const syncedAt = new Date();
      localStorage.setItem(LAST_SYNCED_KEY, syncedAt.toISOString());
      setLastSyncedAt(syncedAt);
      await loadContacts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (statusFilter === "active" && c.isSuppressed) return false;
      if (statusFilter === "suppressed" && !c.isSuppressed) return false;
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    });
  }, [contacts, search, statusFilter]);

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500">
            {contacts.length} total
            {lastSyncedAt && <span> · Last synced {formatRelativeTime(lastSyncedAt, now)}</span>}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600 disabled:opacity-50"
        >
          <RefreshIcon className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing..." : "Sync from Sheet"}
        </button>
      </div>

      {report && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatChip label="New" value={report.new} tone="accent" />
          <StatChip label="Updated" value={report.updated} tone="brand" />
          <StatChip label="Skipped" value={report.skipped} tone="slate" />
          <StatChip label="Invalid" value={report.invalid} tone="red" />
          <StatChip label="Needs review" value={report.needsReview} tone="amber" />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, company, title, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-700 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suppressed">Suppressed</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
            }}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Clear filters
          </button>
        )}

        {hasActiveFilters && (
          <span className="text-sm text-slate-400">
            {filtered.length} of {contacts.length}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Timezone</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No contacts yet. Click "Sync from Sheet" to import.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No contacts match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                          {initials(c.name, c.email)}
                        </div>
                        <span className="font-medium text-slate-900">{c.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.title ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.company ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.email}</td>
                    <td className="px-4 py-3 text-slate-600">{c.locationRaw ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c.resolvedTimezone ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {c.resolvedTimezone}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.isSuppressed ? (
                        <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          Suppressed
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "?";
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "accent" | "brand" | "slate" | "red" | "amber";
}) {
  const tones: Record<string, string> = {
    accent: "bg-accent-50 text-accent-700 border-accent-200",
    brand: "bg-brand-50 text-brand-700 border-brand-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${tones[tone]}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
