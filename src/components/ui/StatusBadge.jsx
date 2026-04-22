export default function StatusBadge({ status }) {
  const normalized = (status || "").toLowerCase();
  const tone =
    normalized.includes("approved") || normalized.includes("verified")
      ? "bg-emerald-100 text-emerald-700"
      : normalized.includes("reject") || normalized.includes("reupload") || normalized.includes("action")
      ? "bg-rose-100 text-rose-700"
      : normalized.includes("missing")
      ? "bg-slate-200 text-slate-700"
      : "bg-amber-100 text-amber-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}
