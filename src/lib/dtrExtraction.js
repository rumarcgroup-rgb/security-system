import { supabase } from "./supabase";

export const DTR_EXTRACTION_STATUS_LABELS = {
  processing: "Extraction processing",
  draft: "Ready for review",
  verified: "Payroll verified",
  needs_review: "Needs manual review",
  failed: "Extraction failed",
};

const NUMERIC_TOTAL_FIELDS = [
  "days_present",
  "regular_hours",
  "overtime_hours",
  "late_minutes",
  "undertime_minutes",
  "absences",
];

const NUMERIC_ROW_FIELDS = [
  "break_hours",
  "regular_hours",
  "overtime_hours",
  "late_minutes",
  "undertime_minutes",
  "confidence",
];

export function getPrimaryDtrExtraction(submission) {
  if (!submission) return null;
  if (submission.dtr_extraction) return submission.dtr_extraction;
  if (Array.isArray(submission.dtr_extractions)) return submission.dtr_extractions[0] || null;
  return null;
}

export function getDtrExtractionStatusLabel(status) {
  return DTR_EXTRACTION_STATUS_LABELS[status] || "Not started";
}

export function getDtrExtractionStatus(submission) {
  return getPrimaryDtrExtraction(submission)?.status || "not_started";
}

export function buildDefaultDtrExtractionData(submission = {}) {
  return {
    employee: {
      name: submission.profiles?.full_name || "",
      employee_id: submission.profiles?.employee_id || "",
      location: submission.profiles?.location || "",
      branch: submission.profiles?.branch || "",
    },
    cutoff: {
      label: submission.cutoff || "",
      selected_dtr_date: submission.selected_dtr_date || "",
    },
    daily_rows: [],
    totals: {
      days_present: 0,
      regular_hours: 0,
      overtime_hours: 0,
      late_minutes: 0,
      undertime_minutes: 0,
      absences: 0,
    },
    low_confidence_fields: [],
    overall_confidence: 0,
    notes: "",
  };
}

export function normalizeDtrExtractionData(data, submission = {}) {
  const fallback = buildDefaultDtrExtractionData(submission);
  const source = data && typeof data === "object" ? data : {};
  const totals = source.totals && typeof source.totals === "object" ? source.totals : {};
  const employee = source.employee && typeof source.employee === "object" ? source.employee : {};
  const cutoff = source.cutoff && typeof source.cutoff === "object" ? source.cutoff : {};

  return {
    ...fallback,
    ...source,
    employee: {
      ...fallback.employee,
      ...employee,
    },
    cutoff: {
      ...fallback.cutoff,
      ...cutoff,
    },
    totals: {
      ...fallback.totals,
      ...totals,
    },
    daily_rows: Array.isArray(source.daily_rows) ? source.daily_rows : [],
    low_confidence_fields: Array.isArray(source.low_confidence_fields) ? source.low_confidence_fields : [],
    notes: source.notes || "",
    overall_confidence: source.overall_confidence ?? fallback.overall_confidence,
  };
}

function asNumber(value) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

export function prepareDtrExtractionData(data, submission = {}) {
  const normalized = normalizeDtrExtractionData(data, submission);
  const totals = { ...normalized.totals };
  NUMERIC_TOTAL_FIELDS.forEach((field) => {
    totals[field] = asNumber(totals[field]);
  });

  return {
    ...normalized,
    totals,
    overall_confidence: asNumber(normalized.overall_confidence),
    daily_rows: normalized.daily_rows.map((row) => {
      const nextRow = { ...row };
      NUMERIC_ROW_FIELDS.forEach((field) => {
        nextRow[field] = asNumber(nextRow[field]);
      });
      nextRow.absence = Boolean(nextRow.absence);
      return nextRow;
    }),
    low_confidence_fields: normalized.low_confidence_fields
      .map((item) => String(item || "").trim())
      .filter(Boolean),
  };
}

export function getDtrExtractionTotals(submission) {
  const extraction = getPrimaryDtrExtraction(submission);
  return normalizeDtrExtractionData(extraction?.extracted_data, submission).totals;
}

async function getFunctionErrorMessage(error) {
  if (!error) return "Unable to run DTR extraction.";

  const response = error.context;
  if (response) {
    try {
      const contentType = response.headers?.get?.("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await response.clone().json();
        return body?.error || body?.message || error.message || "DTR extraction failed.";
      }

      const text = await response.clone().text();
      if (text) return text;
    } catch (_) {
      return error.message || "DTR extraction failed.";
    }
  }

  return error.message || "DTR extraction failed.";
}

export async function triggerDtrExtraction(submissionId) {
  if (!submissionId) return null;
  if (!supabase?.functions) {
    throw new Error("Supabase functions are not configured.");
  }

  const { data, error } = await supabase.functions.invoke("extract-dtr-data", {
    body: { submission_id: submissionId },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (data?.status === "failed") {
    throw new Error(data.error || "DTR extraction failed.");
  }

  return data;
}

export async function saveDtrExtractionReview({ submissionId, extractedData, status }) {
  if (!submissionId) return null;

  const { data, error } = await supabase.rpc("review_dtr_extraction", {
    target_submission_id: submissionId,
    next_extracted_data: extractedData,
    next_status: status,
  });

  if (error) throw error;
  return data;
}
