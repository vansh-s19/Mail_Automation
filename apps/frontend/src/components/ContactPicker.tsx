import { useEffect, useState } from "react";
import { api, ApiError, Contact, ContactFilterOptions } from "../lib/api";
import { ContactFilterBar, ContactFilterState, EMPTY_CONTACT_FILTERS } from "./ContactFilterBar";

const PAGE_SIZE = 50;

/**
 * Contact-selection modal used by the campaign builder to enroll contacts.
 * Fetches its own filtered/paginated page from the API rather than taking a
 * pre-loaded contact list as a prop - campaigns can draw from thousands of
 * contacts, so loading "all contacts" into the browser up front doesn't scale.
 */
export function ContactPicker({
  enrolledIds,
  onClose,
  onEnroll,
}: {
  enrolledIds: Set<string>;
  onClose: () => void;
  onEnroll: (contactIds: string[]) => Promise<void>;
}) {
  const [filters, setFilters] = useState<ContactFilterState>(EMPTY_CONTACT_FILTERS);
  const [filterOptions, setFilterOptions] = useState<ContactFilterOptions | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  useEffect(() => {
    api.getContactFilterOptions().then(setFilterOptions).catch(() => {});
  }, []);

  useEffect(() => {
    setPage(0);
  }, [filters.search, filters.company, filters.industry, filters.location]);

  useEffect(() => {
    const timeout = setTimeout(load, filters.search ? 250 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getContacts({
        search: filters.search || undefined,
        company: filters.company || undefined,
        industry: filters.industry || undefined,
        location: filters.location || undefined,
        status: "active", // suppressed contacts are never selectable here
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      });
      setContacts(data.contacts.filter((c) => !enrolledIds.has(c.id)));
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
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

  async function handleSelectAllMatching() {
    setSelectingAll(true);
    try {
      const { ids } = await api.getContactIds({
        search: filters.search || undefined,
        company: filters.company || undefined,
        industry: filters.industry || undefined,
        location: filters.location || undefined,
        status: "active",
      });
      setSelected(new Set(ids.filter((id) => !enrolledIds.has(id))));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to select all matching contacts");
    } finally {
      setSelectingAll(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allOnPageSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="flex h-[680px] w-full max-w-2xl flex-col rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Add Contacts</h2>
          <span className="text-xs text-slate-400">{total} match your filters</span>
        </div>

        <ContactFilterBar value={filters} onChange={setFilters} options={filterOptions} />

        {error && (
          <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-500">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={() => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (allOnPageSelected) contacts.forEach((c) => next.delete(c.id));
                  else contacts.forEach((c) => next.add(c.id));
                  return next;
                });
              }}
              className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-100"
            />
            Select page
          </label>
          <div className="flex items-center gap-3 text-xs font-medium">
            <button onClick={handleSelectAllMatching} disabled={selectingAll} className="text-brand-600 hover:text-brand-800 disabled:opacity-50">
              {selectingAll ? "Selecting..." : `Select all ${total} matching`}
            </button>
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())} className="text-slate-400 hover:text-slate-700">
                Clear selection
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">Loading...</p>
          ) : contacts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No contacts found.</p>
          ) : (
            contacts.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-100"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{c.name ?? c.email}</p>
                  <p className="truncate text-xs text-slate-400">
                    {[c.title, c.company].filter(Boolean).join(" · ") || c.email}
                  </p>
                </div>
                {c.industry && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {c.industry}
                  </span>
                )}
              </label>
            ))
          )}
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
            <span>
              Page {page + 1} of {pageCount}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}

        <div className="sticky bottom-0 mt-4 flex items-center justify-between border-t border-slate-100 bg-white pt-4">
          <span className="text-sm font-medium text-slate-700">{selected.size} selected</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                setSaving(true);
                try {
                  await onEnroll(Array.from(selected));
                } finally {
                  setSaving(false);
                }
              }}
              disabled={selected.size === 0 || saving}
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
            >
              {saving ? "Adding..." : `Add ${selected.size ? selected.size : ""} Selected`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
