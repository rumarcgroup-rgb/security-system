# Website User Manual Shot List

This shot list supports `docs/website-user-manual.md`.

Capture rules:

1. Use a mobile-style viewport for employee and guard screens.
2. Use a desktop viewport for supervisor and admin screens.
3. Capture real UI labels exactly as they appear.
4. Avoid fake data that suggests features the app does not have.

| Filename | Viewport | Route / Page | Required UI State | Caption |
| --- | --- | --- | --- | --- |
| `portal-selector-overview.png` | Desktop | `/login` | Portal selector visible with all role cards and footer admin link | The first screen where users choose the correct portal before signing in. |
| `security-guard-login.png` | Mobile | `/login/security-guard` | Login form visible with portal hero and login fields | The Security Guard login page with email and password fields. |
| `janitor-login.png` | Mobile | `/login/janitor` | Janitor login page visible with `Employee ID` label and password field | The Janitor login page showing the portal-specific layout and field labels. |
| `admin-login.png` | Desktop | `/login/admin` | Admin login form visible with title and forgot password link | The admin-only login page used for accounts with admin role access. |
| `reset-password-request.png` | Desktop | `/reset-password/security-guard` or another portal reset route | Not in recovery mode, request form visible | The portal-specific password reset page before recovery mode starts. |
| `onboarding-step-progress.png` | Desktop | `/onboarding` | Progress card visible with step number and page title | The onboarding progress card showing the current step number and title. |
| `onboarding-upload-documents.png` | Desktop | `/onboarding` | Step 5 active, required document cards visible | The document upload step where required files are attached before submission. |
| `onboarding-terms-signature.png` | Desktop | `/onboarding` | Step 6 active, checkboxes and signature canvas visible | The final onboarding step with checkboxes and the signature canvas. |
| `employee-dashboard-home.png` | Mobile | `/` | Employee dashboard main view visible with profile, assignment, and summary cards | The employee dashboard home view with profile, assignment, and status cards. |
| `employee-documents-view.png` | Mobile | `/` | Employee `Documents` tab active with document list or previews visible | The Documents page where employees review requirements and upload replacements. |
| `employee-submit-dtr.png` | Mobile | `/` | Employee `Submit DTR` view active with cutoff selector and upload area | The DTR submission page used by staff to upload a cutoff image and note. |
| `employee-messages-updates.png` | Mobile | `/` | Employee `Messages` page open on `Updates` workspace with filters visible | The employee Updates workspace with message filters and unread management. |
| `employee-messages-chat.png` | Mobile | `/` | Employee `Messages` page open on `Chat` workspace with thread or starter state visible | The employee Chat workspace for direct messaging with supervisor or admin support. |
| `employee-notifications-modal.png` | Mobile | `/` | Bell tapped and `Notifications` modal open | The employee notification modal opened from the top-right bell icon. |
| `employee-more-actions.png` | Mobile | `/` | `More Actions` modal open with identity card and profile request tools visible | The More Actions modal with profile edit request tools, refresh, and sign out. |
| `supervisor-dashboard-home.png` | Desktop | `/supervisor` | Supervisor dashboard visible with scope card, metrics, and team preview | The supervisor dashboard showing scope, metrics, team preview, and recent team DTR activity. |
| `supervisor-team-dtr-queue.png` | Desktop | `/supervisor/dtr` | DTR queue table visible with filters and review button | The Team DTR page with scoped submissions and review actions. |
| `supervisor-submit-team-dtr-modal.png` | Desktop | `/supervisor/dtr` | `Submit Team DTR` modal open with team selection and upload controls | The modal used by supervisors to submit DTR files for one or more team members. |
| `supervisor-messages.png` | Desktop | `/supervisor/messages` | Thread list and active conversation visible | The supervisor messaging page with thread list and active conversation panel. |
| `supervisor-team-directory.png` | Desktop | `/supervisor/team` | Team directory filters and member table visible | The Team Directory page where supervisors view employees inside their scope. |
| `supervisor-settings.png` | Desktop | `/supervisor/settings` | Profile settings, password help, and scope notes visible | The supervisor settings page with profile, password help, and scope notes. |
| `admin-dashboard-home.png` | Desktop | `/admin` | Quick actions, metrics, and recent activity panels visible | The admin dashboard with quick actions, metrics, and live activity panels. |
| `admin-notifications-modal.png` | Desktop | `/admin` | Bell tapped and `Admin Notifications` modal open | The admin notification modal opened from the header bell icon. |
| `admin-dtr-submissions.png` | Desktop | `/admin/dtr-submissions` | Filters, summary cards, and DTR table visible | The admin DTR review queue with filters, grouped tables, and approval actions. |
| `admin-requirements.png` | Desktop | `/admin/requirements` | Requirement filters and uploaded requirements table visible | The requirements review page where admins verify employee documents and signatures. |
| `admin-users-directory.png` | Desktop | `/admin/users` | Profile request queue and People Directory visible together if possible | The Users page with the profile request queue and the People Directory. |
| `admin-messages.png` | Desktop | `/admin/messages` | Admin thread list and active message conversation visible | The admin messaging page used for escalated threads and admin fallback conversations. |
| `admin-reports.png` | Desktop | `/admin/reports` | Metrics, status distribution, top locations, and trend chart visible | The reports page with DTR analytics, location ranking, and submission trend charts. |
| `admin-settings.png` | Desktop | `/admin/settings` | Profile settings, system notes, and realtime alerts visible | The admin settings page with profile settings, system notes, and realtime alert controls. |

## Recommended Capture Order

1. Portal selector
2. Portal login pages
3. Reset password page
4. Onboarding steps
5. Employee mobile flow
6. Supervisor desktop flow
7. Admin desktop flow

## Capture Notes

1. Use realistic but non-sensitive employee names and IDs.
2. Prefer showing at least one unread item in notification and message screenshots.
3. For messaging screenshots, show the connection pill if possible.
4. For queue pages, include at least one row so the user can understand the table layout.
