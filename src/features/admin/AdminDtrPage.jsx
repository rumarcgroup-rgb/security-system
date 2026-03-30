import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Search } from "lucide-react";
import Card from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import Modal from "../../components/ui/Modal";
import { supabase } from "../../lib/supabase";
import { attachSignedUrls } from "../../lib/storage";
import { mergeCutoffOptions } from "../../lib/dtr";

const statusOptions = ["All", "Pending Review", "Approved", "Rejected"];

export default function AdminDtrPage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ area: "All", cutoff: "All", status: "All", q: "" });
  const [reviewItem, setReviewItem] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRows();
    const channel = supabase
      .channel("admin-dtr-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "dtr_submissions" }, loadRows)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function loadRows() {
    const { data, error } = await supabase
      .from("dtr_submissions")
      .select("id,user_id,cutoff,file_url,status,approved_at,created_at,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,role,employee_id,location)")
      .order("created_at", { ascending: false });
    if (!error) {
      const withSignedUrls = await attachSignedUrls(data || [], "dtr-images");
      setRows(withSignedUrls);
    }
  }

  const areas = useMemo(() => {
    const list = Array.from(new Set(rows.map((r) => r.profiles?.location).filter(Boolean)));
    return ["All", ...list];
  }, [rows]);

  const cutoffOptions = useMemo(() => {
    return ["All", ...mergeCutoffOptions(rows.map((row) => row.cutoff), new Date(), 6)];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const name = (r.profiles?.full_name || "").toLowerCase();
      const empId = (r.profiles?.employee_id || "").toLowerCase();
      const byArea = filters.area === "All" || r.profiles?.location === filters.area;
      const byCutoff = filters.cutoff === "All" || r.cutoff === filters.cutoff;
      const byStatus = filters.status === "All" || r.status === filters.status;
      const byQ = !filters.q || name.includes(filters.q.toLowerCase()) || empId.includes(filters.q.toLowerCase());
      return byArea && byCutoff && byStatus && byQ;
    });
  }, [rows, filters]);

  const grouped = useMemo(() => {
    return filtered.reduce((acc, item) => {
      const key = item.profiles?.location || "Unassigned";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [filtered]);

  async function updateStatus(status) {
    if (!reviewItem) return;
    setLoading(true);
    const payload = {
      status,
      approved_at: status === "Approved" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("dtr_submissions").update(payload).eq("id", reviewItem.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Marked as ${status}`);
      setReviewItem(null);
      loadRows();
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Employee DTR Review Queue</h2>
            <p className="text-sm text-slate-500">All DTR submissions sent by employees appear here for admin approval.</p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            {rows.filter((row) => row.status === "Pending Review").length} Pending
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-6">
          <Select label="Area" value={filters.area} onChange={(e) => setFilters((p) => ({ ...p, area: e.target.value }))}>
            {areas.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select
            label="Cutoff"
            value={filters.cutoff}
            onChange={(e) => setFilters((p) => ({ ...p, cutoff: e.target.value }))}
          >
            {cutoffOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          >
            {statusOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <div className="md:col-span-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Search</span>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-brand-500"
                  placeholder="Employee name or ID"
                  value={filters.q}
                  onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                />
              </div>
            </label>
          </div>
          <div className="flex items-end gap-2">
            <Button className="w-full" onClick={loadRows}>
              Filter
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => setFilters({ area: "All", cutoff: "All", status: "All", q: "" })}
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {Object.entries(grouped).map(([location, items]) => {
        const pendingCount = items.filter((x) => x.status === "Pending Review").length;
        return (
          <Card key={location}>
            <h3 className="mb-3 text-base font-semibold text-slate-800">
              {location} ({pendingCount} Pending)
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="pb-2">Employee</th>
                    <th className="pb-2">Employee ID</th>
                    <th className="pb-2">Selected Cutoff</th>
                    <th className="pb-2">DTR Preview</th>
                    <th className="pb-2">Date Submitted</th>
                    <th className="pb-2">Date Approved</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-2">
                        <p className="font-medium text-slate-700">{item.profiles?.full_name || "Unknown"}</p>
                        <p className="text-xs text-slate-500">{item.profiles?.role || "Employee"}</p>
                      </td>
                      <td className="py-2">{item.profiles?.employee_id || "-"}</td>
                      <td className="py-2">{item.cutoff || "-"}</td>
                      <td className="py-2">
                        {item.preview_url ? (
                          <img src={item.preview_url} alt="DTR preview" className="h-12 w-16 rounded-md object-cover" />
                        ) : (
                          <div className="flex h-12 w-16 items-center justify-center rounded-md bg-slate-100 text-[10px] text-slate-500">
                            No Preview
                          </div>
                        )}
                      </td>
                      <td className="py-2">{new Date(item.created_at).toLocaleString()}</td>
                      <td className="py-2">{item.approved_at ? new Date(item.approved_at).toLocaleString() : "-"}</td>
                      <td className="py-2">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-2">
                        <Button className="px-3 py-1.5 text-xs" onClick={() => setReviewItem(item)}>
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      {filtered.length === 0 ? <p className="text-sm text-slate-500">No submissions found.</p> : null}

      <div className="text-sm text-slate-500">
        Need to review a new employee submission from the dashboard? Open <Link className="font-medium text-brand-600 hover:underline" to="/admin">Dashboard</Link> for the latest activity, then come back here to approve or reject it.
      </div>

      <Modal open={Boolean(reviewItem)} onClose={() => setReviewItem(null)} title="Review DTR Submission">
        {reviewItem ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">Selected Cutoff:</span> {reviewItem.cutoff || "Not set"}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-slate-800">Submitted:</span> {new Date(reviewItem.created_at).toLocaleString()}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-slate-800">Approved At:</span>{" "}
                {reviewItem.approved_at ? new Date(reviewItem.approved_at).toLocaleString() : "Not approved yet"}
              </p>
            </div>
            {reviewItem.preview_url ? (
              <img src={reviewItem.preview_url} alt="DTR full preview" className="max-h-[60vh] w-full rounded-xl object-contain" />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Unable to load preview URL.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="danger" onClick={() => updateStatus("Rejected")} loading={loading}>
                Reject
              </Button>
              <Button onClick={() => updateStatus("Approved")} loading={loading}>
                Approve
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
