// src/ClientPortal_views/ClientDocuments.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    FileText, Upload, Download, Trash2, FolderOpen, FolderPlus, File,
    Image, FileSpreadsheet, FileCode, Film, Music, Archive, Search,
    Grid, List, X, ChevronRight, Eye, Clock, HardDrive, CheckCircle,
    AlertCircle, RefreshCw, Home, Edit3, Bell, Calendar, Tag,
    Star, Info,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientDocumentsProps = { userName?: string; userEmail?: string; customerId?: string; };
type DocumentRequestStatus   = "pending" | "uploaded" | "approved" | "rejected";
type DocumentRequestPriority = "low" | "medium" | "high" | "urgent";
type ViewMode = "grid" | "list";
type SortBy   = "name" | "date" | "size" | "type";
type TabType  = "files" | "requests";

interface DocumentRequest {
    id: string; clientId: string; clientName: string; clientEmail: string;
    requestedBy: string; requestedByName: string;
    documentName: string; description: string; category: string;
    priority: DocumentRequestPriority; status: DocumentRequestStatus;
    dueDate?: string; createdAt: string; updatedAt: string;
    uploadedDocumentId?: string; uploadedDocumentName?: string;
    uploadedAt?: string; uploadedBy?: string;
    reviewedAt?: string; reviewedBy?: string; reviewNotes?: string;
}

interface DocumentFile {
    id: string; name: string; size: number; type: string;
    folderId: string | null; uploadedBy: string; uploadedAt: string;
    base64?: string; requestId?: string;
    status?: "pending_review" | "approved" | "rejected";
}

interface Folder { id: string; name: string; parentId: string | null; createdAt: string; }
interface Toast  { id: string; message: string; type: "success" | "error" | "info"; }

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
    DOCUMENT_REQUESTS: "timely_document_requests",
    DOCUMENT_UPLOADS:  "timely_document_uploads",
    CLIENT_DOCUMENTS:  "timely_client_documents",
    CLIENT_FOLDERS:    "timely_client_folders",
};

const DOCUMENT_CATEGORIES = [
    { value: "tax",       label: "Tax Documents" },
    { value: "legal",     label: "Legal Documents" },
    { value: "financial", label: "Financial Records" },
    { value: "identity",  label: "Identity Verification" },
    { value: "contract",  label: "Contracts & Agreements" },
    { value: "report",    label: "Reports" },
    { value: "other",     label: "Other" },
];

const genId = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
const fmtShort = (d: string) => {
    const dt = new Date(d); const now = new Date(); const diff = now.getTime() - dt.getTime();
    if (diff < 86400000) return dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return dt.toLocaleDateString("en-US", { weekday: "short" });
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const fmtRelative = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 172800000) return "Yesterday";
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return fmtDate(d);
};
const fmtSize = (b: number) => { if (!b) return "0 B"; const k = 1024; const u = ["B","KB","MB","GB"]; const i = Math.floor(Math.log(b) / Math.log(k)); return `${(b / Math.pow(k, i)).toFixed(1)} ${u[i]}`; };

const priorityColor = (p: DocumentRequestPriority) => ({
    urgent: { bg: "bg-red-500/10 text-red-400",    well: "bg-red-600" },
    high:   { bg: "bg-orange-500/10 text-orange-400", well: "bg-orange-600" },
    medium: { bg: "bg-amber-500/10 text-amber-400",   well: "bg-amber-600" },
    low:    { bg: "bg-emerald-500/10 text-emerald-400", well: "bg-emerald-600" },
}[p] || { bg: "bg-amber-500/10 text-amber-400", well: "bg-amber-600" });

const statusColor = (s: DocumentRequestStatus) => ({
    pending:  "bg-amber-500/10 text-amber-400",
    uploaded: "bg-blue-500/10 text-blue-400",
    approved: "bg-emerald-500/10 text-emerald-400",
    rejected: "bg-red-500/10 text-red-400",
}[s]);

const fileIcon = (type: string, name: string): { icon: React.ComponentType<{ className?: string }>; color: string } => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (type.startsWith("image/") || ["jpg","jpeg","png","gif","webp","svg"].includes(ext)) return { icon: Image,           color: "bg-pink-600" };
    if (type.includes("spreadsheet") || ["xlsx","xls","csv"].includes(ext))                 return { icon: FileSpreadsheet, color: "bg-emerald-600" };
    if (type.includes("pdf") || ext === "pdf")                                              return { icon: FileText,        color: "bg-red-600" };
    if (type.includes("video") || ["mp4","mov","avi","mkv"].includes(ext))                  return { icon: Film,            color: "bg-blue-600" };
    if (type.includes("audio") || ["mp3","wav","ogg"].includes(ext))                        return { icon: Music,           color: "bg-amber-600" };
    if (type.includes("zip")   || ["zip","rar","7z","tar","gz"].includes(ext))              return { icon: Archive,         color: "bg-gray-600" };
    if (["js","ts","jsx","tsx","html","css","json","py","java"].includes(ext))              return { icon: FileCode,        color: "bg-blue-600" };
    return { icon: File, color: "bg-gray-600" };
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

