// src/Tabs/AdminDocumentRequests.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import { FileText, Plus, Search, RefreshCw, Download, Eye, Check, X, Clock, AlertTriangle, CheckCircle, XCircle, Send, Trash2, FileUp, Info } from "lucide-react";

type DocStatus = "pending" | "uploaded" | "approved" | "rejected";
type DocPriority = "low" | "medium" | "high" | "urgent";

interface DocRequest { id: string; clientId: string; clientName: string; clientEmail: string; requestedBy: string; requestedByName: string; documentName: string; description: string; category: string; priority: DocPriority; status: DocStatus; dueDate?: string; createdAt: string; updatedAt: string; uploadedDocumentId?: string; uploadedDocumentName?: string; uploadedAt?: string; uploadedBy?: string; reviewedAt?: string; reviewedBy?: string; reviewNotes?: string; projectId?: string; projectName?: string; }
interface DocUpload { id: string; requestId?: string; clientId: string; fileName: string; fileSize: number; fileType: string; uploadedBy: string; uploadedAt: string; base64?: string; status: "pending_review" | "approved" | "rejected"; reviewedBy?: string; reviewedAt?: string; reviewNotes?: string; projectId?: string; projectName?: string; category?: string; }
interface User { customerId: string; clientCode: string; firstName: string; lastName: string; email: string; }
interface Toast { id: string; message: string; type: "success" | "error" | "info"; }

const STORE = { REQ: "timely_document_requests", UPL: "timely_document_uploads" };
const CATS = [{ v: "tax", l: "Tax Documents" }, { v: "legal", l: "Legal" }, { v: "financial", l: "Financial" }, { v: "identity", l: "Identity" }, { v: "contract", l: "Contracts" }, { v: "report", l: "Reports" }, { v: "other", l: "Other" }];
const genId = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
const relTime = (d: string) => { const diff = Date.now() - new Date(d).getTime(); const m = Math.floor(diff / 60000); if (m < 1) return "Just now"; if (m < 60) return `${m}m ago`; const h = Math.floor(diff / 3600000); if (h < 24) return `${h}h ago`; const days = Math.floor(diff / 86400000); if (days === 1) return "Yesterday"; if (days < 7) return `${days}d ago`; return fmtDate(d); };
const priColor = (p: DocPriority) => ({ urgent: "bg-red-500/20 text-red-400", high: "bg-orange-500/20 text-orange-400", medium: "bg-amber-500/20 text-amber-400", low: "bg-emerald-500/20 text-emerald-400" }[p] || "bg-gray-500/20 text-gray-400");
const statColor = (s: DocStatus) => ({ pending: "bg-amber-500/20 text-amber-400", uploaded: "bg-blue-500/20 text-blue-400", approved: "bg-emerald-500/20 text-emerald-400", rejected: "bg-red-500/20 text-red-400" }[s] || "bg-gray-500/20 text-gray-400");
const uplStatColor = (s: string) => s === "approved" ? "bg-emerald-500/20 text-emerald-400" : s === "rejected" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400";

