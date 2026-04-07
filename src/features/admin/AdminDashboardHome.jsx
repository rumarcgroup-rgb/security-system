import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, CheckCircle2, Clock3, FileText, RefreshCcw, ShieldCheck, Users } from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import { sortAreas } from "../../lib/areas";
import { sortBranches } from "../../lib/branches";
import { supabase } from "../../lib/supabase";
import { isEmployeeOnline } from "../../lib/presence";
import "./AdminDashboardHome.css";

const metricCards = [
  { key: "pendingDtr", label: "Pending DTR", icon: Clock3, tone: "amber" },
  { key: "pendingRequirements", label: "Pending Requirements", icon: FileText, tone: "rose" },
  { key: "pendingSignatures", label: "Pending Signatures", icon: ShieldCheck, tone: "brand" },
  { key: "needsReupload", label: "Needs Reupload", icon: RefreshCcw, tone: "orange" },
  { key: "approvedToday", label: "Approved Today", icon: CheckCircle2, tone: "emerald" },
  { key: "activeEmployees", label: "Active Employees", icon: Users, tone: "brand" },
  { key: "onlineEmployees", label: "Online Now", icon: Activity, tone: "emerald-dark" },
  { key: "totalEmployeeSubmissions", label: "Total Employee Submissions", icon: Activity, tone: "slate" },
];

const quickActions = [
  { to: "/admin/dtr-submissions", label: "Review DTR", copy: "Approve or reject employee DTR uploads." },
  { to: "/admin/requirements", label: "Review Requirements", copy: "Check employee documents and signatures." },
  { to: "/admin/users", label: "Manage Users", copy: "Assign areas, branches, and positions." },
];

function getRequirementTypeLabel(row) {
  return row.requirement_type === "Signature" ? "Signature" : row.document_type || "Requirement";
}

function getDashboardSoundPreferenceKey(profileId) {
  return `admin-dashboard-sound-muted:${profileId || "default"}`;
}

function playSoftNotificationSound(tone) {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  try {
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const now = audioContext.currentTime;
    const toneConfig =
      tone === "requirement"
        ? { start: 587, end: 698, attack: 0.015, peak: 0.012, releaseAt: 0.26, stopAt: 0.3 }
        : { start: 784, end: 1046, attack: 0.02, peak: 0.018, releaseAt: 0.3, stopAt: 0.36 };

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(toneConfig.start, now);
    oscillator.frequency.exponentialRampToValueAtTime(toneConfig.end, now + 0.18);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(toneConfig.peak, now + toneConfig.attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + toneConfig.releaseAt);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + toneConfig.stopAt);
    oscillator.onended = () => {
      audioContext.close().catch(() => {});
    };
  } catch {
    // Ignore notification sound failures and keep the realtime UI responsive.
  }
}

