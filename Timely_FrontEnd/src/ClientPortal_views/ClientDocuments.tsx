// src/ClientPortal_views/ClientDocuments.tsx
// Client document management with admin document request integration
// Shows pending document requests from admin and allows upload fulfillment

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    FileText, Upload, Download, Trash2, FolderOpen, FolderPlus, File,
    Image, FileSpreadsheet, FileCode, Film, Music, Archive, Search,
    Grid, List, X, ChevronRight, Eye, Clock, HardDrive, CheckCircle,
    AlertCircle, RefreshCw, Home, Edit3, Bell, Calendar, Tag, ExternalLink,
    MoreVertical, Star, Copy, Move, Info
} from "lucide-react";

const API_BASE = "http://localhost:4000/api";

// Types from shared module (inline for simplicity)
type DocumentRequestStatus = "pending" | "uploaded" | "approved" | "rejected";
type DocumentRequestPriority = "low" | "medium" | "high" | "urgent";

interface DocumentRequest {
    id: string;
    clientId: string;
    clientName: string;
    clientEmail: string;
    requestedBy: string;
    requestedByName: string;
    documentName: string;
    description: string;
    category: string;
    priority: DocumentRequestPriority;
    status: DocumentRequestStatus;
    dueDate?: string;
    createdAt: string;
    updatedAt: string;
    uploadedDocumentId?: string;
    uploadedDocumentName?: string;
    uploadedAt?: string;
    uploadedBy?: string;
    reviewedAt?: string;
    reviewedBy?: string;
    reviewNotes?: string;
}

const DOCUMENT_CATEGORIES = [
    { value: "tax", label: "Tax Documents" },
    { value: "legal", label: "Legal Documents" },
    { value: "financial", label: "Financial Records" },
    { value: "identity", label: "Identity Verification" },
    { value: "contract", label: "Contracts & Agreements" },
    { value: "report", label: "Reports" },
    { value: "other", label: "Other" },
];

const generateId = (prefix: string): string => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const formatDate = (dateStr: string): string => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const getRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
};

const getPriorityColor = (priority: DocumentRequestPriority): { bg: string; text: string; gradient: string } => {
    const colors: Record<DocumentRequestPriority, { bg: string; text: string; gradient: string }> = {
        urgent: { bg: "bg-red-500/20", text: "text-red-500", gradient: "from-red-500 to-red-600" },
        high: { bg: "bg-orange-500/20", text: "text-orange-500", gradient: "from-orange-500 to-orange-600" },
        medium: { bg: "bg-yellow-500/20", text: "text-yellow-500", gradient: "from-yellow-500 to-yellow-600" },
        low: { bg: "bg-green-500/20", text: "text-green-500", gradient: "from-green-500 to-green-600" },
    };
    return colors[priority] || colors.medium;
};

const getStatusColor = (status: DocumentRequestStatus): { bg: string; text: string } => {
    const colors: Record<DocumentRequestStatus, { bg: string; text: string }> = {
        pending: { bg: "bg-amber-500/20", text: "text-amber-500" },
        uploaded: { bg: "bg-blue-500/20", text: "text-blue-500" },
        approved: { bg: "bg-emerald-500/20", text: "text-emerald-500" },
        rejected: { bg: "bg-red-500/20", text: "text-red-500" },
    };
    return colors[status] || colors.pending;
};

// Storage helpers
const STORAGE_KEYS = {
    DOCUMENT_REQUESTS: "timely_document_requests",
    DOCUMENT_UPLOADS: "timely_document_uploads",
    CLIENT_DOCUMENTS: "timely_client_documents",
    CLIENT_FOLDERS: "timely_client_folders",
};

const DocumentRequestAPI = {
    getForClient: (clientId: string): DocumentRequest[] => {
        try {
            const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCUMENT_REQUESTS) || "[]");
            return all.filter((r: DocumentRequest) => String(r.clientId) === String(clientId));
        } catch { return []; }
    },
    markAsUploaded: (id: string, uploadInfo: { documentId: string; documentName: string; uploadedBy: string }) => {
        try {
            const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCUMENT_REQUESTS) || "[]");
            const index = all.findIndex((r: DocumentRequest) => r.id === id);
            if (index !== -1) {
                all[index] = {
                    ...all[index],
                    status: "uploaded",
                    uploadedDocumentId: uploadInfo.documentId,
                    uploadedDocumentName: uploadInfo.documentName,
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: uploadInfo.uploadedBy,
                    updatedAt: new Date().toISOString(),
                };
                localStorage.setItem(STORAGE_KEYS.DOCUMENT_REQUESTS, JSON.stringify(all));
            }
        } catch { }
    },
};

const DocumentUploadAPI = {
    create: (upload: any) => {
        try {
            const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCUMENT_UPLOADS) || "[]");
            const newUpload = {
                ...upload,
                id: generateId("docup"),
                uploadedAt: new Date().toISOString(),
                status: "pending_review",
            };
            all.push(newUpload);
            localStorage.setItem(STORAGE_KEYS.DOCUMENT_UPLOADS, JSON.stringify(all));
            return newUpload;
        } catch { return null; }
    },
};

type ClientDocumentsProps = {
    userName?: string;
    userEmail?: string;
    customerId?: string;
};

interface DocumentFile {
    id: string;
    name: string;
    size: number;
    type: string;
    folderId: string | null;
    projectId?: string;
    projectName?: string;
    uploadedBy: string;
    uploadedAt: string;
    base64?: string;
    requestId?: string;
    status?: "pending_review" | "approved" | "rejected";
}

