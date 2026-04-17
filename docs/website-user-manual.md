# Website User Manual

This guide explains how to use the website from login up to daily work for guards, employees, supervisors, and admins.

Use this manual when:

1. You are logging in for the first time.
2. You need to finish onboarding.
3. You want to learn what each page does.
4. You need help with common errors or confusing states.

This manual follows the current app behavior and uses the real page labels already shown in the website.

## 1. Getting Started

Section ID: `getting-started`

### 1.1 Portal Selector

Route: `/login`

When you open the login page without a portal type, you will first see the portal selector.

Available choices:

1. `CGroup Access`
2. `Security Guard`
3. `Janitor`
4. `Admin Login`

What happens next:

1. Clicking a staff portal opens its own login page.
2. Clicking `Admin Login` opens the admin-only login page.

> Screenshot key: `portal-selector-overview.png`
> Caption: The first screen where users choose the correct portal before signing in.

### 1.2 Staff Login Pages

Routes:

1. `/login/cgroup-access`
2. `/login/security-guard`
3. `/login/janitor`

How to log in:

1. Open the correct portal.
2. Enter your account email and password.
3. Click `Login`.

Visible note:

1. The `Janitor Login` page labels the first field as `Employee ID`, but it still uses the same sign-in flow as the other staff portals.

What happens next:

1. If your account is valid, the app signs you in.
2. If your profile role is `admin`, the app redirects you to `/admin`.
3. If your profile role is `supervisor`, the app redirects you to `/supervisor`.
4. Other staff users go to `/`.
5. If you are signed in but do not have a profile yet, the app redirects you to `/onboarding`.

> Screenshot key: `security-guard-login.png`
> Caption: The Security Guard login page with email and password fields.

> Screenshot key: `janitor-login.png`
> Caption: The Janitor login page showing the portal-specific layout and field labels.

### 1.3 Admin Login

Route: `/login/admin`

How to log in:

1. Enter your admin email.
2. Enter your password.
3. Click `Login`.

Important:

1. Admin login is role-protected.
2. The app checks `profiles.role`.
3. If the signed-in account is not an admin account, the app signs the user out and shows `Access Denied`.

What happens next:

1. Valid admin accounts go to `/admin`.
2. Non-admin accounts cannot enter the admin portal.

> Screenshot key: `admin-login.png`
> Caption: The admin-only login page used for accounts with admin role access.

### 1.4 Forgot Password

Routes:

1. `/reset-password/cgroup-access`
2. `/reset-password/security-guard`
3. `/reset-password/janitor`
4. `/reset-password/admin`

How to request a reset link:

1. Open the correct reset page from your portal.
2. Enter your email.
3. Click `Send Reset Link`.
4. Open the email link and continue the recovery process.

How to finish the reset:

1. Enter your new password.
2. Confirm the new password.
3. Click `Update Password`.

What happens next:

1. After a successful password change, the app sends you back to the correct login page.

> Screenshot key: `reset-password-request.png`
> Caption: The portal-specific password reset page before recovery mode starts.

### 1.5 Redirect Rules After Login

Current redirect behavior:

1. Admin users go to `/admin`.
2. Supervisor users go to `/supervisor`.
3. Other staff users go to `/`.
4. Signed-in users with no profile go to `/onboarding`.

## 2. Onboarding

Section ID: `onboarding`

Route: `/onboarding`

The onboarding flow is used for first-time account setup and employee profile creation.

Current onboarding steps:

1. `Account Setup`
2. `Basic Information`
3. `Government Details`
4. `Employment Details`
5. `Upload Documents`
6. `Terms & Signature`

What happens next:

1. After submission, the app creates or completes your employee profile.
2. Your uploaded files go to admin review.
3. You can then use the correct dashboard based on your role.

> Screenshot key: `onboarding-step-progress.png`
> Caption: The onboarding progress card showing the current step number and title.

### 2.1 Account Setup

How to use this step:

1. Enter your email address.
2. Enter your password.
3. Confirm your password.
4. Click `Start Registration`.

Visible behavior:

1. If your signup needs email confirmation first, the app stores a pending state and tells you to check your email.
2. If you are already signed in, the page tells you to continue onboarding directly.

### 2.2 Basic Information

Fields:

1. First Name
2. Last Name
3. Birthday
4. Age
5. Gender
6. Civil Status

### 2.3 Government Details

Fields:

1. SSS
2. PhilHealth
3. Pag-IBIG
4. TIN

### 2.4 Employment Details

Fields:

1. Assigned Site
2. Branch
3. Position
4. Employee ID
5. Start Date
6. Shift
7. Supervisor

Current role-related behavior:

1. The selected position is used to save the employee portal type.
2. `Security Guard`, `Janitor`, and `CGroup Access` users all use the employee-style dashboard after login.

### 2.5 Upload Documents

Required document types:

1. `Valid ID`
2. `NBI Clearance`
3. `Medical Certificate`
4. `Barangay Clearance`

How to upload:

1. Use `Take Photo` for camera capture.
2. Use `Upload from Gallery` to choose an image or PDF.
3. Repeat until all required files are selected.

> Screenshot key: `onboarding-upload-documents.png`
> Caption: The document upload step where required files are attached before submission.

### 2.6 Terms and Signature

What to do:

1. Check both agreement boxes.
2. Draw your signature in the signature box.
3. Click `Submit Registration`.

What happens next:

1. The app uploads your signature.
2. The app saves your profile data.
3. The app creates employee document rows for uploaded requirements.
4. You are redirected into the main app after success.

> Screenshot key: `onboarding-terms-signature.png`
> Caption: The final onboarding step with checkboxes and the signature canvas.

## 3. Guard / Employee Guide

Section ID: `guard-employee-guide`

This section applies to the shared employee-style portal used by:

1. Security Guard
2. Janitor
3. CGroup Access staff

Main route after login: `/`

Main mobile navigation:

1. `Dashboard`
2. `Documents`
3. `Submit DTR`
4. `Messages`
5. `More`

### 3.1 Dashboard

Main page sections:

1. `My Profile`
2. `My Assignment`
3. Summary cards for `Pending DTR`, `Approved DTR`, `Verified Files`, and `Needs Action`
4. `Recent Admin Feedback`
5. `Recent Submissions`

How to use it:

1. Check your employee ID and assignment details.
2. Watch the summary cards for pending work.
3. Review admin remarks in `Recent Admin Feedback`.
4. Confirm your recent DTR history in `Recent Submissions`.

> Screenshot key: `employee-dashboard-home.png`
> Caption: The employee dashboard home view with profile, assignment, and status cards.

### 3.2 Documents

Page label: `Documents`

What you can do:

1. Review uploaded requirements.
2. Preview images and PDFs.
3. See each file status.
4. Reupload documents flagged as `Needs Reupload`.
5. Update your signature if needed.

Current statuses:

1. `Pending Review`
2. `Verified`
3. `Needs Reupload`

> Screenshot key: `employee-documents-view.png`
> Caption: The Documents page where employees review requirements and upload replacements.

### 3.3 Submit DTR

Page label: `Submit DTR`

How to submit:

1. Open `Submit DTR`.
2. Choose the correct cutoff.
3. Upload the final DTR image.
4. Add a note if needed.
5. Submit the record for review.

> Screenshot key: `employee-submit-dtr.png`
> Caption: The DTR submission page used by staff to upload a cutoff image and note.

### 3.4 Messages

Page label: `Messages`

The employee messages page has two workspaces:

1. `Updates`
2. `Chat`

#### Updates Workspace

What you can do:

1. Read status messages about DTR, documents, profile, and admin updates.
2. Filter by `All`, `DTR`, `Documents`, `Profile`, and `Admin`.
3. Click `Mark all as read`.

> Screenshot key: `employee-messages-updates.png`
> Caption: The employee Updates workspace with message filters and unread management.

#### Chat Workspace

What you can do:

1. Send instant text messages to your assigned supervisor.
2. Use admin fallback when no supervisor thread is active.
3. Escalate a supervisor thread to admin.

Current message connection states:

1. `Live`
2. `Reconnecting...`
3. `Sync issue`

How to use chat:

1. Open the `Chat` tab.
2. Type your message.
3. Click `Send Message`.
4. Use `Escalate to admin` when available and needed.

What happens next:

1. Your first message creates the thread automatically if none exists yet.
2. New replies appear in the thread in realtime when the connection is healthy.

> Screenshot key: `employee-messages-chat.png`
> Caption: The employee Chat workspace for direct messaging with supervisor or admin support.

### 3.5 Notifications

Where to open it:

1. Tap the bell icon in the header.

What you can see:

1. DTR-related updates
2. Document review updates
3. Profile request updates
4. Admin activity notices

> Screenshot key: `employee-notifications-modal.png`
> Caption: The employee notification modal opened from the top-right bell icon.

### 3.6 More and Profile Actions

Where to open it:

1. Tap `More` in the bottom navigation.

What is inside:

1. Employee identity card
2. `Profile Edit Request`
3. `Refresh Dashboard`
4. `Sign Out`

Profile edit requests:

1. Open `Edit Profile`.
2. Update the requested fields.
3. Optionally upload a new profile picture.
4. Click `Submit For Approval` or `Update Pending Request`.

What happens next:

1. The request goes to the admin `Profile Change Request Queue`.
2. Your live profile stays the same until admin approves it.

> Screenshot key: `employee-more-actions.png`
> Caption: The More Actions modal with profile edit request tools, refresh, and sign out.

### 3.7 Logout

How to sign out:

1. Open `More`.
2. Click `Sign Out`.

## 4. Supervisor Guide

Section ID: `supervisor-guide`

Main route after login: `/supervisor`

Sidebar items:

1. `Dashboard`
2. `Team DTR`
3. `Messages`
4. `Team`
5. `Settings`
6. `Logout`

### 4.1 Dashboard

Main page sections:

1. `Supervisor Scope`
2. Quick actions: `Review Team DTR` and `Open Team Directory`
3. Metric cards
4. `Team Preview`
5. `Recent Team DTR Activity`
6. `Pending DTR by Branch`

> Screenshot key: `supervisor-dashboard-home.png`
> Caption: The supervisor dashboard showing scope, metrics, team preview, and recent team DTR activity.

### 4.2 Team DTR

Route: `/supervisor/dtr`

Main sections:

1. `Team DTR Review Queue`
2. `Scoped DTR Submissions`
3. `Submit Team DTR`

What you can do:

1. Filter by branch, cutoff, status, and submit source.
2. Review employee submissions inside your scope.
3. Approve, reject, or return a submission to pending.
4. Submit one DTR file for one or more team members.

Review modal title:

1. `Review Team DTR`

Bulk submit flow:

1. Click `Submit Team DTR`.
2. Select one or more team members.
3. Choose the cutoff.
4. Upload the DTR image.
5. Add a note if needed.
6. Click `Review Submission`.
7. Confirm in `Confirm Bulk Team DTR`.

> Screenshot key: `supervisor-team-dtr-queue.png`
> Caption: The Team DTR page with scoped submissions and review actions.

> Screenshot key: `supervisor-submit-team-dtr-modal.png`
> Caption: The modal used by supervisors to submit DTR files for one or more team members.

### 4.3 Messages

Route: `/supervisor/messages`

Page title: `Supervisor Messages`

What you can do:

1. Open live guard threads in your scope.
2. Reply instantly.
3. Resolve completed threads.

> Screenshot key: `supervisor-messages.png`
> Caption: The supervisor messaging page with thread list and active conversation panel.

### 4.4 Team Directory

Route: `/supervisor/team`

Main sections:

1. `Team Directory`
2. `Team Members`

What you can do:

1. Filter by branch.
2. Filter by presence: `All`, `online`, `offline`.
3. Search by name, employee ID, branch, or position.
4. See presence badges, assignments, and schedules.

> Screenshot key: `supervisor-team-directory.png`
> Caption: The Team Directory page where supervisors view employees inside their scope.

### 4.5 Settings

Route: `/supervisor/settings`

Main sections:

1. `Supervisor Profile Settings`
2. `Password & Help`
3. `Scope Notes`

What you can do:

1. Update your name, shift, supervisor or manager field, and profile photo.
2. View your account email.
3. Send yourself a password reset email.
4. Check your current supervisor scope.

Important:

1. Area and branch scope are read-only here and are managed by admin.

> Screenshot key: `supervisor-settings.png`
> Caption: The supervisor settings page with profile, password help, and scope notes.

### 4.6 Logout

How to sign out:

1. Use the `Logout` action in the sidebar.

## 5. Admin Guide

Section ID: `admin-guide`

Main route after login: `/admin`

Sidebar items:

1. `Dashboard`
2. `DTR Submissions`
3. `Requirements`
4. `Users`
5. `Messages`
6. `Reports`
7. `Settings`
8. `Logout`

### 5.1 Dashboard

Main page sections:

1. `Quick Actions`
2. Metric cards
3. `Recent DTR Activity`
4. `Recent Requirement Activity`
5. `Employee Distribution`
6. `Branch Distribution`

Admin notifications:

1. Use the bell icon in the header.
2. The modal title is `Admin Notifications`.
3. It collects recent DTR submissions, requirement uploads, and profile update requests.

> Screenshot key: `admin-dashboard-home.png`
> Caption: The admin dashboard with quick actions, metrics, and live activity panels.

> Screenshot key: `admin-notifications-modal.png`
> Caption: The admin notification modal opened from the header bell icon.

### 5.2 DTR Submissions

Route: `/admin/dtr-submissions`

Main sections:

1. `Employee DTR Review Queue`
2. Area summary cards
3. Branch backlog cards
4. Grouped submission tables by location

