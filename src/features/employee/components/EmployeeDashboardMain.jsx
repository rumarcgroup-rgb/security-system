import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { IdCard, MapPin } from "lucide-react";
import Card from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";


export default function EmployeeDashboardMain({
  adminFeedback,
  assignment,
  dashboardVariant,
  dtrReviewLoadingId,
  person,
  profileCompletenessSummary,
  onOpenDtrReview,
  recentSubmissionsFocusRequestKey,
  submissions,
  summary,
}) {
  const recentSubmissionsRef = useRef(null);
  const sectionHighlightTimeoutRef = useRef(null);
  const dtrHistory = useMemo(() => {
    return [...submissions]
      .sort((left, right) => new Date(right.selected_dtr_date || right.created_at || 0) - new Date(left.selected_dtr_date || left.created_at || 0))
      .slice(0, 10);
  }, [submissions]);
  const needsActionTotal = summary.needsActionTotal ?? summary.rejectedDtrs + summary.flaggedDocs;
  const hasRejectedDtrAction = summary.rejectedDtrs > 0;
  const hasFileAction = summary.flaggedDocs > 0;
  const hasNeedsAction = needsActionTotal > 0;
  const isProfileComplete = profileCompletenessSummary.percent >= 100;

  useEffect(() => {
    return () => {
      if (sectionHighlightTimeoutRef.current) {
        window.clearTimeout(sectionHighlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!recentSubmissionsFocusRequestKey) return;

    const frame = window.requestAnimationFrame(() => {
      focusSection(recentSubmissionsRef.current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [recentSubmissionsFocusRequestKey]);

  function focusSection(target) {
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.remove("employee-dashboard__focus-target--highlight");
    void target.offsetWidth;
    target.classList.add("employee-dashboard__focus-target--highlight");

    if (sectionHighlightTimeoutRef.current) {
      window.clearTimeout(sectionHighlightTimeoutRef.current);
    }

    sectionHighlightTimeoutRef.current = window.setTimeout(() => {
      target.classList.remove("employee-dashboard__focus-target--highlight");
    }, 1600);
  }

  return (
    <main className="employee-dashboard__content employee-dashboard__stack-lg">
      <h2 className="employee-dashboard__section-title">My Profile</h2>
      <Card className="employee-dashboard__profile-card">
        <div className="employee-dashboard__profile-header">
          <div className="app-avatar app-avatar--circle app-avatar--lg employee-dashboard__profile-avatar">
            {person.avatar_preview_url ? (
              <img src={person.avatar_preview_url} alt={person.full_name} className="app-media-cover" />
            ) : (
              person.full_name
                .split(" ")
                .slice(0, 4)
                .map((namePart) => namePart[0])
                .join("")
            )}
          </div>

          <div>
            <h2 className="employee-dashboard__profile-name">{person.full_name}</h2>
            <p className="employee-dashboard__profile-role">{person.role || dashboardVariant.roleLabel}</p>
          </div>
        </div>

        <div className="employee-dashboard__profile-divider" />

        <div className="employee-dashboard__profile-meta">
          <span className="app-inline-meta">
            <IdCard size={14} className="text-slate-500" />
            <span className="employee-dashboard__label-strong">Employee ID:</span>
            <span>{person.employee_id}</span>
          </span>
          <span className="app-inline-meta">
            <MapPin size={14} className="text-slate-500" />
            <span className="employee-dashboard__label-strong">Location:</span>
            <span>{person.branch ? `${person.location} / ${person.branch}` : person.location}</span>
          </span>
        </div>
      </Card>

      <div className="employee-dashboard__info-grid">
        <Card className="employee-dashboard__assignment-card">
          <div className="employee-dashboard__section-head">
            <div>
              <h3 className="employee-dashboard__subsection-title">My Assignment</h3>
              <p className="app-copy-sm">Your current post, shift, and reporting setup.</p>
            </div>
            <div className="app-icon-box">
              <MapPin size={18} />
            </div>
          </div>
          <div className="employee-dashboard__assignment-grid">
            <div className="employee-dashboard__info-tile">
              <p className="employee-dashboard__copy-xs">Position</p>
              <p className="employee-dashboard__text-strong">{assignment.position}</p>
            </div>
            <div className="employee-dashboard__info-tile">
              <p className="employee-dashboard__copy-xs">Shift</p>
              <p className="employee-dashboard__text-strong">{assignment.shift}</p>
            </div>
            <div className="employee-dashboard__info-tile">
              <p className="employee-dashboard__copy-xs">Location</p>
              <p className="employee-dashboard__text-strong">{assignment.location}</p>
            </div>
            <div className="employee-dashboard__info-tile">
              <p className="employee-dashboard__copy-xs">Branch</p>
              <p className="employee-dashboard__text-strong">{assignment.branch}</p>
            </div>
            <div className="employee-dashboard__info-tile employee-dashboard__info-tile--wide">
              <p className="employee-dashboard__copy-xs">Supervisor</p>
              <p className="employee-dashboard__text-strong">{assignment.supervisor}</p>
            </div>
          </div>
        </Card>

      </div>

      <div className="employee-dashboard__stats-grid">
        <Card className="employee-dashboard__stat-card--dark">
          <p className="employee-dashboard__stat-label employee-dashboard__stat-label--dark">Pending DTR</p>
          <p className="employee-dashboard__stat-value">{summary.pendingDtrs}</p>
          <p className="employee-dashboard__stat-copy employee-dashboard__stat-copy--dark">Waiting for payroll review</p>
        </Card>
        <Card className="employee-dashboard__stat-card--light">
          <p className="employee-dashboard__stat-label employee-dashboard__stat-label--light">Approved DTR</p>
          <p className="employee-dashboard__stat-value employee-dashboard__stat-value--light">{summary.approvedDtrs}</p>
          <p className="employee-dashboard__stat-copy employee-dashboard__stat-copy--light">Recent approved cutoffs</p>
        </Card>
        <Card className="employee-dashboard__stat-card--light">
          <p className="employee-dashboard__stat-label employee-dashboard__stat-label--light">Verified Files</p>
          <p className="employee-dashboard__stat-value employee-dashboard__stat-value--success">{summary.verifiedDocs}</p>
          <p className="employee-dashboard__stat-copy employee-dashboard__stat-copy--light">Docs cleared by admin</p>
        </Card>
        <Card className="employee-dashboard__stat-card--alert">
          <p className="employee-dashboard__stat-label employee-dashboard__stat-label--alert">Needs Action</p>
          <p className="employee-dashboard__stat-value employee-dashboard__stat-value--alert">{needsActionTotal}</p>
          <p className="employee-dashboard__stat-copy employee-dashboard__stat-copy--alert">Rejected DTR or files to fix</p>
          <div className="employee-dashboard__stat-breakdown">
            <span>Rejected DTR: {summary.rejectedDtrs}</span>
            <span>Files to fix: {summary.flaggedDocs}</span>
          </div>
        </Card>
      </div>

      {hasNeedsAction ? (
        <Card className="employee-dashboard__next-action-card">
          <h3 className="employee-dashboard__subsection-title employee-dashboard__subsection-title--tight">Needs Action Guidance</h3>
          <div className="employee-dashboard__guidance-list">
            {hasRejectedDtrAction ? (
              <p className="app-copy-sm">Review the admin remarks on your rejected DTR, then submit a corrected DTR for review.</p>
            ) : null}
            {hasFileAction ? (
              <p className="app-copy-sm">Open Documents and upload replacements for missing files or files marked Needs Reupload.</p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {!isProfileComplete ? (
        <Card className="employee-dashboard__compliance-card">
          <div className="employee-dashboard__section-head">
            <div>
              <h3 className="employee-dashboard__subsection-title">Profile Completeness</h3>
              <p className="app-copy-sm">Finish these items so admin and supervisors can process your records smoothly.</p>
            </div>
            <span className="app-pill app-pill--success">{profileCompletenessSummary.percent}%</span>
          </div>
          <div className="employee-dashboard__compliance-progress">
            <div className="employee-dashboard__progress-track">
              <div className="employee-dashboard__progress-fill" style={{ width: `${profileCompletenessSummary.percent}%` }} />
            </div>
            <p className="employee-dashboard__copy-xs">
              {profileCompletenessSummary.completeCount} of {profileCompletenessSummary.totalCount} setup areas complete.
            </p>
          </div>
          <div className="employee-dashboard__compliance-checks">
            {profileCompletenessSummary.checks.map((item) => (
              <div
                key={item.id}
                className={`employee-dashboard__compliance-check${item.done ? " employee-dashboard__compliance-check--done" : ""}`}
              >
                <span className="employee-dashboard__compliance-dot" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div>
        <h3 className="employee-dashboard__subsection-title employee-dashboard__subsection-title--tight">Recent Admin Feedback</h3>
        <div className="employee-stack employee-dashboard__recent-list">
          {adminFeedback.map((item) => (
            <div key={item.id} className="employee-card-panel employee-card-panel--muted employee-dashboard__feedback-card">
              <div className="employee-dashboard__recent-item-header">
                <div>
                  <p className="employee-dashboard__text-strong">{item.cutoff}</p>
                  <p className="employee-dashboard__copy-xs">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <p className="employee-dashboard__feedback-copy">{item.remarks}</p>
            </div>
          ))}
          {adminFeedback.length === 0 ? (
            <div className="employee-card-panel employee-card-panel--muted employee-dashboard__feedback-card">
              <p className="employee-dashboard__text-strong">No admin feedback yet</p>
              <p className="employee-dashboard__copy-xs">Feedback will appear here once your submissions are reviewed.</p>
            </div>
          ) : null}
        </div>
      </div>

      <div ref={recentSubmissionsRef} className="employee-dashboard__focus-target">
        <h3 className="employee-dashboard__subsection-title employee-dashboard__subsection-title--tight">Recent Submissions</h3>
        <div className="employee-stack employee-dashboard__recent-list">
          {submissions.map((row) => (
            <motion.div key={row.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="employee-card-soft employee-dashboard__recent-item">
              <div className="employee-dashboard__recent-item-header">
                <div>
                  <p className="employee-dashboard__copy-xs">{new Date(row.created_at).toLocaleString()}</p>
                  <p className="employee-dashboard__text-strong">{row.cutoff}</p>
                  {row.employee_note ? <p className="app-copy-xs-spaced">Note: {row.employee_note}</p> : null}
                  {row.admin_remarks ? <p className="app-copy-xs-spaced-brand">Admin remarks: {row.admin_remarks}</p> : null}
                  {row.approved_at ? <p className="app-copy-xs-success">Approved: {new Date(row.approved_at).toLocaleString()}</p> : null}
                </div>
                <StatusBadge status={row.status} />
              </div>
              <div className="employee-dashboard__recent-actions">
                <button
                  type="button"
                  className="app-link-button employee-dashboard__review-dtr-button"
                  disabled={dtrReviewLoadingId === row.id}
                  onClick={() => onOpenDtrReview(row)}
                >
                  {dtrReviewLoadingId === row.id ? "Loading DTR..." : "Review DTR"}
                </button>
              </div>
            </motion.div>
          ))}
          {submissions.length === 0 ? <p className="app-copy-sm">No submissions yet.</p> : null}
        </div>
      </div>

      <div>
        <h3 className="employee-dashboard__subsection-title employee-dashboard__subsection-title--tight">DTR History Timeline</h3>
        <div className="employee-dashboard__timeline">
          {dtrHistory.map((row) => (
            <div key={`timeline-${row.id}`} className="employee-dashboard__timeline-item">
              <span className="employee-dashboard__timeline-dot" />
              <div className="employee-dashboard__timeline-card">
                <div className="employee-dashboard__recent-item-header">
                  <div>
                    <p className="employee-dashboard__text-strong">{row.cutoff || "No cutoff selected"}</p>
                    <p className="employee-dashboard__copy-xs">
                      Submitted {new Date(row.created_at).toLocaleString()}
                      {row.selected_dtr_date ? ` | DTR date ${row.selected_dtr_date}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                {row.admin_remarks ? <p className="app-copy-xs-spaced-brand">Admin remarks: {row.admin_remarks}</p> : null}
                <div className="employee-dashboard__recent-actions employee-dashboard__recent-actions--timeline">
                  <button
                    type="button"
                    className="app-link-button employee-dashboard__review-dtr-button"
                    disabled={dtrReviewLoadingId === row.id}
                    onClick={() => onOpenDtrReview(row)}
                  >
                    {dtrReviewLoadingId === row.id ? "Loading DTR..." : "Review DTR"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {dtrHistory.length === 0 ? <p className="app-copy-sm">Your submitted DTR history will appear here.</p> : null}
        </div>
      </div>


    </main>
  );
}
