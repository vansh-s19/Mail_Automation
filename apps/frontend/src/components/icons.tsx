type IconProps = { className?: string };

const base = "h-[18px] w-[18px]";

export function UsersIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`${base} ${className}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 5 18.5V20" />
      <circle cx="9.5" cy="8" r="3.25" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 14.5a3 3 0 0 1 3 3V20" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 5.1a3.25 3.25 0 0 1 0 6.3" />
    </svg>
  );
}

export function SendIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`${base} ${className}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 4 3 11.5l7 2.5 2.5 7L21 4Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 14 21 4" />
    </svg>
  );
}

export function DocumentIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`${base} ${className}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3.5V8h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.5h6M9 15.5h6M9 9.5h2" />
    </svg>
  );
}

export function ChartIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`${base} ${className}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function LogoutIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`${base} ${className}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h12m0 0-3.5-3.5M21 12l-3.5 3.5" />
    </svg>
  );
}

export function SearchIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`${base} ${className}`}>
      <circle cx="11" cy="11" r="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.8-3.8" />
    </svg>
  );
}

export function RefreshIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`${base} ${className}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 11A8 8 0 0 0 5.5 6.5L4 8M4 13a8 8 0 0 0 14.5 4.5L20 16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v4h4M20 20v-4h-4" />
    </svg>
  );
}

export function CalendarCheckIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`${base} ${className}`}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v4M16 3v4M3.5 10h17" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 14.5 2 2 4-4.5" />
    </svg>
  );
}

export function PlusIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`${base} ${className}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ChevronUpIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 ${className}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 15 6-6 6 6" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 ${className}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function TrashIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`${base} ${className}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9.5 7V4.5h5V7M6.5 7 7.3 19a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={`${base} ${className}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m0 0 6-6m-6 6 6 6" />
    </svg>
  );
}
