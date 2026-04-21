import { useEffect, useMemo, useState } from "react";
import { Bell, CircleHelp, LayoutDashboard, FileClock, Files, Users, FileBarChart2, Settings, LogOut, MessageSquareText, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, NavLink, Outlet, matchPath, useLocation, useNavigate } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import StatusBadge from "../../components/ui/StatusBadge";
import { supabase } from "../../lib/supabase";
import { useMessageUnreadCount } from "../messaging/useMessageUnreadCount";
import { useLiveDtrStore } from "../realtime/useLiveDtrStore";
import { useLiveRequirementsStore } from "../realtime/useLiveRequirementsStore";
import { useLivePeopleStore } from "../realtime/useLivePeopleStore";
import "./AdminLayout.css";

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/dtr-submissions", label: "DTR Submissions", icon: FileClock },
  { to: "/admin/requirements", label: "Requirements", icon: Files },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/messages", label: "Messages", icon: MessageSquareText },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/admin/help", label: "Help", icon: CircleHelp },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ profile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [seenNotificationIds, setSeenNotificationIds] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const unreadMessageCount = useMessageUnreadCount({ currentRole: "admin", currentUserId: profile?.id });
  const { rows: dtrRows } = useLiveDtrStore({
    currentRole: "admin",
    currentUserId: profile?.id,
    scopeProfile: profile,
  });
  const { rows: requirementRows } = useLiveRequirementsStore({
    currentRole: "admin",
    currentUserId: profile?.id,
    scopeProfile: profile,
  });
  const { profileRequests } = useLivePeopleStore({
    currentRole: "admin",
    currentUserId: profile?.id,
    scopeProfile: profile,
  });

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

  const notifications = useMemo(() => {
    const nextNotifications = [];

    dtrRows.slice(0, 6).forEach((row) => {
      nextNotifications.push({
        id: `dtr-${row.id}`,
        title: `${row.profiles?.full_name || "Employee"} submitted a DTR`,
        subtitle: `${row.profiles?.employee_id || "No Employee ID"} | ${row.cutoff || "No cutoff"}`,
        createdAt: row.created_at,
        status: row.status,
        link: "/admin/dtr-submissions",
        linkLabel: "Open DTR queue",
      });
    });

    requirementRows.slice(0, 6).forEach((row) => {
      nextNotifications.push({
        id: `requirement-${row.id}`,
        title: `${row.profiles?.full_name || "Employee"} uploaded ${row.requirement_type || "a requirement"}`,
        subtitle: `${row.profiles?.employee_id || "No Employee ID"} | Waiting on requirement review`,
        createdAt: row.created_at,
        status: row.status,
        link: "/admin/requirements",
        linkLabel: "Review requirements",
      });
    });

    profileRequests.slice(0, 6).forEach((row) => {
      nextNotifications.push({
        id: `profile-request-${row.id}`,
        title: `${row.profiles?.full_name || "Employee"} sent a profile update request`,
        subtitle: `${row.profiles?.employee_id || "No Employee ID"} | Requested name: ${row.requested_full_name || "No change"}`,
        createdAt: row.created_at,
        status: row.status,
        link: "/admin/users",
        linkLabel: "Review request",
      });
    });

    return nextNotifications
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
      .slice(0, 12);
  }, [dtrRows, profileRequests, requirementRows]);

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !seenNotificationIds.includes(item.id)).length;
  }, [notifications, seenNotificationIds]);

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
    <div className={`admin-layout${sidebarCollapsed ? " admin-layout--collapsed" : ""}`}>
      <button
        type="button"
        className={`admin-layout__backdrop${sidebarOpen ? " admin-layout__backdrop--visible" : ""}`}
        aria-label="Close sidebar"
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`admin-layout__sidebar${sidebarOpen ? " admin-layout__sidebar--open" : ""}`}>
        <div className="admin-layout__sidebar-top">
          <p className="admin-layout__brand">CGROUP of COMPANIES Admin</p>
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
              {to === "/admin/messages" && unreadMessageCount > 0 ? (
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
            <h1 className="admin-layout__title">Admin Dashboard</h1>
          </div>
          <div className="admin-layout__header-actions">
            <button
              className="admin-layout__bell"
              onClick={() => {
                setNotificationsOpen(true);
                setSeenNotificationIds((current) => Array.from(new Set([...current, ...notifications.map((item) => item.id)])));
              }}
            >
              <Bell size={18} />
              {unreadCount > 0 ? (
                <span className="admin-layout__bell-badge">
                  {Math.min(unreadCount, 9)}
                </span>
              ) : null}
            </button>
            <div className="admin-layout__profile-chip">
              <div className="admin-layout__avatar">
                {(profile?.full_name || "Admin").slice(0, 1)}
              </div>
              <span className="admin-layout__profile-name">{profile?.full_name || "Admin User"}</span>
            </div>
          </div>
        </header>
        <main className="admin-layout__content">
          <Outlet />
        </main>
      </div>

      <Modal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Admin Notifications">
        <div className="admin-layout__notifications">
          {notifications.length === 0 ? <p className="admin-layout__notifications-empty">No admin notifications yet.</p> : null}

          {notifications.map((item) => (
            <div key={item.id} className="admin-layout__notification-card">
              <div className="admin-layout__notification-head">
                <div>
                  <p className="admin-layout__notification-title">{item.title}</p>
                  <p className="admin-layout__notification-copy">{item.subtitle}</p>
                  <p className="admin-layout__notification-time">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="admin-layout__notification-link-wrap">
                <Link
                  className="admin-link"
                  onClick={() => setNotificationsOpen(false)}
                  to={item.link}
                >
                  {item.linkLabel}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
