import {
  Camera,
  ExternalLink,
  ImageUp,
  LogOut,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Modal from "../../../components/ui/Modal";
import Select from "../../../components/ui/Select";
import StatusBadge from "../../../components/ui/StatusBadge";
import employeeCardBackground from "../../../assets/employee-card-bg.jpg";
import { canEditDocument, formatDateTime, getStatusCopy, isPdfFile } from "../employeeDashboardUtils";

export default function EmployeeDashboardModals({
  GENDER_OPTIONS,
  CIVIL_STATUS_OPTIONS,
  activeDocument,
  activeProfileRequestAvatar,
  clearSignaturePad,
  closeActiveDocument,
  dashboardVariant,
  drawSignatureStroke,
  editProfileForm,
  editProfileImageFile,
  editProfileOpen,
  endSignatureStroke,
  handleLogout,
  hasSignatureDrawing,
  loggingOut,
  moreOpen,
  notifications,
  notificationsOpen,
  openEditProfileModal,
  person,
  profileChangeRequest,
  profileRequestLoading,
  profileRow,
  refreshing,
  refreshDashboard,
  replacementFile,
  setEditProfileForm,
  setEditProfileImageFile,
  setEditProfileOpen,
  setMoreOpen,
  setNotificationsOpen,
  setReplacementFile,
  signatureCanvasRef,
  startSignatureStroke,
  submitProfileChangeRequest,
  submittingProfileRequest,
  summary,
  uploadingRequirement,
  uploadRequirement,
}) {
  return (
    <>
      <Modal open={Boolean(activeDocument)} onClose={closeActiveDocument} title={activeDocument?.document_type || "Document Preview"}>
        {activeDocument ? (
          <div className="app-modal-stack">
            <div className="admin-row admin-row--between employee-dashboard__preview-head">
              <div>
                <div className="employee-dashboard__row-between employee-dashboard__row-gap-sm">
                  <p className="app-text-strong-dark">{activeDocument.document_type}</p>
                  <StatusBadge status={activeDocument.review_status} />
                </div>
                <p className="app-preview-meta">
                  {activeDocument.created_at ? new Date(activeDocument.created_at).toLocaleString() : "No upload record available yet."}
                </p>
              </div>
              {activeDocument.preview_url ? (
                <a href={activeDocument.preview_url} target="_blank" rel="noreferrer" className="app-link-button">
                  <ExternalLink size={16} />
                  Open File
                </a>
              ) : null}
            </div>

            {activeDocument.preview_url ? (
              isPdfFile(activeDocument.file_url) ? (
                <iframe title={activeDocument.document_type} src={activeDocument.preview_url} className="app-preview-frame employee-dashboard__preview-frame" />
              ) : (
                <img src={activeDocument.preview_url} alt={activeDocument.document_type} className="app-preview-image employee-dashboard__preview-image" />
              )
            ) : (
              <div className="app-info-panel app-info-panel--dashed app-preview-empty employee-dashboard__preview-empty">
                {activeDocument.is_missing ? "This requirement has not been uploaded yet." : "Preview is currently unavailable for this file."}
              </div>
            )}

            {activeDocument.review_status === "Needs Reupload" ? (
              <div className="employee-card-panel employee-card-panel--danger employee-dashboard__warning-panel">
                This file was flagged for reupload. Upload a replacement below to send it back for review.
              </div>
            ) : null}

            {canEditDocument(activeDocument) ? (
              <div className="employee-card-panel employee-card-panel--muted employee-dashboard__editor-panel">
                <div>
                  <p className="app-text-strong-dark">
                    {activeDocument.document_type === "Signature"
                      ? activeDocument.preview_url
                        ? "Update signature"
                        : "Upload missing signature"
                      : activeDocument.preview_url
                        ? "Upload latest requirement"
                        : activeDocument.is_missing
                          ? "Upload missing requirement"
                          : "Upload replacement"}
                  </p>
                  <p className="employee-dashboard__copy-xs">
                    {activeDocument.document_type === "Signature"
                      ? "Draw your signature below or upload a PNG, JPG, or WEBP file."
                      : "Accepted files: PNG, JPG, WEBP, or PDF."}
                  </p>
                </div>

                {activeDocument.document_type === "Signature" ? (
                  <div className="employee-card-panel employee-dashboard__signature-panel">
                    <div className="employee-dashboard__signature-head">
                      <p className="app-text-strong-md">Draw Signature</p>
                      <button type="button" className="app-inline-link app-inline-link--danger" onClick={clearSignaturePad}>
                        Clear
                      </button>
                    </div>
                    <canvas
                      ref={signatureCanvasRef}
                      width={800}
                      height={220}
                      className="w-full rounded-xl border border-slate-300 bg-white touch-none"
                      onMouseDown={startSignatureStroke}
                      onMouseMove={drawSignatureStroke}
                      onMouseUp={endSignatureStroke}
                      onMouseLeave={endSignatureStroke}
                      onTouchStart={startSignatureStroke}
                      onTouchMove={drawSignatureStroke}
                      onTouchEnd={endSignatureStroke}
                    />
                    <p className="employee-dashboard__copy-xs">
                      Sign using your mouse, touchpad, or phone screen. You can still upload an image file below if you prefer.
                    </p>
                  </div>
                ) : null}

                <label className="employee-dashboard__upload-card employee-dashboard__upload-card--compact">
                  <div className="employee-dashboard__upload-icons">
                    <Camera size={18} />
                    <ImageUp size={18} />
                  </div>
                  <p className="app-copy-sm">{replacementFile ? replacementFile.name : `Choose ${activeDocument.document_type} file`}</p>
                  <input
                    type="file"
                    accept={activeDocument.document_type === "Signature" ? "image/png,image/jpeg,image/webp" : "image/*,.pdf"}
                    className="employee-dashboard__hidden-input"
                    onChange={(e) => setReplacementFile(e.target.files?.[0] ?? null)}
                  />
                </label>

                <Button className="employee-dashboard__btn-full" loading={uploadingRequirement} onClick={() => uploadRequirement(activeDocument)}>
                  {activeDocument.document_type === "Signature" && !replacementFile && hasSignatureDrawing
                    ? activeDocument.preview_url
                      ? "Update With Drawn Signature"
                      : "Submit Drawn Signature"
                    : activeDocument.document_type === "Signature"
                      ? activeDocument.preview_url
                        ? "Upload New Signature"
                        : "Upload Signature"
                      : activeDocument.preview_url
                        ? "Upload Latest File"
                        : activeDocument.is_missing
                          ? "Upload Requirement"
                          : "Upload Replacement"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} showCloseButton={false}>
        <div className="app-modal-stack">
          <div className="employee-dashboard__modal-header">
            <p className="app-text-strong-md">More Actions</p>
            <button type="button" aria-label="Close message" className="app-icon-close" onClick={() => setMoreOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="employee-dashboard__identity-card" style={{ "--employee-card-image": `url(${employeeCardBackground})` }}>
            <div className="employee-dashboard__identity-overlay" />
            <div className="employee-dashboard__identity-bubble-left" />
            <div className="employee-dashboard__identity-bubble-right" />
            <div className="employee-dashboard__identity-topline" />

            <div className="employee-dashboard__identity-content employee-dashboard__identity-header">
              <div>
                <p className="employee-dashboard__identity-name">{person.full_name}</p>
                <p className="employee-dashboard__identity-role">{String(person.role || "Employee").toUpperCase()}</p>
              </div>

              <div className="app-avatar app-avatar--circle employee-dashboard__identity-avatar">
                {person.avatar_preview_url ? (
                  <img src={person.avatar_preview_url} alt={person.full_name} className="app-media-cover" />
                ) : (
                  person.full_name
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                )}
              </div>
            </div>

            <div className="employee-dashboard__identity-content employee-dashboard__identity-grid">
              <div>
                <p className="employee-dashboard__identity-label">Employee ID</p>
                <p className="employee-dashboard__identity-value">{person.employee_id || "N/A"}</p>
              </div>
              <div>
                <p className="employee-dashboard__identity-label">TIN Number</p>
                <p className="employee-dashboard__identity-value">{profileRow?.tin || "N/A"}</p>
              </div>
              <div>
                <p className="employee-dashboard__identity-label">SSS Number</p>
                <p className="employee-dashboard__identity-value">{profileRow?.sss || "N/A"}</p>
              </div>
              <div>
                <p className="employee-dashboard__identity-label">PhilHealth</p>
                <p className="employee-dashboard__identity-value">{profileRow?.philhealth || "N/A"}</p>
              </div>
            </div>

            <div className="employee-dashboard__identity-content employee-dashboard__identity-footer">
              <p className="employee-dashboard__identity-footer-copy">Valid Entry</p>
              <div className="app-icon-box app-icon-box--sm app-icon-box--contrast employee-dashboard__identity-footer-icon">
                <ShieldCheck size={16} className="text-white/90" />
              </div>
            </div>
          </div>

          <div className="employee-card-panel employee-card-panel--elevated employee-dashboard__status-card">
            <div className="employee-dashboard__section-head">
              <div>
                <p className="employee-dashboard__subsection-title">Profile Edit Request</p>
                <p className="app-copy-sm">Name and profile picture changes must be approved by admin before they go live.</p>
              </div>
              {profileRequestLoading ? null : profileChangeRequest ? <StatusBadge status={profileChangeRequest.status} /> : null}
            </div>
            <div className="app-actions-wrap app-actions-wrap--spaced">
              <Button variant="secondary" className="employee-button-secondary" onClick={openEditProfileModal}>
                <PencilLine size={16} />
                {profileChangeRequest?.status === "Pending Review" ? "Update Pending Request" : "Edit Profile"}
              </Button>
            </div>
            {profileRequestLoading ? (
              <p className="app-copy-sm">Loading request status...</p>
            ) : profileChangeRequest ? (
              <div className="app-info-panel employee-dashboard__request-summary">
                <p className="app-text-strong-dark">{getStatusCopy(profileChangeRequest.status)}</p>
                <p className="mt-2">Requested name: {profileChangeRequest.requested_full_name || person.full_name}</p>
                <p className="app-summary-line">
                  <span className="app-summary-label">Birthday / Gender:</span>{" "}
                  Birthday: {profileChangeRequest.requested_birthday || profileRow?.birthday || "Not set"} | Gender:{" "}
                  {profileChangeRequest.requested_gender || profileRow?.gender || "Not set"}
                </p>
                <p className="app-summary-line">
                  <span className="app-summary-label">Submitted:</span> {new Date(profileChangeRequest.created_at).toLocaleString()}
                </p>
              </div>
            ) : (
              <div className="app-empty-box app-empty-box--spaced employee-dashboard__request-empty">No profile edit request submitted yet.</div>
            )}
          </div>

          <div className="grid gap-2">
            <Button variant="secondary" className="employee-button-full-secondary" loading={refreshing} onClick={refreshDashboard}>
              <RefreshCw size={16} />
              Refresh Dashboard
            </Button>
            <Button variant="danger" className="employee-button-full-danger" loading={loggingOut} onClick={handleLogout}>
              <LogOut size={16} />
              Sign Out
            </Button>
          </div>

          <div className="employee-card-panel employee-card-panel--soft employee-dashboard__support-card">
            {dashboardVariant.supportCopy} You currently have {summary.flaggedDocs} file{summary.flaggedDocs === 1 ? "" : "s"} that need attention and{" "}
            {summary.pendingDtrs} DTR submission{summary.pendingDtrs === 1 ? "" : "s"} still pending review.
          </div>
        </div>
      </Modal>

      <Modal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} showCloseButton={false}>
        <div className="employee-dashboard__modal-header">
          <p className="app-text-strong-md">Notifications</p>
          <button type="button" aria-label="Close notification" className="app-icon-close" onClick={() => setNotificationsOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="employee-stack employee-dashboard__stack">
          {notifications.length === 0 ? <p className="app-copy-sm">No notifications yet.</p> : null}

          {notifications.map((notification) => (
            <div key={notification.id} className="employee-card-panel employee-dashboard__list-card">
              <p className="app-text-strong-dark">{notification.title}</p>
              <p className="app-card-copy">{notification.description}</p>
              <p className="app-copy-xs-muted">{formatDateTime(notification.createdAt)}</p>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={editProfileOpen} onClose={() => setEditProfileOpen(false)} showCloseButton={false}>
        <div className="employee-dashboard__modal-header">
          <p className="app-text-strong-md">Request Profile Update</p>
          <button type="button" aria-label="Close profile update" className="app-icon-close" onClick={() => setEditProfileOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="app-modal-stack">
          <div className="employee-dashboard__profile-flow">
            <div className="app-avatar app-avatar--circle employee-dashboard__profile-flow-avatar">
              {activeProfileRequestAvatar ? (
                <img src={activeProfileRequestAvatar} alt={editProfileForm.full_name || person.full_name} className="app-media-cover" />
              ) : (
                <UserRound size={24} />
              )}
            </div>
            <div className="app-copy-sm">
              <p className="app-text-strong-md">Current profile approval flow</p>
              <p>Submit your new name and profile picture here. Admin must approve before your live profile updates.</p>
            </div>
          </div>

          <Input
            label="Full Name"
            value={editProfileForm.full_name}
            onChange={(e) => setEditProfileForm((prev) => ({ ...prev, full_name: e.target.value }))}
          />

          <div className="app-form-grid app-form-grid--two">
            <Input
              label="Birthday"
              type="date"
              value={editProfileForm.birthday}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, birthday: e.target.value }))}
            />
            <Input
              label="Age"
              type="number"
              value={editProfileForm.age}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, age: e.target.value }))}
            />
            <Select
              label="Gender"
              value={editProfileForm.gender}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, gender: e.target.value }))}
            >
              {GENDER_OPTIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
            <Select
              label="Civil Status"
              value={editProfileForm.civil_status}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, civil_status: e.target.value }))}
            >
              {CIVIL_STATUS_OPTIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
            <Input label="SSS" value={editProfileForm.sss} onChange={(e) => setEditProfileForm((prev) => ({ ...prev, sss: e.target.value }))} />
            <Input
              label="PhilHealth"
              value={editProfileForm.philhealth}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, philhealth: e.target.value }))}
            />
            <Input
              label="Pag-IBIG"
              value={editProfileForm.pagibig}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, pagibig: e.target.value }))}
            />
            <Input label="TIN" value={editProfileForm.tin} onChange={(e) => setEditProfileForm((prev) => ({ ...prev, tin: e.target.value }))} />
          </div>

          <label className="app-field-block employee-dashboard__textarea-label">
            <span className="app-field-label">Profile Picture</span>
            <label className="employee-dashboard__upload-card">
              <div className="employee-dashboard__upload-icons">
                <Camera size={18} />
                <ImageUp size={18} />
              </div>
              <p className="app-copy-sm">{editProfileImageFile ? editProfileImageFile.name : "Choose a new profile picture"}</p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="employee-dashboard__hidden-input"
                onChange={(e) => setEditProfileImageFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="app-copy-xs-spaced">Accepted files: PNG, JPG, or WEBP.</p>
          </label>

          <div className="app-info-panel employee-dashboard__helper-panel">
            {profileChangeRequest?.status === "Pending Review"
              ? "A pending request already exists. Submitting again will update the pending request."
              : "Your current profile will stay the same until an admin approves this request."}
          </div>

          <Button className="employee-dashboard__btn-full" loading={submittingProfileRequest} onClick={submitProfileChangeRequest}>
            {profileChangeRequest?.status === "Pending Review" ? "Update Pending Request" : "Submit For Approval"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