const ReqAPI = {
    getAll: (): DocRequest[] => { try { return JSON.parse(localStorage.getItem(STORE.REQ) || "[]"); } catch { return []; } },
    save: (d: DocRequest[]) => localStorage.setItem(STORE.REQ, JSON.stringify(d)),
    create: (r: Omit<DocRequest, "id" | "createdAt" | "updatedAt" | "status">): DocRequest => { const nr: DocRequest = { ...r, id: genId("docreq"), status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; const all = ReqAPI.getAll(); all.push(nr); ReqAPI.save(all); return nr; },
    update: (id: string, u: Partial<DocRequest>) => { const all = ReqAPI.getAll(); const i = all.findIndex(r => r.id === id); if (i === -1) return null; all[i] = { ...all[i], ...u, updatedAt: new Date().toISOString() }; ReqAPI.save(all); return all[i]; },
    approve: (id: string, by: string, notes?: string) => ReqAPI.update(id, { status: "approved", reviewedAt: new Date().toISOString(), reviewedBy: by, reviewNotes: notes }),
    reject: (id: string, by: string, notes: string) => ReqAPI.update(id, { status: "rejected", reviewedAt: new Date().toISOString(), reviewedBy: by, reviewNotes: notes }),
    delete: (id: string) => { const all = ReqAPI.getAll().filter(r => r.id !== id); ReqAPI.save(all); },
};

const UplAPI = {
    getAll: (): DocUpload[] => { try { return JSON.parse(localStorage.getItem(STORE.UPL) || "[]"); } catch { return []; } },
    save: (d: DocUpload[]) => localStorage.setItem(STORE.UPL, JSON.stringify(d)),
    update: (id: string, u: Partial<DocUpload>) => { const all = UplAPI.getAll(); const i = all.findIndex(x => x.id === id); if (i === -1) return null; all[i] = { ...all[i], ...u }; UplAPI.save(all); return all[i]; },
    approve: (id: string, by: string, notes?: string) => UplAPI.update(id, { status: "approved", reviewedBy: by, reviewedAt: new Date().toISOString(), reviewNotes: notes }),
    reject: (id: string, by: string, notes: string) => UplAPI.update(id, { status: "rejected", reviewedBy: by, reviewedAt: new Date().toISOString(), reviewNotes: notes }),
};

interface Props { onNavigate?: (page: string) => void; adminEmail?: string; adminName?: string; }

const AdminDocumentRequests: React.FC<Props> = ({ onNavigate, adminEmail = "admin@timely.com", adminName = "Admin" }) => {
    const { isDark } = useTheme();

    const n = {
        bg: isDark ? "neu-bg-dark" : "neu-bg-light", card: isDark ? "neu-dark" : "neu-light",
        flat: isDark ? "neu-dark-flat" : "neu-light-flat", inset: isDark ? "neu-dark-inset" : "neu-light-inset",
        pressed: isDark ? "neu-dark-pressed" : "neu-light-pressed",
        text: isDark ? "text-white" : "text-gray-900", secondary: isDark ? "text-gray-300" : "text-gray-600",
        tertiary: isDark ? "text-gray-500" : "text-gray-400", strong: isDark ? "text-white" : "text-black",
        label: isDark ? "text-blue-400" : "text-blue-600",
        badge: isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700",
        input: isDark ? "bg-transparent border-gray-700 text-white" : "bg-transparent border-gray-300 text-gray-900",
        modal: isDark ? "bg-[#111111] border-gray-800" : "bg-[#f0f0f0] border-gray-300",
        modalHead: isDark ? "bg-[#111111]" : "bg-[#f0f0f0]",
        btnPrimary: "bg-blue-600 hover:bg-blue-500 text-white", btnSecondary: isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        btnDanger: "bg-red-600 hover:bg-red-500 text-white", divider: isDark ? "border-gray-800" : "border-gray-200",
        edgeHover: isDark ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]" : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]",
        edgeHoverFlat: isDark ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),4px_4px_10px_rgba(0,0,0,0.6),-4px_-4px_10px_rgba(40,40,40,0.1)]" : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),4px_4px_10px_rgba(0,0,0,0.08),-4px_-4px_10px_rgba(255,255,255,0.9)]",
    };

    const [requests, setRequests] = useState<DocRequest[]>([]);
    const [uploads, setUploads] = useState<DocUpload[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"requests" | "uploads">("requests");
    const [filterStatus, setFilterStatus] = useState<"all" | DocStatus>("all");
    const [searchQ, setSearchQ] = useState("");
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [selReq, setSelReq] = useState<DocRequest | null>(null);
    const [selUpl, setSelUpl] = useState<DocUpload | null>(null);
    const [fClientId, setFClientId] = useState(""); const [fDocName, setFDocName] = useState(""); const [fDesc, setFDesc] = useState(""); const [fCat, setFCat] = useState("other"); const [fPri, setFPri] = useState<DocPriority>("medium"); const [fDue, setFDue] = useState("");
    const [reviewNotes, setReviewNotes] = useState("");

    const showToast = (msg: string, type: "success" | "error" | "info" = "success") => { const id = `t_${Date.now()}`; setToasts(p => [...p, { id, message: msg, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000); };

    const loadData = async () => { setLoading(true); try { const r = await fetch(`/api/orgs/me`); if (r.ok) { const d = await r.json(); setUsers(d.data || []); } } catch {} setRequests(ReqAPI.getAll()); setUploads(UplAPI.getAll()); setLoading(false); };
    useEffect(() => { loadData(); }, []);

    const filteredReqs = useMemo(() => { let r = requests; if (filterStatus !== "all") r = r.filter(x => x.status === filterStatus); if (searchQ.trim()) { const q = searchQ.toLowerCase(); r = r.filter(x => x.documentName.toLowerCase().includes(q) || x.clientName.toLowerCase().includes(q) || x.description.toLowerCase().includes(q)); } return r.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); }, [requests, filterStatus, searchQ]);
    const filteredUpls = useMemo(() => { let r = uploads; if (searchQ.trim()) { const q = searchQ.toLowerCase(); r = r.filter(u => u.fileName.toLowerCase().includes(q) || u.uploadedBy.toLowerCase().includes(q)); } return r.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()); }, [uploads, searchQ]);

    const stats = useMemo(() => ({ total: requests.length, pending: requests.filter(r => r.status === "pending").length, uploaded: requests.filter(r => r.status === "uploaded").length, pendingUpl: uploads.filter(u => u.status === "pending_review").length, urgent: requests.filter(r => r.priority === "urgent" && r.status === "pending").length }), [requests, uploads]);
    const getClient = (cid: string) => { const u = users.find(x => x.customerId === cid); return u ? { name: `${u.firstName} ${u.lastName}`, email: u.email } : { name: "Unknown", email: "" }; };
    const fmtSize = (s: number) => s < 1024 ? `${s} B` : s < 1048576 ? `${(s / 1024).toFixed(1)} KB` : `${(s / 1048576).toFixed(1)} MB`;

    const createRequest = () => {
        if (!fClientId || !fDocName.trim()) { showToast("Client and document name required", "error"); return; }
        const ci = getClient(fClientId);
        const nr = ReqAPI.create({ clientId: fClientId, clientName: ci.name, clientEmail: ci.email, requestedBy: adminEmail, requestedByName: adminName, documentName: fDocName.trim(), description: fDesc.trim(), category: fCat, priority: fPri, dueDate: fDue || undefined });
        setRequests([...requests, nr]);
        // Notify client
        const mk = `timely_client_messages_${nr.clientId}`; const msgs = JSON.parse(localStorage.getItem(mk) || "[]");
        msgs.push({ id: genId("msg"), threadId: `thread_docreq_${nr.id}`, from: { name: adminName, email: adminEmail, role: "admin" }, to: { name: nr.clientName, email: nr.clientEmail }, subject: `Document Request: ${nr.documentName}`, body: `Hello,\n\nWe need you to upload: ${nr.documentName}\n\n${nr.description || ""}\n\nPlease go to Documents section.\n\nThank you,\n${adminName}`, timestamp: new Date().toISOString(), read: false, starred: false, archived: false, deleted: false });
        localStorage.setItem(mk, JSON.stringify(msgs));
        setFClientId(""); setFDocName(""); setFDesc(""); setFCat("other"); setFPri("medium"); setFDue(""); setShowCreateModal(false);
        showToast("Request sent to client");
    };

    const handleApprove = (type: "request" | "upload", id: string) => {
        if (type === "request") { ReqAPI.approve(id, adminEmail, reviewNotes); setRequests(ReqAPI.getAll()); }
        else if (selUpl) { UplAPI.approve(id, adminEmail, reviewNotes); setUploads(UplAPI.getAll()); if (selUpl.requestId) { ReqAPI.approve(selUpl.requestId, adminEmail, reviewNotes); setRequests(ReqAPI.getAll()); } }
        setShowReviewModal(false); setReviewNotes(""); showToast("Approved");
    };

    const handleReject = (type: "request" | "upload", id: string) => {
        if (!reviewNotes.trim()) { showToast("Rejection reason required", "error"); return; }
        if (type === "request") { ReqAPI.reject(id, adminEmail, reviewNotes); setRequests(ReqAPI.getAll()); }
        else if (selUpl) { UplAPI.reject(id, adminEmail, reviewNotes); setUploads(UplAPI.getAll()); if (selUpl.requestId) { ReqAPI.reject(selUpl.requestId, adminEmail, reviewNotes); setRequests(ReqAPI.getAll()); } }
        setShowReviewModal(false); setReviewNotes(""); showToast("Rejected");
    };

    const deleteReq = (id: string) => { if (confirm("Delete this request?")) { ReqAPI.delete(id); setRequests(ReqAPI.getAll()); showToast("Deleted"); } };
    const handleDl = (u: DocUpload) => { if (u.base64) { const a = document.createElement("a"); a.href = u.base64; a.download = u.fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); showToast(`Downloading ${u.fileName}`); } else showToast("File unavailable", "error"); };

    return (
        <div className="space-y-8">
            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">{toasts.map(t => (<div key={t.id} className={`${n.card} flex items-center gap-3 px-4 py-3 rounded-xl text-sm animate-fadeIn`}>{t.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === "error" ? <XCircle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}<span>{t.message}</span><button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className={n.tertiary}><X className="w-3.5 h-3.5" /></button></div>))}</div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div><h2 className={`text-lg font-semibold ${n.strong}`}>Document Requests</h2><p className={`text-sm ${n.secondary}`}>Request and manage client documents</p></div>
                <div className="flex items-center gap-2">
                    <button onClick={loadData} className={`w-9 h-9 ${n.flat} flex items-center justify-center ${loading ? "animate-spin" : ""}`}><RefreshCw className={`w-4 h-4 ${n.secondary}`} /></button>
                    <button onClick={() => setShowCreateModal(true)} className={`${n.btnPrimary} px-4 py-2.5 rounded-xl text-sm flex items-center gap-2`}><Plus className="w-4 h-4" />Request</button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[{ l: "Total", v: stats.total, icon: FileText, c: "" }, { l: "Awaiting", v: stats.pending, icon: Clock, c: "text-amber-400" }, { l: "Uploaded", v: stats.uploaded, icon: FileUp, c: n.label }, { l: "Review", v: stats.pendingUpl, icon: Eye, c: "text-purple-400" }, { l: "Urgent", v: stats.urgent, icon: AlertTriangle, c: "text-red-400" }].map((s, i) => (
                    <div key={i} className={`${n.card} ${n.edgeHover} p-4 transition-all duration-200`}>
                        <div className="flex items-center justify-between"><s.icon className={`w-4 h-4 ${s.c || n.tertiary}`} /><span className={`text-xl font-semibold ${s.c || n.strong}`}>{s.v}</span></div>
                        <p className={`text-[11px] ${n.tertiary} mt-1`}>{s.l}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className={`${n.card} p-0.5 flex rounded-xl w-fit`}>
                    {[{ id: "requests", l: "Requests" }, { id: "uploads", l: "Uploads" }].map(v => (<button key={v.id} onClick={() => setViewMode(v.id as any)} className={`px-5 py-2.5 text-sm rounded-xl transition-all ${viewMode === v.id ? n.btnPrimary : n.secondary}`}>{v.l}</button>))}
                </div>
                <div className={`flex-1 ${n.flat} flex items-center gap-2 px-4 py-2.5`}><Search className={`w-4 h-4 ${n.tertiary}`} /><input type="text" placeholder="Search..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} /></div>
                {viewMode === "requests" && <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className={`px-3 py-2 ${n.input} border rounded-xl text-sm`}><option value="all">All</option><option value="pending">Pending</option><option value="uploaded">Uploaded</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>}
            </div>

            {/* Requests List */}
            {viewMode === "requests" && (
                <div className={`${n.card} p-1.5 space-y-1.5`}>
                    <div className={`${n.flat} grid grid-cols-12 gap-4 px-4 py-3`}><div className={`col-span-3 text-xs ${n.label}`}>Document</div><div className={`col-span-2 text-xs ${n.label}`}>Client</div><div className={`col-span-1 text-xs ${n.label}`}>Priority</div><div className={`col-span-2 text-xs ${n.label}`}>Status</div><div className={`col-span-2 text-xs ${n.label}`}>Due</div><div className={`col-span-2 text-xs ${n.label} text-right`}>Actions</div></div>
                    {filteredReqs.length === 0 ? <div className={`${n.flat} text-center py-12`}><FileText className={`w-8 h-8 ${n.tertiary} mx-auto mb-2`} /><p className={`text-sm ${n.secondary}`}>No requests</p></div> : filteredReqs.map(r => (
                        <div key={r.id} className={`${n.flat} ${n.edgeHoverFlat} grid grid-cols-12 gap-4 px-4 py-3.5 transition-all duration-200`}>
                            <div className="col-span-3 flex items-center gap-3"><div className={`w-9 h-9 ${n.inset} rounded-xl flex items-center justify-center`}><FileText className={`w-4 h-4 ${n.tertiary}`} /></div><div className="min-w-0"><p className={`${n.text} text-sm font-medium truncate`}>{r.documentName}</p><p className={`${n.tertiary} text-[10px]`}>{r.category} · {relTime(r.createdAt)}</p></div></div>
                            <div className="col-span-2 flex items-center"><div className="min-w-0"><p className={`${n.text} text-sm truncate`}>{r.clientName}</p><p className={`${n.tertiary} text-[10px] truncate`}>{r.clientEmail}</p></div></div>
                            <div className="col-span-1 flex items-center"><span className={`text-[10px] px-2 py-0.5 rounded-lg ${priColor(r.priority)}`}>{r.priority}</span></div>
                            <div className="col-span-2 flex items-center"><span className={`text-[10px] px-2 py-0.5 rounded-lg ${statColor(r.status)}`}>{r.status}</span></div>
                            <div className="col-span-2 flex items-center"><span className={`${n.tertiary} text-sm`}>{r.dueDate ? fmtDate(r.dueDate) : "—"}</span></div>
                            <div className="col-span-2 flex items-center justify-end gap-1">
                                {r.status === "uploaded" && <button onClick={() => { setSelReq(r); setShowReviewModal(true); }} className={`p-1.5 ${n.flat} rounded-lg text-blue-400`}><Eye className="w-3.5 h-3.5" /></button>}
                                <button onClick={() => deleteReq(r.id)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Uploads List */}
            {viewMode === "uploads" && (
                <div className={`${n.card} p-1.5 space-y-1.5`}>
                    <div className={`${n.flat} grid grid-cols-12 gap-4 px-4 py-3`}><div className={`col-span-3 text-xs ${n.label}`}>File</div><div className={`col-span-2 text-xs ${n.label}`}>By</div><div className={`col-span-2 text-xs ${n.label}`}>Size</div><div className={`col-span-2 text-xs ${n.label}`}>Status</div><div className={`col-span-1 text-xs ${n.label}`}>When</div><div className={`col-span-2 text-xs ${n.label} text-right`}>Actions</div></div>
                    {filteredUpls.length === 0 ? <div className={`${n.flat} text-center py-12`}><FileUp className={`w-8 h-8 ${n.tertiary} mx-auto mb-2`} /><p className={`text-sm ${n.secondary}`}>No uploads</p></div> : filteredUpls.map(u => (
                        <div key={u.id} className={`${n.flat} ${n.edgeHoverFlat} grid grid-cols-12 gap-4 px-4 py-3.5 transition-all duration-200`}>
                            <div className="col-span-3 flex items-center gap-3"><FileText className={`w-4 h-4 ${n.tertiary}`} /><div className="min-w-0"><p className={`${n.text} text-sm font-medium truncate`}>{u.fileName}</p><p className={`${n.tertiary} text-[10px]`}>{u.fileType}</p></div></div>
                            <div className="col-span-2 flex items-center"><span className={`${n.text} text-sm truncate`}>{u.uploadedBy}</span></div>
                            <div className="col-span-2 flex items-center"><span className={`${n.secondary} text-sm`}>{fmtSize(u.fileSize)}</span></div>
                            <div className="col-span-2 flex items-center"><span className={`text-[10px] px-2 py-0.5 rounded-lg ${uplStatColor(u.status)}`}>{u.status.replace("_", " ")}</span></div>
                            <div className="col-span-1 flex items-center"><span className={`${n.tertiary} text-xs`}>{relTime(u.uploadedAt)}</span></div>
                            <div className="col-span-2 flex items-center justify-end gap-1">
                                <button onClick={() => handleDl(u)} className={`p-1.5 ${n.flat} rounded-lg`}><Download className={`w-3.5 h-3.5 ${n.secondary}`} /></button>
                                {u.status === "pending_review" && <button onClick={() => { setSelUpl(u); setShowReviewModal(true); }} className={`p-1.5 ${n.flat} rounded-lg text-blue-400`}><Eye className="w-3.5 h-3.5" /></button>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}><h3 className={`text-lg font-semibold ${n.text}`}>Request Document</h3><button onClick={() => setShowCreateModal(false)} className={`p-2 rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-200"}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button></div>
                        <div className="p-5 space-y-4">
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Client *</label><select value={fClientId} onChange={e => setFClientId(e.target.value)} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="">Select...</option>{users.map(u => <option key={u.customerId} value={u.customerId}>{u.firstName} {u.lastName} ({u.email})</option>)}</select></div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Document Name *</label><input type="text" value={fDocName} onChange={e => setFDocName(e.target.value)} placeholder="e.g. W-2 Form 2024" className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} /></div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Description</label><textarea value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Details..." rows={3} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Category</label><select value={fCat} onChange={e => setFCat(e.target.value)} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}>{CATS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}</select></div>
                                <div><label className={`${n.label} text-[11px] block mb-1`}>Priority</label><select value={fPri} onChange={e => setFPri(e.target.value as DocPriority)} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
                            </div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Due Date</label><input type="date" value={fDue} onChange={e => setFDue(e.target.value)} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                            <div className="flex gap-3 pt-2"><button onClick={() => setShowCreateModal(false)} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button><button onClick={createRequest} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center justify-center gap-2`}><Send className="w-3.5 h-3.5" />Send</button></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {showReviewModal && (selReq || selUpl) && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-lg w-full`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center justify-between ${n.modalHead}`}><h3 className={`text-lg font-semibold ${n.text}`}>Review Document</h3><button onClick={() => { setShowReviewModal(false); setSelReq(null); setSelUpl(null); setReviewNotes(""); }} className={`p-2 rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-gray-200"}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button></div>
                        <div className="p-5 space-y-4">
                            {selReq && (<div className={`${n.flat} p-4`}><p className={`${n.text} font-medium text-sm`}>{selReq.documentName}</p><p className={`${n.tertiary} text-xs mt-1`}>From: {selReq.clientName}</p>{selReq.uploadedDocumentName && <p className={`${n.secondary} text-xs mt-2`}>📎 {selReq.uploadedDocumentName}</p>}</div>)}
                            {selUpl && (<div className={`${n.flat} p-4`}><p className={`${n.text} font-medium text-sm`}>{selUpl.fileName}</p><p className={`${n.tertiary} text-xs mt-1`}>By: {selUpl.uploadedBy}</p>{selUpl.base64 && <button onClick={() => handleDl(selUpl)} className={`mt-2 text-xs ${n.link} flex items-center gap-1`}><Download className="w-3.5 h-3.5" />Download</button>}</div>)}
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Notes</label><textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Required for rejection..." rows={3} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500`} /></div>
                            <div className="flex gap-3">
                                <button onClick={() => handleReject(selReq ? "request" : "upload", selReq?.id || selUpl?.id || "")} className={`flex-1 px-4 py-2.5 ${n.btnDanger} rounded-xl text-sm flex items-center justify-center gap-2`}><XCircle className="w-3.5 h-3.5" />Reject</button>
                                <button onClick={() => handleApprove(selReq ? "request" : "upload", selReq?.id || selUpl?.id || "")} className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm flex items-center justify-center gap-2"><CheckCircle className="w-3.5 h-3.5" />Approve</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDocumentRequests;