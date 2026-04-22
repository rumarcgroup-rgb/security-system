# Release QA Checklist

Use this checklist before deploying changes to the guard, supervisor, and admin workflows.

## Guard / Employee
1. Log in through Security Guard Login or the correct staff portal.
2. Confirm the dashboard shows profile, assignment, DTR counts, profile completeness, admin feedback, and DTR history.
3. Submit a DTR with a cutoff, image, and optional note.
4. Confirm the submitted DTR appears in Recent Submissions and DTR History without a browser refresh.
5. Open Documents, preview a requirement, upload a replacement, and confirm the row becomes Pending Review.
6. Submit or update a Profile Change Request from More.
7. Open Messages, send a message, edit the latest own message, confirm seen receipts, typing indicator, and escalation/de-escalation behavior.
8. Confirm Notifications and More show the correct status messages and logout works.

## Supervisor
1. Log in as a supervisor with an assigned area.
2. Confirm Dashboard metrics, Team Preview, Team Attendance Board, Missing DTR Follow-Up, and Recent Team DTR Activity load.
3. Open Team DTR and filter by branch, cutoff, status, submit source, and search.
4. Review a DTR and approve, reject, or return pending.
5. Use Submit Team DTR for one guard and for multiple guards.
6. Confirm skipped existing cutoff rows are reported correctly.
7. Open Messages, reply to an employee, and resolve a thread.
8. Open Team Directory and confirm the dashboard preview is a subset of the full directory.

## Admin
1. Log in through Admin Login.
2. Confirm Dashboard metrics, quick actions, notifications, recent DTR activity, and requirement activity update live.
3. Open DTR Submissions, filter rows, approve/reject a single DTR, and test bulk approval/rejection.
4. Open Requirements, verify one document, mark another Needs Reupload, and test bulk actions.
5. Open Users, approve/reject a profile request, change an employee assignment, and update a role.
6. Open Messages and confirm admin fallback/escalated threads are visible only when expected.
7. Open Reports, confirm charts load, export DTR CSV, and review Cutoff Summary.
8. Open Settings, run System Health, confirm Audit Log Preview loads, and toggle Realtime Alerts sound.

## Realtime Recovery
1. Open two browser sessions with different roles.
2. Make a DTR, requirement, profile request, message, and assignment change in one session.
3. Confirm the other session updates without refresh.
4. Disconnect the network briefly, reconnect, and confirm the UI catches up automatically.
5. Confirm no duplicate messages, DTR rows, requirement rows, notifications, or audit logs appear in the UI.

## Database Checklist
1. Rerun `supabase/schema.sql` before testing schema-dependent features.
2. Confirm `get_admin_system_health()` reports no missing realtime tables.
3. Confirm `audit_logs` receives rows for DTR review, requirement review, profile request review, assignment changes, message edits, escalation, and de-escalation.
