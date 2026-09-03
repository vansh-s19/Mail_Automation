export default function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-12 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6 text-brand-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2.5 2.5" />
            <circle cx="12" cy="12" r="8.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mb-1.5 text-base font-semibold text-slate-900">Coming soon</h2>
        <p className="mx-auto max-w-md text-sm text-slate-500">{note}</p>
      </div>
    </div>
  );
}
