import { useEffect, useMemo, useState } from "react";
import { Bell, LayoutDashboard, FileClock, Files, Users, FileBarChart2, Settings, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import StatusBadge from "../../components/ui/StatusBadge";
import { supabase } from "../../lib/supabase";
import "./AdminLayout.css";

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/dtr-submissions", label: "DTR Submissions", icon: FileClock },
  { to: "/admin/requirements", label: "Requirements", icon: Files },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ profile }) {
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [seenNotificationIds, setSeenNotificationIds] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    loadNotifications();

    const dtrChannel = supabase
      .channel("admin-layout-dtr-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "dtr_submissions" }, loadNotifications)
      .subscribe();

    const documentsChannel = supabase
      .channel("admin-layout-document-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_documents" }, loadNotifications)
      .subscribe();

    const profileRequestChannel = supabase
      .channel("admin-layout-profile-request-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_change_requests" }, loadNotifications)
      .subscribe();

    return () => {
      supabase.removeChannel(dtrChannel);
      supabase.removeChannel(documentsChannel);
      supabase.removeChannel(profileRequestChannel);
    };
  }, []);

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

  async function loadNotifications() {
    const [dtrRes, documentsRes, profileRequestsRes] = await Promise.all([
      supabase
        .from("dtr_submissions")
        .select("id,status,created_at,cutoff,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,employee_id)")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("employee_documents")
        .select(
          "id,document_type,review_status,created_at,profiles:profiles!employee_documents_user_id_profile_fkey(full_name,employee_id)"
        )
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("profile_change_requests")
        .select(
          "id,status,created_at,requested_full_name,profiles:profiles!profile_change_requests_user_id_profile_fkey(full_name,employee_id)"
        )
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const nextNotifications = [];

    if (!dtrRes.error) {
      (dtrRes.data ?? []).forEach((row) => {
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
    }

    if (!documentsRes.error) {
      (documentsRes.data ?? []).forEach((row) => {
        nextNotifications.push({
          id: `document-${row.id}`,
          title: `${row.profiles?.full_name || "Employee"} uploaded ${row.document_type || "a requirement"}`,
          subtitle: `${row.profiles?.employee_id || "No Employee ID"} | Waiting on requirement review`,
          createdAt: row.created_at,
          status: row.review_status || "Pending Review",
          link: "/admin/requirements",
          linkLabel: "Review requirements",
        });
      });
    }

    if (!profileRequestsRes.error) {
      (profileRequestsRes.data ?? []).forEach((row) => {
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
    }

    setNotifications(
      nextNotifications
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 12)
    );
  }

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
              data-tooltip={sidebarCollapsed ? label : undefined}
              className={({ isActive }) =>
                `admin-layout__nav-link${isActive ? " admin-layout__nav-link--active" : ""}`
              }
            >
              <Icon size={16} /> {label}
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
