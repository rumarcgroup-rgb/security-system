import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CloudUpload,
  FileBarChart2,
  FileImage,
  FileWarning,
  ImageIcon,
  Map,
  MapPinned,
  Search,
  SlidersHorizontal,
  TrendingUp,
  UserRound,
  UsersRound,
  RotateCcw,
  Settings,
  ShieldCheck,
  Truck,
  Upload,
  Users,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { getSupervisorScopeLabel, isScopedEmployee, matchesSupervisorScope } from "../../lib/supervisorScope";
import "./CebuanaUploadPreviewPage.css";

const cutoffOptions = ["May 1 - 7, 2024", "May 8 - 15, 2024", "May 16 - 23, 2024", "May 24 - 31, 2024"];
const areaOptions = ["Cebu City Area", "Mandaue Area", "Lapu-Lapu Area", "South Cebu Area"];
const branchOptions = ["Cebu Main Branch", "IT Park Branch", "Colon Branch", "Mactan Branch"];
const courierOptions = ["LBC Express", "JRS Express", "Personal Delivery", "Branch Messenger"];
const dashboardFilterStorageKey = "cebuana-preview-dashboard-filters";
const dashboardRealtimeChannelName = "cebuana-preview-dashboard-dtr";

const sampleGuardFiles = [
  { name: "John-Reyes-DTR-May1-7.jpg", size: 1.2 * 1024 * 1024, previewTone: "sheet" },
  { name: "Mark-Villanueva-DTR-May1-7.jpg", size: 1.1 * 1024 * 1024, previewTone: "sheet" },
  { name: "Carlos-Santos-DTR-May1-7.jpg", size: 1.3 * 1024 * 1024, previewTone: "sheet" },
];

const sampleSummaryFile = {
  name: "Weekly-DTR-Summary-May1-7.jpg",
  size: 2.4 * 1024 * 1024,
  previewTone: "document",
};

const mockGuards = [
  {
    id: "guard-1",
    name: "John Reyes",
    employeeId: "SG-1024",
    branch: "Cebu Main Branch",
    area: "Cebu City Area",
    status: "Uploaded",
    shift: "Day Shift",
  },
  {
    id: "guard-2",
    name: "Mark Villanueva",
    employeeId: "SG-2045",
    branch: "Cebu Main Branch",
    area: "Cebu City Area",
    status: "Missing",
    shift: "Night Shift",
  },
  {
    id: "guard-3",
    name: "Carlos Santos",
    employeeId: "SG-3108",
    branch: "IT Park Branch",
    area: "Cebu City Area",
    status: "Needs Correction",
    shift: "Reliever",
  },
  {
    id: "guard-4",
    name: "Nikko Dela Cruz",
    employeeId: "SG-4113",
    branch: "IT Park Branch",
    area: "Cebu City Area",
    status: "Uploaded",
    shift: "Day Shift",
  },
];

const mockRecentActivity = [
  { id: "act-1", title: "3 guard DTRs uploaded", meta: "Cebu Main Branch  |  9:18 AM", tone: "success" },
  { id: "act-2", title: "Weekly summary pending review", meta: "May 1 - 7, 2024  |  8:52 AM", tone: "info" },
  { id: "act-3", title: "1 guard still missing DTR", meta: "IT Park Branch  |  Follow-up needed", tone: "warning" },
];

const mockPendingDashboardRows = [
  {
    id: "row-1",
    guardName: "John Reyes",
    site: "ABC Corp",
    range: "May 1 - May 7, 2024",
    tracking: "Sent via LBC (124773284109)",
    trackingTone: "success",
    canSend: true,
  },
  {
    id: "row-2",
    guardName: "Mark Villanueva",
    site: "City Mall",
    range: "May 1 - May 7, 2024",
    tracking: "Submitted via LBC (472113895605)",
    trackingTone: "success",
    canSend: true,
  },
  {
    id: "row-3",
    guardName: "Carlos Santos",
    site: "Tech Solutions",
    range: "May 1 - May 7, 2024",
    tracking: "Submitted via JRS Express (A87621294)",
    trackingTone: "success",
    canSend: true,
  },
  {
    id: "row-4",
    guardName: "Eric Mendoza",
    site: "Metro Residences",
    range: "May 1 - May 7, 2024",
    tracking: "Submitted via personal handoff to DTR coordinator",
    trackingTone: "neutral",
    canSend: false,
  },
  {
    id: "row-5",
    guardName: "Ben Cruz",
    site: "Sunrise Hotel",
    range: "May 1 - May 7, 2024",
    tracking: "Delivered personally to headquarters by supervisor",
    trackingTone: "neutral",
    canSend: false,
  },
];

function formatDashboardTimestamp(timestamp) {
  if (!timestamp) {
    return "Just now";
  }

  const parsedDate = new Date(timestamp);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Just now";
  }

  return parsedDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDashboardScopeLabel(profile) {
  if (!profile) {
    return "Public demo mode";
  }

  if (profile.role === "admin") {
    return "All branches";
  }

  return getSupervisorScopeLabel(profile);
}

function getLiveTrackingCopy(row) {
  if (row.status === "Approved") {
    return row.admin_remarks || "Approved in Supabase and ready for records handoff.";
  }

  if (row.status === "Rejected") {
    return row.admin_remarks || "Returned for correction before dispatch.";
  }

  if (row.employee_note) {
    return row.employee_note;
  }

  return "Awaiting original signed DTR routing details.";
}

function mapLiveSubmissionToDashboardRow(row) {
  const employeeName = row.profiles?.full_name?.trim() || row.profiles?.employee_id || "Unnamed guard";
  const locationLabel = [row.profiles?.location, row.profiles?.branch].filter(Boolean).join(" / ");

  return {
    id: row.id,
    guardName: employeeName,
    site: row.profiles?.branch || row.profiles?.location || "Unassigned site",
    range: row.cutoff || "Current cutoff",
    tracking: getLiveTrackingCopy(row),
    trackingTone: row.status === "Approved" ? "success" : "neutral",
    canSend: row.status === "Pending Review",
    created_at: row.created_at,
    source: "live",
    mockCompleted: false,
    mockCourier: null,
    mockTracking: null,
    mockCompletedAt: null,
    locationLabel,
    originalStatus: row.status,
  };
}

function mapLiveSubmissionToActivity(row) {
  const employeeName = row.profiles?.full_name?.trim() || row.profiles?.employee_id || "Unnamed guard";
  const locationLabel = [row.profiles?.location, row.profiles?.branch].filter(Boolean).join(" / ") || "Unassigned scope";
  const cutoffLabel = row.cutoff || "current cutoff";

  if (row.status === "Approved") {
    return {
      id: `activity-${row.id}`,
      title: `${employeeName} approved for ${cutoffLabel}`,
      meta: `${locationLabel}  |  ${formatDashboardTimestamp(row.approved_at || row.created_at)}`,
      tone: "success",
    };
  }

  if (row.status === "Rejected") {
    return {
      id: `activity-${row.id}`,
      title: `${employeeName} needs corrections`,
      meta: `${locationLabel}  |  ${formatDashboardTimestamp(row.created_at)}`,
      tone: "warning",
    };
  }

  return {
    id: `activity-${row.id}`,
    title: `${employeeName} submitted a DTR`,
    meta: `${locationLabel}  |  ${formatDashboardTimestamp(row.created_at)}`,
    tone: "info",
  };
}

function mapProfileToGuard(profileRow, latestSubmission) {
  const latestStatus = latestSubmission?.status || null;
  const status =
    latestStatus === "Rejected"
      ? "Needs Correction"
      : latestStatus
        ? "Uploaded"
        : "Missing";

  return {
    id: profileRow.id,
    name: profileRow.full_name || profileRow.employee_id || "Unnamed guard",
    employeeId: profileRow.employee_id || "No employee ID",
    branch: profileRow.branch || profileRow.location || "Unassigned branch",
    area: profileRow.location || "No area assigned",
    status,
    shift: profileRow.shift || profileRow.position || "No shift set",
  };
}

