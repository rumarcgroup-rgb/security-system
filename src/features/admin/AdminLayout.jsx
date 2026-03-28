import { Bell, LayoutDashboard, FileClock, Users, FileBarChart2, Settings, LogOut } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/dtr-submissions", label: "DTR Submissions", icon: FileClock },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ profile }) {
  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="hidden w-72 flex-col bg-slate-900 text-white md:flex">
        <div className="border-b border-slate-700 p-5">
          <p className="rounded-lg bg-brand-500 px-3 py-1 text-sm font-bold inline-block">OMGJ Admin</p>
        </div>
        <nav className="flex-1 p-3">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `mb-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                  isActive ? "bg-brand-500 text-white" : "text-slate-200 hover:bg-slate-800"
                }`
              }
            >
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <button className="m-3 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-slate-800" onClick={logout}>
          <LogOut size={16} /> Logout
        </button>
      </aside>

      <div className="flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <h1 className="text-lg font-semibold text-slate-800">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <button className="relative rounded-full border border-slate-200 p-2">
              <Bell size={18} />
              <span className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] text-white">2</span>
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 px-2 py-1 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {(profile?.full_name || "Admin").slice(0, 1)}
              </div>
              <span className="text-sm text-slate-700">{profile?.full_name || "Admin User"}</span>
            </div>
          </div>
        </header>
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
