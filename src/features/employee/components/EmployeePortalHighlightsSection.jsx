import Card from "../../../components/ui/Card";

export default function EmployeePortalHighlightsSection({ dashboardVariant }) {
  const DashboardIcon = dashboardVariant.icon;

  return (
    <Card className="employee-dashboard__focus-card">
      <div className="employee-dashboard__section-head">
        <div>
          <h3 className="employee-dashboard__subsection-title">{dashboardVariant.highlightTitle}</h3>
          <p className="app-copy-sm">A quick checklist tailored to your current portal.</p>
        </div>
        <div className="app-icon-box">
          <DashboardIcon size={18} />
        </div>
      </div>
      <div className="employee-dashboard__focus-list">
        {dashboardVariant.highlights.map((item) => (
          <div key={item} className="employee-dashboard__focus-item">
            <span className="employee-dashboard__focus-dot" />
            <p className="app-copy-sm">{item}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
