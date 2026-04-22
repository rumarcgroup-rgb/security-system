import { Camera, ExternalLink, ImageUp } from "lucide-react";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import StatusBadge from "../../../components/ui/StatusBadge";
import { formatDateTime } from "../employeeDashboardUtils";

const REUPLOADABLE_STATUSES = new Set(["Pending Review", "Rejected"]);

export default function EmployeeDtrReviewModal({
  currentUserId,
  file,
  note,
  onChangeFile,
  onChangeNote,
  onClose,
  onSubmitReplacement,
  reuploading,
  submission,
}) {
  const isOwnSubmission = submission?.user_id === currentUserId;
  const submittedByGuard =
    submission?.submitted_by_role === "employee" &&
    (submission?.submitted_by_user_id ? submission.submitted_by_user_id === currentUserId : isOwnSubmission);
  const canReupload = Boolean(
    submission &&
      isOwnSubmission &&
      submittedByGuard &&
      REUPLOADABLE_STATUSES.has(submission.status)
  );
  const isApproved = submission?.status === "Approved";
  const isRejected = submission?.status === "Rejected";

  return (
    <Modal
      open={Boolean(submission)}
      onClose={onClose}
      title="Review DTR Submission"
      panelClassName="employee-dashboard__dtr-review-modal"
    >
      {submission ? (
        <div className="app-modal-stack">
          <div className="employee-dashboard__dtr-review-summary">
            <div className="employee-dashboard__dtr-review-summary-head">
              <div>
                <p className="employee-dashboard__dtr-review-eyebrow">Submitted DTR</p>
                <h3 className="employee-dashboard__dtr-review-title">{submission.cutoff || "No cutoff selected"}</h3>
              </div>
              <StatusBadge status={submission.status} />
            </div>

            <div className="employee-dashboard__dtr-review-grid">
              <ReviewField label="Submitted" value={formatDateTime(submission.created_at)} />
              <ReviewField label="Approved" value={submission.approved_at ? formatDateTime(submission.approved_at) : "Not approved yet"} />
              <ReviewField label="Source" value={submission.submitted_by_role === "supervisor" ? "Submitted by supervisor" : "Submitted by guard"} />
              <ReviewField label="Reference" value={submission.id} />
            </div>

            {submission.employee_note ? (
              <div className="employee-dashboard__dtr-review-note">
                <p className="employee-dashboard__dtr-review-note-label">Guard note</p>
                <p>{submission.employee_note}</p>
              </div>
            ) : null}

            {submission.admin_remarks ? (
              <div className="employee-dashboard__dtr-review-note employee-dashboard__dtr-review-note--remarks">
                <p className="employee-dashboard__dtr-review-note-label">Admin remarks</p>
                <p>{submission.admin_remarks}</p>
              </div>
            ) : null}
          </div>

          {submission.preview_url ? (
            <a
              href={submission.preview_url}
              target="_blank"
              rel="noreferrer"
              className="app-preview-image-link app-preview-overlay-link"
              title="Open submitted DTR image"
            >
              <div className="app-preview-frame-wrap">
                <img src={submission.preview_url} alt="Submitted DTR" className="app-preview-image employee-dashboard__dtr-review-image" />
                <div className="app-preview-chip">
                  <ExternalLink size={14} />
                  Open Full Image
                </div>
              </div>
            </a>
          ) : (
            <div className="app-info-panel app-info-panel--dashed app-preview-empty">
              The DTR preview is not available right now. Close and reopen this review to refresh the signed link.
            </div>
          )}

          <div className={`app-info-panel${isRejected ? " app-info-panel--warning" : ""}`}>
            {canReupload
              ? isRejected
                ? "Review admin remarks, upload the corrected DTR, and send it back for review."
                : "If you uploaded the wrong file, you can replace it before review is completed."
              : isApproved
                ? "Approved DTRs are locked and cannot be replaced."
                : "This DTR cannot be reuploaded here because it was not submitted directly by this guard."}
          </div>

          {canReupload ? (
            <div className="employee-card-panel employee-dashboard__dtr-reupload-panel">
              <label className="app-field-block">
                <span className="app-field-label">Note for Admin</span>
                <textarea
                  className="app-textarea"
                  placeholder="Optional note about this corrected DTR"
                  value={note}
                  onChange={(event) => onChangeNote(event.target.value)}
                />
              </label>

              <label className="employee-dashboard__upload-card employee-dashboard__upload-card--compact">
                <div className="employee-dashboard__upload-icons">
                  <Camera size={18} />
                  <ImageUp size={18} />
                </div>
                <p className="app-copy-sm">{file ? file.name : "Choose replacement DTR image"}</p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="employee-dashboard__hidden-input"
                  onChange={(event) => onChangeFile(event.target.files?.[0] ?? null)}
                />
              </label>

              <Button className="employee-dashboard__btn-full" loading={reuploading} disabled={!file} onClick={onSubmitReplacement}>
                Submit Replacement
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

function ReviewField({ label, value }) {
  return (
    <div className="employee-dashboard__dtr-review-field">
      <p className="employee-dashboard__copy-xs">{label}</p>
      <p className="employee-dashboard__dtr-review-value">{value}</p>
    </div>
  );
}
