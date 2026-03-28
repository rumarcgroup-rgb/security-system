import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  LayoutDashboard,
  ListChecks,
  UploadCloud,
  MessageSquareText,
  MoreHorizontal,
  Camera,
  ImageUp,
  ExternalLink,
  FileImage,
  FileText,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import StatusBadge from "../../components/ui/StatusBadge";
import { supabase } from "../../lib/supabase";
import { attachSignedUrls } from "../../lib/storage";
import { buildCutoffOptions } from "../../lib/dtr";

const REQUIRED_DOCUMENTS = ["Valid ID", "NBI Clearance", "Medical Certificate", "Barangay Clearance", "Signature"];

function isPdfFile(path = "") {
  return /\.pdf($|\?)/i.test(path);
}

function getDocumentIcon(path = "") {
  return isPdfFile(path) ? FileText : FileImage;
}

export default function EmployeeDashboard({ user, profile }) {
  const cutoffOptions = useMemo(() => buildCutoffOptions(new Date(), 4), []);
  const [cutoff, setCutoff] = useState(() => cutoffOptions[0]);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [activeDocument, setActiveDocument] = useState(null);

  useEffect(() => {
    loadSubmissions();
    loadDocuments();
    const channel = supabase
      .channel("employee-dtr-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dtr_submissions", filter: `user_id=eq.${user.id}` },
        loadSubmissions
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employee_documents", filter: `user_id=eq.${user.id}` },
        loadDocuments
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        loadDocuments
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSubmissions() {
    const { data, error } = await supabase
      .from("dtr_submissions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6);
    if (!error) {
      const withSignedUrls = await attachSignedUrls(data ?? [], "dtr-images");
      setSubmissions(withSignedUrls);
    }
  }

  async function loadDocuments() {
    setDocumentsLoading(true);

    const { data, error } = await supabase
      .from("employee_documents")
      .select("id,document_type,file_url,review_status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setDocumentsLoading(false);
      return;
    }

    let docs = await attachSignedUrls(data ?? [], "documents");
    docs = docs.map((document) => ({
      ...document,
      review_status: document.review_status || "Pending Review",
      source_table: "employee_documents",
      is_missing: false,
    }));

    if (profile?.signature_url) {
      const signatureRows = await attachSignedUrls(
        [
          {
            id: `signature-${user.id}`,
            document_type: "Signature",
            file_url: profile.signature_url,
            created_at: profile.created_at,
          },
        ],
        "documents"
      );
      docs = [
        ...signatureRows.map((document) => ({
          ...document,
          review_status: profile.signature_status || "Pending Review",
          source_table: "profiles",
          is_missing: false,
        })),
        ...docs,
      ];
    }

    const byType = new Map(docs.map((document) => [document.document_type, document]));
    const mergedDocs = REQUIRED_DOCUMENTS.map(
      (type) =>
        byType.get(type) || {
          id: `missing-${user.id}-${type}`,
          document_type: type,
          file_url: "",
          created_at: null,
          review_status: "Missing",
          preview_url: null,
          source_table: "virtual",
          is_missing: true,
        }
    );
    const extraDocs = docs.filter((document) => !REQUIRED_DOCUMENTS.includes(document.document_type));
    const nextDocuments = [...mergedDocs, ...extraDocs];

    setDocuments(nextDocuments);
    setActiveDocument((current) => nextDocuments.find((item) => item.id === current?.id) || null);
    setDocumentsLoading(false);
  }

  async function submitDtr() {
    if (!file) return toast.error("Please upload a DTR image.");
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("dtr-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("dtr_submissions").insert({
        user_id: user.id,
        cutoff,
        file_url: path,
        status: "Pending Review",
      });
      if (insertError) throw insertError;
      setFile(null);
      toast.success("DTR submitted successfully.");
      loadSubmissions();
    } catch (err) {
      toast.error(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  const person = useMemo(() => {
    return {
      full_name: profile?.full_name ?? "John Dela Cruz",
      role: profile?.position ?? profile?.role ?? "Janitor",
      employee_id: profile?.employee_id ?? "EMP-00124",
      location: profile?.location ?? "ABC Building",
    };
  }, [profile]);

  const summary = useMemo(() => {
    const pendingDtrs = submissions.filter((item) => item.status === "Pending Review").length;
    const approvedDtrs = submissions.filter((item) => item.status === "Approved").length;
    const verifiedDocs = documents.filter((item) => item.review_status === "Verified").length;
    const flaggedDocs = documents.filter(
      (item) => item.review_status === "Needs Reupload" || item.review_status === "Missing"
    ).length;

    return { pendingDtrs, approvedDtrs, verifiedDocs, flaggedDocs };
  }, [documents, submissions]);

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-slate-100 pb-24">
      <header className="sticky top-0 z-20 glass border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-bold text-white">OMGJ</div>
          <button className="relative rounded-full bg-white p-2 shadow">
            <Bell size={18} />
            {summary.flaggedDocs > 0 ? (
              <span className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] text-white">
                {summary.flaggedDocs}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <main className="space-y-4 p-4">
        <Card className="bg-gradient-to-r from-brand-500 to-brand-600 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-xl font-bold">
              {person.full_name
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("")}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{person.full_name}</h2>
              <p className="text-sm opacity-90">{person.role}</p>
              <p className="text-xs opacity-80">
                {person.employee_id} | {person.location}
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-slate-900 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Pending DTR</p>
            <p className="mt-2 text-2xl font-bold">{summary.pendingDtrs}</p>
            <p className="mt-1 text-xs text-slate-300">Waiting for payroll review</p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Approved DTR</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{summary.approvedDtrs}</p>
            <p className="mt-1 text-xs text-slate-500">Recent approved cutoffs</p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Verified Files</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{summary.verifiedDocs}</p>
            <p className="mt-1 text-xs text-slate-500">Docs cleared by admin</p>
          </Card>
          <Card className="bg-rose-50">
            <p className="text-xs uppercase tracking-[0.18em] text-rose-500">Needs Action</p>
            <p className="mt-2 text-2xl font-bold text-rose-600">{summary.flaggedDocs}</p>
            <p className="mt-1 text-xs text-rose-600">Missing or for reupload</p>
          </Card>
        </div>

        <Card>
          <h3 className="mb-3 text-base font-semibold">Submit DTR</h3>
          <div className="space-y-3">
            <Select value={cutoff} onChange={(e) => setCutoff(e.target.value)}>
              {cutoffOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-brand-400">
              <div className="mb-2 flex gap-2 text-slate-500">
                <Camera size={18} />
                <ImageUp size={18} />
              </div>
              <p className="text-sm text-slate-600">{file ? file.name : "Tap to upload DTR image"}</p>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0])} />
            </label>
            <Button className="w-full" loading={submitting} onClick={submitDtr}>
              Submit DTR
            </Button>
          </div>
        </Card>

        <div>
          <h3 className="mb-2 text-base font-semibold">Recent Submissions</h3>
          <div className="space-y-2">
            {submissions.map((row) => (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-white p-3 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</p>
                    <p className="text-sm font-medium text-slate-700">{row.cutoff}</p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              </motion.div>
            ))}
            {submissions.length === 0 ? <p className="text-sm text-slate-500">No submissions yet.</p> : null}
          </div>
        </div>

        <Card>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Document Status</h3>
              <p className="text-sm text-slate-500">Track uploaded requirements and signature review.</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
              <ShieldCheck size={18} />
            </div>
          </div>

          <div className="space-y-2">
            {documentsLoading ? <p className="text-sm text-slate-500">Loading documents...</p> : null}
            {!documentsLoading
              ? documents.map((document) => {
                  const Icon = getDocumentIcon(document.file_url);

                  return (
                    <button
                      key={document.id}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-brand-300 hover:bg-white"
                      onClick={() => setActiveDocument(document)}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-xl bg-white p-2 text-slate-600 shadow-sm">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{document.document_type}</p>
                          <p className="truncate text-xs text-slate-500">
                            {document.created_at
                              ? new Date(document.created_at).toLocaleString()
                              : document.is_missing
                              ? "Upload required"
                              : "Waiting for timestamp"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={document.review_status} />
                    </button>
                  );
                })
              : null}
            {!documentsLoading && documents.length === 0 ? (
              <p className="text-sm text-slate-500">No uploaded documents found yet.</p>
            ) : null}
          </div>
        </Card>
      </main>

      <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-md -translate-x-1/2 items-center justify-around border-t border-slate-200 bg-white px-2 py-2">
        <Nav icon={LayoutDashboard} label="Dashboard" />
        <Nav icon={ListChecks} label="Tasks" />
        <button className="-mt-8 rounded-full bg-brand-500 p-4 text-white shadow-lg shadow-brand-500/30">
          <UploadCloud size={20} />
        </button>
        <Nav icon={MessageSquareText} label="Messages" />
        <Nav icon={MoreHorizontal} label="More" />
      </nav>

      <Modal
        open={Boolean(activeDocument)}
        onClose={() => setActiveDocument(null)}
        title={activeDocument?.document_type || "Document Preview"}
      >
        {activeDocument ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{activeDocument.document_type}</p>
                  <StatusBadge status={activeDocument.review_status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {activeDocument.created_at
                    ? new Date(activeDocument.created_at).toLocaleString()
                    : "No upload record available yet."}
                </p>
              </div>
              {activeDocument.preview_url ? (
                <a
                  href={activeDocument.preview_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink size={16} />
                  Open File
                </a>
              ) : null}
            </div>

            {activeDocument.preview_url ? (
              isPdfFile(activeDocument.file_url) ? (
                <iframe
                  title={activeDocument.document_type}
                  src={activeDocument.preview_url}
                  className="h-[60vh] w-full rounded-2xl border border-slate-200"
                />
              ) : (
                <img
                  src={activeDocument.preview_url}
                  alt={activeDocument.document_type}
                  className="max-h-[60vh] w-full rounded-2xl border border-slate-200 object-contain"
                />
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                {activeDocument.is_missing
                  ? "This requirement has not been uploaded yet."
                  : "Preview is currently unavailable for this file."}
              </div>
            )}

            {activeDocument.review_status === "Needs Reupload" ? (
              <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
                This file was flagged for reupload. Replace it from onboarding or the upload flow once that screen is added.
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Nav({ icon: Icon, label }) {
  return (
    <button className="flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:text-brand-600">
      <Icon size={17} />
      {label}
    </button>
  );
}
