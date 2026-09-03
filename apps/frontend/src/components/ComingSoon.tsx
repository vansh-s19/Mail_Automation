export default function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <h1 className="mb-2 text-lg font-semibold text-slate-900">{title}</h1>
      <p className="mx-auto max-w-md text-sm text-slate-500">{note}</p>
    </div>
  );
}
