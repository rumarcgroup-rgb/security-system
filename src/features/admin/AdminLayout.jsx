import { useEffect, useMemo, useState } from "react";
import { Bell, LayoutDashboard, FileClock, Users, FileBarChart2, Settings, LogOut } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import StatusBadge from "../../components/ui/StatusBadge";
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [seenNotificationIds, setSeenNotificationIds] = useState([]);
  const [notifications, setNotifications] = useState([]);

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
          "id,document_type,review_status,created_at,profiles:profiles!employee_documents_user_id_fkey(full_name,employee_id)"
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
          link: "/admin/users",
          linkLabel: "Review user files",
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

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="hidden w-72 flex-col bg-slate-900 text-white md:flex">
        <div className="border-b border-slate-700 p-5">
          <p className="rounded-lg bg-brand-500 px-3 py-1 text-sm font-bold inline-block">CGROUP of COMPANIES Admin</p>
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
            <button
              className="relative rounded-full border border-slate-200 p-2"
              onClick={() => {
                setNotificationsOpen(true);
                setSeenNotificationIds((current) => Array.from(new Set([...current, ...notifications.map((item) => item.id)])));
              }}
            >
              <Bell size={18} />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] text-white">
                  {Math.min(unreadCount, 9)}
                </span>
              ) : null}
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

      <Modal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Admin Notifications">
        <div className="space-y-3">
          {notifications.length === 0 ? <p className="text-sm text-slate-500">No admin notifications yet.</p> : null}

          {notifications.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p>
                  <p className="mt-2 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="mt-3">
                <Link
                  className="text-sm font-medium text-brand-600 hover:underline"
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