function mergeDashboardRowsWithLiveSeed(nextSeedRows, currentRows) {
  const currentRowMap = new Map(currentRows.map((row) => [row.id, row]));
  const liveIds = new Set(nextSeedRows.map((row) => row.id));
  const mergedLiveRows = nextSeedRows.map((row) => {
    const existingRow = currentRowMap.get(row.id);

    if (!existingRow?.mockCompleted) {
      return row;
    }

    return {
      ...row,
      mockCompleted: true,
      mockCourier: existingRow.mockCourier,
      mockTracking: existingRow.mockTracking,
      mockCompletedAt: existingRow.mockCompletedAt,
    };
  });

  const preservedCompletedRows = currentRows.filter((row) => row.mockCompleted && !liveIds.has(row.id));
  return [...mergedLiveRows, ...preservedCompletedRows];
}

const mockReports = [
  { label: "Upload Rate", value: "83%", copy: "10 of 12 guards submitted for this cutoff" },
  { label: "Missing DTRs", value: "2", copy: "1 in Cebu Main, 1 in IT Park" },
  { label: "Summaries", value: "4", copy: "Last 4 cutoffs submitted on time" },
];

const mockSettings = [
  { label: "Remember last selections", value: "Enabled" },
  { label: "Notify on missing DTRs", value: "On" },
  { label: "Default branch", value: "Cebu Main Branch" },
];

