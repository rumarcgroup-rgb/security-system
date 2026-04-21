import {
  Bell,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  MoreHorizontal,
  UploadCloud,
} from "lucide-react";

export default function EmployeeDashboardShell({
  activeView,
  children,
  dashboardVariant,
  unreadMessagesCount,
  moreNeedsAttention = false,
  onOpenMessages,
  onOpenMore,
  onOpenNotifications,
  onShortcutSubmitDtr,
  onShowDashboard,
  onShowDocuments,
  unreadNotificationCount,
}) {
  return (
    <>
      <header className="employee-dashboard__header glass">
        <div className="employee-dashboard__header-inner">
          <div className="employee-dashboard__brand">{dashboardVariant.headerLabel}</div>
          <button type="button" className="employee-dashboard__icon-button" onClick={onOpenNotifications}>
            <Bell size={18} />
            {unreadNotificationCount > 0 ? <span className="employee-dashboard__badge">{Math.min(unreadNotificationCount, 9)}</span> : null}
          </button>
        </div>
      </header>

      {children}

      <nav className="employee-dashboard__bottom-nav">
        <div className="employee-dashboard__nav-side employee-dashboard__nav-side--left">
          <Nav icon={LayoutDashboard} isActive={activeView === "dashboard"} label="Dashboard" onClick={onShowDashboard} />
          <Nav icon={FileText} isActive={activeView === "documents"} label="Documents" onClick={onShowDocuments} />
        </div>
        <button
          type="button"
          className={`employee-nav-center${activeView === "submit-dtr" ? " employee-nav-center--active" : ""}`}
          aria-label="Submit DTR"
          title="Submit DTR"
          onClick={onShortcutSubmitDtr}
        >
          <UploadCloud size={20} />
          <span className="employee-nav-center__label">Submit DTR</span>
        </button>
        <div className="employee-dashboard__nav-side employee-dashboard__nav-side--right">
          <Nav icon={MessageSquareText} isActive={activeView === "messages"} label="Messages" badgeCount={unreadMessagesCount} onClick={onOpenMessages} />
          <Nav icon={MoreHorizontal} label="More" attention={moreNeedsAttention} onClick={onOpenMore} />
        </div>
      </nav>
    </>
  );
}

function Nav({ icon: Icon, isActive = false, attention = false, badgeCount = 0, label, onClick }) {
  return (
    <button
      type="button"
      className={`employee-dashboard__nav-button${isActive ? " employee-dashboard__nav-button--active" : ""}`}
      onClick={onClick}
    >
      <Icon size={17} />
      <span className="employee-dashboard__nav-label">{label}</span>
      {badgeCount > 0 ? <span className="employee-dashboard__nav-badge">{Math.min(badgeCount, 9)}</span> : null}
      {attention && badgeCount === 0 ? <span className="employee-dashboard__nav-attention-dot" /> : null}
    </button>
  );
}
