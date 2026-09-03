import clientLogo from "../assets/client-logo.png";

// The client's real logo (uniquespm.com/img/logo.png) is white-on-transparent,
// designed for their navy header — so it needs a navy backdrop to stay visible
// on our light-background pages, not just a bare <img>.
export default function Logo({ width = 120 }: { width?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 px-3 py-2 shadow-sm"
      style={{ width }}
    >
      <img src={clientLogo} alt="Unique SPM" className="w-full" />
    </div>
  );
}