const bottomNav = [
  { label: "Dashboard", icon: Building2 },
  { label: "Guards", icon: Users },
  { label: "Upload", icon: Upload },
  { label: "Reports", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

function createPreviewFile(file, fallbackId) {
  return {
    id: fallbackId,
    name: file.name,
    size: file.size,
    previewTone: file.previewTone || "sheet",
    source: file.source || "Local file",
    previewUrl: file.previewUrl || null,
    mimeType: file.mimeType || "",
  };
}

function formatFileSize(sizeInBytes) {
  if (!sizeInBytes) {
    return "0 KB";
  }

  if (sizeInBytes >= 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(sizeInBytes / 1024))} KB`;
}

function buildSelectionSummary(files) {
  if (!files.length) {
    return "No files selected yet";
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  return `${files.length} file${files.length === 1 ? "" : "s"} selected  |  Total ${formatFileSize(totalSize)}`;
}

function createIncomingFiles(fileList, prefix) {
  return Array.from(fileList || []).map((file, index) =>
    createPreviewFile(
      {
        name: file.name,
        size: file.size,
        previewTone: file.type === "application/pdf" ? "document" : "sheet",
        source: "Chosen from device",
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        mimeType: file.type,
      },
      `${prefix}-${Date.now()}-${index}`
    )
  );
}

function DetailField({ label, icon: Icon, value, options, onChange }) {
  return (
    <label className="cebuana-preview__field">
      <span className="cebuana-preview__field-label">
        <Icon size={16} />
        {label} <em>*</em>
      </span>

      <div className="cebuana-preview__select-wrap">
        <select className="cebuana-preview__select" value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="cebuana-preview__select-caret" />
      </div>
    </label>
  );
}

function FileThumb({ file }) {
  if (file.previewUrl) {
    return <img className="cebuana-preview__file-image" src={file.previewUrl} alt={file.name} />;
  }

  return (
    <div
      className={`cebuana-preview__file-thumb${
        file.previewTone === "document" ? " cebuana-preview__file-thumb--document" : ""
      }`}
    >
      <ImageIcon size={16} />
    </div>
  );
}

function UploadSection({
  title,
  copy,
  files,
  sectionTone,
  reviewedGuardName,
  dispatchReady = false,
  emptyTitle,
  emptyCopy,
  actionLabel,
  actionTone = "blue",
  isSubmitting,
  isSubmitted,
  isDragOver,
  onChooseFiles,
  onAddSamples,
  onRemoveFile,
  onSubmit,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  summary,
}) {
  const fileInputRef = useRef(null);

  return (
    <section className="cebuana-preview__section">
      <div className="cebuana-preview__section-head">
        <div className="cebuana-preview__section-icon">
          <FileImage size={18} />
        </div>
        <div>
          <h3>{title}</h3>
          <p>{copy}</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="cebuana-preview__file-input"
        multiple={sectionTone === "guard"}
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        onChange={onChooseFiles}
      />

      <button
        type="button"
        className={`cebuana-preview__dropzone${isDragOver ? " cebuana-preview__dropzone--dragover" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <CloudUpload size={34} />
        <strong>{emptyTitle}</strong>
        <span>{isDragOver ? "Drop files here to add them to the preview" : emptyCopy}</span>
      </button>

      <div className="cebuana-preview__dropzone-actions">
        <button type="button" className="cebuana-preview__mini-action" onClick={() => fileInputRef.current?.click()}>
          Choose files
        </button>
        <button type="button" className="cebuana-preview__mini-action cebuana-preview__mini-action--ghost" onClick={onAddSamples}>
          Add sample {sectionTone === "guard" ? "DTRs" : "summary"}
        </button>
      </div>

      {files.length ? (
        <div className="cebuana-preview__file-list">
          {files.map((file) => (
            <article
              key={file.id}
              className={`cebuana-preview__file-card${
                reviewedGuardName && file.name.toLowerCase().includes(reviewedGuardName.toLowerCase().replace(/\s+/g, "-"))
                  ? " cebuana-preview__file-card--reviewed"
                  : ""
              }`}
            >
              <FileThumb file={file} />
              <div className="cebuana-preview__file-copy">
                <strong>{file.name}</strong>
                <span>
                  {formatFileSize(file.size)}  |  {file.source}
                </span>
                {reviewedGuardName && file.name.toLowerCase().includes(reviewedGuardName.toLowerCase().replace(/\s+/g, "-")) ? (
                  <span className="cebuana-preview__file-flag">
                    {dispatchReady ? "Ready to dispatch" : "Review target"}
                  </span>
                ) : null}
              </div>
              <button type="button" className="cebuana-preview__file-close" aria-label={`Remove ${file.name}`} onClick={() => onRemoveFile(file.id)}>
                <X size={16} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="cebuana-preview__empty-state">
          <p>No files added yet. Choose from device, drag files in, or add sample data to test the flow.</p>
        </div>
      )}

      <div className="cebuana-preview__summary-line">{summary}</div>

      <button
        type="button"
        className={`cebuana-preview__submit cebuana-preview__submit--${actionTone}`}
        onClick={onSubmit}
        disabled={!files.length || isSubmitting}
      >
        {actionTone === "green" ? <CheckCircle2 size={18} /> : <Upload size={18} />}
        <span>
          {isSubmitting ? "Submitting..." : isSubmitted ? `${actionLabel} Submitted` : actionLabel}
        </span>
      </button>
    </section>
  );
}

function MockMetricCard({ icon: Icon, label, value, copy, tone = "blue" }) {
  return (
    <article className={`cebuana-preview__metric-card cebuana-preview__metric-card--${tone}`}>
      <div className="cebuana-preview__metric-icon">
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <span>{label}</span>
      <p>{copy}</p>
    </article>
  );
}

function MockStatusPill({ status }) {
  const toneClass =
    status === "Uploaded"
      ? "cebuana-preview__status-pill--success"
      : status === "Missing"
        ? "cebuana-preview__status-pill--danger"
        : "cebuana-preview__status-pill--muted";

  return <span className={`cebuana-preview__status-pill ${toneClass}`}>{status}</span>;
}

function readDashboardFilters() {
  if (typeof window === "undefined") {
    return {
      dashboardFilter: "Pending",
      searchQuery: "",
      courierFilter: "All Couriers",
    };
  }

  try {
    const rawValue = window.localStorage.getItem(dashboardFilterStorageKey);

    if (!rawValue) {
      return {
        dashboardFilter: "Pending",
        searchQuery: "",
        courierFilter: "All Couriers",
      };
    }

    const parsedValue = JSON.parse(rawValue);

    return {
      dashboardFilter: ["Pending", "Completed", "All"].includes(parsedValue?.dashboardFilter)
        ? parsedValue.dashboardFilter
        : "Pending",
      searchQuery: typeof parsedValue?.searchQuery === "string" ? parsedValue.searchQuery : "",
      courierFilter:
        ["All Couriers", ...courierOptions].includes(parsedValue?.courierFilter)
          ? parsedValue.courierFilter
          : "All Couriers",
    };
  } catch {
    return {
      dashboardFilter: "Pending",
      searchQuery: "",
      courierFilter: "All Couriers",
    };
  }
}

function DashboardTab({
  rows,
  onReviewRow,
  onBatchDispatch,
  onReprintRow,
  recentActivity,
  dashboardMode,
  dashboardLoading,
  dashboardError,
  scopeLabel,
  lastSyncedAt,
}) {
  const [dashboardFilter, setDashboardFilter] = useState(() => readDashboardFilters().dashboardFilter);
  const [searchQuery, setSearchQuery] = useState(() => readDashboardFilters().searchQuery);
  const [courierFilter, setCourierFilter] = useState(() => readDashboardFilters().courierFilter);
  const pendingRows = rows.filter((row) => !row.mockCompleted);
  const sentRows = rows.filter((row) => row.mockCompleted);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchedPendingRows = normalizedQuery
    ? pendingRows.filter((row) => row.guardName.toLowerCase().includes(normalizedQuery))
    : pendingRows;
  const searchedSentRows = normalizedQuery
    ? sentRows.filter((row) => row.guardName.toLowerCase().includes(normalizedQuery))
    : sentRows;
  const courierFilteredSentRows =
    courierFilter === "All Couriers"
      ? searchedSentRows
      : searchedSentRows.filter((row) => row.mockCourier === courierFilter);
  const filteredPendingRows = dashboardFilter === "Completed" ? [] : searchedPendingRows;
  const filteredSentRows = dashboardFilter === "Pending" ? [] : courierFilteredSentRows;
  const latestSentAt = filteredSentRows[0]?.mockCompletedAt || sentRows[0]?.mockCompletedAt || "No dispatches yet";
  const pendingMetricLabel = dashboardFilter === "Completed" ? "Pending hidden by filter" : "Pending DTRs in view";
  const summaryMetricLabel =
    dashboardFilter === "Pending"
      ? "Completed hidden by filter"
      : courierFilter === "All Couriers"
        ? "Completed dispatches in view"
        : `${courierFilter} dispatches in view`;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      dashboardFilterStorageKey,
      JSON.stringify({
        dashboardFilter,
        searchQuery,
        courierFilter,
      }),
    );
  }, [courierFilter, dashboardFilter, searchQuery]);

  function getCourierToneClass(courierName) {
    if (courierName === "Branch Messenger") {
      return "cebuana-preview__sent-courier-chip--messenger";
    }

    if (courierName === "Personal Delivery") {
      return "cebuana-preview__sent-courier-chip--personal";
    }

    if (courierName === "JRS Express") {
      return "cebuana-preview__sent-courier-chip--jrs";
    }

    return "cebuana-preview__sent-courier-chip--lbc";
  }

  return (
    <>
      <section className="cebuana-preview__dashboard-status-strip">
        <article className="cebuana-preview__dashboard-status-card">
          <span>Data Source</span>
          <strong>{dashboardMode === "live" ? "Supabase live data" : "Presentation demo data"}</strong>
          <p>
            {dashboardMode === "live"
              ? "Pending DTR rows are loading from your current authenticated scope."
              : "The preview is showing local demo rows until a supervisor or admin session is available."}
          </p>
        </article>
        <article className="cebuana-preview__dashboard-status-card">
          <span>Scope</span>
          <strong>{scopeLabel}</strong>
          <p>{lastSyncedAt ? `Last synced ${formatDashboardTimestamp(lastSyncedAt)}` : "Waiting for first sync."}</p>
        </article>
        <article className="cebuana-preview__dashboard-status-card">
          <span>Dashboard State</span>
          <strong>{dashboardLoading ? "Refreshing..." : dashboardError ? "Using fallback data" : "Ready to present"}</strong>
          <p>{dashboardError || "Dispatch actions remain mock-only so the workflow stays safe for demos."}</p>
        </article>
      </section>

      <section className="cebuana-preview__dashboard-hero">
        <article className="cebuana-preview__dashboard-action-card">
          <div>
            <h3>Send DTR of Guards</h3>
            <p><strong>{filteredPendingRows.length}</strong> {pendingMetricLabel}</p>
          </div>
          <button
            type="button"
            className="cebuana-preview__dashboard-button cebuana-preview__dashboard-button--blue"
            onClick={() => filteredPendingRows[0] && onReviewRow(filteredPendingRows[0], { dispatchReady: true })}
            disabled={!filteredPendingRows.length}
          >
            Review &amp; Send
          </button>
        </article>

        <article className="cebuana-preview__dashboard-action-card">
          <div>
            <h3>Send Summary of DTRs</h3>
            <p><strong>{filteredSentRows.length}</strong> {summaryMetricLabel}</p>
          </div>
          <button type="button" className="cebuana-preview__dashboard-button cebuana-preview__dashboard-button--green">
            Send Summary
          </button>
        </article>
      </section>

      <section className="cebuana-preview__section cebuana-preview__section--dashboard-activity">
        <div className="cebuana-preview__section-head">
          <div className="cebuana-preview__section-icon">
            <Clock3 size={18} />
          </div>
          <div>
            <h3>Recent Activity</h3>
            <p>{dashboardMode === "live" ? "Latest scoped submission updates from Supabase." : "Presentation-ready activity examples for the tablet dashboard."}</p>
          </div>
        </div>

        <div className="cebuana-preview__activity-list">
          {recentActivity.map((item) => (
            <article key={item.id} className={`cebuana-preview__activity-card cebuana-preview__activity-card--${item.tone}`}>
              <strong>{item.title}</strong>
              <span>{item.meta}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="cebuana-preview__dashboard-table-card">
        <div className="cebuana-preview__dashboard-table-head">
          <div>
            <h3>Pending DTRs of Guards</h3>
            <p>{dashboardMode === "live" ? "Review scoped Daily Time Records from Supabase." : "Review and Send Daily Time Records."}</p>
          </div>
          <div className="cebuana-preview__dashboard-head-actions">
            <label className="cebuana-preview__dashboard-search">
              <Search size={15} className="cebuana-preview__dashboard-search-icon" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search guard name"
                aria-label="Search guard name"
              />
            </label>
            {searchQuery ? (
              <button
                type="button"
                className="cebuana-preview__dashboard-filter cebuana-preview__dashboard-filter--ghost"
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </button>
            ) : null}
            <div className="cebuana-preview__dashboard-filters">
              {["Pending", "Completed", "All"].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`cebuana-preview__dashboard-filter${
                    dashboardFilter === filter ? " cebuana-preview__dashboard-filter--active" : ""
                  }`}
                  onClick={() => setDashboardFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="cebuana-preview__dashboard-head-badge">
              <TrendingUp size={16} />
              {dashboardLoading ? "Syncing..." : "Active Cutoff"}
            </div>
          </div>
        </div>

        {filteredPendingRows.length ? (
        <div className="cebuana-preview__dashboard-table-wrap">
          <table className="cebuana-preview__dashboard-table">
            <thead>
              <tr>
                <th>Guard Name</th>
                <th>Site Assignment</th>
                <th>Date Range</th>
                <th>Status</th>
                <th>Tracking for Original Signed DTR</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPendingRows.map((row) => (
                <tr
                  key={row.id}
                  className={`cebuana-preview__dashboard-row${
                    row.mockCompleted ? " cebuana-preview__dashboard-row--completed" : ""
                  }`}
                >
                  <td>{row.guardName}</td>
                  <td>{row.site}</td>
                  <td>{row.range}</td>
                  <td>
                    <span className="cebuana-preview__completed-badge">Pending</span>
                  </td>
                  <td>
                    <span
                      className={`cebuana-preview__tracking-copy${
                        row.trackingTone === "success" ? " cebuana-preview__tracking-copy--success" : ""
                      }${row.mockCompleted ? " cebuana-preview__tracking-copy--completed" : ""}`}
                    >
                      {row.mockCompleted ? `Completed mock dispatch via ${row.mockCourier} (${row.mockTracking})` : row.tracking}
                    </span>
                  </td>
                  <td>
                    <div className="cebuana-preview__table-actions">
                      <button
                        type="button"
                        className="cebuana-preview__table-button"
                        onClick={() => onReviewRow(row)}
                        disabled={row.mockCompleted}
                      >
                        Review
                      </button>
                      {row.canSend && !row.mockCompleted ? (
                        <button
                          type="button"
                          className="cebuana-preview__table-button cebuana-preview__table-button--primary"
                          onClick={() => onReviewRow(row, { dispatchReady: true })}
                        >
                          Send DTR
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ) : (
          <div className="cebuana-preview__dashboard-empty">
            {normalizedQuery
              ? "No matching guards in the pending queue."
              : "No pending rows in the current dashboard filter."}
          </div>
        )}

        <div className="cebuana-preview__dashboard-footer">
          <button
            type="button"
            className="cebuana-preview__dashboard-button cebuana-preview__dashboard-button--blue"
            onClick={onBatchDispatch}
            disabled={!pendingRows.length}
          >
            Send All Pending DTRs
          </button>
        </div>
      </section>

      {sentRows.length && dashboardFilter !== "Pending" ? (
        <>
        <section className="cebuana-preview__sent-summary-card">
          <div>
            <span className="cebuana-preview__sent-summary-label">Batch summary</span>
            <strong>{filteredSentRows.length} sent today</strong>
            <p>Latest mock dispatch: {latestSentAt}</p>
          </div>
          <div className="cebuana-preview__sent-summary-metrics">
            <span>{pendingRows.length} pending left</span>
            <span>{filteredSentRows.filter((row) => row.mockCourier === "Branch Messenger").length} batch messenger</span>
            <span>{courierFilter}</span>
          </div>
        </section>

        <section className="cebuana-preview__dashboard-table-card cebuana-preview__dashboard-table-card--sent">
          <div className="cebuana-preview__dashboard-table-head">
            <div>
              <h3>Sent Today</h3>
              <p>Mock-completed dispatches moved out of the pending queue.</p>
            </div>
            <div className="cebuana-preview__dashboard-head-actions">
              <div className="cebuana-preview__dashboard-filters">
                {["All Couriers", "LBC Express", "JRS Express", "Personal Delivery", "Branch Messenger"].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`cebuana-preview__dashboard-filter${
                      courierFilter === filter ? " cebuana-preview__dashboard-filter--active" : ""
                    }`}
                    onClick={() => setCourierFilter(filter)}
                  >
                    {filter === "All Couriers" ? "All" : filter.replace(" Express", "").replace(" Delivery", "")}
                  </button>
                ))}
              </div>
              <div className="cebuana-preview__courier-legend" aria-label="Courier legend">
                <span className="cebuana-preview__courier-legend-label">Courier</span>
                {[
                  { label: "LBC", value: "LBC Express", toneClass: "cebuana-preview__sent-courier-chip--lbc" },
                  { label: "JRS", value: "JRS Express", toneClass: "cebuana-preview__sent-courier-chip--jrs" },
                  {
                    label: "Personal",
                    value: "Personal Delivery",
                    toneClass: "cebuana-preview__sent-courier-chip--personal",
                  },
                  {
                    label: "Messenger",
                    value: "Branch Messenger",
                    toneClass: "cebuana-preview__sent-courier-chip--messenger",
                  },
                ].map((courier) => (
                  <button
                    key={courier.value}
                    type="button"
                    className={`cebuana-preview__sent-courier-chip cebuana-preview__sent-courier-chip--filter ${courier.toneClass}${
                      courierFilter === courier.value ? " cebuana-preview__sent-courier-chip--active" : ""
                    }`}
                    onClick={() => setCourierFilter(courier.value)}
                  >
                    {courier.label}
                  </button>
                ))}
              </div>
              <div className="cebuana-preview__dashboard-head-badge cebuana-preview__dashboard-head-badge--success">
                <CheckCircle2 size={16} />
                {filteredSentRows.length} completed
              </div>
            </div>
          </div>

          <div className="cebuana-preview__dashboard-table-wrap">
            <table className="cebuana-preview__dashboard-table">
              <thead>
                <tr>
                  <th>Guard Name</th>
                  <th>Site Assignment</th>
                  <th>Date Range</th>
                  <th>Status</th>
                  <th>Completed At</th>
                  <th>Tracking for Original Signed DTR</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSentRows.map((row) => (
                  <tr key={row.id} className="cebuana-preview__dashboard-row cebuana-preview__dashboard-row--completed">
                    <td>{row.guardName}</td>
                    <td>{row.site}</td>
                    <td>{row.range}</td>
                    <td>
                      <span className="cebuana-preview__completed-badge cebuana-preview__completed-badge--done">Completed</span>
                    </td>
                    <td>{row.mockCompletedAt}</td>
                    <td>
                      <div className="cebuana-preview__sent-tracking">
                        <span className={`cebuana-preview__sent-courier-chip ${getCourierToneClass(row.mockCourier)}`}>
                          <Truck size={13} />
                          {row.mockCourier}
                        </span>
                        <span className="cebuana-preview__tracking-copy cebuana-preview__tracking-copy--completed">
                          Completed mock dispatch via {row.mockCourier} ({row.mockTracking})
                        </span>
                      </div>
                    </td>
                    <td>
                      <button type="button" className="cebuana-preview__table-button" onClick={() => onReprintRow(row)}>
                        Reprint slip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredSentRows.length ? (
            <div className="cebuana-preview__dashboard-empty">
              {normalizedQuery
                ? "No matching guards in Sent Today."
                : "No completed dispatches match the current courier filter."}
            </div>
          ) : null}
        </section>
        </>
      ) : null}
    </>
  );
}

function GuardsTab({ guards, dashboardMode, scopeLabel }) {
  return (
    <>
      <section className="cebuana-preview__section">
        <div className="cebuana-preview__section-head">
          <div className="cebuana-preview__section-icon">
            <UsersRound size={18} />
          </div>
          <div>
            <h3>Guard Roster</h3>
            <p>
              {dashboardMode === "live"
                ? "Scoped employee profiles from Supabase with quick DTR coverage status."
                : "Preview how supervisors could scan DTR coverage by guard and branch."}
            </p>
          </div>
        </div>

        <div className="cebuana-preview__roster-filters">
          <span className="cebuana-preview__filter-chip">
            <Map size={14} />
            {scopeLabel}
          </span>
          <span className="cebuana-preview__filter-chip">
            <Building2 size={14} />
            {dashboardMode === "live" ? "Scoped profile feed" : "Mixed Branch View"}
          </span>
          <span className="cebuana-preview__filter-chip">
            <SlidersHorizontal size={14} />
            {dashboardMode === "live" ? "Realtime roster status" : "Status Filter"}
          </span>
        </div>

        <div className="cebuana-preview__roster-list">
          {guards.map((guard) => (
            <article key={guard.id} className="cebuana-preview__roster-card">
              <div className="cebuana-preview__roster-main">
                <div className="cebuana-preview__roster-avatar">
                  <UserRound size={18} />
                </div>
                <div className="cebuana-preview__roster-copy">
                  <strong>{guard.name}</strong>
                  <span>{guard.employeeId}</span>
                  <span>{guard.branch}  |  {guard.shift}</span>
                </div>
              </div>
              <div className="cebuana-preview__roster-side">
                <MockStatusPill status={guard.status} />
                <button type="button" className="cebuana-preview__mini-action">Upload for Guard</button>
              </div>
            </article>
          ))}
        </div>
        {!guards.length ? (
          <div className="cebuana-preview__dashboard-empty">
            {dashboardMode === "live"
              ? "No scoped guard profiles were returned from Supabase."
              : "No mock guards are available in this preview state."}
          </div>
        ) : null}
      </section>
    </>
  );
}

function ReportsTab() {
  return (
    <>
      <section className="cebuana-preview__section">
        <div className="cebuana-preview__section-head">
          <div className="cebuana-preview__section-icon">
            <FileBarChart2 size={18} />
          </div>
          <div>
            <h3>Reports Snapshot</h3>
            <p>Compliance and submission patterns for the selected cutoff.</p>
          </div>
        </div>

        <div className="cebuana-preview__reports-grid">
          {mockReports.map((item) => (
            <article key={item.label} className="cebuana-preview__report-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>

        <div className="cebuana-preview__chart-card">
          <div className="cebuana-preview__chart-head">
            <strong>Submission Trend</strong>
            <span>Last 4 cutoffs</span>
          </div>
          <div className="cebuana-preview__chart-bars" aria-hidden="true">
            <span style={{ height: "52%" }} />
            <span style={{ height: "76%" }} />
            <span style={{ height: "64%" }} />
            <span style={{ height: "88%" }} />
          </div>
        </div>
      </section>
    </>
  );
}

function SettingsTab() {
  return (
    <>
      <section className="cebuana-preview__section">
        <div className="cebuana-preview__section-head">
          <div className="cebuana-preview__section-icon">
            <Settings size={18} />
          </div>
          <div>
            <h3>Preview Settings</h3>
            <p>Mock controls that support the Cebuana preview experience.</p>
          </div>
        </div>

        <div className="cebuana-preview__settings-list">
          {mockSettings.map((item) => (
            <article key={item.label} className="cebuana-preview__settings-row">
              <div>
                <strong>{item.label}</strong>
                <span>Preview-only preference</span>
              </div>
              <span className="cebuana-preview__settings-value">{item.value}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export default function CebuanaUploadPreviewPage({ profile = null }) {
  const allFilesRef = useRef([]);
  const [cutoff, setCutoff] = useState(cutoffOptions[0]);
  const [area, setArea] = useState(areaOptions[0]);
  const [branch, setBranch] = useState(branchOptions[0]);
  const [guardFiles, setGuardFiles] = useState(sampleGuardFiles.map((file, index) => createPreviewFile(file, `guard-${index + 1}`)));
  const [summaryFiles, setSummaryFiles] = useState([createPreviewFile(sampleSummaryFile, "summary-1")]);
  const [guardSubmitState, setGuardSubmitState] = useState("idle");
  const [summarySubmitState, setSummarySubmitState] = useState("idle");
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [guardDragOver, setGuardDragOver] = useState(false);
  const [summaryDragOver, setSummaryDragOver] = useState(false);
  const [reviewFocus, setReviewFocus] = useState(null);
  const [dispatchReady, setDispatchReady] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchMode, setDispatchMode] = useState("single");
  const [courier, setCourier] = useState(courierOptions[0]);
  const [trackingNumber, setTrackingNumber] = useState("LBC-124773284109");
  const [dispatchSuccessMessage, setDispatchSuccessMessage] = useState("");
  const [dashboardSeedRows, setDashboardSeedRows] = useState(mockPendingDashboardRows);
  const [dashboardRows, setDashboardRows] = useState(mockPendingDashboardRows);
  const [dashboardRecentActivity, setDashboardRecentActivity] = useState(mockRecentActivity);
  const [guardRoster, setGuardRoster] = useState(mockGuards);
  const [dashboardMode, setDashboardMode] = useState("mock");
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [dashboardLastSyncedAt, setDashboardLastSyncedAt] = useState(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewRow, setPrintPreviewRow] = useState(null);

  const detailSummary = useMemo(() => `${cutoff}  |  ${area}  |  ${branch}`, [area, branch, cutoff]);
  const checklistItems = useMemo(
    () => [
      { id: "check-1", label: "Cutoff details selected", done: Boolean(cutoff && area && branch) },
      { id: "check-2", label: "Guard DTR images complete", done: guardFiles.length > 0 },
      { id: "check-3", label: "Weekly summary attached", done: summaryFiles.length > 0 },
      {
        id: "check-4",
        label: dispatchReady
          ? `Dispatch staged for ${reviewFocus?.guardName || "selected guard"}`
          : reviewFocus
            ? `Review target loaded for ${reviewFocus.guardName}`
            : "Review target loaded from dashboard",
        done: Boolean(reviewFocus),
      },
    ],
    [area, branch, cutoff, dispatchReady, guardFiles.length, reviewFocus, summaryFiles.length]
  );
  const completedChecklistCount = checklistItems.filter((item) => item.done).length;
  const checklistReadyForSend = completedChecklistCount >= 3;
  const checklistNote = reviewFocus
    ? `${reviewFocus.guardName} from ${reviewFocus.site} is ${
        dispatchReady ? "marked ready for dispatch" : "staged in the upload flow"
      } for ${reviewFocus.range}.`
    : "Select a pending dashboard row to preload a review target before final dispatch.";
  const dispatchTitle = dispatchMode === "batch" ? "Batch Dispatch Summary Ready" : "Dispatch Summary Ready";
  const dispatchDescription =
    dispatchMode === "batch"
      ? `${dashboardRows.filter((row) => !row.mockCompleted).length} pending guards are grouped into one mock dispatch batch for ${cutoff}.`
        : reviewFocus
          ? `${reviewFocus.guardName} is prepared for ${dispatchReady ? "sending" : "review"} in the current cutoff batch.`
          : "This cutoff batch is staged for supervisor confirmation.";

  useEffect(() => {
    if (dispatchMode === "batch") {
      setCourier("Branch Messenger");
      setTrackingNumber(`BATCH-${cutoff.replace(/\s+/g, "").replace(/,/g, "").replace(/-/g, "")}`);
      return;
    }

    if (reviewFocus?.tracking?.includes("JRS")) {
      setCourier("JRS Express");
      setTrackingNumber("JRS-A87621294");
      return;
    }

    if (reviewFocus?.tracking?.toLowerCase().includes("personal")) {
      setCourier("Personal Delivery");
      setTrackingNumber("HAND-CARRY-2024");
      return;
    }

    setCourier("LBC Express");
    setTrackingNumber("LBC-124773284109");
  }, [cutoff, dispatchMode, reviewFocus]);

  useEffect(() => {
    allFilesRef.current = [...guardFiles, ...summaryFiles];
  }, [guardFiles, summaryFiles]);

  useEffect(() => {
    return () => {
      allFilesRef.current.forEach((file) => {
        if (file.previewUrl) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadDashboardRows() {
      if (!isSupabaseConfigured || !profile || !["admin", "supervisor"].includes(profile.role)) {
        if (!isActive) {
          return;
        }

        setDashboardMode("mock");
        setDashboardError(
          !isSupabaseConfigured
            ? "Supabase environment variables are missing, so the preview stays in polished demo mode."
            : "Sign in as an admin or supervisor to swap the dashboard table into live scoped data."
        );
        setDashboardSeedRows(mockPendingDashboardRows);
        setDashboardRows((current) => mergeDashboardRowsWithLiveSeed(mockPendingDashboardRows, current));
        setDashboardRecentActivity(mockRecentActivity);
        setGuardRoster(mockGuards);
        setDashboardLastSyncedAt(null);
        setDashboardLoading(false);
        return;
      }

      setDashboardLoading(true);

      const [pendingResponse, recentResponse, profilesResponse] = await Promise.all([
        supabase
          .from("dtr_submissions")
          .select(
            "id,status,cutoff,selected_dtr_date,employee_note,admin_remarks,created_at,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,employee_id,location,branch)"
          )
          .eq("status", "Pending Review")
          .order("created_at", { ascending: false })
          .limit(18),
        supabase
          .from("dtr_submissions")
          .select(
            "id,user_id,status,cutoff,selected_dtr_date,employee_note,admin_remarks,approved_at,created_at,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,employee_id,location,branch)"
          )
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("profiles")
          .select("id,role,full_name,employee_id,position,shift,location,branch,created_at")
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

      if (!isActive) {
        return;
      }

      if (pendingResponse.error || recentResponse.error || profilesResponse.error) {
        setDashboardMode("mock");
        setDashboardError("Live dashboard data could not be loaded, so the preview is showing demo rows.");
        setDashboardSeedRows(mockPendingDashboardRows);
        setDashboardRows((current) => mergeDashboardRowsWithLiveSeed(mockPendingDashboardRows, current));
        setDashboardRecentActivity(mockRecentActivity);
        setGuardRoster(mockGuards);
        setDashboardLastSyncedAt(null);
        setDashboardLoading(false);
        return;
      }

      const recentScopedRows =
        profile.role === "supervisor"
          ? (recentResponse.data ?? []).filter((row) => matchesSupervisorScope(row, profile))
          : recentResponse.data ?? [];
      const scopedRows =
        profile.role === "supervisor"
          ? (pendingResponse.data ?? []).filter((row) => matchesSupervisorScope(row, profile))
          : pendingResponse.data ?? [];
      const scopedProfiles =
        profile.role === "supervisor"
          ? (profilesResponse.data ?? []).filter((item) => isScopedEmployee(item, profile))
          : (profilesResponse.data ?? []).filter((item) => item.role === "employee");
      const nextSeedRows = scopedRows.map(mapLiveSubmissionToDashboardRow);
      const latestSubmissionByUserId = new Map();

      recentScopedRows.forEach((row) => {
        if (row.user_id && !latestSubmissionByUserId.has(row.user_id)) {
          latestSubmissionByUserId.set(row.user_id, row);
        }
      });

      setDashboardMode("live");
      setDashboardError("");
      setDashboardSeedRows(nextSeedRows);
      setDashboardRows((current) => mergeDashboardRowsWithLiveSeed(nextSeedRows, current));
      setDashboardRecentActivity(
        recentScopedRows.length ? recentScopedRows.slice(0, 6).map(mapLiveSubmissionToActivity) : mockRecentActivity
      );
      setGuardRoster(
        scopedProfiles.length
          ? scopedProfiles.map((item) => mapProfileToGuard(item, latestSubmissionByUserId.get(item.id)))
          : mockGuards
      );
      setDashboardLastSyncedAt(new Date().toISOString());
      setDashboardLoading(false);
    }

    loadDashboardRows();

    if (!isSupabaseConfigured || !profile || !["admin", "supervisor"].includes(profile.role)) {
      return () => {
        isActive = false;
      };
    }

    const realtimeChannel = supabase
      .channel(dashboardRealtimeChannelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "dtr_submissions" }, loadDashboardRows)
      .subscribe();

    return () => {
      isActive = false;
      supabase.removeChannel(realtimeChannel);
    };
  }, [profile]);

  function addGuardSamples() {
    setGuardFiles((current) => [
      ...current,
      ...sampleGuardFiles.map((file, index) =>
        createPreviewFile({ ...file, source: "Demo sample" }, `guard-sample-${Date.now()}-${index}`)
      ),
    ]);
    setGuardSubmitState("idle");
  }

  function addSummarySample() {
    setSummaryFiles([createPreviewFile({ ...sampleSummaryFile, source: "Demo sample" }, `summary-sample-${Date.now()}`)]);
    setSummarySubmitState("idle");
  }

  function handleGuardFileChange(event) {
    const incomingFiles = createIncomingFiles(event.target.files, "guard-upload");
    if (incomingFiles.length) {
      setGuardFiles((current) => [...current, ...incomingFiles]);
      setGuardSubmitState("idle");
    }
    event.target.value = "";
  }

  function handleSummaryFileChange(event) {
    const incomingFiles = createIncomingFiles(event.target.files, "summary-upload");
    if (incomingFiles.length) {
      setSummaryFiles((current) => {
        current.forEach((file) => {
          if (file.previewUrl) {
            URL.revokeObjectURL(file.previewUrl);
          }
        });
        return [incomingFiles[0]];
      });
      setSummarySubmitState("idle");
    }
    event.target.value = "";
  }

  function removeGuardFile(id) {
    setGuardFiles((current) => {
      const fileToRemove = current.find((file) => file.id === id);
      if (fileToRemove?.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }
      return current.filter((file) => file.id !== id);
    });
    setGuardSubmitState("idle");
  }

  function removeSummaryFile(id) {
    setSummaryFiles((current) => {
      const fileToRemove = current.find((file) => file.id === id);
      if (fileToRemove?.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }
      return current.filter((file) => file.id !== id);
    });
    setSummarySubmitState("idle");
  }

  function simulateSubmit(setter) {
    setter("submitting");
    window.setTimeout(() => setter("submitted"), 1100);
  }

  function handleReviewRow(row, options = {}) {
    setActiveTab("Upload");
    setCutoff(cutoffOptions[0]);
    setArea(areaOptions[0]);
    setBranch(row.site === "ABC Corp" || row.site === "City Mall" ? "Cebu Main Branch" : "IT Park Branch");
    setReviewFocus(row);
    setDispatchReady(Boolean(options.dispatchReady));
    setDispatchMode(options.dispatchReady ? "single" : "single");
    setShowDispatchModal(false);
    setShowPrintPreview(false);
    setDispatchSuccessMessage("");
  }

  function handleBatchDispatch() {
    setActiveTab("Upload");
    setReviewFocus(dashboardRows.find((row) => !row.mockCompleted) || dashboardRows[0] || null);
    setDispatchReady(true);
    setDispatchMode("batch");
    setShowDispatchModal(true);
    setShowPrintPreview(false);
    setDispatchSuccessMessage("");
  }

  function handleReprintRow(row) {
    setDispatchMode("single");
    setCourier(row.mockCourier || courierOptions[0]);
    setTrackingNumber(row.mockTracking || "LBC-124773284109");
    setPrintPreviewRow(row);
    setShowPrintPreview(true);
  }

  function resetDemo() {
    [...guardFiles, ...summaryFiles].forEach((file) => {
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
    });

    setCutoff(cutoffOptions[0]);
    setArea(areaOptions[0]);
    setBranch(branchOptions[0]);
    setGuardFiles(sampleGuardFiles.map((file, index) => createPreviewFile({ ...file, source: "Demo sample" }, `guard-reset-${index + 1}`)));
    setSummaryFiles([createPreviewFile({ ...sampleSummaryFile, source: "Demo sample" }, "summary-reset-1")]);
    setGuardSubmitState("idle");
    setSummarySubmitState("idle");
    setActiveTab("Dashboard");
    setGuardDragOver(false);
    setSummaryDragOver(false);
    setReviewFocus(null);
    setDispatchReady(false);
    setDispatchMode("single");
    setCourier(courierOptions[0]);
    setTrackingNumber("LBC-124773284109");
    setShowDispatchModal(false);
    setShowPrintPreview(false);
    setPrintPreviewRow(null);
    setDispatchSuccessMessage("");
    setDashboardRows(dashboardSeedRows);
  }

  function handleDrop(setDragOver, onFiles) {
    return (event) => {
      event.preventDefault();
      setDragOver(false);
      const incomingFiles = createIncomingFiles(event.dataTransfer?.files, "drop-upload");
      if (incomingFiles.length) {
        onFiles(incomingFiles);
      }
    };
  }

  function createMockCompletedTime(index) {
    const minutes = 42 + index * 7;
    const hour = minutes >= 60 ? 11 : 10;
    const displayMinutes = String(minutes % 60).padStart(2, "0");
    return `${hour}:${displayMinutes} AM`;
  }

  function renderActiveTab() {
    if (activeTab === "Dashboard") {
      return (
        <DashboardTab
          rows={dashboardRows}
          onReviewRow={handleReviewRow}
          onBatchDispatch={handleBatchDispatch}
          onReprintRow={handleReprintRow}
          recentActivity={dashboardRecentActivity}
          dashboardMode={dashboardMode}
          dashboardLoading={dashboardLoading}
          dashboardError={dashboardError}
          scopeLabel={getDashboardScopeLabel(profile)}
          lastSyncedAt={dashboardLastSyncedAt}
        />
      );
    }

    if (activeTab === "Guards") {
      return <GuardsTab guards={guardRoster} dashboardMode={dashboardMode} scopeLabel={getDashboardScopeLabel(profile)} />;
    }

    if (activeTab === "Reports") {
      return <ReportsTab />;
    }

    if (activeTab === "Settings") {
      return <SettingsTab />;
    }

    return (
      <>
        <div className="cebuana-preview__upload-layout">
          <div className="cebuana-preview__upload-main">
            <UploadSection
              title="Upload Guard DTRs"
              copy="Upload images of guards' individual Daily Time Records (DTRs)."
              files={guardFiles}
              sectionTone="guard"
              reviewedGuardName={reviewFocus?.guardName || ""}
              dispatchReady={dispatchReady}
              emptyTitle="Drag & drop DTR images here"
              emptyCopy="or tap to upload from your device"
              actionLabel="Submit DTRs"
              actionTone="blue"
              isSubmitting={guardSubmitState === "submitting"}
              isSubmitted={guardSubmitState === "submitted"}
              isDragOver={guardDragOver}
              onChooseFiles={handleGuardFileChange}
              onAddSamples={addGuardSamples}
              onRemoveFile={removeGuardFile}
              onSubmit={() => simulateSubmit(setGuardSubmitState)}
              onDragEnter={(event) => {
                event.preventDefault();
                setGuardDragOver(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setGuardDragOver(false);
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setGuardDragOver(true);
              }}
              onDrop={handleDrop(setGuardDragOver, (incomingFiles) => {
                setGuardFiles((current) => [...current, ...incomingFiles]);
                setGuardSubmitState("idle");
              })}
              summary={buildSelectionSummary(guardFiles)}
            />

            <UploadSection
              title="Upload Weekly Summary of DTRs"
              copy="Upload the summary report of all guards for the period."
              files={summaryFiles}
              sectionTone="summary"
              emptyTitle="Drop the summary report here"
              emptyCopy="or tap to replace the summary file"
              actionLabel="Submit Summary"
              actionTone="green"
              isSubmitting={summarySubmitState === "submitting"}
              isSubmitted={summarySubmitState === "submitted"}
              isDragOver={summaryDragOver}
              onChooseFiles={handleSummaryFileChange}
              onAddSamples={addSummarySample}
              onRemoveFile={removeSummaryFile}
              onSubmit={() => simulateSubmit(setSummarySubmitState)}
              onDragEnter={(event) => {
                event.preventDefault();
                setSummaryDragOver(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setSummaryDragOver(false);
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setSummaryDragOver(true);
              }}
              onDrop={handleDrop(setSummaryDragOver, (incomingFiles) => {
                setSummaryFiles((current) => {
                  current.forEach((file) => {
                    if (file.previewUrl) {
                      URL.revokeObjectURL(file.previewUrl);
                    }
                  });
                  return incomingFiles.length ? [incomingFiles[0]] : current;
                });
                setSummarySubmitState("idle");
              })}
              summary={buildSelectionSummary(summaryFiles)}
            />
          </div>

          <div className="cebuana-preview__upload-side">
            <div className="cebuana-preview__sticky-panel">
              <section className="cebuana-preview__panel">
                <div className="cebuana-preview__panel-head">
                  <h2>Select Details</h2>
                  <p>{reviewFocus ? `Reviewing ${reviewFocus.guardName}` : detailSummary}</p>
                </div>

                <div className="cebuana-preview__fields">
                  <DetailField label="Cut-off Date" icon={CalendarDays} value={cutoff} options={cutoffOptions} onChange={setCutoff} />
                  <DetailField label="Area" icon={MapPinned} value={area} options={areaOptions} onChange={setArea} />
                  <DetailField label="Branch Location" icon={Building2} value={branch} options={branchOptions} onChange={setBranch} />
                </div>
              </section>

              <section className="cebuana-preview__checklist-card">
                <div className="cebuana-preview__section-head">
                  <div className="cebuana-preview__section-icon">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3>Submission Checklist</h3>
                    <p>Quick supervisor checklist before forwarding this cutoff batch.</p>
                  </div>
                </div>

                <div className="cebuana-preview__checklist-list">
                  {checklistItems.map((item) => (
                    <div key={item.id} className="cebuana-preview__checklist-row">
                      <span className={`cebuana-preview__checklist-dot${item.done ? " cebuana-preview__checklist-dot--done" : ""}`} />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="cebuana-preview__checklist-note">
                  <strong>Supervisor note</strong>
                  <p>
                    {completedChecklistCount} of {checklistItems.length} checkpoints are ready. {checklistNote}
                  </p>
                </div>
              </section>

              <section className="cebuana-preview__rail-cta-card">
                <div className="cebuana-preview__rail-cta-copy">
                  <span>Tablet side rail summary</span>
                  <strong>
                    {dispatchReady
                      ? "Dispatch-ready review loaded"
                      : checklistReadyForSend
                        ? "Ready to package this cutoff"
                        : "Complete the checklist first"}
                  </strong>
                  <p>
                    {guardFiles.length} DTR file{guardFiles.length === 1 ? "" : "s"} and {summaryFiles.length} summary item
                    {summaryFiles.length === 1 ? "" : "s"} currently staged.
                  </p>
                </div>
                <button
                  type="button"
                  className="cebuana-preview__dashboard-button cebuana-preview__dashboard-button--blue cebuana-preview__rail-cta-button"
                  disabled={!checklistReadyForSend}
                  onClick={() => {
                    if (dispatchMode !== "batch") {
                      setDispatchMode("single");
                    }
                    setShowDispatchModal(true);
                  }}
                >
                  {checklistReadyForSend ? "Prepare Dispatch Summary" : "Waiting for Review"}
                </button>
              </section>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="cebuana-preview">
      <div className="cebuana-preview__backdrop" />

      <div className="cebuana-preview__phone-shell">
        <div className="cebuana-preview__phone-camera" />

        <div className="cebuana-preview__screen">
          <header className="cebuana-preview__topbar">
            <div className="cebuana-preview__topbar-main">
              <div className="cebuana-preview__brand">CEBUANA</div>

              <nav className="cebuana-preview__header-nav" aria-label="Tablet preview navigation">
                {bottomNav.map(({ label }) => {
                  const active = activeTab === label;

                  return (
                    <button
                      key={label}
                      type="button"
                      className={`cebuana-preview__header-nav-item${active ? " cebuana-preview__header-nav-item--active" : ""}`}
                      onClick={() => setActiveTab(label)}
                    >
                      {label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="cebuana-preview__profile-pill">
              <div className="cebuana-preview__avatar">S</div>
              <span>Supervisor</span>
            </div>
          </header>

          <main className="cebuana-preview__content">
            <div className={`cebuana-preview__toolbar${activeTab === "Dashboard" ? " cebuana-preview__toolbar--compact" : ""}`}>
              <div className="cebuana-preview__toolbar-copy">
                <h1>{activeTab === "Upload" ? "Upload DTRs and Summary" : activeTab}</h1>
                <p>
                  {activeTab === "Dashboard" &&
                    (dashboardMode === "live"
                      ? "Cebuana dashboard preview with real Supabase DTR data for the current signed-in scope."
                      : "Cebuana dashboard preview in presentation mode, ready to switch to live data when an admin or supervisor signs in.")}
                  {activeTab === "Guards" && "Mock guard roster for tracking submission status by branch."}
                  {activeTab === "Upload" && "Standalone interactive upload preview for testing the Cebuana supervisor workflow."}
                  {activeTab === "Reports" && "Preview-only reporting tab for compliance and submission trends."}
                  {activeTab === "Settings" && "Mock settings tab for supervisor workflow preferences."}
                </p>
              </div>

              <div className="cebuana-preview__toolbar-actions">
                <button type="button" className="cebuana-preview__icon-button" aria-label="Time">
                  <Clock3 size={18} />
                </button>
                <button type="button" className="cebuana-preview__icon-button cebuana-preview__icon-button--alert" aria-label="Notifications">
                  <Bell size={18} />
                </button>
              </div>
            </div>

            <div className="cebuana-preview__demo-banner">
              <div>
                <strong>{dashboardMode === "live" ? "Connected preview mode" : "Interactive demo mode"}</strong>
                <span>
                  {activeTab === "Upload"
                    ? "Selections and uploads are local to this preview only."
                    : dashboardMode === "live"
                      ? "Dashboard counts and pending rows are coming from Supabase, while the dispatch flow remains safely mocked."
                      : "This tab is mock-only and stays separate from the rest of the app."}
                </span>
              </div>
              <button type="button" className="cebuana-preview__demo-reset" onClick={resetDemo}>
                <RotateCcw size={16} />
                Reset
              </button>
            </div>

            {dispatchSuccessMessage ? (
              <div className="cebuana-preview__success-banner" role="status">
                <CheckCircle2 size={16} />
                <span>{dispatchSuccessMessage}</span>
              </div>
            ) : null}
            {renderActiveTab()}
          </main>

          {showDispatchModal ? (
            <div className="cebuana-preview__dispatch-modal" role="dialog" aria-modal="true" aria-label="Dispatch summary">
              <div className="cebuana-preview__dispatch-panel">
                <div className="cebuana-preview__dispatch-head">
                  <div>
                    <strong>{dispatchTitle}</strong>
                    <span>{dispatchDescription}</span>
                  </div>
                  <button
                    type="button"
                    className="cebuana-preview__file-close"
                    aria-label="Close dispatch summary"
                    onClick={() => setShowDispatchModal(false)}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="cebuana-preview__dispatch-body">
                  <div className="cebuana-preview__dispatch-metric">
                    <span>Cutoff</span>
                    <strong>{cutoff}</strong>
                  </div>
                  <div className="cebuana-preview__dispatch-metric">
                    <span>Branch</span>
                    <strong>{branch}</strong>
                  </div>
                  <div className="cebuana-preview__dispatch-metric">
                    <span>{dispatchMode === "batch" ? "Guards staged" : "Files staged"}</span>
                    <strong>{dispatchMode === "batch" ? mockPendingDashboardRows.length : guardFiles.length + summaryFiles.length}</strong>
                  </div>
                </div>

                <div className="cebuana-preview__dispatch-step">
                  <div className="cebuana-preview__dispatch-step-head">
                    <strong>Mock courier and tracking</strong>
                    <span>Choose how the signed DTR packet will be forwarded.</span>
                  </div>
                  <div className="cebuana-preview__dispatch-form">
                    <DetailField label="Courier" icon={MapPinned} value={courier} options={courierOptions} onChange={setCourier} />
                    <label className="cebuana-preview__field">
                      <span className="cebuana-preview__field-label">
                        <FileWarning size={16} />
                        Tracking Reference <em>*</em>
                      </span>
                      <input
                        className="cebuana-preview__text-input"
                        value={trackingNumber}
                        onChange={(event) => setTrackingNumber(event.target.value)}
                        placeholder="Enter reference number"
                      />
                    </label>
                  </div>
                </div>

                <div className="cebuana-preview__dispatch-slip">
                  <div className="cebuana-preview__dispatch-slip-head">
                    <strong>Mock Printable Dispatch Slip</strong>
                    <span>{dispatchMode === "batch" ? "Batch forwarding copy" : "Single-guard forwarding copy"}</span>
                  </div>
                  <div className="cebuana-preview__dispatch-slip-grid">
                    <div>
                      <span>Destination</span>
                      <strong>{dispatchMode === "batch" ? "Head Office DTR Coordinator" : reviewFocus?.site || branch}</strong>
                    </div>
                    <div>
                      <span>Courier</span>
                      <strong>{courier}</strong>
                    </div>
                    <div>
                      <span>Tracking Ref</span>
                      <strong>{trackingNumber}</strong>
                    </div>
                    <div>
                      <span>Prepared By</span>
                      <strong>Supervisor Demo User</strong>
                    </div>
                  </div>
                </div>

                <div className="cebuana-preview__dispatch-actions">
                  <button
                    type="button"
                    className="cebuana-preview__mini-action"
                    onClick={() => setShowPrintPreview(true)}
                  >
                    Print slip
                  </button>
                  <button
                    type="button"
                    className="cebuana-preview__mini-action cebuana-preview__mini-action--ghost"
                    onClick={() => setShowDispatchModal(false)}
                  >
                    Back to editing
                  </button>
                  <button
                    type="button"
                    className="cebuana-preview__dashboard-button cebuana-preview__dashboard-button--blue"
                    onClick={() => {
                      setDispatchReady(true);
                      setDispatchMode(dispatchMode);
                      setDashboardRows((current) =>
                        current.map((row, index) => {
                          if (dispatchMode === "batch") {
                            return {
                              ...row,
                              mockCompleted: true,
                              mockCourier: courier,
                              mockTracking: trackingNumber,
                              mockCompletedAt: createMockCompletedTime(index),
                              canSend: false,
                            };
                          }

                          if (row.id !== reviewFocus?.id) {
                            return row;
                          }

                          return {
                            ...row,
                            mockCompleted: true,
                            mockCourier: courier,
                            mockTracking: trackingNumber,
                            mockCompletedAt: createMockCompletedTime(index),
                            canSend: false,
                          };
                        })
                      );
                      setDispatchSuccessMessage(
                        dispatchMode === "batch"
                          ? `Batch dispatch confirmed via ${courier} with reference ${trackingNumber}.`
                          : `${reviewFocus?.guardName || "Selected guard"} dispatch confirmed via ${courier} with reference ${trackingNumber}.`
                      );
                      setShowDispatchModal(false);
                      setShowPrintPreview(false);
                    }}
                  >
                    Confirm mock dispatch
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {showPrintPreview ? (
            <div className="cebuana-preview__print-preview" role="dialog" aria-modal="true" aria-label="Print preview">
              <div className="cebuana-preview__print-panel">
                <div className="cebuana-preview__dispatch-head">
                  <div>
                    <strong>Print Preview</strong>
                    <span>Mock print-ready copy of the dispatch slip.</span>
                  </div>
                  <button
                    type="button"
                    className="cebuana-preview__file-close"
                    aria-label="Close print preview"
                    onClick={() => setShowPrintPreview(false)}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="cebuana-preview__print-sheet">
                  <div className="cebuana-preview__print-brand">CEBUANA DISPATCH SLIP</div>
                  <div className="cebuana-preview__dispatch-slip-grid">
                    <div>
                      <span>Mode</span>
                      <strong>{printPreviewRow ? "Reprint Dispatch" : dispatchMode === "batch" ? "Batch Dispatch" : "Single Dispatch"}</strong>
                    </div>
                    <div>
                      <span>Cutoff</span>
                      <strong>{cutoff}</strong>
                    </div>
                    <div>
                      <span>Courier</span>
                      <strong>{courier}</strong>
                    </div>
                    <div>
                      <span>Tracking Ref</span>
                      <strong>{trackingNumber}</strong>
                    </div>
                    <div>
                      <span>Prepared For</span>
                      <strong>
                        {printPreviewRow
                          ? printPreviewRow.guardName
                          : dispatchMode === "batch"
                            ? "Head Office DTR Coordinator"
                            : reviewFocus?.guardName || "Selected guard"}
                      </strong>
                    </div>
                    <div>
                      <span>Branch</span>
                      <strong>{branch}</strong>
                    </div>
                    <div>
                      <span>Completed At</span>
                      <strong>{printPreviewRow?.mockCompletedAt || "For confirmation"}</strong>
                    </div>
                  </div>
                </div>

                <div className="cebuana-preview__dispatch-actions">
                  <button
                    type="button"
                    className="cebuana-preview__mini-action cebuana-preview__mini-action--ghost"
                    onClick={() => setShowPrintPreview(false)}
                  >
                    Close preview
                  </button>
                  <button
                    type="button"
                    className="cebuana-preview__dashboard-button cebuana-preview__dashboard-button--blue"
                    onClick={() => setShowPrintPreview(false)}
                  >
                    Print mock slip
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <nav className="cebuana-preview__bottom-nav" aria-label="Preview navigation">
            {bottomNav.map(({ label, icon: Icon }) => {
              const active = activeTab === label;

              return (
                <button
                  key={label}
                  type="button"
                  className={`cebuana-preview__bottom-item${active ? " cebuana-preview__bottom-item--active" : ""}`}
                  onClick={() => setActiveTab(label)}
                >
                  <span className="cebuana-preview__bottom-icon">
                    <Icon size={19} />
                  </span>
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
