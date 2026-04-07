import { ExternalLink } from "lucide-react";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import StatusBadge from "../../../components/ui/StatusBadge";

export default function ProfileRequestReviewModal({ reviewRequest, savingRequestId, onClose, onUpdateProfileRequestStatus }) {
  return (
    <Modal open={Boolean(reviewRequest)} onClose={onClose} title="Review Profile Change Request">
      {reviewRequest ? (
        <div className="app-modal-stack">
          <div className="admin-panel-grid">
            <div className="admin-card-panel">
              <p className="admin-panel-title">Current Profile</p>
              <p className="admin-text-strong admin-panel-copy">{reviewRequest.profiles?.full_name || "No current name"}</p>
              <p className="admin-copy-xs">{reviewRequest.profiles?.employee_id || "No employee ID"}</p>
              <p className="admin-copy-xs-muted">{reviewRequest.profiles?.location || "No location"}</p>
              <p className="admin-copy-xs admin-panel-copy">
                Birthday: {reviewRequest.profiles?.birthday || "Not set"} | Age: {reviewRequest.profiles?.age ?? "Not set"}
              </p>
              <p className="admin-copy-xs">
                Gender: {reviewRequest.profiles?.gender || "Not set"} | Civil Status: {reviewRequest.profiles?.civil_status || "Not set"}
              </p>
              <p className="admin-copy-xs">
                SSS: {reviewRequest.profiles?.sss || "-"} | PhilHealth: {reviewRequest.profiles?.philhealth || "-"}
              </p>
              <p className="admin-copy-xs">
                Pag-IBIG: {reviewRequest.profiles?.pagibig || "-"} | TIN: {reviewRequest.profiles?.tin || "-"}
              </p>
            </div>

            <div className="admin-card-panel admin-card-panel--brand">
              <p className="admin-panel-title admin-panel-title--brand">Requested Update</p>
              <p className="admin-text-strong admin-panel-copy">{reviewRequest.requested_full_name || "No requested name"}</p>
              <p className="admin-copy-xs">{new Date(reviewRequest.created_at).toLocaleString()}</p>
              <p className="admin-copy-xs admin-panel-copy">
                Birthday: {reviewRequest.requested_birthday || "Not set"} | Age: {reviewRequest.requested_age ?? "Not set"}
              </p>
              <p className="admin-copy-xs">
                Gender: {reviewRequest.requested_gender || "Not set"} | Civil Status: {reviewRequest.requested_civil_status || "Not set"}
              </p>
              <p className="admin-copy-xs">
                SSS: {reviewRequest.requested_sss || "-"} | PhilHealth: {reviewRequest.requested_philhealth || "-"}
              </p>
              <p className="admin-copy-xs">
                Pag-IBIG: {reviewRequest.requested_pagibig || "-"} | TIN: {reviewRequest.requested_tin || "-"}
              </p>
              <StatusBadge status={reviewRequest.status} />
            </div>
          </div>

          <div className="admin-stack-sm">
            <div className="admin-row admin-row--between">
              <div>
                <p className="admin-text-strong">Requested Profile Picture</p>
                <p className="admin-copy-xs">Approve this to update the employee avatar on the live profile.</p>
              </div>
              {reviewRequest.preview_url ? (
                <a href={reviewRequest.preview_url} target="_blank" rel="noreferrer" className="app-link-button">
                  <ExternalLink size={16} />
                  Open File
                </a>
              ) : null}
            </div>

            {reviewRequest.preview_url ? (
              <img
                src={reviewRequest.preview_url}
                alt={reviewRequest.requested_full_name || "Requested profile picture"}
                className="app-preview-image admin-users-page__preview-image"
              />
            ) : (
              <div className="app-empty-box">No profile picture was attached to this request.</div>
            )}
          </div>

          <div className="app-modal-footer">
            <Button
              variant="danger"
              loading={savingRequestId === reviewRequest.id}
              disabled={savingRequestId === reviewRequest.id}
              onClick={() => onUpdateProfileRequestStatus(reviewRequest, "Rejected")}
            >
              Reject
            </Button>
            <Button
              loading={savingRequestId === reviewRequest.id}
              disabled={savingRequestId === reviewRequest.id}
              onClick={() => onUpdateProfileRequestStatus(reviewRequest, "Approved")}
            >
              Approve
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
