import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import StatusBadge from "../../components/ui/StatusBadge";
import { sortAreas } from "../../lib/areas";
import { sortBranches } from "../../lib/branches";
import { supabase } from "../../lib/supabase";
import { attachSignedUrls } from "../../lib/storage";
import RequirementReviewModal from "./requirements/RequirementReviewModal";
import "./AdminRequirementsPage.css";

const REVIEWABLE_STATUSES = ["Pending Review", "Verified", "Needs Reupload"];
const STATUS_OPTIONS = ["All", ...REVIEWABLE_STATUSES];

function normalizeRequirementRow(row) {
  return {
    ...row,
    status: row.status || "Pending Review",
  };
}

export default function AdminRequirementsPage() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filters, setFilters] = useState({
    status: "All",
    location: "All",
    branch: "All",
    q: "",
  });

  const selectedUserId = searchParams.get("user") || "";

  useEffect(() => {
    loadRows();

    const channel = supabase
      .channel("admin-requirements-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_documents" }, loadRows)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadRows)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadRows() {
    setLoading(true);

    const [documentsRes, profilesRes] = await Promise.all([
      supabase
        .from("employee_documents")
        .select(
          "id,user_id,document_type,file_url,review_status,created_at,profiles:profiles!employee_documents_user_id_profile_fkey(id,full_name,employee_id,location,branch)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id,full_name,employee_id,location,branch,signature_url,signature_status,created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (documentsRes.error) {
      toast.error(documentsRes.error.message);
      setLoading(false);
      return;
    }

    if (profilesRes.error) {
      toast.error(profilesRes.error.message);
      setLoading(false);
      return;
    }

    const documentRows = await attachSignedUrls(
      (documentsRes.data ?? []).map((row) => ({
        ...row,
        requirement_type: row.document_type,
        status: row.review_status || "Pending Review",
        source_table: "employee_documents",
      })),
      "documents"
    );

    const signatureSourceRows = (profilesRes.data ?? [])
      .filter((profile) => profile.signature_url)
      .map((profile) => ({
        id: `signature-${profile.id}`,
        user_id: profile.id,
        requirement_type: "Signature",
        file_url: profile.signature_url,
        created_at: profile.created_at,
        status: profile.signature_status || "Pending Review",
        source_table: "profiles",
        profiles: {
          id: profile.id,
          full_name: profile.full_name,
          employee_id: profile.employee_id,
          location: profile.location,
          branch: profile.branch,
        },
      }));

    const signatureRows = await attachSignedUrls(signatureSourceRows, "documents");

    const combined = [...documentRows, ...signatureRows]
      .map(normalizeRequirementRow)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    setRows(combined);
    setSelectedIds((current) => current.filter((id) => combined.some((row) => row.id === id)));
    setActiveItem((current) => {
      if (!current) return null;
      return combined.find((row) => row.id === current.id) || null;
    });
    setLoading(false);
  }

  async function updateStatus(item, nextStatus) {
    if (!item) return;

    setSavingId(item.id);
    const query =
      item.source_table === "profiles"
        ? supabase.from("profiles").update({ signature_status: nextStatus }).eq("id", item.user_id)
        : supabase.from("employee_documents").update({ review_status: nextStatus }).eq("id", item.id);

    const { error } = await query;
    setSavingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    setRows((current) => current.map((row) => (row.id === item.id ? { ...row, status: nextStatus } : row)));
    setActiveItem((current) => (current?.id === item.id ? { ...current, status: nextStatus } : current));
    toast.success(`Requirement marked as ${nextStatus}.`);
  }

  async function updateBulkStatus(nextStatus) {
    if (selectedIds.length === 0) return;

    const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
    setSavingId(`bulk-${nextStatus}`);

    try {
      const profileIds = selectedRows.filter((row) => row.source_table === "profiles").map((row) => row.user_id);
      const documentIds = selectedRows.filter((row) => row.source_table === "employee_documents").map((row) => row.id);

      if (profileIds.length > 0) {
        const { error } = await supabase.from("profiles").update({ signature_status: nextStatus }).in("id", profileIds);
        if (error) throw error;
      }

      if (documentIds.length > 0) {
        const { error } = await supabase.from("employee_documents").update({ review_status: nextStatus }).in("id", documentIds);
        if (error) throw error;
      }

      setRows((current) => current.map((row) => (selectedIds.includes(row.id) ? { ...row, status: nextStatus } : row)));
      setActiveItem((current) => (current && selectedIds.includes(current.id) ? { ...current, status: nextStatus } : current));
      toast.success(`${selectedIds.length} requirement(s) marked as ${nextStatus}.`);
      setSelectedIds([]);
    } catch (error) {
      toast.error(error.message || "Unable to update selected requirements.");
    } finally {
      setSavingId(null);
    }
  }

  const locations = useMemo(() => {
    const uniqueLocations = Array.from(new Set(rows.map((row) => row.profiles?.location).filter(Boolean)));
    return ["All", ...sortAreas(uniqueLocations)];
  }, [rows]);

  const branches = useMemo(() => {
    const uniqueBranches = Array.from(new Set(rows.map((row) => row.profiles?.branch).filter(Boolean)));
    return ["All", ...sortBranches(uniqueBranches)];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = filters.q.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesUser = !selectedUserId || row.user_id === selectedUserId;
      const matchesStatus = filters.status === "All" || row.status === filters.status;
      const matchesLocation = filters.location === "All" || (row.profiles?.location || "Unassigned") === filters.location;
      const matchesBranch = filters.branch === "All" || (row.profiles?.branch || "Unassigned") === filters.branch;
      const haystack = [
        row.profiles?.full_name,
        row.profiles?.employee_id,
        row.profiles?.location,
        row.profiles?.branch,
        row.requirement_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query);

      return matchesUser && matchesStatus && matchesLocation && matchesBranch && matchesQuery;
    });
  }, [filters, rows, selectedUserId]);

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));

  if (loading) {
    return <p className="admin-loading-copy">Loading employee requirements...</p>;
  }

  return (
    <div className="admin-page admin-requirements-page">
      <Card>
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-title">Requirement Review Queue</h2>
            <p className="admin-section-copy">
              Review employee documents and signatures in one place.
              {selectedUserId ? " Showing a filtered employee view from Users." : ""}
            </p>
          </div>
        </div>

        <div className="admin-filters-grid admin-filters-grid--queue">
          <Select label="Status" value={filters.status} onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          <Select
            label="Area"
            value={filters.location}
            onChange={(e) => setFilters((current) => ({ ...current, location: e.target.value }))}
          >
            {locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </Select>
          <Select
            label="Branch"
            value={filters.branch}
            onChange={(e) => setFilters((current) => ({ ...current, branch: e.target.value }))}
          >
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </Select>
          <label className="admin-search-label admin-search-label--wide">
            <span className="admin-search-label-text">Search</span>
            <div className="admin-search-wrap">
              <Search size={16} className="admin-search-icon" />
              <input
                className="admin-search-input"
                placeholder="Name, employee ID, area, branch, requirement"
                value={filters.q}
                onChange={(e) => setFilters((current) => ({ ...current, q: e.target.value }))}
              />
            </div>
          </label>
        </div>
      </Card>

      <Card>
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-title">Uploaded Requirements</h2>
            <p className="admin-section-copy">{filteredRows.length} matching requirement(s)</p>
          </div>
          <div className="admin-users-page__actions">
            <Button
              variant="secondary"
              disabled={selectedIds.length === 0 || Boolean(savingId)}
              loading={savingId === "bulk-Verified"}
              onClick={() => updateBulkStatus("Verified")}
            >
              Verify All Selected
            </Button>
            <Button
              variant="secondary"
              disabled={selectedIds.length === 0 || Boolean(savingId)}
              loading={savingId === "bulk-Needs Reupload"}
              onClick={() => updateBulkStatus("Needs Reupload")}
            >
              Needs Reupload
            </Button>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr className="admin-table-head-row admin-table-head-row--caps">
                <th className="admin-table-head-cell admin-table-head-cell--lg">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={(e) =>
                      setSelectedIds((current) =>
                        e.target.checked
                          ? Array.from(new Set([...current, ...filteredRows.map((row) => row.id)]))
                          : current.filter((id) => !filteredRows.some((row) => row.id === id))
                      )
                    }
                  />
                </th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Employee</th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Requirement</th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Assignment</th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Submitted</th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Status</th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="admin-table-row admin-table-row--top">
                  <td className="admin-table-cell admin-table-cell--lg">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={(e) =>
                        setSelectedIds((current) =>
                          e.target.checked ? Array.from(new Set([...current, row.id])) : current.filter((id) => id !== row.id)
                        )
                      }
                    />
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg">
                    <p className="admin-text-strong">{row.profiles?.full_name || "Unknown Employee"}</p>
                    <p className="admin-copy-xs">{row.profiles?.employee_id || "No Employee ID"}</p>
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg">
                    <p className="admin-text-medium">{row.requirement_type}</p>
                    <p className="admin-copy-xs-muted">{row.source_table === "profiles" ? "Profile signature" : "Document upload"}</p>
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg">
                    <p className="admin-copy-xs">{row.profiles?.location || "Unassigned location"}</p>
                    <p className="admin-copy-xs-muted">{row.profiles?.branch || "Unassigned branch"}</p>
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg">
                    <p className="admin-copy-xs">{row.created_at ? new Date(row.created_at).toLocaleString() : "No timestamp"}</p>
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg">
                    <Button variant="secondary" onClick={() => setActiveItem(row)}>
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRows.length === 0 ? <p className="admin-copy-sm">No uploaded requirements match the current filters.</p> : null}
      </Card>

      <RequirementReviewModal
        item={activeItem}
        saving={savingId === activeItem?.id}
        reviewableStatuses={REVIEWABLE_STATUSES}
        onClose={() => setActiveItem(null)}
        onUpdateStatus={updateStatus}
      />
    </div>
  );
}
