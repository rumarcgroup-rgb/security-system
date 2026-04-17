import { ShieldCheck } from "lucide-react";
import Card from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";
import { getDocumentIcon } from "../employeeDashboardUtils";

export default function EmployeeDocumentStatusSection({
  dashboardVariant,
  documents,
  documentsLoading,
  onOpenDocument,
  title = "Document Status",
  description,
}) {
  return (
    <Card>
      <div className="employee-dashboard__section-head">
        <div>
          <h3 className="employee-dashboard__subsection-title">{title}</h3>
          <p className="app-copy-sm">{description || dashboardVariant.documentsCopy}</p>
        </div>
        <div className="app-icon-box">
          <ShieldCheck size={18} />
        </div>
      </div>

      <div className="employee-dashboard__stack">
        {documentsLoading ? <p className="app-copy-sm">Loading documents...</p> : null}
        {!documentsLoading
          ? documents.map((document) => {
            const Icon = getDocumentIcon(document.file_url);

            return (
              <button
                key={document.id}
                type="button"
                className="employee-card-panel employee-card-panel--muted employee-dashboard__doc-row"
                onClick={() => onOpenDocument(document)}
              >
                <div className="employee-dashboard__doc-row-main">
                  <div className="app-icon-box employee-dashboard__doc-row-icon">
                    <Icon size={18} />
                  </div>
                  <div className="employee-dashboard__min-w-0">
                    <p className="employee-dashboard__truncate app-text-strong-dark">{document.document_type}</p>
                    <p className="employee-dashboard__truncate employee-dashboard__copy-xs">
                      {document.created_at
                        ? new Date(document.created_at).toLocaleString()
                        : document.is_missing
                          ? "Upload required"
                          : "Waiting for timestamp"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={document.review_status} />
              </button>
            );
          })
          : null}
        {!documentsLoading && documents.length === 0 ? <p className="app-copy-sm">No uploaded documents found yet.</p> : null}
      </div>
    </Card>
  );
}
