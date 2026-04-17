import { FileImage, FileText } from "lucide-react";
import { DOCUMENT_TYPES, IMAGE_TYPES } from "./employeeDashboardConfig";

export function isPdfFile(path = "") {
  return /\.pdf($|\?)/i.test(path);
}

export function getDocumentIcon(path = "") {
  return isPdfFile(path) ? FileText : FileImage;
}

export function buildStoragePath(userId, label, file) {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  return `${userId}/${safeLabel}-${Date.now()}.${ext}`;
}

export function validateRequirementFile(file, documentType) {
  if (!file) return "Please choose a file first.";
  const allowedTypes = documentType === "Signature" ? IMAGE_TYPES : DOCUMENT_TYPES;
  if (file.type && !allowedTypes.includes(file.type)) {
    return documentType === "Signature"
      ? "Signature must be uploaded as PNG, JPG, or WEBP."
      : "Requirement must be uploaded as PNG, JPG, WEBP, or PDF.";
  }
  return null;
}

export function validateAvatarFile(file) {
  if (!file) return null;
  if (file.type && !IMAGE_TYPES.includes(file.type)) {
    return "Profile picture must be PNG, JPG, or WEBP.";
  }
  return null;
}

export function getStatusCopy(status) {
  if (status === "Approved") return "Approved by admin";
  if (status === "Rejected") return "Rejected by admin";
  return "Waiting for admin approval";
}

export function formatDateTime(value) {
  if (!value) return "No date available";
  return new Date(value).toLocaleString();
}

export function canEditDocument(document) {
  if (!document) return false;
  if (document.document_type === "Signature") return true;
  return Boolean(document.preview_url) || document.is_missing || document.review_status === "Needs Reupload";
}
