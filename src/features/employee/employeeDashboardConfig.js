import { BriefcaseBusiness, ShieldCheck, UserRound } from "lucide-react";
import { getStoredEmployeePortalType, normalizeEmployeePortal } from "../../lib/employeePortal";

export const REQUIRED_DOCUMENTS = ["License", "NBI Clearance", "Medical Certificate", "Barangay Clearance", "Valid ID", "Signature"];
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const DOCUMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];
export const GENDER_OPTIONS = ["Male", "Female"];
export const CIVIL_STATUS_OPTIONS = ["Single", "Married", "Widowed"];

export const DASHBOARD_VARIANTS = {
  "cgroup-access": {
    key: "cgroup-access",
    title: "CGroup Access",
    roleLabel: "Access Staff",
    headerLabel: "CGROUP ACCESS",
    heroTitle: "CGroup Access Dashboard",
    heroCopy: "Manage shared records, DTR submissions, and compliance files for your assigned access role.",
    supportCopy: "Keep your access records updated so admin can review your DTR, profile edits, and file submissions quickly.",
    submitTitle: "Submit Access DTR",
    submitCopy: "Upload the final attendance or access-support DTR image for your selected cutoff before review starts.",
    documentsCopy: "Track uploaded access requirements, IDs, and signature review from here.",
    highlightTitle: "Access Priorities",
    highlights: [
      "Confirm your assigned site and shift details before sending a DTR.",
      "Keep IDs and compliance files clear and updated for faster admin review.",
      "Watch notifications for payroll or reassignment follow-ups.",
    ],
    actionEmptyCopy: "You have no urgent CGroup Access action items right now.",
    clearMessageTitle: "No urgent access messages",
    clearMessageBody: "Everything looks steady right now. Keep an eye on notifications for any admin updates.",
    adminReviewBody: "Your DTRs, requirement uploads, and profile update requests are reviewed from the admin dashboard for CGroup Access personnel.",
    theme: {
      primary: "#153f91",
      primaryDark: "#10295c",
      soft: "#dbeafe",
      tint: "#eff6ff",
      glow: "rgba(21, 63, 145, 0.18)",
    },
    icon: BriefcaseBusiness,
  },
  "security-guard": {
    key: "security-guard",
    title: "Security Guard",
    roleLabel: "Guard",
    headerLabel: "SECURITY GUARD",
    heroTitle: "Security Guard Dashboard",
    heroCopy: "Track guard submissions, compliance documents, and profile approvals from one dedicated view.",
    supportCopy: "Keep your guard records ready for review so assignments and payroll processing stay on schedule.",
    submitTitle: "Submit Guard DTR",
    submitCopy: "Upload the final guard duty DTR image for your selected cutoff after checking all duty logs and notes.",
    documentsCopy: "Track guard credentials, clearances, and signature review from here.",
    highlightTitle: "Guard Priorities",
    highlights: [
      "Verify every submitted DTR matches your final shift and post assignment.",
      "Reupload any expired or unclear clearances as soon as admin flags them.",
      "Use notes to explain unusual incidents, reliever coverage, or overtime.",
    ],
    actionEmptyCopy: "You have no urgent security guard action items right now.",
    clearMessageTitle: "No urgent guard messages",
    clearMessageBody: "Your guard dashboard is up to date. Watch for notifications from admin when reviews are completed.",
    adminReviewBody: "Your DTRs, requirement uploads, and profile update requests are reviewed from the admin dashboard for security personnel.",
    theme: {
      primary: "#0d4dc4",
      primaryDark: "#08347d",
      soft: "#dbeafe",
      tint: "#eff6ff",
      glow: "rgba(13, 77, 196, 0.18)",
    },
    icon: ShieldCheck,
  },
  janitor: {
    key: "janitor",
    title: "Janitor",
    roleLabel: "Janitorial Staff",
    headerLabel: "JANITOR",
    heroTitle: "Janitor Dashboard",
    heroCopy: "Stay on top of shift records, cleanup assignment paperwork, and required file uploads in one place.",
    supportCopy: "Keep your janitorial records complete so admin can approve DTR and document updates without delays.",
    submitTitle: "Submit Janitor DTR",
    submitCopy: "Upload the final janitorial service DTR image for your selected cutoff after checking your full shift record.",
    documentsCopy: "Track janitorial requirements, medical clearance, and signature review from here.",
    highlightTitle: "Janitorial Priorities",
    highlights: [
      "Make sure your DTR reflects the full cleaning shift before uploading.",
      "Keep medical and barangay clearances ready for fast verification.",
      "Check messages often for supply, assignment, or reupload reminders.",
    ],
    actionEmptyCopy: "You have no urgent janitor action items right now.",
    clearMessageTitle: "No urgent janitor messages",
    clearMessageBody: "Your janitor portal looks clear right now. Watch notifications for any new admin action items.",
    adminReviewBody: "Your DTRs, requirement uploads, and profile update requests are reviewed from the admin dashboard for janitorial personnel.",
    theme: {
      primary: "#0c8b4d",
      primaryDark: "#0b5f37",
      soft: "#dcfce7",
      tint: "#f0fdf4",
      glow: "rgba(12, 139, 77, 0.18)",
    },
    icon: UserRound,
  },
};

export function getDashboardVariant(profile) {
  const rawPosition = String(profile?.position || "").trim();
  const rawStoredPortal = String(getStoredEmployeePortalType() || "").trim();
  const resolvedPortal = rawPosition
    ? normalizeEmployeePortal(rawPosition)
    : rawStoredPortal
      ? normalizeEmployeePortal(rawStoredPortal)
      : "cgroup-access";

  return DASHBOARD_VARIANTS[resolvedPortal] || DASHBOARD_VARIANTS["cgroup-access"];
}
