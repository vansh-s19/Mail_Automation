import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const navItems = [
  { to: "/contacts", label: "Contacts" },
  { to: "/campaigns", label: "Campaigns" },
  { to: "/templates", label: "Templates" },
  { to: "/analytics", label: "Analytics" },
];

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className="flex h-screen w-56 flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <span className="text-sm font-semibold text-slate-900">Mail Automation</span>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium ${
                    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-slate-200 p-3">
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
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
