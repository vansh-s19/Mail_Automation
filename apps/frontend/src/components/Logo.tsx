export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 font-bold text-white shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      SPM
    </div>
  );
}
