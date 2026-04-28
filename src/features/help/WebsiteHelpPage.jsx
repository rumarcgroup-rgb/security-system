import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import { isAdminRole } from "../../lib/roles";
import manualOutline from "../../../docs/website-user-manual-outline.json";
import "./WebsiteHelpPage.css";

function getHomePath(role) {
  if (isAdminRole(role)) return "/admin";
  if (role === "supervisor") return "/supervisor";
  return "/";
}

function shouldShowPage(page, role) {
  const normalizedRole = isAdminRole(role) ? "admin" : role;
  return page.role === "all" || page.role === normalizedRole || (normalizedRole === "employee" && page.role === "guard");
}

export default function WebsiteHelpPage({ profile }) {
  const role = profile?.role || "employee";
  const visibleSections = manualOutline.sections
    .map((section) => ({
      ...section,
      pages: section.pages.filter((page) => shouldShowPage(page, role)),
    }))
    .filter((section) => section.pages.length > 0);

  return (
    <main className="website-help-page">
      <div className="website-help-page__shell">
        <div className="website-help-page__hero">
          <div>
            <p className="website-help-page__eyebrow">In-app guide</p>
            <h1 className="website-help-page__title">Website User Help</h1>
            <p className="website-help-page__copy">
              Simple role-based instructions for login, onboarding, DTR, documents, messages, reports, and troubleshooting.
            </p>
          </div>
          <Link className="website-help-page__home-link" to={getHomePath(role)}>
            Back to dashboard
          </Link>
        </div>

        <div className="website-help-page__grid">
          {visibleSections.map((section) => (
            <Card key={section.id} className="website-help-page__section">
              <div className="website-help-page__section-head">
                <p className="website-help-page__section-kicker">{section.id.replaceAll("-", " ")}</p>
                <h2 className="website-help-page__section-title">{section.title}</h2>
                <p className="website-help-page__copy">{section.goal}</p>
              </div>

              <div className="website-help-page__pages">
                {section.pages.map((page) => (
                  <article key={page.id} className="website-help-page__page-card">
                    <div className="website-help-page__page-head">
                      <div>
                        <h3 className="website-help-page__page-title">{page.label}</h3>
                        <p className="website-help-page__route">{page.route || "General guidance"}</p>
                      </div>
                      <span className="website-help-page__role-chip">{page.role}</span>
                    </div>
                    <p className="website-help-page__goal">{page.goal}</p>
                    <ol className="website-help-page__steps">
                      {page.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    {page.warnings.length > 0 ? (
                      <div className="website-help-page__warning">
                        {page.warnings.map((warning) => (
                          <p key={warning}>{warning}</p>
                        ))}
                      </div>
                    ) : null}
                    {page.screenshotKeys.length > 0 ? (
                      <div className="website-help-page__screenshots">
                        {page.screenshotKeys.map((key) => (
                          <span key={key} className="website-help-page__screenshot-chip">
                            {key}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