const DocumentRequestAPI = {
    getForClient: (clientId: string): DocumentRequest[] => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCUMENT_REQUESTS) || "[]").filter((r: DocumentRequest) => String(r.clientId) === String(clientId)); }
        catch { return []; }
    },
    markAsUploaded: (id: string, info: { documentId: string; documentName: string; uploadedBy: string }) => {
        try {
            const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCUMENT_REQUESTS) || "[]");
            const i = all.findIndex((r: DocumentRequest) => r.id === id);
            if (i !== -1) { all[i] = { ...all[i], status: "uploaded", uploadedDocumentId: info.documentId, uploadedDocumentName: info.documentName, uploadedAt: new Date().toISOString(), uploadedBy: info.uploadedBy, updatedAt: new Date().toISOString() }; localStorage.setItem(STORAGE_KEYS.DOCUMENT_REQUESTS, JSON.stringify(all)); }
        } catch {}
    },
};

// ─── Component ────────────────────────────────────────────────────────────────

const ClientDocuments: React.FC<ClientDocumentsProps> = ({
    userName = "Client", userEmail = "", customerId = "",
}) => {
    const { isDark } = useTheme();

    const n = {
        bg:           isDark ? "neu-bg-dark"       : "neu-bg-light",
        card:         isDark ? "neu-dark"           : "neu-light",
        flat:         isDark ? "neu-dark-flat"      : "neu-light-flat",
        inset:        isDark ? "neu-dark-inset"     : "neu-light-inset",
        pressed:      isDark ? "neu-dark-pressed"   : "neu-light-pressed",
        text:         isDark ? "text-white"         : "text-gray-900",
        secondary:    isDark ? "text-gray-300"      : "text-gray-600",
        tertiary:     isDark ? "text-gray-500"      : "text-gray-400",
        strong:       isDark ? "text-white"         : "text-black",
        label:        isDark ? "text-blue-400"      : "text-blue-600",
        divider:      isDark ? "border-gray-800"    : "border-gray-200",
        modal:        isDark ? "bg-[#111111] border-gray-800" : "bg-[#e4e4e4] border-gray-300",
        modalHead:    isDark ? "bg-[#111111]"       : "bg-[#e4e4e4]",
        input:        isDark ? "bg-transparent border-gray-700 text-white" : "bg-transparent border-gray-300 text-gray-900",
        btnPrimary:   "bg-blue-600 hover:bg-blue-500 text-white",
        btnSecondary: isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        btnDanger:    "bg-red-600 hover:bg-red-500 text-white",
        rowHover:     isDark ? "hover:bg-gray-800/60" : "hover:bg-black/5",
        edgeHover: isDark
            ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]"
            : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]",
    };

    const [activeTab,      setActiveTab]      = useState<TabType>("files");
    const [files,          setFiles]          = useState<DocumentFile[]>([]);
    const [folders,        setFolders]        = useState<Folder[]>([]);
    const [docRequests,    setDocRequests]    = useState<DocumentRequest[]>([]);
    const [loading,        setLoading]        = useState(true);
    const [currentFolder,  setCurrentFolder]  = useState<string | null>(null);
    const [viewMode,       setViewMode]       = useState<ViewMode>("grid");
    const [sortBy,         setSortBy]         = useState<SortBy>("date");
    const [searchQuery,    setSearchQuery]    = useState("");
    const [selectedFiles,  setSelectedFiles]  = useState<Set<string>>(new Set());
    const [toasts,         setToasts]         = useState<Toast[]>([]);
    const [uploading,      setUploading]      = useState(false);
    const [uploadPct,      setUploadPct]      = useState(0);
    const [dragOver,       setDragOver]       = useState(false);

    const [showNewFolder,  setShowNewFolder]  = useState(false);
    const [folderName,     setFolderName]     = useState("");
    const [previewFile,    setPreviewFile]    = useState<DocumentFile | null>(null);
    const [renameFile,     setRenameFile]     = useState<DocumentFile | null>(null);
    const [renameVal,      setRenameVal]      = useState("");
    const [uploadReq,      setUploadReq]      = useState<DocumentRequest | null>(null);

    const fileRef    = useRef<HTMLInputElement>(null);
    const reqFileRef = useRef<HTMLInputElement>(null);

    const showToast = (message: string, type: Toast["type"] = "success") => {
        const id = genId("t");
        setToasts(p => [...p, { id, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    useEffect(() => {
        setLoading(true);
        try {
            const sf = localStorage.getItem(`${STORAGE_KEYS.CLIENT_DOCUMENTS}_${customerId}`);
            const sd = localStorage.getItem(`${STORAGE_KEYS.CLIENT_FOLDERS}_${customerId}`);
            if (sf) setFiles(JSON.parse(sf));
            if (sd) setFolders(JSON.parse(sd));
        } catch {} finally { setLoading(false); }
        setDocRequests(DocumentRequestAPI.getForClient(customerId));
    }, [customerId]);

    const saveFiles   = (f: DocumentFile[]) => { setFiles(f);   localStorage.setItem(`${STORAGE_KEYS.CLIENT_DOCUMENTS}_${customerId}`, JSON.stringify(f)); };
    const saveFolders = (f: Folder[])       => { setFolders(f); localStorage.setItem(`${STORAGE_KEYS.CLIENT_FOLDERS}_${customerId}`,   JSON.stringify(f)); };

    const handleUpload = async (fileList: FileList | null, requestId?: string) => {
        if (!fileList?.length) return;
        setUploading(true); setUploadPct(0);
        const newFiles: DocumentFile[] = [];
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            if (file.size > 10 * 1024 * 1024) { showToast(`${file.name} exceeds 10MB`, "error"); continue; }
            const base64 = await new Promise<string>(res => { const r = new FileReader(); r.onloadend = () => res(r.result as string); r.readAsDataURL(file); });
            newFiles.push({ id: genId("file"), name: file.name, size: file.size, type: file.type || "application/octet-stream", folderId: currentFolder, uploadedBy: userName, uploadedAt: new Date().toISOString(), base64, requestId, status: requestId ? "pending_review" : undefined });
            const uploads = JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCUMENT_UPLOADS) || "[]");
            uploads.push({ id: genId("docup"), requestId, clientId: customerId, fileName: file.name, fileSize: file.size, fileType: file.type, uploadedBy: userName, base64, uploadedAt: new Date().toISOString(), status: "pending_review" });
            localStorage.setItem(STORAGE_KEYS.DOCUMENT_UPLOADS, JSON.stringify(uploads));
            setUploadPct(Math.round(((i + 1) / fileList.length) * 100));
        }
        if (newFiles.length > 0) {
            saveFiles([...files, ...newFiles]);
            if (requestId && uploadReq) {
                DocumentRequestAPI.markAsUploaded(requestId, { documentId: newFiles[0].id, documentName: newFiles[0].name, uploadedBy: userName });
                const notifs = JSON.parse(localStorage.getItem("timely_admin_notifications") || "[]");
                notifs.push({ id: genId("notif"), type: "document_uploaded", clientId: customerId, clientName: userName, requestId, documentName: newFiles[0].name, requestedDocument: uploadReq.documentName, timestamp: new Date().toISOString(), read: false });
                localStorage.setItem("timely_admin_notifications", JSON.stringify(notifs));
                setDocRequests(DocumentRequestAPI.getForClient(customerId));
                setUploadReq(null);
                showToast(`Uploaded for "${uploadReq.documentName}"`, "success");
            } else {
                showToast(`${newFiles.length} file${newFiles.length > 1 ? "s" : ""} uploaded`, "success");
            }
        }
        setUploading(false); setUploadPct(0);
    };

    const handleDownload = (file: DocumentFile) => {
        if (file.base64) { const a = document.createElement("a"); a.href = file.base64; a.download = file.name; a.click(); showToast(`Downloading ${file.name}`, "info"); }
        else showToast("File not available for download", "error");
    };

    const handleDelete = (file: DocumentFile) => {
        if (!confirm(`Delete "${file.name}"?`)) return;
        saveFiles(files.filter(f => f.id !== file.id));
        setSelectedFiles(p => { const n = new Set(p); n.delete(file.id); return n; });
        showToast(`${file.name} deleted`, "success");
    };

    const handleBulkDelete = () => {
        if (!selectedFiles.size || !confirm(`Delete ${selectedFiles.size} file(s)?`)) return;
        saveFiles(files.filter(f => !selectedFiles.has(f.id)));
        showToast(`${selectedFiles.size} file(s) deleted`, "success");
        setSelectedFiles(new Set());
    };

    const handleCreateFolder = () => {
        if (!folderName.trim()) return;
        const f: Folder = { id: genId("folder"), name: folderName.trim(), parentId: currentFolder, createdAt: new Date().toISOString() };
        saveFolders([...folders, f]);
        setFolderName(""); setShowNewFolder(false);
        showToast(`Folder "${f.name}" created`, "success");
    };

    const handleRename = () => {
        if (!renameFile || !renameVal.trim()) return;
        saveFiles(files.map(f => f.id === renameFile.id ? { ...f, name: renameVal.trim() } : f));
        showToast(`Renamed to "${renameVal.trim()}"`, "success");
        setRenameFile(null); setRenameVal("");
    };

    const breadcrumbs = useMemo(() => {
        const path: { id: string | null; name: string }[] = [{ id: null, name: "All Files" }];
        let cur = currentFolder;
        while (cur) { const f = folders.find(x => x.id === cur); if (f) { path.splice(1, 0, { id: f.id, name: f.name }); cur = f.parentId; } else break; }
        return path;
    }, [folders, currentFolder]);

    const items = useMemo(() => {
        const curFolders = folders.filter(f => f.parentId === currentFolder);
        let curFiles = files.filter(f => f.folderId === currentFolder);
        if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); curFiles = curFiles.filter(f => f.name.toLowerCase().includes(q)); }
        curFiles.sort((a, b) => ({
            name: () => a.name.localeCompare(b.name),
            date: () => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
            size: () => b.size - a.size,
            type: () => a.type.localeCompare(b.type),
        }[sortBy] || (() => 0))());
        return { folders: curFolders, files: curFiles };
    }, [files, folders, currentFolder, searchQuery, sortBy]);

    const stats = useMemo(() => ({
        totalFiles: files.length,
        totalSize:  files.reduce((s, f) => s + f.size, 0),
        totalFolders: folders.length,
        pendingReqs: docRequests.filter(r => r.status === "pending").length,
    }), [files, folders, docRequests]);

    const pendingRequests = useMemo(() =>
        docRequests.filter(r => r.status === "pending").sort((a, b) =>
            ({ urgent: 0, high: 1, medium: 2, low: 3 }[a.priority] || 2) - ({ urgent: 0, high: 1, medium: 2, low: 3 }[b.priority] || 2)
        ), [docRequests]);

    const Modal: React.FC<{ title: string; icon: React.ComponentType<{ className?: string }>; iconColor: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }> =
        ({ title, icon: Icon, iconColor, onClose, children, footer }) => (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
            <div className={`${n.modal} border rounded-2xl max-w-md w-full overflow-hidden`}>
                <div className={`px-5 py-4 border-b ${n.divider} flex items-center justify-between ${n.modalHead}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 ${iconColor} rounded-xl flex items-center justify-center`}><Icon className="w-4 h-4 text-white" /></div>
                        <span className={`font-semibold ${n.text}`}>{title}</span>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-black/10"}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button>
                </div>
                <div className="p-5">{children}</div>
                <div className={`px-5 py-4 border-t ${n.divider} flex justify-end gap-2 ${n.modalHead}`}>{footer}</div>
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">
                {toasts.map(t => (
                    <div key={t.id} className={`${n.card} flex items-center gap-3 px-4 py-3 rounded-xl text-sm`}>
                        {t.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === "error" ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}
                        <span className={n.text}>{t.message}</span>
                        <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}><X className="w-3.5 h-3.5" /></button>
                    </div>
                ))}
            </div>

            {/* Hidden inputs */}
            <input ref={fileRef}    type="file" multiple onChange={e => handleUpload(e.target.files)} className="hidden" />
            <input ref={reqFileRef} type="file"          onChange={e => uploadReq && handleUpload(e.target.files, uploadReq.id)} className="hidden" />

            {/* New Folder Modal */}
            {showNewFolder && (
                <Modal title="New Folder" icon={FolderPlus} iconColor="bg-blue-600" onClose={() => setShowNewFolder(false)}
                    footer={<><button onClick={() => setShowNewFolder(false)} className={`px-4 py-2 ${n.flat} rounded-xl text-sm ${n.secondary}`}>Cancel</button><button onClick={handleCreateFolder} className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm`}>Create</button></>}>
                    <input type="text" value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Folder name"
                        className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} autoFocus onKeyDown={e => e.key === "Enter" && handleCreateFolder()} />
                </Modal>
            )}

            {/* Rename Modal */}
            {renameFile && (
                <Modal title="Rename File" icon={Edit3} iconColor="bg-amber-600" onClose={() => setRenameFile(null)}
                    footer={<><button onClick={() => setRenameFile(null)} className={`px-4 py-2 ${n.flat} rounded-xl text-sm ${n.secondary}`}>Cancel</button><button onClick={handleRename} className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm`}>Rename</button></>}>
                    <input type="text" value={renameVal} onChange={e => setRenameVal(e.target.value)}
                        className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} autoFocus onKeyDown={e => e.key === "Enter" && handleRename()} />
                </Modal>
            )}

            {/* Upload for request modal */}
            {uploadReq && (
                <Modal title="Upload Document" icon={Upload} iconColor={priorityColor(uploadReq.priority).well} onClose={() => setUploadReq(null)}
                    footer={<button onClick={() => setUploadReq(null)} className={`px-4 py-2 ${n.flat} rounded-xl text-sm ${n.secondary}`}>Cancel</button>}>
                    <div className={`${n.flat} p-4 rounded-xl mb-4`}>
                        <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 ${priorityColor(uploadReq.priority).well} rounded-xl flex items-center justify-center flex-shrink-0`}><FileText className="w-4 h-4 text-white" /></div>
                            <div>
                                <p className={`font-medium ${n.text} text-sm`}>{uploadReq.documentName}</p>
                                {uploadReq.description && <p className={`text-xs ${n.secondary} mt-0.5`}>{uploadReq.description}</p>}
                                {uploadReq.dueDate && <p className={`text-xs ${n.tertiary} mt-1 flex items-center gap-1`}><Calendar className="w-3 h-3" />Due: {fmtDate(uploadReq.dueDate)}</p>}
                            </div>
                        </div>
                    </div>
                    <button onClick={() => reqFileRef.current?.click()} disabled={uploading}
                        className={`w-full py-3 ${n.btnPrimary} rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50`}>
                        {uploading ? <><RefreshCw className="w-4 h-4 animate-spin" />{uploadPct}%</> : <><Upload className="w-4 h-4" />Select File</>}
                    </button>
                    <p className={`text-xs ${n.tertiary} text-center mt-2`}>Maximum 10MB</p>
                </Modal>
            )}

            {/* Preview Modal */}
            {previewFile && (
                <div className="fixed inset-0 bg-black/90 z-[10001] flex items-center justify-center p-4">
                    <div className="absolute top-4 right-4 flex gap-2">
                        <button onClick={() => handleDownload(previewFile)} className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"><Download className="w-4 h-4 text-white" /></button>
                        <button onClick={() => setPreviewFile(null)} className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-colors"><X className="w-4 h-4 text-white" /></button>
                    </div>
                    <div className="max-w-3xl max-h-[80vh] overflow-auto">
                        {previewFile.type.startsWith("image/") && previewFile.base64 ? (
                            <img src={previewFile.base64} alt={previewFile.name} className="max-w-full rounded-2xl" />
                        ) : (
                            <div className={`${n.card} rounded-2xl p-10 text-center min-w-64`}>
                                {(() => { const { icon: I, color: c } = fileIcon(previewFile.type, previewFile.name); return (<div className={`w-20 h-20 ${c} rounded-2xl flex items-center justify-center mx-auto mb-5`}><I className="w-10 h-10 text-white" /></div>); })()}
                                <p className={`font-semibold ${n.strong} mb-1`}>{previewFile.name}</p>
                                <p className={`text-sm ${n.tertiary} mb-5`}>{fmtSize(previewFile.size)} · {previewFile.type.split("/")[1]?.toUpperCase() || "FILE"}</p>
                                <button onClick={() => handleDownload(previewFile)} className={`px-5 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-2 mx-auto`}><Download className="w-4 h-4" />Download</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className={`text-xl font-semibold ${n.strong}`}>Documents</h1>
                    <p className={`text-sm ${n.secondary} mt-0.5`}>Manage your files and respond to document requests</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowNewFolder(true)} className={`px-3 py-2 ${n.flat} rounded-xl text-sm ${n.secondary} flex items-center gap-1.5`}>
                        <FolderPlus className="w-3.5 h-3.5" />New Folder
                    </button>
                    <button onClick={() => fileRef.current?.click()} className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-1.5`}>
                        <Upload className="w-3.5 h-3.5" />Upload
                    </button>
                </div>
            </div>

            {/* Pending requests banner */}
            {pendingRequests.length > 0 && (
                <div className={`${n.card} rounded-2xl p-5 border border-amber-500/20`}>
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Bell className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className={`font-semibold ${n.text}`}>{pendingRequests.length} document request{pendingRequests.length > 1 ? "s" : ""} pending</p>
                            <p className={`text-xs ${n.secondary} mt-0.5 mb-4`}>Your consultant has requested documents. Please upload them soon.</p>
                            <div className="space-y-2">
                                {pendingRequests.slice(0, 3).map(req => (
                                    <div key={req.id} className={`${n.flat} p-3 flex items-center justify-between rounded-xl gap-3`}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-8 h-8 ${priorityColor(req.priority).well} rounded-lg flex items-center justify-center flex-shrink-0`}><FileText className="w-3.5 h-3.5 text-white" /></div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-medium ${n.text} truncate`}>{req.documentName}</p>
                                                {req.dueDate && <p className={`text-xs ${n.tertiary}`}>Due {fmtDate(req.dueDate)}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${priorityColor(req.priority).bg}`}>{req.priority}</span>
                                            <button onClick={() => setUploadReq(req)} className={`px-3 py-1.5 ${n.btnPrimary} rounded-lg text-xs flex items-center gap-1`}><Upload className="w-3 h-3" />Upload</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {pendingRequests.length > 3 && (
                                <button onClick={() => setActiveTab("requests")} className={`mt-3 text-xs ${n.label}`}>View all {pendingRequests.length} requests →</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2">
                {([
                    { id: "files",    label: "My Files",           icon: FolderOpen },
                    { id: "requests", label: "Document Requests",  icon: Bell, badge: stats.pendingReqs },
                ] as { id: TabType; label: string; icon: any; badge?: number }[]).map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? n.btnPrimary : `${n.flat} ${n.secondary}`}`}>
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {tab.badge !== undefined && tab.badge > 0 && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${activeTab === tab.id ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>{tab.badge}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── FILES TAB ── */}
            {activeTab === "files" && (
                <div className="space-y-5">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: "Files",   value: stats.totalFiles,           icon: FileText,  dot: "bg-blue-500" },
                            { label: "Folders", value: stats.totalFolders,         icon: FolderOpen,dot: "bg-blue-500" },
                            { label: "Storage", value: fmtSize(stats.totalSize),   icon: HardDrive, dot: "bg-emerald-500" },
                        ].map((st, i) => (
                            <div key={i} className={`${n.card} ${n.edgeHover} p-4 rounded-2xl transition-all`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                    <span className={`text-[11px] uppercase tracking-widest ${n.tertiary}`}>{st.label}</span>
                                </div>
                                <div className={`text-xl font-semibold ${n.strong} tabular-nums`}>{st.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Toolbar */}
                    <div className={`${n.card} rounded-2xl p-4`}>
                        <div className="flex flex-wrap gap-3 items-center">
                            {/* Breadcrumbs */}
                            <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
                                {breadcrumbs.map((item, i, arr) => (
                                    <React.Fragment key={item.id || "root"}>
                                        <button onClick={() => setCurrentFolder(item.id)}
                                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all ${n.rowHover} ${i === arr.length - 1 ? `font-semibold ${n.text}` : n.tertiary}`}>
                                            {i === 0 && <Home className="w-3.5 h-3.5" />}
                                            <span className="whitespace-nowrap">{item.name}</span>
                                        </button>
                                        {i < arr.length - 1 && <ChevronRight className={`w-3 h-3 ${n.tertiary} flex-shrink-0`} />}
                                    </React.Fragment>
                                ))}
                            </div>
                            {/* Search */}
                            <div className={`flex items-center gap-2 px-3 py-2 ${n.inset} rounded-xl`}>
                                <Search className={`w-3.5 h-3.5 ${n.tertiary}`} />
                                <input type="text" placeholder="Search…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    className={`w-36 bg-transparent ${n.text} text-xs focus:outline-none`} />
                                {searchQuery && <button onClick={() => setSearchQuery("")}><X className={`w-3 h-3 ${n.tertiary}`} /></button>}
                            </div>
                            {/* Sort */}
                            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
                                className={`px-3 py-2 ${n.input} border rounded-xl text-xs focus:outline-none focus:border-blue-500`}>
                                <option value="date">Date</option>
                                <option value="name">Name</option>
                                <option value="size">Size</option>
                                <option value="type">Type</option>
                            </select>
                            {/* View toggle */}
                            <div className={`flex items-center ${n.inset} rounded-xl overflow-hidden`}>
                                <button onClick={() => setViewMode("grid")} className={`w-9 h-9 flex items-center justify-center transition-all ${viewMode === "grid" ? "bg-blue-600 text-white" : `${n.tertiary}`}`}><Grid className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setViewMode("list")} className={`w-9 h-9 flex items-center justify-center transition-all ${viewMode === "list" ? "bg-blue-600 text-white" : `${n.tertiary}`}`}><List className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>

                        {/* Bulk actions */}
                        {selectedFiles.size > 0 && (
                            <div className={`mt-3 pt-3 border-t ${n.divider} flex items-center gap-3`}>
                                <span className={`text-sm ${n.secondary}`}>{selectedFiles.size} selected</span>
                                <button onClick={handleBulkDelete} className={`px-3 py-1.5 ${n.btnDanger} rounded-lg text-xs flex items-center gap-1`}><Trash2 className="w-3 h-3" />Delete</button>
                                <button onClick={() => setSelectedFiles(new Set())} className={`px-3 py-1.5 ${n.flat} rounded-lg text-xs ${n.secondary}`}>Clear</button>
                            </div>
                        )}
                    </div>

                    {/* Upload progress */}
                    {uploading && (
                        <div className={`${n.card} rounded-2xl p-4 flex items-center gap-4`}>
                            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0"><RefreshCw className="w-4 h-4 text-white animate-spin" /></div>
                            <div className="flex-1">
                                <div className="flex justify-between mb-1.5">
                                    <span className={`text-sm ${n.text}`}>Uploading…</span>
                                    <span className={`text-sm font-semibold ${n.text}`}>{uploadPct}%</span>
                                </div>
                                <div className={`h-1.5 ${n.inset} rounded-full overflow-hidden`}>
                                    <div className="h-full bg-blue-600 transition-all duration-300 rounded-full" style={{ width: `${uploadPct}%` }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Drop zone + content */}
                    <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                        onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
                        className={`relative transition-all ${dragOver ? "ring-2 ring-blue-500 ring-dashed rounded-2xl" : ""}`}>
                        {dragOver && (
                            <div className="absolute inset-0 bg-blue-500/10 rounded-2xl flex items-center justify-center z-10">
                                <div className="text-center">
                                    <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 animate-bounce"><Upload className="w-7 h-7 text-white" /></div>
                                    <p className={`font-semibold ${n.text} text-sm`}>Drop to upload</p>
                                </div>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <RefreshCw className={`w-7 h-7 ${n.label} animate-spin`} />
                            </div>
                        ) : items.folders.length === 0 && items.files.length === 0 ? (
                            <div className={`${n.card} rounded-2xl text-center py-16`}>
                                <FolderOpen className={`w-12 h-12 ${n.tertiary} mx-auto mb-4`} strokeWidth={1.5} />
                                <p className={`${n.secondary} text-sm font-medium mb-1`}>No files yet</p>
                                <p className={`${n.tertiary} text-xs mb-5`}>Upload files or drag them here</p>
                                <button onClick={() => fileRef.current?.click()} className={`px-5 py-2.5 ${n.btnPrimary} rounded-xl text-sm inline-flex items-center gap-2 mx-auto`}><Upload className="w-4 h-4" />Upload Files</button>
                            </div>
                        ) : viewMode === "grid" ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {/* Folder cards */}
                                {items.folders.map(folder => (
                                    <div key={folder.id} onClick={() => setCurrentFolder(folder.id)}
                                        className={`${n.card} ${n.edgeHover} rounded-2xl p-4 cursor-pointer transition-all group`}>
                                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                            <FolderOpen className="w-6 h-6 text-white" />
                                        </div>
                                        <p className={`font-medium ${n.text} truncate text-sm`}>{folder.name}</p>
                                        <p className={`text-[10px] ${n.tertiary} mt-0.5`}>Folder</p>
                                    </div>
                                ))}
                                {/* File cards */}
                                {items.files.map(file => {
                                    const { icon: Icon, color } = fileIcon(file.type, file.name);
                                    return (
                                        <div key={file.id} onClick={() => setPreviewFile(file)}
                                            className={`${n.card} ${n.edgeHover} rounded-2xl p-4 cursor-pointer transition-all relative group ${selectedFiles.has(file.id) ? "ring-2 ring-blue-500" : ""}`}>
                                            <input type="checkbox" checked={selectedFiles.has(file.id)} onClick={e => e.stopPropagation()}
                                                onChange={e => { e.stopPropagation(); setSelectedFiles(p => { const s = new Set(p); s.has(file.id) ? s.delete(file.id) : s.add(file.id); return s; }); }}
                                                className="absolute top-3 left-3 w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <button onClick={e => { e.stopPropagation(); handleDownload(file); }}
                                                className="absolute top-3 right-3 w-7 h-7 bg-black/30 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600">
                                                <Download className="w-3 h-3 text-white" />
                                            </button>
                                            {file.type.startsWith("image/") && file.base64 ? (
                                                <div className="w-full h-20 rounded-xl overflow-hidden mb-3"><img src={file.base64} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /></div>
                                            ) : (
                                                <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}><Icon className="w-6 h-6 text-white" /></div>
                                            )}
                                            <p className={`font-medium ${n.text} truncate text-xs`}>{file.name}</p>
                                            <p className={`text-[10px] ${n.tertiary} mt-0.5`}>{fmtSize(file.size)}</p>
                                            {file.requestId && (
                                                <span className={`mt-1.5 inline-block text-[10px] px-2 py-0.5 rounded-lg font-medium ${file.status === "approved" ? "bg-emerald-500/10 text-emerald-400" : file.status === "rejected" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
                                                    {file.status === "pending_review" ? "Pending Review" : file.status}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* List view */
                            <div className={`${n.card} rounded-2xl overflow-hidden`}>
                                <div className={`grid grid-cols-12 gap-3 px-4 py-3 border-b ${n.divider} ${n.flat}`}>
                                    <div className="col-span-6 flex items-center gap-3">
                                        <input type="checkbox" className="w-3.5 h-3.5"
                                            onChange={e => e.target.checked ? setSelectedFiles(new Set(items.files.map(f => f.id))) : setSelectedFiles(new Set())} />
                                        <span className={`text-[11px] uppercase tracking-wider ${n.tertiary}`}>Name</span>
                                    </div>
                                    <div className={`col-span-2 text-[11px] uppercase tracking-wider ${n.tertiary}`}>Size</div>
                                    <div className={`col-span-2 text-[11px] uppercase tracking-wider ${n.tertiary}`}>Modified</div>
                                    <div className={`col-span-2 text-[11px] uppercase tracking-wider ${n.tertiary}`}>Actions</div>
                                </div>
                                {items.folders.map(folder => (
                                    <div key={folder.id} onClick={() => setCurrentFolder(folder.id)}
                                        className={`grid grid-cols-12 gap-3 px-4 py-3 border-b ${n.divider} cursor-pointer ${n.rowHover} group transition-all`}>
                                        <div className="col-span-6 flex items-center gap-3">
                                            <div className="w-4" />
                                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0"><FolderOpen className="w-4 h-4 text-white" /></div>
                                            <span className={`text-sm font-medium ${n.text} truncate`}>{folder.name}</span>
                                        </div>
                                        <div className={`col-span-2 text-xs ${n.tertiary} flex items-center`}>—</div>
                                        <div className={`col-span-2 text-xs ${n.tertiary} flex items-center`}>{fmtShort(folder.createdAt)}</div>
                                        <div className="col-span-2" />
                                    </div>
                                ))}
                                {items.files.map(file => {
                                    const { icon: Icon, color } = fileIcon(file.type, file.name);
                                    return (
                                        <div key={file.id}
                                            className={`grid grid-cols-12 gap-3 px-4 py-3 border-b ${n.divider} ${n.rowHover} group transition-all ${selectedFiles.has(file.id) ? "bg-blue-500/5" : ""}`}>
                                            <div className="col-span-6 flex items-center gap-3 min-w-0">
                                                <input type="checkbox" checked={selectedFiles.has(file.id)} className="w-3.5 h-3.5 flex-shrink-0"
                                                    onChange={() => setSelectedFiles(p => { const s = new Set(p); s.has(file.id) ? s.delete(file.id) : s.add(file.id); return s; })} />
                                                <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}><Icon className="w-4 h-4 text-white" /></div>
                                                <span className={`text-sm ${n.text} truncate cursor-pointer hover:text-blue-400 transition-colors`} onClick={() => setPreviewFile(file)}>{file.name}</span>
                                                {file.requestId && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-lg flex-shrink-0 ${file.status === "approved" ? "bg-emerald-500/10 text-emerald-400" : file.status === "rejected" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
                                                        {file.status === "pending_review" ? "Review" : file.status}
                                                    </span>
                                                )}
                                            </div>
                                            <div className={`col-span-2 text-xs ${n.tertiary} flex items-center`}>{fmtSize(file.size)}</div>
                                            <div className={`col-span-2 text-xs ${n.tertiary} flex items-center`}>{fmtShort(file.uploadedAt)}</div>
                                            <div className="col-span-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleDownload(file)} className={`w-7 h-7 ${n.flat} rounded-lg flex items-center justify-center ${n.tertiary} hover:text-blue-400`}><Download className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => { setRenameFile(file); setRenameVal(file.name); }} className={`w-7 h-7 ${n.flat} rounded-lg flex items-center justify-center ${n.tertiary} hover:text-amber-400`}><Edit3 className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleDelete(file)} className={`w-7 h-7 ${n.flat} rounded-lg flex items-center justify-center ${n.tertiary} hover:text-red-400`}><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── REQUESTS TAB ── */}
            {activeTab === "requests" && (
                <div className={`${n.card} rounded-2xl overflow-hidden`}>
                    {docRequests.length === 0 ? (
                        <div className="text-center py-16">
                            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" strokeWidth={1.5} />
                            <p className={`${n.secondary} text-sm font-medium`}>All caught up!</p>
                            <p className={`${n.tertiary} text-xs mt-1`}>No document requests at this time</p>
                        </div>
                    ) : docRequests.map((req, i) => {
                        const pc = priorityColor(req.priority);
                        return (
                            <div key={req.id} className={`p-5 ${n.rowHover} transition-all ${i < docRequests.length - 1 ? `border-b ${n.divider}` : ""}`}>
                                <div className="flex items-start gap-4">
                                    <div className={`w-11 h-11 ${pc.well} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                        <FileText className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-3 mb-1">
                                            <div className="min-w-0">
                                                <p className={`font-semibold ${n.text} text-sm`}>{req.documentName}</p>
                                                {req.description && <p className={`text-xs ${n.secondary} mt-0.5`}>{req.description}</p>}
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${pc.bg}`}>{req.priority}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${statusColor(req.status)} capitalize`}>{req.status}</span>
                                            </div>
                                        </div>
                                        <div className={`flex flex-wrap items-center gap-3 text-[11px] ${n.tertiary} mt-1`}>
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtRelative(req.createdAt)}</span>
                                            {req.dueDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Due {fmtDate(req.dueDate)}</span>}
                                            <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{DOCUMENT_CATEGORIES.find(c => c.value === req.category)?.label || req.category}</span>
                                        </div>
                                        {req.uploadedDocumentName && (
                                            <div className={`mt-3 px-3 py-2 ${n.flat} rounded-xl flex items-center gap-2`}>
                                                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                                <span className={`text-xs ${n.secondary}`}>Uploaded: {req.uploadedDocumentName}</span>
                                                {req.uploadedAt && <span className={`text-[10px] ${n.tertiary}`}>({fmtRelative(req.uploadedAt)})</span>}
                                            </div>
                                        )}
                                        {req.status === "rejected" && req.reviewNotes && (
                                            <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                                <p className="text-xs text-red-400">{req.reviewNotes}</p>
                                            </div>
                                        )}
                                    </div>
                                    {(req.status === "pending" || req.status === "rejected") && (
                                        <button onClick={() => setUploadReq(req)}
                                            className={`px-4 py-2 ${req.status === "rejected" ? "bg-amber-600 hover:bg-amber-500" : "bg-blue-600 hover:bg-blue-500"} text-white rounded-xl text-xs flex items-center gap-1.5 flex-shrink-0`}>
                                            <Upload className="w-3 h-3" />{req.status === "rejected" ? "Re-upload" : "Upload"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ClientDocuments;