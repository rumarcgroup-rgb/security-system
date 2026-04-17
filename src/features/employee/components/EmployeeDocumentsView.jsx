import EmployeeActionItemsSection from "./EmployeeActionItemsSection";
import EmployeeDocumentStatusSection from "./EmployeeDocumentStatusSection";

export default function EmployeeDocumentsView({
  actions,
  dashboardVariant,
  documents,
  documentsLoading,
  onOpenDocument,
  onPendingDtrAction,
}) {
  return (
    <main className="employee-dashboard__content employee-dashboard__stack-lg">
      <div className="employee-dashboard__page-header">
        <h2 className="employee-dashboard__section-title">Documents</h2>
        <p className="app-copy-sm">Review uploaded requirements, preview files, and update anything that still needs attention.</p>
      </div>

      <EmployeeActionItemsSection
        actions={actions}
        emptyCopy={dashboardVariant.actionEmptyCopy}
        onPendingDtrAction={onPendingDtrAction}
      />

      <EmployeeDocumentStatusSection
        dashboardVariant={dashboardVariant}
        documents={documents}
        documentsLoading={documentsLoading}
        onOpenDocument={onOpenDocument}
      />
    </main>
  );
}
