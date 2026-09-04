import { ContactFilterOptions } from "../lib/api";
import { SearchIcon } from "./icons";

export interface ContactFilterState {
  search: string;
  company: string;
  industry: string;
  location: string;
}

export const EMPTY_CONTACT_FILTERS: ContactFilterState = { search: "", company: "", industry: "", location: "" };

/**
 * Search + Company/Industry/Location selects, shared between the Contacts
 * page and the campaign contact picker so both filter the same way against
 * the same /contacts/filter-options values instead of drifting apart.
 */
export function ContactFilterBar({
  value,
  onChange,
  options,
  searchPlaceholder = "Search name, company, or email...",
}: {
  value: ContactFilterState;
  onChange: (next: ContactFilterState) => void;
  options: ContactFilterOptions | null;
  searchPlaceholder?: string;
}) {
  const hasActiveFilters = value.search !== "" || value.company !== "" || value.industry !== "" || value.location !== "";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <FilterSelect
        label="Company"
        value={value.company}
        options={options?.companies ?? []}
        onChange={(company) => onChange({ ...value, company })}
      />
      <FilterSelect
        label="Industry"
        value={value.industry}
        options={options?.industries ?? []}
        onChange={(industry) => onChange({ ...value, industry })}
      />
      <FilterSelect
        label="Location"
        value={value.location}
        options={options?.locations ?? []}
        onChange={(location) => onChange({ ...value, location })}
      />

      {hasActiveFilters && (
        <button
          onClick={() => onChange(EMPTY_CONTACT_FILTERS)}
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-700 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
    >
      <option value="">All {label.toLowerCase()}s</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