interface Folder {
    id: string;
    name: string;
    parentId: string | null;
    createdAt: string;
    color?: string;
}

interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info";
}

type ViewMode = "grid" | "list";
type SortBy = "name" | "date" | "size" | "type";
type TabType = "files" | "requests";

const ClientDocuments: React.FC<ClientDocumentsProps> = ({
    userName = "Client",
    userEmail = "",
    customerId = "",
}) => {
    const { isDark } = useTheme();

    const s = {
        bg: isDark ? "bg-slate-950" : "bg-gray-50",
        card: isDark ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200",
        cardHover: isDark ? "hover:bg-slate-800/80" : "hover:bg-gray-50",
        cardInner: isDark ? "bg-slate-800" : "bg-gray-100",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-600",
        textSubtle: isDark ? "text-slate-500" : "text-gray-400",
        divider: isDark ? "border-slate-800" : "border-gray-200",
        button: isDark ? "bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white" : "bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800",
        buttonPrimary: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white",
        buttonDanger: "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white",
        input: isDark
            ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500"
            : "bg-white border-gray-300 text-gray-900 placeholder-gray-400",
        // Interactive
        clickable: "cursor-pointer active:scale-[0.98] transition-all duration-150",
        hoverLift: "hover:-translate-y-1 hover:shadow-xl transition-all duration-300",
        hoverGlow: isDark ? "hover:shadow-lg hover:shadow-blue-500/10" : "hover:shadow-lg hover:shadow-blue-500/5",
    };

    const [activeTab, setActiveTab] = useState<TabType>("files");
    const [files, setFiles] = useState<DocumentFile[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [documentRequests, setDocumentRequests] = useState<DocumentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [sortBy, setSortBy] = useState<SortBy>("date");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [toasts, setToasts] = useState<Toast[]>([]);

    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [previewFile, setPreviewFile] = useState<DocumentFile | null>(null);
    const [renameFile, setRenameFile] = useState<DocumentFile | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [showUploadForRequestModal, setShowUploadForRequestModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<DocumentRequest | null>(null);

    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const requestFileInputRef = useRef<HTMLInputElement>(null);

    const getFileIcon = (type: string, name: string) => {
        const ext = name.split(".").pop()?.toLowerCase() || "";
        if (type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
            return { icon: Image, color: "text-pink-500", bg: "bg-pink-500/10", gradient: "from-pink-500 to-pink-600" };
        if (type.includes("spreadsheet") || ["xlsx", "xls", "csv"].includes(ext))
            return { icon: FileSpreadsheet, color: "text-green-500", bg: "bg-green-500/10", gradient: "from-green-500 to-green-600" };
        if (type.includes("pdf") || ext === "pdf")
            return { icon: FileText, color: "text-red-500", bg: "bg-red-500/10", gradient: "from-red-500 to-red-600" };
        if (type.includes("video") || ["mp4", "mov", "avi", "mkv"].includes(ext))
            return { icon: Film, color: "text-purple-500", bg: "bg-purple-500/10", gradient: "from-purple-500 to-purple-600" };
        if (type.includes("audio") || ["mp3", "wav", "ogg"].includes(ext))
            return { icon: Music, color: "text-amber-500", bg: "bg-amber-500/10", gradient: "from-amber-500 to-amber-600" };
        if (type.includes("zip") || ["zip", "rar", "7z", "tar", "gz"].includes(ext))
            return { icon: Archive, color: "text-yellow-500", bg: "bg-yellow-500/10", gradient: "from-yellow-500 to-yellow-600" };
        if (["js", "ts", "jsx", "tsx", "html", "css", "json", "py", "java"].includes(ext))
            return { icon: FileCode, color: "text-blue-500", bg: "bg-blue-500/10", gradient: "from-blue-500 to-blue-600" };
        return { icon: File, color: "text-gray-500", bg: "bg-gray-500/10", gradient: "from-gray-500 to-gray-600" };
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    const formatDateShort = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 86400000) return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        if (diff < 604800000) return date.toLocaleDateString("en-US", { weekday: "short" });
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        const id = `toast_${Date.now()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };

    useEffect(() => {
        loadDocuments();
        loadDocumentRequests();
    }, [customerId]);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            const storedFiles = localStorage.getItem(`${STORAGE_KEYS.CLIENT_DOCUMENTS}_${customerId}`);
            const storedFolders = localStorage.getItem(`${STORAGE_KEYS.CLIENT_FOLDERS}_${customerId}`);
            if (storedFiles) setFiles(JSON.parse(storedFiles));
            if (storedFolders) setFolders(JSON.parse(storedFolders));
        } catch (e) {
            console.error("Error loading documents:", e);
        } finally {
            setLoading(false);
        }
    };

    const loadDocumentRequests = () => {
        const requests = DocumentRequestAPI.getForClient(customerId);
        setDocumentRequests(requests);
    };

    const saveFiles = (newFiles: DocumentFile[]) => {
        setFiles(newFiles);
        localStorage.setItem(`${STORAGE_KEYS.CLIENT_DOCUMENTS}_${customerId}`, JSON.stringify(newFiles));
    };

    const saveFolders = (newFolders: Folder[]) => {
        setFolders(newFolders);
        localStorage.setItem(`${STORAGE_KEYS.CLIENT_FOLDERS}_${customerId}`, JSON.stringify(newFolders));
    };

    const handleFileUpload = async (uploadedFiles: FileList | null, requestId?: string) => {
        if (!uploadedFiles || uploadedFiles.length === 0) return;

        setUploading(true);
        setUploadProgress(0);

        const newFiles: DocumentFile[] = [];
        const totalFiles = uploadedFiles.length;

        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            if (file.size > 10 * 1024 * 1024) {
                showToast(`${file.name} is too large (max 10MB)`, "error");
                continue;
            }

            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });

            const newFile: DocumentFile = {
                id: `file_${Date.now()}_${i}`,
                name: file.name,
                size: file.size,
                type: file.type || "application/octet-stream",
                folderId: currentFolderId,
                uploadedBy: userName,
                uploadedAt: new Date().toISOString(),
                base64,
                requestId,
                status: requestId ? "pending_review" : undefined,
            };

            newFiles.push(newFile);

            // Save to DocumentUploadAPI for admin visibility
            DocumentUploadAPI.create({
                requestId,
                clientId: customerId,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type || "application/octet-stream",
                uploadedBy: userName,
                base64,
                category: selectedRequest?.category,
            });

            setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
        }

        if (newFiles.length > 0) {
            saveFiles([...files, ...newFiles]);

            if (requestId && selectedRequest) {
                DocumentRequestAPI.markAsUploaded(requestId, {
                    documentId: newFiles[0].id,
                    documentName: newFiles[0].name,
                    uploadedBy: userName,
                });

                // Notify admin
                const adminNotifs = JSON.parse(localStorage.getItem("timely_admin_notifications") || "[]");
                adminNotifs.push({
                    id: generateId("notif"),
                    type: "document_uploaded",
                    clientId: customerId,
                    clientName: userName,
                    requestId: requestId,
                    documentName: newFiles[0].name,
                    requestedDocument: selectedRequest.documentName,
                    timestamp: new Date().toISOString(),
                    read: false,
                });
                localStorage.setItem("timely_admin_notifications", JSON.stringify(adminNotifs));

                loadDocumentRequests();
                setShowUploadForRequestModal(false);
                setSelectedRequest(null);
                showToast(`Document uploaded for "${selectedRequest.documentName}"`, "success");
            } else {
                showToast(`${newFiles.length} file(s) uploaded successfully`, "success");
            }
        }

        setUploading(false);
        setUploadProgress(0);
    };

    const handleUploadForRequest = (request: DocumentRequest) => {
        setSelectedRequest(request);
        setShowUploadForRequestModal(true);
    };

    const handleRequestFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (selectedRequest) {
            handleFileUpload(e.target.files, selectedRequest.id);
        }
    };

    const handleDownload = (file: DocumentFile) => {
        if (file.base64) {
            const link = document.createElement("a");
            link.href = file.base64;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast(`Downloading ${file.name}`, "info");
        } else {
            showToast("File not available for download", "error");
        }
    };

    const handleDelete = (file: DocumentFile) => {
        if (confirm(`Delete "${file.name}"?`)) {
            saveFiles(files.filter((f) => f.id !== file.id));
            showToast(`${file.name} deleted`, "success");
            setSelectedFiles((prev) => { const next = new Set(prev); next.delete(file.id); return next; });
        }
    };

    const handleBulkDelete = () => {
        if (selectedFiles.size === 0) return;
        if (confirm(`Delete ${selectedFiles.size} selected file(s)?`)) {
            saveFiles(files.filter((f) => !selectedFiles.has(f.id)));
            showToast(`${selectedFiles.size} file(s) deleted`, "success");
            setSelectedFiles(new Set());
        }
    };

    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return;
        const newFolder: Folder = {
            id: `folder_${Date.now()}`,
            name: newFolderName.trim(),
            parentId: currentFolderId,
            createdAt: new Date().toISOString(),
            color: ["blue", "green", "purple", "amber", "pink"][Math.floor(Math.random() * 5)],
        };
        saveFolders([...folders, newFolder]);
        setNewFolderName("");
        setShowNewFolderModal(false);
        showToast(`Folder "${newFolder.name}" created`, "success");
    };

    const handleRename = () => {
        if (!renameFile || !renameValue.trim()) return;
        saveFiles(files.map((f) => (f.id === renameFile.id ? { ...f, name: renameValue.trim() } : f)));
        showToast(`Renamed to "${renameValue.trim()}"`, "success");
        setRenameFile(null);
        setRenameValue("");
    };

    const getBreadcrumbs = () => {
        const path: { id: string | null; name: string }[] = [{ id: null, name: "All Files" }];
        let current = currentFolderId;
        while (current) {
            const folder = folders.find((f) => f.id === current);
            if (folder) {
                path.splice(1, 0, { id: folder.id, name: folder.name });
                current = folder.parentId;
            } else break;
        }
        return path;
    };

    const displayedItems = useMemo(() => {
        const currentFolders = folders.filter((f) => f.parentId === currentFolderId);
        let currentFiles = files.filter((f) => f.folderId === currentFolderId);
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            currentFiles = currentFiles.filter((f) => f.name.toLowerCase().includes(query));
        }
        currentFiles.sort((a, b) => {
            switch (sortBy) {
                case "name": return a.name.localeCompare(b.name);
                case "date": return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
                case "size": return b.size - a.size;
                case "type": return a.type.localeCompare(b.type);
                default: return 0;
            }
        });
        return { folders: currentFolders, files: currentFiles };
    }, [files, folders, currentFolderId, searchQuery, sortBy]);

    const stats = useMemo(() => ({
        totalFiles: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        totalFolders: folders.length,
        pendingRequests: documentRequests.filter(r => r.status === "pending").length,
    }), [files, folders, documentRequests]);

    const pendingRequests = useMemo(() =>
        documentRequests.filter(r => r.status === "pending").sort((a, b) => {
            const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }),
        [documentRequests]
    );

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = () => { setDragOver(false); };
    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files); };

    return (
        <div className={`${s.bg} min-h-full`}>
            {/* Toast Notifications */}
            <div className="fixed top-20 right-4 z-[10000] space-y-2">
                {toasts.map((toast, index) => (
                    <div
                        key={toast.id}
                        style={{ animationDelay: `${index * 50}ms` }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border ${s.card} animate-in slide-in-from-right duration-300`}
                    >
                        {toast.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                        {toast.type === "error" && <AlertCircle className="w-5 h-5 text-red-500" />}
                        {toast.type === "info" && <Info className="w-5 h-5 text-blue-500" />}
                        <span className={s.text}>{toast.message}</span>
                        <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className={`ml-2 ${s.textMuted} hover:${s.text}`}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* New Folder Modal */}
            {showNewFolderModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className={`${s.card} border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200`}>
                        <div className={`px-6 py-4 border-b ${s.divider} flex items-center justify-between`}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <FolderPlus className="w-5 h-5 text-white" />
                                </div>
                                <h3 className={`text-lg font-bold ${s.text}`}>New Folder</h3>
                            </div>
                            <button onClick={() => setShowNewFolderModal(false)} className={`p-2 rounded-xl ${s.cardHover} transition-all duration-200 hover:shadow-md active:scale-95`}>
                                <X className={`w-5 h-5 ${s.textMuted}`} />
                            </button>
                        </div>
                        <div className="p-6">
                            <input
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Folder name"
                                className={`w-full px-4 py-3 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200`}
                                autoFocus
                                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                            />
                        </div>
                        <div className={`px-6 py-4 border-t ${s.divider} flex justify-end gap-3`}>
                            <button onClick={() => setShowNewFolderModal(false)} className={`${s.button} px-5 py-2.5 rounded-xl transition-all duration-200 hover:shadow-md active:scale-95`}>Cancel</button>
                            <button onClick={handleCreateFolder} className={`${s.buttonPrimary} px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0`}>Create Folder</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Modal */}
            {renameFile && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className={`${s.card} border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200`}>
                        <div className={`px-6 py-4 border-b ${s.divider} flex items-center justify-between`}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                                    <Edit3 className="w-5 h-5 text-white" />
                                </div>
                                <h3 className={`text-lg font-bold ${s.text}`}>Rename File</h3>
                            </div>
                            <button onClick={() => setRenameFile(null)} className={`p-2 rounded-xl ${s.cardHover} transition-all duration-200 hover:shadow-md active:scale-95`}>
                                <X className={`w-5 h-5 ${s.textMuted}`} />
                            </button>
                        </div>
                        <div className="p-6">
                            <input
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className={`w-full px-4 py-3 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200`}
                                autoFocus
                                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                            />
                        </div>
                        <div className={`px-6 py-4 border-t ${s.divider} flex justify-end gap-3`}>
                            <button onClick={() => setRenameFile(null)} className={`${s.button} px-5 py-2.5 rounded-xl transition-all duration-200 hover:shadow-md active:scale-95`}>Cancel</button>
                            <button onClick={handleRename} className={`${s.buttonPrimary} px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0`}>Rename</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload for Request Modal */}
            {showUploadForRequestModal && selectedRequest && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className={`${s.card} border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200`}>
                        <div className={`px-6 py-4 border-b ${s.divider} flex items-center justify-between`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getPriorityColor(selectedRequest.priority).gradient} flex items-center justify-center shadow-lg`}>
                                    <Upload className="w-5 h-5 text-white" />
                                </div>
                                <h3 className={`text-lg font-bold ${s.text}`}>Upload Document</h3>
                            </div>
                            <button onClick={() => { setShowUploadForRequestModal(false); setSelectedRequest(null); }} className={`p-2 rounded-xl ${s.cardHover} transition-all duration-200 hover:shadow-md active:scale-95`}>
                                <X className={`w-5 h-5 ${s.textMuted}`} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className={`p-4 rounded-xl ${s.cardInner} border ${s.divider}`}>
                                <div className="flex items-start gap-3">
                                    <div className={`w-12 h-12 rounded-xl ${getPriorityColor(selectedRequest.priority).bg} flex items-center justify-center`}>
                                        <FileText className={`w-6 h-6 ${getPriorityColor(selectedRequest.priority).text}`} />
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-semibold ${s.text}`}>{selectedRequest.documentName}</p>
                                        <p className={`text-sm ${s.textMuted} mt-1`}>{selectedRequest.description || "No description"}</p>
                                        {selectedRequest.dueDate && (
                                            <p className={`text-xs ${s.textMuted} mt-2 flex items-center gap-1`}>
                                                <Calendar className="w-3 h-3" /> Due: {formatDate(selectedRequest.dueDate)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <input ref={requestFileInputRef} type="file" onChange={handleRequestFileSelect} className="hidden" />
                            <button
                                onClick={() => requestFileInputRef.current?.click()}
                                disabled={uploading}
                                className={`w-full ${s.buttonPrimary} px-4 py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0`}
                            >
                                {uploading ? (
                                    <><RefreshCw className="w-5 h-5 animate-spin" /> Uploading... {uploadProgress}%</>
                                ) : (
                                    <><Upload className="w-5 h-5" /> Select File to Upload</>
                                )}
                            </button>
                            <p className={`text-xs ${s.textMuted} text-center`}>Maximum file size: 10MB</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewFile && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        <button onClick={() => handleDownload(previewFile)} className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all duration-200 hover:scale-105 active:scale-95">
                            <Download className="w-5 h-5 text-white" />
                        </button>
                        <button onClick={() => setPreviewFile(null)} className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all duration-200 hover:scale-105 active:scale-95">
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>
                    <div className="max-w-4xl max-h-[80vh] overflow-auto animate-in zoom-in-95 duration-300">
                        {previewFile.type.startsWith("image/") && previewFile.base64 ? (
                            <img src={previewFile.base64} alt={previewFile.name} className="max-w-full rounded-2xl shadow-2xl" />
                        ) : (
                            <div className={`${s.card} border rounded-2xl p-10 text-center min-w-[300px]`}>
                                {(() => {
                                    const { icon: Icon, gradient } = getFileIcon(previewFile.type, previewFile.name);
                                    return (
                                        <div className={`w-24 h-24 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl`}>
                                            <Icon className="w-12 h-12 text-white" />
                                        </div>
                                    );
                                })()}
                                <p className={`text-xl font-bold ${s.text} mb-2`}>{previewFile.name}</p>
                                <p className={s.textMuted}>{formatSize(previewFile.size)} • {previewFile.type.split('/')[1]?.toUpperCase() || 'FILE'}</p>
                                <button
                                    onClick={() => handleDownload(previewFile)}
                                    className={`${s.buttonPrimary} px-6 py-3 rounded-xl mt-6 inline-flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0`}
                                >
                                    <Download className="w-5 h-5" /> Download File
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <input ref={fileInputRef} type="file" multiple onChange={(e) => handleFileUpload(e.target.files)} className="hidden" />

            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className={`text-2xl font-bold ${s.text}`}>Documents</h1>
                        <p className={`text-sm ${s.textMuted} mt-1`}>Manage your files and respond to document requests</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowNewFolderModal(true)}
                            className={`${s.button} px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all duration-200 hover:shadow-md active:scale-95`}
                        >
                            <FolderPlus className="w-4 h-4" /> New Folder
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className={`${s.buttonPrimary} px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0`}
                        >
                            <Upload className="w-4 h-4" /> Upload
                        </button>
                    </div>
                </div>

                {/* Pending Requests Alert Banner */}
                {pendingRequests.length > 0 && (
                    <div className={`${s.card} border-2 border-amber-500/50 rounded-2xl p-5 animate-in slide-in-from-top duration-300`}>
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20 animate-pulse">
                                <Bell className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className={`font-bold ${s.text}`}>
                                    {pendingRequests.length} Document Request{pendingRequests.length > 1 ? "s" : ""} Pending
                                </h3>
                                <p className={`text-sm ${s.textMuted} mt-1`}>
                                    Your consultant has requested documents. Please upload them soon.
                                </p>
                                <div className="mt-4 space-y-2">
                                    {pendingRequests.slice(0, 3).map((req, index) => {
                                        const priorityColors = getPriorityColor(req.priority);
                                        return (
                                            <div
                                                key={req.id}
                                                style={{ animationDelay: `${index * 100}ms` }}
                                                className={`flex items-center justify-between p-3 rounded-xl ${s.cardInner} transition-all duration-200 hover:shadow-md group animate-in slide-in-from-left`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${priorityColors.gradient} flex items-center justify-center shadow-md`}>
                                                        <FileText className="w-5 h-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <p className={`font-semibold ${s.text}`}>{req.documentName}</p>
                                                        <p className={`text-xs ${s.textMuted}`}>{req.dueDate ? `Due: ${formatDate(req.dueDate)}` : "No deadline"}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${priorityColors.bg} ${priorityColors.text}`}>{req.priority}</span>
                                                    <button
                                                        onClick={() => handleUploadForRequest(req)}
                                                        className={`${s.buttonPrimary} px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0`}
                                                    >
                                                        <Upload className="w-4 h-4" /> Upload
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {pendingRequests.length > 3 && (
                                    <button
                                        onClick={() => setActiveTab("requests")}
                                        className={`mt-4 text-sm font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1 transition-colors`}
                                    >
                                        View all {pendingRequests.length} requests <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-2">
                    {[
                        { id: "files", label: "My Files", icon: FolderOpen },
                        { id: "requests", label: "Document Requests", icon: Bell, badge: stats.pendingRequests },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === tab.id
                                    ? `${s.buttonPrimary} shadow-lg shadow-blue-500/20`
                                    : `${s.button}`
                                } hover:shadow-md active:scale-[0.98]`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {tab.badge && tab.badge > 0 && (
                                <span className={`px-2 py-0.5 text-xs rounded-full ${activeTab === tab.id ? "bg-white/20 text-white" : "bg-red-500 text-white"} font-bold`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === "files" ? (
                    <>
                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { label: "Total Files", value: stats.totalFiles, icon: FileText, color: "blue", gradient: "from-blue-500 to-blue-600" },
                                { label: "Folders", value: stats.totalFolders, icon: FolderOpen, color: "purple", gradient: "from-purple-500 to-purple-600" },
                                { label: "Storage Used", value: formatSize(stats.totalSize), icon: HardDrive, color: "emerald", gradient: "from-emerald-500 to-emerald-600" },
                            ].map((stat, index) => (
                                <div
                                    key={stat.label}
                                    style={{ animationDelay: `${index * 100}ms` }}
                                    className={`${s.card} border rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group animate-in fade-in slide-in-from-bottom`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg shadow-${stat.color}-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                                            <stat.icon className="w-6 h-6 text-white" />
                                        </div>
                                        <span className={`text-2xl font-bold ${s.text}`}>{stat.value}</span>
                                    </div>
                                    <p className={`text-sm ${s.textMuted} mt-3`}>{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Toolbar */}
                        <div className={`${s.card} border rounded-2xl p-4`}>
                            <div className="flex flex-col md:flex-row gap-4">
                                {/* Breadcrumbs */}
                                <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                                    {getBreadcrumbs().map((item, index, arr) => (
                                        <React.Fragment key={item.id || "root"}>
                                            <button
                                                onClick={() => setCurrentFolderId(item.id)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 ${s.cardHover} active:scale-95 ${index === arr.length - 1 ? `font-semibold ${s.text}` : s.textMuted}`}
                                            >
                                                {index === 0 && <Home className="w-4 h-4" />}
                                                <span className="whitespace-nowrap">{item.name}</span>
                                            </button>
                                            {index < arr.length - 1 && <ChevronRight className={`w-4 h-4 ${s.textSubtle} shrink-0`} />}
                                        </React.Fragment>
                                    ))}
                                </div>

                                {/* Search */}
                                <div className="relative group">
                                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${s.textMuted} group-focus-within:text-blue-500 transition-colors`} />
                                    <input
                                        type="text"
                                        placeholder="Search files..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className={`pl-10 pr-4 py-2.5 rounded-xl border ${s.input} w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200`}
                                    />
                                </div>

                                {/* Sort */}
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                                    className={`px-4 py-2.5 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 cursor-pointer`}
                                >
                                    <option value="date">Sort by Date</option>
                                    <option value="name">Sort by Name</option>
                                    <option value="size">Sort by Size</option>
                                    <option value="type">Sort by Type</option>
                                </select>

                                {/* View Mode */}
                                <div className={`flex items-center rounded-xl overflow-hidden border ${s.divider}`}>
                                    <button
                                        onClick={() => setViewMode("grid")}
                                        className={`p-2.5 transition-all duration-200 ${viewMode === "grid" ? s.buttonPrimary : `${s.button} border-0`}`}
                                    >
                                        <Grid className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode("list")}
                                        className={`p-2.5 transition-all duration-200 ${viewMode === "list" ? s.buttonPrimary : `${s.button} border-0`}`}
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Bulk Actions */}
                            {selectedFiles.size > 0 && (
                                <div className={`mt-4 pt-4 border-t ${s.divider} flex items-center gap-4 animate-in slide-in-from-top duration-200`}>
                                    <span className={`text-sm font-medium ${s.text}`}>{selectedFiles.size} selected</span>
                                    <button
                                        onClick={handleBulkDelete}
                                        className={`${s.buttonDanger} px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 shadow-lg shadow-red-500/20 transition-all duration-200 hover:shadow-xl active:scale-95`}
                                    >
                                        <Trash2 className="w-4 h-4" /> Delete
                                    </button>
                                    <button
                                        onClick={() => setSelectedFiles(new Set())}
                                        className={`${s.button} px-4 py-2 rounded-xl text-sm transition-all duration-200 hover:shadow-md active:scale-95`}
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Upload Progress */}
                        {uploading && (
                            <div className={`${s.card} border rounded-2xl p-4 animate-in slide-in-from-top duration-200`}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                        <RefreshCw className="w-5 h-5 text-white animate-spin" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-2">
                                            <span className={`text-sm font-medium ${s.text}`}>Uploading files...</span>
                                            <span className={`text-sm font-bold ${s.text}`}>{uploadProgress}%</span>
                                        </div>
                                        <div className={`h-2 ${s.cardInner} rounded-full overflow-hidden`}>
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 rounded-full"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Files Area */}
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`relative transition-all duration-200 ${dragOver ? "ring-2 ring-blue-500 ring-dashed rounded-2xl" : ""}`}
                        >
                            {dragOver && (
                                <div className="absolute inset-0 bg-blue-500/10 rounded-2xl flex items-center justify-center z-10 animate-in fade-in duration-200">
                                    <div className="text-center">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-xl animate-bounce">
                                            <Upload className="w-8 h-8 text-white" />
                                        </div>
                                        <p className={`text-lg font-bold ${s.text}`}>Drop files here to upload</p>
                                    </div>
                                </div>
                            )}

                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                                    <p className={s.textMuted}>Loading documents...</p>
                                </div>
                            ) : displayedItems.folders.length === 0 && displayedItems.files.length === 0 ? (
                                <div className={`${s.card} border-2 border-dashed rounded-2xl p-16 text-center`}>
                                    <div className={`w-20 h-20 rounded-2xl ${isDark ? "bg-slate-800" : "bg-gray-100"} flex items-center justify-center mx-auto mb-6`}>
                                        <FolderOpen className={`w-10 h-10 ${s.textSubtle}`} />
                                    </div>
                                    <p className={`text-xl font-bold ${s.text} mb-2`}>No files yet</p>
                                    <p className={`${s.textMuted} mb-6`}>Upload files or create folders to get started</p>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`${s.buttonPrimary} px-6 py-3 rounded-xl inline-flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0`}
                                    >
                                        <Upload className="w-5 h-5" /> Upload Files
                                    </button>
                                </div>
                            ) : viewMode === "grid" ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {/* Folders */}
                                    {displayedItems.folders.map((folder, index) => (
                                        <div
                                            key={folder.id}
                                            onClick={() => setCurrentFolderId(folder.id)}
                                            style={{ animationDelay: `${index * 50}ms` }}
                                            className={`${s.card} border rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group animate-in fade-in slide-in-from-bottom`}
                                        >
                                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                                                <FolderOpen className="w-7 h-7 text-white" />
                                            </div>
                                            <p className={`font-semibold ${s.text} truncate`}>{folder.name}</p>
                                            <p className={`text-xs ${s.textMuted} mt-1`}>Folder</p>
                                        </div>
                                    ))}

                                    {/* Files */}
                                    {displayedItems.files.map((file, index) => {
                                        const { icon: Icon, gradient } = getFileIcon(file.type, file.name);
                                        return (
                                            <div
                                                key={file.id}
                                                onClick={() => setPreviewFile(file)}
                                                style={{ animationDelay: `${(displayedItems.folders.length + index) * 50}ms` }}
                                                className={`${s.card} border rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative group animate-in fade-in slide-in-from-bottom ${selectedFiles.has(file.id) ? "ring-2 ring-blue-500" : ""}`}
                                            >
                                                {/* Checkbox */}
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFiles.has(file.id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedFiles((prev) => {
                                                            const next = new Set(prev);
                                                            if (next.has(file.id)) next.delete(file.id);
                                                            else next.add(file.id);
                                                            return next;
                                                        });
                                                    }}
                                                    className="absolute top-3 left-3 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                                                    onClick={(e) => e.stopPropagation()}
                                                />

                                                {/* Quick Actions */}
                                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                                                        className={`p-1.5 rounded-lg ${s.cardInner} hover:bg-blue-500 hover:text-white transition-colors`}
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Thumbnail or Icon */}
                                                {file.type.startsWith("image/") && file.base64 ? (
                                                    <div className="w-full h-24 rounded-xl overflow-hidden mb-3 bg-black/10">
                                                        <img src={file.base64} alt={file.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                                    </div>
                                                ) : (
                                                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                                                        <Icon className="w-7 h-7 text-white" />
                                                    </div>
                                                )}

                                                <p className={`font-semibold ${s.text} truncate text-sm group-hover:text-blue-500 transition-colors`}>{file.name}</p>
                                                <p className={`text-xs ${s.textMuted} mt-1`}>{formatSize(file.size)}</p>

                                                {/* Request Status Badge */}
                                                {file.requestId && (
                                                    <span className={`mt-2 inline-block text-xs px-2 py-1 rounded-lg font-medium ${file.status === "approved" ? "bg-emerald-500/20 text-emerald-500" :
                                                            file.status === "rejected" ? "bg-red-500/20 text-red-500" :
                                                                "bg-amber-500/20 text-amber-500"
                                                        }`}>
                                                        {file.status === "pending_review" ? "Pending Review" : file.status}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* List View */
                                <div className={`${s.card} border rounded-2xl overflow-hidden`}>
                                    <div className={`grid grid-cols-12 gap-4 p-4 border-b ${s.divider} ${s.cardInner}`}>
                                        <div className="col-span-6 text-sm font-semibold flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedFiles(new Set(displayedItems.files.map(f => f.id)));
                                                    else setSelectedFiles(new Set());
                                                }}
                                                className="w-4 h-4"
                                            />
                                            <span className={s.textMuted}>Name</span>
                                        </div>
                                        <div className={`col-span-2 text-sm font-semibold ${s.textMuted}`}>Size</div>
                                        <div className={`col-span-2 text-sm font-semibold ${s.textMuted}`}>Modified</div>
                                        <div className={`col-span-2 text-sm font-semibold ${s.textMuted}`}>Actions</div>
                                    </div>

                                    {/* Folder Rows */}
                                    {displayedItems.folders.map((folder, index) => (
                                        <div
                                            key={folder.id}
                                            onClick={() => setCurrentFolderId(folder.id)}
                                            style={{ animationDelay: `${index * 30}ms` }}
                                            className={`grid grid-cols-12 gap-4 p-4 border-b ${s.divider} ${s.cardHover} cursor-pointer transition-all duration-200 group animate-in fade-in slide-in-from-left`}
                                        >
                                            <div className="col-span-6 flex items-center gap-3">
                                                <div className="w-4" />
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                                                    <FolderOpen className="w-5 h-5 text-white" />
                                                </div>
                                                <span className={`font-medium ${s.text} group-hover:text-blue-500 transition-colors`}>{folder.name}</span>
                                            </div>
                                            <div className={`col-span-2 ${s.textMuted} flex items-center`}>—</div>
                                            <div className={`col-span-2 ${s.textMuted} flex items-center`}>{formatDateShort(folder.createdAt)}</div>
                                            <div className="col-span-2" />
                                        </div>
                                    ))}

                                    {/* File Rows */}
                                    {displayedItems.files.map((file, index) => {
                                        const { icon: Icon, color, gradient } = getFileIcon(file.type, file.name);
                                        return (
                                            <div
                                                key={file.id}
                                                style={{ animationDelay: `${(displayedItems.folders.length + index) * 30}ms` }}
                                                className={`grid grid-cols-12 gap-4 p-4 border-b ${s.divider} ${s.cardHover} transition-all duration-200 group animate-in fade-in slide-in-from-left ${selectedFiles.has(file.id) ? "bg-blue-500/5" : ""}`}
                                            >
                                                <div className="col-span-6 flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedFiles.has(file.id)}
                                                        onChange={() => {
                                                            setSelectedFiles((prev) => {
                                                                const next = new Set(prev);
                                                                if (next.has(file.id)) next.delete(file.id);
                                                                else next.add(file.id);
                                                                return next;
                                                            });
                                                        }}
                                                        className="w-4 h-4"
                                                    />
                                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}>
                                                        <Icon className="w-5 h-5 text-white" />
                                                    </div>
                                                    <span className={`${s.text} truncate cursor-pointer hover:text-blue-500 transition-colors font-medium`} onClick={() => setPreviewFile(file)}>{file.name}</span>
                                                    {file.requestId && (
                                                        <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${file.status === "approved" ? "bg-emerald-500/20 text-emerald-500" :
                                                                file.status === "rejected" ? "bg-red-500/20 text-red-500" :
                                                                    "bg-amber-500/20 text-amber-500"
                                                            }`}>
                                                            {file.status === "pending_review" ? "Review" : file.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`col-span-2 ${s.textMuted} flex items-center`}>{formatSize(file.size)}</div>
                                                <div className={`col-span-2 ${s.textMuted} flex items-center`}>{formatDateShort(file.uploadedAt)}</div>
                                                <div className="col-span-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                    <button onClick={() => handleDownload(file)} className={`p-2 rounded-lg ${s.cardHover} transition-colors hover:text-blue-500`}><Download className="w-4 h-4" /></button>
                                                    <button onClick={() => { setRenameFile(file); setRenameValue(file.name); }} className={`p-2 rounded-lg ${s.cardHover} transition-colors hover:text-amber-500`}><Edit3 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(file)} className={`p-2 rounded-lg ${s.cardHover} transition-colors hover:text-red-500`}><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* Document Requests Tab */
                    <div className="space-y-4">
                        <div className={`${s.card} border rounded-2xl overflow-hidden`}>
                            {documentRequests.length === 0 ? (
                                <div className="p-16 text-center">
                                    <div className={`w-20 h-20 rounded-2xl ${isDark ? "bg-slate-800" : "bg-gray-100"} flex items-center justify-center mx-auto mb-6`}>
                                        <CheckCircle className={`w-10 h-10 text-emerald-500`} />
                                    </div>
                                    <p className={`text-xl font-bold ${s.text} mb-2`}>All caught up!</p>
                                    <p className={s.textMuted}>No document requests at the moment</p>
                                </div>
                            ) : (
                                <div className={`divide-y ${s.divider}`}>
                                    {documentRequests.map((request, index) => {
                                        const priorityColors = getPriorityColor(request.priority);
                                        const statusColors = getStatusColor(request.status);
                                        return (
                                            <div
                                                key={request.id}
                                                style={{ animationDelay: `${index * 50}ms` }}
                                                className={`p-5 ${s.cardHover} transition-all duration-200 group animate-in fade-in slide-in-from-left`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${priorityColors.gradient} flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 group-hover:rotate-2 transition-transform duration-300`}>
                                                        <FileText className="w-7 h-7 text-white" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <h3 className={`font-bold ${s.text} group-hover:text-blue-500 transition-colors`}>{request.documentName}</h3>
                                                                <p className={`text-sm ${s.textMuted} mt-1`}>{request.description || "No description"}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${priorityColors.bg} ${priorityColors.text}`}>{request.priority}</span>
                                                                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${statusColors.bg} ${statusColors.text} capitalize`}>{request.status}</span>
                                                            </div>
                                                        </div>
                                                        <div className={`flex items-center gap-4 mt-3 text-xs ${s.textMuted}`}>
                                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {getRelativeTime(request.createdAt)}</span>
                                                            {request.dueDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Due {formatDate(request.dueDate)}</span>}
                                                            <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {DOCUMENT_CATEGORIES.find(c => c.value === request.category)?.label || request.category}</span>
                                                            <span>From: {request.requestedByName}</span>
                                                        </div>
                                                        {request.uploadedDocumentName && (
                                                            <div className={`mt-4 p-3 rounded-xl ${s.cardInner} flex items-center gap-3`}>
                                                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                                                                <span className={`text-sm font-medium ${s.text}`}>Uploaded: {request.uploadedDocumentName}</span>
                                                                <span className={`text-xs ${s.textMuted}`}>({getRelativeTime(request.uploadedAt || "")})</span>
                                                            </div>
                                                        )}
                                                        {request.status === "rejected" && request.reviewNotes && (
                                                            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                                                                <p className="text-sm text-red-500 flex items-center gap-2">
                                                                    <AlertCircle className="w-4 h-4" />
                                                                    <span>Rejection reason: {request.reviewNotes}</span>
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {request.status === "pending" && (
                                                        <button
                                                            onClick={() => handleUploadForRequest(request)}
                                                            className={`${s.buttonPrimary} px-5 py-2.5 rounded-xl flex items-center gap-2 shrink-0 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0`}
                                                        >
                                                            <Upload className="w-4 h-4" /> Upload
                                                        </button>
                                                    )}
                                                    {request.status === "rejected" && (
                                                        <button
                                                            onClick={() => handleUploadForRequest(request)}
                                                            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shrink-0 shadow-lg shadow-amber-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                                                        >
                                                            <Upload className="w-4 h-4" /> Re-upload
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientDocuments;