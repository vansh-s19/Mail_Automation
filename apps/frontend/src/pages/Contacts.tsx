import { useEffect, useState } from "react";
import { api, ApiError, Contact, ContactFilterOptions, SyncReport } from "../lib/api";
import { formatRelativeTime } from "../lib/relativeTime";
import { RefreshIcon, TrashIcon } from "../components/icons";
import { ContactFilterBar, ContactFilterState, EMPTY_CONTACT_FILTERS } from "../components/ContactFilterBar";

const LAST_SYNCED_KEY = "mail_automation_last_synced";
const PAGE_SIZE = 50;

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [filterOptions, setFilterOptions] = useState<ContactFilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
    const stored = localStorage.getItem(LAST_SYNCED_KEY);
    return stored ? new Date(stored) : null;
  });
  const [now, setNow] = useState(() => new Date());

  const [filters, setFilters] = useState<ContactFilterState>(EMPTY_CONTACT_FILTERS);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    api.getContactFilterOptions().then(setFilterOptions).catch(() => {});
  }, []);

  // Filter changes reset back to page 0; debounced so typing in the search
  // box doesn't fire a request per keystroke.
  useEffect(() => {
    setPage(0);
  }, [filters.search, filters.company, filters.industry, filters.location]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadContacts();
    }, filters.search ? 250 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  async function loadContacts() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getContacts({
        search: filters.search || undefined,
        company: filters.company || undefined,
        industry: filters.industry || undefined,
        location: filters.location || undefined,
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      });
      setContacts(data.contacts);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(contact: Contact) {
    if (!confirm(`Delete ${contact.name ?? contact.email}? This can't be undone.`)) return;
    try {
      await api.deleteContact(contact.id);
      await loadContacts();
    } catch (err) {
      alert(
        err instanceof ApiError
          ? err.message
          : "Failed to delete contact"
      );
    }
  }

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
      const options = await api.getContactFilterOptions();
      setFilterOptions(options);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500">
            {total} total
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

      <ContactFilterBar
        value={filters}
        onChange={setFilters}
        options={filterOptions}
        searchPlaceholder="Search name, company, title, or email..."
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Industry</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Timezone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    {total === 0 ? 'No contacts yet. Click "Sync from Sheet" to import.' : "No contacts match your filters."}
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                          {initials(c.name, c.email)}
                        </div>
                        <div>
                          <span className="block font-medium text-slate-900">{c.name ?? "—"}</span>
                          {c.title && <span className="block text-xs text-slate-400">{c.title}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.company ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.industry ?? "—"}</td>
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
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(c)}
                        className="text-slate-300 hover:text-red-600"
                        title="Delete contact"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>
              Page {page + 1} of {pageCount} · {total} contacts
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
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
