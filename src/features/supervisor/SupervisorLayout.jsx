import { CircleHelp, FileClock, LayoutDashboard, LogOut, MessageSquareText, Settings, Users, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, matchPath, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useMessageUnreadCount } from "../messaging/useMessageUnreadCount";
import "./SupervisorLayout.css";

const items = [
  { to: "/supervisor", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/supervisor/dtr", label: "Team DTR", icon: FileClock },
  { to: "/supervisor/messages", label: "Messages", icon: MessageSquareText },
  { to: "/supervisor/team", label: "Team", icon: Users },
  { to: "/supervisor/help", label: "Help", icon: CircleHelp },
  { to: "/supervisor/settings", label: "Settings", icon: Settings },
];

export default function SupervisorLayout({ profile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const unreadMessageCount = useMessageUnreadCount({ currentRole: "supervisor", currentUserId: profile?.id });

  useEffect(() => {
    function syncSidebarMode() {
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }

    window.addEventListener("resize", syncSidebarMode);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", syncSidebarMode);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  function handleNavClick() {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }

  function isItemActive({ to, end }) {
    return Boolean(
      matchPath(
        {
          path: to,
          end: Boolean(end),
        },
        location.pathname
      )
    );
  }

  function getTooltipLabel(item) {
    if (!sidebarCollapsed) {
      return undefined;
    }

    return isItemActive(item) ? `Current page: ${item.label}` : item.label;
  }

  return (
    <div className={`admin-layout supervisor-layout${sidebarCollapsed ? " admin-layout--collapsed" : ""}`}>
      <button
        type="button"
        className={`admin-layout__backdrop${sidebarOpen ? " admin-layout__backdrop--visible" : ""}`}
        aria-label="Close sidebar"
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`admin-layout__sidebar supervisor-layout__sidebar${sidebarOpen ? " admin-layout__sidebar--open" : ""}`}>
        <div className="admin-layout__sidebar-top">
          <p className="admin-layout__brand supervisor-layout__brand">CGROUP Supervisor</p>
        </div>
        <nav className="admin-layout__nav">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={handleNavClick}
              aria-label={label}
              data-tooltip={getTooltipLabel({ to, label, end })}
              className={({ isActive }) =>
                `admin-layout__nav-link${isActive ? " admin-layout__nav-link--active" : ""}`
              }
            >
              <Icon size={16} />
              <span>{label}</span>
              {to === "/supervisor/messages" && unreadMessageCount > 0 ? (
                <span className="admin-layout__nav-badge">{Math.min(unreadMessageCount, 9)}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <button
          className="admin-layout__logout"
          onClick={logout}
          aria-label="Logout"
          data-tooltip={sidebarCollapsed ? "Logout" : undefined}
        >
          <LogOut size={16} /> Logout
        </button>
      </aside>

      <div className="admin-layout__main">
        <header className="admin-layout__header">
          <div className="admin-layout__header-title">
            <button
              type="button"
              className="admin-layout__sidebar-toggle"
              onClick={() => {
                if (window.innerWidth >= 768) {
                  setSidebarCollapsed((current) => !current);
                } else {
                  setSidebarOpen(true);
                }
              }}
              aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <div>
              <h1 className="admin-layout__title">Supervisor Dashboard</h1>
              <p className="supervisor-layout__scope-copy">
                {profile?.location || "No area assigned"}{profile?.branch ? ` / ${profile.branch}` : ""}
              </p>
            </div>
          </div>
          <div className="admin-layout__profile-chip">
            <div className="admin-layout__avatar">{(profile?.full_name || "Supervisor").slice(0, 1)}</div>
            <span className="admin-layout__profile-name">{profile?.full_name || "Supervisor"}</span>
          </div>
        </header>
        <nav className="supervisor-layout__mobile-nav">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `supervisor-layout__mobile-link${isActive ? " supervisor-layout__mobile-link--active" : ""}`
              }
            >
              <Icon size={16} />
              <span>{label}</span>
              {to === "/supervisor/messages" && unreadMessageCount > 0 ? (
                <span className="supervisor-layout__mobile-badge">{Math.min(unreadMessageCount, 9)}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <main className="admin-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