export default function AdminDashboardHome({ profile }) {
  const [recentDtrRows, setRecentDtrRows] = useState([]);
  const [allDtrRows, setAllDtrRows] = useState([]);
  const [recentRequirementRows, setRecentRequirementRows] = useState([]);
  const [allRequirementRows, setAllRequirementRows] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [highlightedDtrId, setHighlightedDtrId] = useState(null);
  const [highlightedRequirementId, setHighlightedRequirementId] = useState(null);
  const [soundMuted, setSoundMuted] = useState(false);
  const [unreadDtrCount, setUnreadDtrCount] = useState(0);
  const [unreadRequirementCount, setUnreadRequirementCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const soundMutedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const preferenceKey = getDashboardSoundPreferenceKey(profile?.id);
    const syncPreference = () => {
      const isMuted = window.localStorage.getItem(preferenceKey) === "true";
      soundMutedRef.current = isMuted;
      setSoundMuted(isMuted);
    };

    const handlePreferenceChange = (event) => {
      if (!event.detail || event.detail.profileId === profile?.id) {
        syncPreference();
      }
    };

    syncPreference();
    window.addEventListener("storage", syncPreference);
    window.addEventListener("admin-dashboard-sound-preference-change", handlePreferenceChange);

    return () => {
      window.removeEventListener("storage", syncPreference);
      window.removeEventListener("admin-dashboard-sound-preference-change", handlePreferenceChange);
    };
  }, [profile?.id]);

  useEffect(() => {
    loadData();

    const dtrChannel = supabase
      .channel("admin-dashboard-dtr")
      .on("postgres_changes", { event: "*", schema: "public", table: "dtr_submissions" }, handleDtrChange)
      .subscribe();

    const documentsChannel = supabase
      .channel("admin-dashboard-documents")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_documents" }, handleRequirementChange)
      .subscribe();

    const profilesChannel = supabase
      .channel("admin-dashboard-profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadData)
      .subscribe();

    const presenceChannel = supabase
      .channel("admin-dashboard-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_presence" }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(dtrChannel);
      supabase.removeChannel(documentsChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  function upsertRecentDtrRow(nextRow) {
    setRecentDtrRows((current) =>
      [nextRow, ...current.filter((row) => row.id !== nextRow.id)]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 8)
    );
  }

  function upsertAllDtrRow(nextRow) {
    setAllDtrRows((current) =>
      [nextRow, ...current.filter((row) => row.id !== nextRow.id)].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )
    );
  }

  function upsertRecentRequirementRow(nextRow) {
    setRecentRequirementRows((current) =>
      [nextRow, ...current.filter((row) => row.id !== nextRow.id)]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 8)
    );
  }

  function upsertAllRequirementRow(nextRow) {
    setAllRequirementRows((current) =>
      [nextRow, ...current.filter((row) => row.id !== nextRow.id)].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )
    );
  }

  function flashNewActivity(setter, id) {
    setter(id);
    window.setTimeout(() => {
      setter((current) => (current === id ? null : current));
    }, 2200);
  }

  function maybePlayNotificationSound(tone) {
    if (soundMutedRef.current) {
      return;
    }

    playSoftNotificationSound(tone);
  }

  function resetUnreadCount(type) {
    if (type === "dtr") {
      setUnreadDtrCount(0);
      return;
    }

    setUnreadRequirementCount(0);
  }

  async function handleDtrChange(payload) {
    if (payload.eventType === "DELETE") {
      setRecentDtrRows((current) => current.filter((row) => row.id !== payload.old.id));
      setAllDtrRows((current) => current.filter((row) => row.id !== payload.old.id));
      return;
    }

    const summaryRow = {
      id: payload.new.id,
      status: payload.new.status,
      created_at: payload.new.created_at,
      approved_at: payload.new.approved_at,
    };
    upsertAllDtrRow(summaryRow);

    const { data, error } = await supabase
      .from("dtr_submissions")
      .select("id,status,created_at,cutoff,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,employee_id,location,branch)")
      .eq("id", payload.new.id)
      .maybeSingle();

    if (!error && data) {
      upsertRecentDtrRow(data);
      if (payload.eventType === "INSERT") {
        flashNewActivity(setHighlightedDtrId, data.id);
        setUnreadDtrCount((current) => current + 1);
        toast.success("New DTR received.");
        maybePlayNotificationSound("dtr");
      }
    } else {
      loadData();
    }
  }

  async function handleRequirementChange(payload) {
    if (payload.eventType === "DELETE") {
      setRecentRequirementRows((current) => current.filter((row) => row.id !== payload.old.id));
      setAllRequirementRows((current) => current.filter((row) => row.id !== payload.old.id));
      return;
    }

    const { data, error } = await supabase
      .from("employee_documents")
      .select(
        "id,document_type,review_status,created_at,profiles:profiles!employee_documents_user_id_profile_fkey(full_name,employee_id,location,branch)"
      )
      .eq("id", payload.new.id)
      .maybeSingle();

    if (error || !data) {
      loadData();
      return;
    }

    const nextRow = {
      ...data,
      requirement_type: data.document_type,
      status: data.review_status || "Pending Review",
      source: "employee_documents",
    };

    upsertAllRequirementRow(nextRow);
    upsertRecentRequirementRow(nextRow);

    if (payload.eventType === "INSERT") {
      flashNewActivity(setHighlightedRequirementId, nextRow.id);
      setUnreadRequirementCount((current) => current + 1);
      toast("New requirement received.", {
        duration: 2200,
        icon: "",
        style: {
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
          color: "#334155",
        },
      });
      maybePlayNotificationSound("requirement");
    }
  }

  async function loadData() {
    setLoading(true);

    const [recentDtrRes, allDtrRes, documentsRes, profilesRes, presenceRes] = await Promise.all([
      supabase
        .from("dtr_submissions")
        .select("id,status,created_at,cutoff,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,employee_id,location,branch)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("dtr_submissions").select("id,status,created_at,approved_at").order("created_at", { ascending: false }),
      supabase
        .from("employee_documents")
        .select(
          "id,document_type,review_status,created_at,profiles:profiles!employee_documents_user_id_profile_fkey(full_name,employee_id,location,branch)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id,role,full_name,location,branch,employee_id,created_at,signature_url,signature_status")
        .order("created_at", { ascending: false }),
      supabase.from("employee_presence").select("user_id,last_seen_at"),
    ]);

    if (!recentDtrRes.error) {
      setRecentDtrRows(recentDtrRes.data ?? []);
    }

    if (!allDtrRes.error) {
      setAllDtrRows(allDtrRes.data ?? []);
    }

    if (!profilesRes.error && !presenceRes.error) {
      const presenceMap = new Map((presenceRes.data ?? []).map((row) => [row.user_id, row.last_seen_at]));
      setProfiles(
        (profilesRes.data ?? []).map((profile) => ({
          ...profile,
          last_seen_at: presenceMap.get(profile.id) ?? null,
        }))
      );
    }

    if (!documentsRes.error && !profilesRes.error) {
      const documentRows = (documentsRes.data ?? []).map((row) => ({
        ...row,
        requirement_type: row.document_type,
        status: row.review_status || "Pending Review",
        source: "employee_documents",
      }));

      const signatureRows = (profilesRes.data ?? [])
        .filter((profile) => profile.signature_url)
        .map((profile) => ({
          id: `signature-${profile.id}`,
          document_type: "Signature",
          requirement_type: "Signature",
          created_at: profile.created_at,
          status: profile.signature_status || "Pending Review",
          profiles: {
            full_name: profile.full_name,
            employee_id: profile.employee_id,
            location: profile.location,
            branch: profile.branch,
          },
          source: "profiles",
        }));

      const combinedRequirements = [...documentRows, ...signatureRows].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      setAllRequirementRows(combinedRequirements);
      setRecentRequirementRows(combinedRequirements.slice(0, 8));
    }

    setLoading(false);
  }

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const activeEmployees = profiles.filter((profile) => profile.role !== "admin").length;
    const onlineEmployees = profiles.filter((profile) => profile.role !== "admin" && isEmployeeOnline(profile.last_seen_at)).length;
    const pendingDtr = allDtrRows.filter((row) => row.status === "Pending Review").length;
    const approvedToday = allDtrRows.filter(
      (row) => row.status === "Approved" && row.approved_at && new Date(row.approved_at).toISOString().slice(0, 10) === today
    ).length;
    const pendingRequirements = allRequirementRows.filter((row) => row.status === "Pending Review").length;
    const pendingSignatures = allRequirementRows.filter(
      (row) => row.requirement_type === "Signature" && row.status === "Pending Review"
    ).length;
    const needsReupload = allRequirementRows.filter((row) => row.status === "Needs Reupload").length;

    return {
      pendingDtr,
      pendingRequirements,
      pendingSignatures,
      needsReupload,
      approvedToday,
      activeEmployees,
      onlineEmployees,
      totalEmployeeSubmissions: allDtrRows.length + allRequirementRows.length,
    };
  }, [allDtrRows, allRequirementRows, profiles]);

  const locationSummary = useMemo(() => {
    const grouped = profiles.reduce((acc, profile) => {
      if (profile.role === "admin") return acc;
      const key = profile.location || "Unassigned";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return sortAreas(Object.keys(grouped))
      .map((location) => ({ location, count: grouped[location] }))
      .slice(0, 5);
  }, [profiles]);

  const branchSummary = useMemo(() => {
    const grouped = profiles.reduce((acc, profile) => {
      if (profile.role === "admin") return acc;
      const key = profile.branch || "Unassigned";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return sortBranches(Object.keys(grouped))
      .map((branch) => ({ branch, count: grouped[branch] }))
      .slice(0, 5);
  }, [profiles]);

  if (loading) {
    return <p className="admin-loading-copy">Loading dashboard metrics...</p>;
  }

  return (
    <div className="admin-page admin-dashboard-home">
      <Card>
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-title admin-dashboard-home__section-title">Quick Actions</h2>
            <p className="admin-section-copy">Jump straight into the admin work that needs attention.</p>
          </div>
        </div>
        <div className="admin-dashboard-home__quick-actions">
          {quickActions.map((action) => (
            <Link key={`${action.to}-${action.label}`} to={action.to} className="admin-dashboard-home__quick-action">
              <p className="admin-dashboard-home__quick-action-title">{action.label}</p>
              <p className="app-copy-sm">{action.copy}</p>
            </Link>
          ))}
        </div>
      </Card>

      <div className="admin-metrics-grid admin-metrics-grid--dashboard">
        {metricCards.map(({ key, label, icon: Icon, tone }) => (
          <Card key={key}>
            <div className="admin-metric-card">
              <div>
                <p className="admin-metric-label">{label}</p>
                <p className={`admin-metric-value admin-metric-value--lg admin-dashboard-home__metric-value--${tone}`}>
                  {metrics[key]}
                </p>
              </div>
              <div className={`admin-dashboard-home__metric-icon-box admin-dashboard-home__metric-icon-box--${tone}`}>
                <Icon className={`admin-dashboard-home__metric-icon--${tone}`} size={20} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="admin-sections-grid admin-sections-grid--analytics">
        <Card>
          <div className="admin-section-head">
            <div>
              <div className="admin-dashboard-home__heading-row">
                <h2 className="admin-section-title admin-dashboard-home__section-title">Recent DTR Activity</h2>
                {unreadDtrCount > 0 ? <span className="admin-dashboard-home__unread-badge">+{unreadDtrCount}</span> : null}
              </div>
              <p className="admin-section-copy">Last {recentDtrRows.length} submissions</p>
            </div>
            <Link className="admin-link" to="/admin/dtr-submissions" onClick={() => resetUnreadCount("dtr")}>
              Review Queue
            </Link>
          </div>
          <div className="admin-dashboard-home__activity-list">
            {recentDtrRows.map((row) => (
              <div
                key={row.id}
                className={`admin-list-card admin-dashboard-home__activity-item${
                  highlightedDtrId === row.id ? " admin-dashboard-home__activity-item--new" : ""
                }`}
              >
                <div>
                  <p className="admin-dashboard-home__activity-name">{row.profiles?.full_name || "Unknown Employee"}</p>
                  <p className="app-copy-sm">
                    {row.profiles?.employee_id || "No Employee ID"} | {row.cutoff}
                  </p>
                  <p className="app-copy-xs-muted">
                    {[row.profiles?.location, row.profiles?.branch].filter(Boolean).join(" / ") || "No assignment yet"}
                  </p>
                  <p className="app-copy-xs-muted">{new Date(row.created_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
            ))}
            {recentDtrRows.length === 0 ? <p className="admin-empty-copy">No DTR activity yet.</p> : null}
          </div>
        </Card>

        <Card>
          <div className="admin-section-head">
            <div>
              <div className="admin-dashboard-home__heading-row">
                <h2 className="admin-section-title admin-dashboard-home__section-title">Recent Requirement Activity</h2>
                {unreadRequirementCount > 0 ? (
                  <span className="admin-dashboard-home__unread-badge admin-dashboard-home__unread-badge--requirements">
                    +{unreadRequirementCount}
                  </span>
                ) : null}
              </div>
              <p className="admin-section-copy">Employee documents and signatures</p>
            </div>
            <Link className="admin-link" to="/admin/requirements" onClick={() => resetUnreadCount("requirements")}>
              Review Queue
            </Link>
          </div>
          <div className="admin-dashboard-home__activity-list">
            {recentRequirementRows.map((row) => (
              <div
                key={row.id}
                className={`admin-list-card admin-dashboard-home__activity-item${
                  highlightedRequirementId === row.id ? " admin-dashboard-home__activity-item--new" : ""
                }`}
              >
                <div>
                  <p className="admin-dashboard-home__activity-name">{row.profiles?.full_name || "Unknown Employee"}</p>
                  <p className="app-copy-sm">
                    {row.profiles?.employee_id || "No Employee ID"} | {getRequirementTypeLabel(row)}
                  </p>
                  <p className="app-copy-xs-muted">
                    {[row.profiles?.location, row.profiles?.branch].filter(Boolean).join(" / ") || "No assignment yet"}
                  </p>
                  <p className="app-copy-xs-muted">{new Date(row.created_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
            ))}
            {recentRequirementRows.length === 0 ? <p className="admin-empty-copy">No employee requirement activity yet.</p> : null}
          </div>
        </Card>
      </div>

      <div className="admin-content-grid admin-content-grid--distribution admin-dashboard-home__distribution-panels">
        <Card>
          <h2 className="admin-section-title admin-dashboard-home__section-title">Employee Distribution</h2>
          <p className="admin-section-copy app-copy-sm app-copy-xs-spaced admin-dashboard-home__distribution-copy">
            Top assigned locations based on onboarding records.
          </p>
          <div className="admin-dashboard-home__distribution-grid">
            {locationSummary.map((item, index) => (
              <div key={item.location} className="admin-dashboard-home__distribution-item">
                <div className="admin-dashboard-home__distribution-row">
                  <span className="admin-dashboard-home__distribution-label">
                    {index + 1}. {item.location}
                  </span>
                  <span className="admin-dashboard-home__distribution-count">{item.count}</span>
                </div>
                <div className="admin-dashboard-home__distribution-bar">
                  <div
                    className="admin-dashboard-home__distribution-fill"
                    style={{ width: `${Math.max((item.count / locationSummary[0].count) * 100, 8)}%` }}
                  />
                </div>
              </div>
            ))}
            {locationSummary.length === 0 ? <p className="admin-empty-copy">No employee location data available yet.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="admin-section-title admin-dashboard-home__section-title">Branch Distribution</h2>
          <p className="admin-section-copy app-copy-sm app-copy-xs-spaced admin-dashboard-home__distribution-copy">
            Top branches based on assigned employee records.
          </p>
          <div className="admin-dashboard-home__distribution-grid">
            {branchSummary.map((item, index) => (
              <div key={item.branch} className="admin-dashboard-home__distribution-item">
                <div className="admin-dashboard-home__distribution-row">
                  <span className="admin-dashboard-home__distribution-label">
                    {index + 1}. {item.branch}
                  </span>
                  <span className="admin-dashboard-home__distribution-count">{item.count}</span>
                </div>
                <div className="admin-dashboard-home__distribution-bar">
                  <div
                    className="admin-dashboard-home__distribution-fill admin-dashboard-home__distribution-fill--branch"
                    style={{ width: `${Math.max((item.count / branchSummary[0].count) * 100, 8)}%` }}
                  />
                </div>
              </div>
            ))}
            {branchSummary.length === 0 ? <p className="admin-empty-copy">No employee branch data available yet.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