What you can do:

1. Filter by area, branch, cutoff, status, submit source, and search text.
2. Review one submission at a time.
3. Approve or reject quickly from the table.
4. Apply bulk actions to selected rows.

Review modal title:

1. `Review DTR Submission`

> Screenshot key: `admin-dtr-submissions.png`
> Caption: The admin DTR review queue with filters, grouped tables, and approval actions.

### 5.3 Requirements

Route: `/admin/requirements`

Main sections:

1. `Requirement Review Queue`
2. `Uploaded Requirements`

What you can do:

1. Filter by status, area, branch, and search text.
2. Review documents and signatures.
3. Set statuses like `Verified` or `Needs Reupload`.
4. Use bulk review actions for selected rows.

> Screenshot key: `admin-requirements.png`
> Caption: The requirements review page where admins verify employee documents and signatures.

### 5.4 Users and Profile Requests

Route: `/admin/users`

Main sections:

1. `Profile Change Request Queue`
2. `People Directory`

What you can do:

1. Review and approve or reject profile update requests.
2. Search and filter the people directory.
3. Change roles between `employee`, `supervisor`, and `admin`.
4. Open the assignment editor for location, branch, position, and supervisor assignment.

> Screenshot key: `admin-users-directory.png`
> Caption: The Users page with the profile request queue and the People Directory.

### 5.5 Messages

Route: `/admin/messages`

Page title: `Admin Messages`

What you can do:

1. View escalated employee threads.
2. Reply in realtime.
3. Resolve completed conversations.

> Screenshot key: `admin-messages.png`
> Caption: The admin messaging page used for escalated threads and admin fallback conversations.

### 5.6 Reports

Route: `/admin/reports`

Main sections:

1. `Status Distribution`
2. `Top Locations`
3. `Last 7 Days Submission Trend`

What you can do:

1. Review DTR totals and approval rates.
2. Compare top locations by submission count.
3. Watch recent submission trends by day.

> Screenshot key: `admin-reports.png`
> Caption: The reports page with DTR analytics, location ranking, and submission trend charts.

### 5.7 Settings

Route: `/admin/settings`

Main sections:

1. `Admin Profile Settings`
2. `System Notes`
3. `Realtime Alerts`

What you can do:

1. Update admin profile details.
2. Review environment notes shown by the app.
3. Mute or enable dashboard notification sounds.

> Screenshot key: `admin-settings.png`
> Caption: The admin settings page with profile settings, system notes, and realtime alert controls.

### 5.8 Logout

How to sign out:

1. Use the `Logout` button in the admin sidebar.

## 6. Troubleshooting

Section ID: `troubleshooting`

### 6.1 "You can't access this area."

What it means:

1. You tried to enter the admin portal with a non-admin account.

What to do:

1. Return to the correct portal at `/login`.
2. Use a real admin account if you need `/admin`.

### 6.2 Signed In but Sent to Onboarding

What it means:

1. Your auth account exists, but your profile record is still missing.

What to do:

1. Finish the onboarding flow at `/onboarding`.

### 6.3 Pending Email Confirmation During Onboarding

What it means:

1. Your signup was created, but email confirmation is still waiting.

What to do:

1. Check your inbox.
2. Confirm the account.
3. Log in again and continue onboarding.

### 6.4 Supervisor Team Pages Are Empty

What it means:

1. The supervisor account may not have an assigned area.
2. The current scope may not match any employee assignments.

What to do:

1. Ask admin to check the supervisor assignment in the Users page.
2. Confirm the employee records use the correct area and branch values.

### 6.5 DTR or Requirement Status Stays Pending

Common statuses:

1. `Pending Review`
2. `Approved`
3. `Rejected`
4. `Verified`
5. `Needs Reupload`

What to do:

1. Wait for review.
2. Reupload flagged files when `Needs Reupload` appears.
3. Check `Recent Admin Feedback` or `Notifications` for remarks.

### 6.6 Messaging Shows Reconnecting or Sync Issue

Current message states:

1. `Live` means normal instant delivery.
2. `Reconnecting...` means the app is restoring the channel.
3. `Sync issue` means the connection needs recovery help.

What to do:

1. Wait a moment for reconnect.
2. If a `Sync now` button appears, use it as a recovery action.
3. Check your network connection.

### 6.7 Forgot Password

What to do:

1. Open the correct reset page for your portal.
2. Request the reset link.
3. Finish the reset from your email link.

## Final Notes

This manual is written for training and day-to-day use. If the website changes later, update this document and the screenshot plan together so the written steps, screenshot keys, and future in-app help structure stay aligned.
