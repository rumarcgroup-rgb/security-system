import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, Plus, RefreshCcw, Trash2 } from "lucide-react";
import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  getDtrExtractionStatusLabel,
  getPrimaryDtrExtraction,
  normalizeDtrExtractionData,
  prepareDtrExtractionData,
} from "../../lib/dtrExtraction";
import "./DtrExtractionPanel.css";

const TOTAL_FIELDS = [
  ["days_present", "Days Present"],
  ["regular_hours", "Regular Hours"],
  ["overtime_hours", "Overtime Hours"],
  ["late_minutes", "Late Minutes"],
  ["undertime_minutes", "Undertime Minutes"],
  ["absences", "Absences"],
];

const ROW_TEMPLATE = {
  date: "",
  day: "",
  time_in: "",
  time_out: "",
  break_hours: 0,
  regular_hours: 0,
  overtime_hours: 0,
  late_minutes: 0,
  undertime_minutes: 0,
  absence: false,
  remarks: "",
  confidence: 0,
};

export default function DtrExtractionPanel({
  canReview = false,
  extracting = false,
  onSaveExtraction,
  onStartExtraction,
  saving = false,
  submission,
}) {
  const extraction = getPrimaryDtrExtraction(submission);
  const [draft, setDraft] = useState(() => normalizeDtrExtractionData(extraction?.extracted_data, submission));
  const status = extraction?.status || "not_started";
  const statusLabel = getDtrExtractionStatusLabel(status);
  const isProcessing = status === "processing";
  const isVerified = status === "verified";
  const canEdit = canReview && !isProcessing;
  const confidence = extraction?.confidence_score ?? draft.overall_confidence;
  const confidenceLabel = Number.isFinite(Number(confidence)) ? `${Math.round(Number(confidence) * 100)}%` : "Not scored";

  useEffect(() => {
    setDraft(normalizeDtrExtractionData(extraction?.extracted_data, submission));
  }, [extraction?.id, extraction?.updated_at, submission?.id]);

  const lowConfidenceText = useMemo(() => {
    const fields = draft.low_confidence_fields || [];
    return fields.length ? fields.join(", ") : "None flagged";
  }, [draft.low_confidence_fields]);

  function updatePath(section, field, value) {
    setDraft((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  }

  function updateRoot(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateDailyRow(index, field, value) {
    setDraft((current) => ({
      ...current,
      daily_rows: current.daily_rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      ),
    }));
  }

  function addDailyRow() {
    setDraft((current) => ({
      ...current,
      daily_rows: [...current.daily_rows, { ...ROW_TEMPLATE }],
    }));
  }

  function removeDailyRow(index) {
    setDraft((current) => ({
      ...current,
      daily_rows: current.daily_rows.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function submitReview(nextStatus) {
    if (!onSaveExtraction) return;
    onSaveExtraction(submission, prepareDtrExtractionData(draft, submission), nextStatus);
  }

  return (
    <section className="dtr-extraction-panel">
      <div className="dtr-extraction-panel__head">
        <div>
          <p className="dtr-extraction-panel__eyebrow">AI Payroll Draft</p>
          <h3 className="dtr-extraction-panel__title">Generated DTR Data</h3>
        </div>
        <StatusBadge status={statusLabel} />
      </div>

      <div className="dtr-extraction-panel__meta-grid">
        <MetaItem label="Confidence" value={confidenceLabel} />
        <MetaItem label="Low-confidence fields" value={lowConfidenceText} />
        <MetaItem label="Last updated" value={extraction?.updated_at ? new Date(extraction.updated_at).toLocaleString() : "Not started"} />
        <MetaItem label="Verified" value={extraction?.verified_at ? new Date(extraction.verified_at).toLocaleString() : "Not verified"} />
      </div>

      {status === "not_started" ? (
        <div className="dtr-extraction-panel__empty">
          <Bot size={18} />
          <span>No AI extraction has been generated for this DTR yet.</span>
        </div>
      ) : null}

      {isProcessing ? (
        <div className="dtr-extraction-panel__empty dtr-extraction-panel__empty--processing">
          <Bot size={18} />
          <span>AI is reading the submitted DTR image. This can take a moment.</span>
        </div>
      ) : null}

      {extraction?.error_message ? (
        <div className="dtr-extraction-panel__error">
          <AlertTriangle size={18} />
          <span>{extraction.error_message}</span>
        </div>
      ) : null}

      <div className="dtr-extraction-panel__section">
        <p className="dtr-extraction-panel__section-title">Payroll Totals</p>
        <div className="dtr-extraction-panel__totals-grid">
          {TOTAL_FIELDS.map(([field, label]) => (
            <label key={field} className="dtr-extraction-panel__field">
              <span>{label}</span>
              <input
                type="number"
                min="0"
                step={field.includes("hours") ? "0.25" : "1"}
                value={draft.totals?.[field] ?? 0}
                disabled={!canEdit}
                onChange={(event) => updatePath("totals", field, event.target.value)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="dtr-extraction-panel__section">
        <div className="dtr-extraction-panel__section-head">
          <p className="dtr-extraction-panel__section-title">Daily Rows</p>
          {canEdit ? (
            <button type="button" className="dtr-extraction-panel__link" onClick={addDailyRow}>
              <Plus size={14} />
              Add row
            </button>
          ) : null}
        </div>

        <div className="dtr-extraction-panel__rows">
          {draft.daily_rows.length ? (
            draft.daily_rows.map((row, index) => (
              <div key={`${row.date || "row"}-${index}`} className="dtr-extraction-panel__row">
                <div className="dtr-extraction-panel__row-grid">
                  <TextField label="Date" value={row.date} disabled={!canEdit} onChange={(value) => updateDailyRow(index, "date", value)} />
                  <TextField label="Day" value={row.day} disabled={!canEdit} onChange={(value) => updateDailyRow(index, "day", value)} />
                  <TextField label="Time In" value={row.time_in} disabled={!canEdit} onChange={(value) => updateDailyRow(index, "time_in", value)} />
                  <TextField label="Time Out" value={row.time_out} disabled={!canEdit} onChange={(value) => updateDailyRow(index, "time_out", value)} />
                  <NumberField label="Regular" value={row.regular_hours} disabled={!canEdit} onChange={(value) => updateDailyRow(index, "regular_hours", value)} />
                  <NumberField label="OT" value={row.overtime_hours} disabled={!canEdit} onChange={(value) => updateDailyRow(index, "overtime_hours", value)} />
                  <NumberField label="Late" value={row.late_minutes} disabled={!canEdit} onChange={(value) => updateDailyRow(index, "late_minutes", value)} />
                  <NumberField label="UT" value={row.undertime_minutes} disabled={!canEdit} onChange={(value) => updateDailyRow(index, "undertime_minutes", value)} />
                </div>
                <label className="dtr-extraction-panel__remarks">
                  <span>Remarks</span>
                  <input
                    value={row.remarks || ""}
                    disabled={!canEdit}
                    onChange={(event) => updateDailyRow(index, "remarks", event.target.value)}
                  />
                </label>
                {canEdit ? (
                  <button type="button" className="dtr-extraction-panel__remove" onClick={() => removeDailyRow(index)}>
                    <Trash2 size={14} />
                    Remove row
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="dtr-extraction-panel__empty-copy">No daily rows extracted yet.</p>
          )}
        </div>
      </div>

      <label className="dtr-extraction-panel__field dtr-extraction-panel__field--full">
        <span>Extraction Notes</span>
        <textarea
          value={draft.notes || ""}
          disabled={!canEdit}
          onChange={(event) => updateRoot("notes", event.target.value)}
        />
      </label>

      {canReview ? (
        <div className="dtr-extraction-panel__actions">
          <Button variant="secondary" loading={extracting} disabled={saving || extracting} onClick={() => onStartExtraction?.(submission)}>
            <RefreshCcw size={15} />
            {status === "not_started" || status === "failed" ? "Run AI Extraction" : "Re-run AI"}
          </Button>
          <Button variant="secondary" loading={saving} disabled={saving || extracting || isProcessing} onClick={() => submitReview("draft")}>
            Save Draft
          </Button>
          <Button variant="danger" loading={saving} disabled={saving || extracting || isProcessing} onClick={() => submitReview("needs_review")}>
            Mark Needs Review
          </Button>
          <Button loading={saving} disabled={saving || extracting || isProcessing || isVerified} onClick={() => submitReview("verified")}>
            Verify Payroll Data
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function MetaItem({ label, value }) {
  return (
    <div className="dtr-extraction-panel__meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TextField({ disabled, label, onChange, value }) {
  return (
    <label className="dtr-extraction-panel__field">
      <span>{label}</span>
      <input value={value || ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ disabled, label, onChange, value }) {
  return (
    <label className="dtr-extraction-panel__field">
      <span>{label}</span>
      <input type="number" min="0" step="0.25" value={value ?? 0} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
