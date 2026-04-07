import { ExternalLink, FileImage, FileText } from "lucide-react";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import StatusBadge from "../../../components/ui/StatusBadge";

function isPdfFile(path = "") {
  return /\.pdf($|\?)/i.test(path);
}

function getDocumentIcon(path = "") {
  return isPdfFile(path) ? FileText : FileImage;
}

export default function RequirementReviewModal({
  item,
  saving,
  reviewableStatuses,
  onClose,
  onUpdateStatus,
}) {
  const Icon = getDocumentIcon(item?.file_url);

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title={item ? `${item.profiles?.full_name || "Employee"} Requirement Review` : "Requirement Review"}
    >
      {item ? (
        <div className="app-modal-stack">
          <div className="admin-row admin-row--between">
            <div>
              <div className="admin-row admin-row--gap">
                <div className="admin-users-page__file-icon">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="admin-text-strong">{item.requirement_type}</p>
                  <p className="admin-copy-xs">
                    {item.profiles?.employee_id || "No Employee ID"} | {[item.profiles?.location, item.profiles?.branch].filter(Boolean).join(" / ") || "No assignment"}
                  </p>
                </div>
              </div>
              <p className="admin-copy-xs-muted">{item.created_at ? new Date(item.created_at).toLocaleString() : "No timestamp"}</p>
            </div>
            <StatusBadge status={item.status} />
          </div>

          <div className="admin-row admin-row--between">
            <div>
              <p className="admin-text-strong">Preview</p>
              <p className="admin-copy-xs">{item.file_url}</p>
            </div>
            <a href={item.preview_url} target="_blank" rel="noreferrer" className="app-link-button">
              <ExternalLink size={16} />
              Open File
            </a>
          </div>

          <div className="flex flex-wrap gap-2">
            {reviewableStatuses.map((status) => (
              <Button
                key={status}
                variant={item.status === status ? "primary" : "secondary"}
                loading={saving && item.status !== status}
                disabled={saving || item.status === status}
                onClick={() => onUpdateStatus(item, status)}
              >
                {status}
              </Button>
            ))}
          </div>

          {isPdfFile(item.file_url) ? (
            <iframe title={item.requirement_type} src={item.preview_url} className="app-preview-frame admin-users-page__preview-frame" />
          ) : (
            <img src={item.preview_url} alt={item.requirement_type} className="app-preview-image admin-users-page__preview-image" />
          )}
        </div>
      ) : null}
    </Modal>
  );
}
