import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import Logo from "./Logo";
import { UsersIcon, SendIcon, DocumentIcon, ChartIcon, LogoutIcon, CalendarCheckIcon } from "./icons";

const navItems = [
  { to: "/contacts", label: "Contacts", icon: UsersIcon },
  { to: "/campaigns", label: "Campaigns", icon: SendIcon },
  { to: "/daily-review", label: "Daily Review", icon: CalendarCheckIcon },
  { to: "/templates", label: "Templates", icon: DocumentIcon },
  { to: "/analytics", label: "Analytics", icon: ChartIcon },
];

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className="flex h-screen w-60 flex-col border-r border-slate-200/80 bg-white">
          <div className="flex flex-col gap-1.5 border-b border-slate-200/80 px-5 py-5">
            <Logo width={128} />
            <div className="pl-0.5 text-xs text-slate-400">Outreach Automation</div>
          </div>
          <nav className="flex-1 space-y-0.5 px-3 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-brand-700 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                >
                  <Icon />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="border-t border-slate-200/80 p-3">
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <LogoutIcon />
              Sign out
            </button>
          </div>
        </aside>
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
