// src/Tabs/AdminDocumentRequests.tsx
// Document request management for admin - request documents from clients, review uploads
// All types and helpers are inline to avoid import issues

import React, { useState, useEffect, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    FileText, Plus, Search, RefreshCw, Download, Eye, Check, X,
    Clock, AlertTriangle, CheckCircle, XCircle, Send,
    Trash2, FileUp
} from "lucide-react";

// ============ INLINE TYPES ============
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
    projectId?: string;
    projectName?: string;
}

interface DocumentUpload {
    id: string;
    requestId?: string;
    clientId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    uploadedBy: string;
    uploadedAt: string;
    base64?: string;
    status: "pending_review" | "approved" | "rejected";
    reviewedBy?: string;
    reviewedAt?: string;
    reviewNotes?: string;
    projectId?: string;
    projectName?: string;
    category?: string;
}

// ============ INLINE CONSTANTS ============
const STORAGE_KEYS = {
    DOCUMENT_REQUESTS: "timely_document_requests",
    DOCUMENT_UPLOADS: "timely_document_uploads",
};

const DOCUMENT_CATEGORIES = [
    { value: "tax", label: "Tax Documents" },
    { value: "legal", label: "Legal Documents" },
    { value: "financial", label: "Financial Records" },
    { value: "identity", label: "Identity Verification" },
    { value: "contract", label: "Contracts & Agreements" },
    { value: "report", label: "Reports" },
    { value: "other", label: "Other" },
];

// ============ INLINE HELPERS ============
const generateId = (prefix: string): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const formatDate = (dateStr: string): string => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
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

const getPriorityColor = (priority: DocumentRequestPriority): { bg: string; text: string } => {
    switch (priority) {
        case "urgent": return { bg: "bg-red-500/20", text: "text-red-500" };
        case "high": return { bg: "bg-orange-500/20", text: "text-orange-500" };
        case "medium": return { bg: "bg-yellow-500/20", text: "text-yellow-500" };
        case "low": return { bg: "bg-green-500/20", text: "text-green-500" };
        default: return { bg: "bg-gray-500/20", text: "text-gray-500" };
    }
};

const getStatusColor = (status: DocumentRequestStatus): { bg: string; text: string } => {
    switch (status) {
        case "pending": return { bg: "bg-amber-500/20", text: "text-amber-500" };
        case "uploaded": return { bg: "bg-blue-500/20", text: "text-blue-500" };
        case "approved": return { bg: "bg-emerald-500/20", text: "text-emerald-500" };
        case "rejected": return { bg: "bg-red-500/20", text: "text-red-500" };
        default: return { bg: "bg-gray-500/20", text: "text-gray-500" };
    }
};

// ============ INLINE API HELPERS ============
const DocumentRequestAPI = {
    getAll: (): DocumentRequest[] => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCUMENT_REQUESTS) || "[]");
        } catch {
            return [];
        }
    },

    create: (request: Omit<DocumentRequest, "id" | "createdAt" | "updatedAt" | "status">): DocumentRequest => {
        const newRequest: DocumentRequest = {
            ...request,
            id: generateId("docreq"),
            status: "pending",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const all = DocumentRequestAPI.getAll();
        all.push(newRequest);
        localStorage.setItem(STORAGE_KEYS.DOCUMENT_REQUESTS, JSON.stringify(all));
        return newRequest;
    },

    update: (id: string, updates: Partial<DocumentRequest>): DocumentRequest | null => {
        const all = DocumentRequestAPI.getAll();
        const index = all.findIndex(r => r.id === id);
        if (index === -1) return null;
        all[index] = { ...all[index], ...updates, updatedAt: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEYS.DOCUMENT_REQUESTS, JSON.stringify(all));
        return all[index];
    },

    approve: (id: string, reviewedBy: string, notes?: string): DocumentRequest | null => {
        return DocumentRequestAPI.update(id, {
            status: "approved",
            reviewedAt: new Date().toISOString(),
            reviewedBy,
            reviewNotes: notes,
        });
    },

    reject: (id: string, reviewedBy: string, notes: string): DocumentRequest | null => {
        return DocumentRequestAPI.update(id, {
            status: "rejected",
            reviewedAt: new Date().toISOString(),
            reviewedBy,
            reviewNotes: notes,
        });
    },

    delete: (id: string): boolean => {
        const all = DocumentRequestAPI.getAll();
        const filtered = all.filter(r => r.id !== id);
        if (filtered.length === all.length) return false;
        localStorage.setItem(STORAGE_KEYS.DOCUMENT_REQUESTS, JSON.stringify(filtered));
        return true;
    },
};

const DocumentUploadAPI = {
    getAll: (): DocumentUpload[] => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCUMENT_UPLOADS) || "[]");
        } catch {
            return [];
        }
    },

    update: (id: string, updates: Partial<DocumentUpload>): DocumentUpload | null => {
        const all = DocumentUploadAPI.getAll();
        const index = all.findIndex(u => u.id === id);
        if (index === -1) return null;
        all[index] = { ...all[index], ...updates };
        localStorage.setItem(STORAGE_KEYS.DOCUMENT_UPLOADS, JSON.stringify(all));
        return all[index];
    },

    approve: (id: string, reviewedBy: string, notes?: string): DocumentUpload | null => {
        return DocumentUploadAPI.update(id, {
            status: "approved",
            reviewedBy,
            reviewedAt: new Date().toISOString(),
            reviewNotes: notes,
        });
    },

    reject: (id: string, reviewedBy: string, notes: string): DocumentUpload | null => {
        return DocumentUploadAPI.update(id, {
            status: "rejected",
            reviewedBy,
            reviewedAt: new Date().toISOString(),
            reviewNotes: notes,
        });
    },
};

// ============ COMPONENT ============
const API_BASE = "http://localhost:4000/api";

interface AdminDocumentRequestsProps {
    onNavigate?: (page: string) => void;
    adminEmail?: string;
    adminName?: string;
}

interface User {
    customerId: string;
    clientCode: string;
    firstName: string;
    lastName: string;
    email: string;
}

interface Toast {
    message: string;
    type: "success" | "error";
}

type ViewMode = "requests" | "uploads";
type FilterStatus = "all" | DocumentRequestStatus;

const AdminDocumentRequests: React.FC<AdminDocumentRequestsProps> = ({
    onNavigate,
    adminEmail = "admin@timely.com",
    adminName = "Admin",
}) => {
    const { isDark } = useTheme();

    const s = {
        card: isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200",
        cardInner: isDark ? "bg-slate-900" : "bg-gray-50",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-500",
        input: isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900",
        hover: isDark ? "hover:bg-slate-700" : "hover:bg-gray-100",
        selected: isDark ? "bg-slate-700" : "bg-blue-50",
        divider: isDark ? "divide-slate-700 border-slate-700" : "divide-gray-200 border-gray-200",
    };

    // State
    const [requests, setRequests] = useState<DocumentRequest[]>([]);
    const [uploads, setUploads] = useState<DocumentUpload[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>("requests");
    const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [toast, setToast] = useState<Toast | null>(null);

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<DocumentRequest | null>(null);
    const [selectedUpload, setSelectedUpload] = useState<DocumentUpload | null>(null);

    // Form state
    const [formClientId, setFormClientId] = useState("");
    const [formDocumentName, setFormDocumentName] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formCategory, setFormCategory] = useState("other");
    const [formPriority, setFormPriority] = useState<DocumentRequestPriority>("medium");
    const [formDueDate, setFormDueDate] = useState("");
    const [reviewNotes, setReviewNotes] = useState("");

    const showToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const usersRes = await fetch(`${API_BASE}/users-report`);
            if (usersRes.ok) {
                const data = await usersRes.json();
                setUsers(data.data || []);
            }
            setRequests(DocumentRequestAPI.getAll());
            setUploads(DocumentUploadAPI.getAll());
        } catch (err) {
            console.error("Error loading data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filtered data
    const filteredRequests = useMemo(() => {
        let result = requests;
        if (filterStatus !== "all") {
            result = result.filter(r => r.status === filterStatus);
        }
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(r =>
                r.documentName.toLowerCase().includes(query) ||
                r.clientName.toLowerCase().includes(query) ||
                r.description.toLowerCase().includes(query)
            );
        }
        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [requests, filterStatus, searchQuery]);

    const filteredUploads = useMemo(() => {
        let result = uploads;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(u =>
                u.fileName.toLowerCase().includes(query) ||
                u.uploadedBy.toLowerCase().includes(query)
            );
        }
        return result.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    }, [uploads, searchQuery]);

    // Stats
    const stats = useMemo(() => ({
        totalRequests: requests.length,
        pendingRequests: requests.filter(r => r.status === "pending").length,
        uploadedRequests: requests.filter(r => r.status === "uploaded").length,
        pendingUploads: uploads.filter(u => u.status === "pending_review").length,
        urgentRequests: requests.filter(r => r.priority === "urgent" && r.status === "pending").length,
    }), [requests, uploads]);

    const getClientInfo = (clientId: string) => {
        const user = users.find(u => u.customerId === clientId);
        return user ? { name: `${user.firstName} ${user.lastName}`, email: user.email } : { name: "Unknown", email: "" };
    };

    const handleCreateRequest = () => {
        if (!formClientId || !formDocumentName.trim()) {
            showToast("Please select a client and enter document name", "error");
            return;
        }

        const clientInfo = getClientInfo(formClientId);
        const newRequest = DocumentRequestAPI.create({
            clientId: formClientId,
            clientName: clientInfo.name,
            clientEmail: clientInfo.email,
            requestedBy: adminEmail,
            requestedByName: adminName,
            documentName: formDocumentName.trim(),
            description: formDescription.trim(),
            category: formCategory,
            priority: formPriority,
            dueDate: formDueDate || undefined,
        });

        setRequests([...requests, newRequest]);

        // Send notification to client
        const messagesKey = `timely_client_messages_${newRequest.clientId}`;
        const existingMessages = JSON.parse(localStorage.getItem(messagesKey) || "[]");
        const notification = {
            id: generateId("msg"),
            threadId: `thread_docreq_${newRequest.id}`,
            from: { name: adminName, email: adminEmail, role: "admin" },
            to: { name: newRequest.clientName, email: newRequest.clientEmail },
            subject: `Document Request: ${newRequest.documentName}`,
            body: `Hello,\n\nWe need you to upload: ${newRequest.documentName}\n\n${newRequest.description || ""}\n\nPlease go to Documents section to upload.\n\nThank you,\n${adminName}`,
            timestamp: new Date().toISOString(),
            read: false,
            starred: false,
            archived: false,
            deleted: false,
        };
        existingMessages.push(notification);
        localStorage.setItem(messagesKey, JSON.stringify(existingMessages));

        // Reset form
        setFormClientId("");
        setFormDocumentName("");
        setFormDescription("");
        setFormCategory("other");
        setFormPriority("medium");
        setFormDueDate("");
        setShowCreateModal(false);
        showToast("Document request sent to client", "success");
    };

    const handleApprove = (type: "request" | "upload", id: string) => {
        if (type === "request" && selectedRequest) {
            DocumentRequestAPI.approve(id, adminEmail, reviewNotes);
            setRequests(DocumentRequestAPI.getAll());
            showToast("Document approved", "success");
        } else if (type === "upload" && selectedUpload) {
            DocumentUploadAPI.approve(id, adminEmail, reviewNotes);
            setUploads(DocumentUploadAPI.getAll());
            if (selectedUpload.requestId) {
                DocumentRequestAPI.approve(selectedUpload.requestId, adminEmail, reviewNotes);
                setRequests(DocumentRequestAPI.getAll());
            }
            showToast("Upload approved", "success");
        }
        setShowReviewModal(false);
        setReviewNotes("");
    };

    const handleReject = (type: "request" | "upload", id: string) => {
        if (!reviewNotes.trim()) {
            showToast("Please provide a reason for rejection", "error");
            return;
        }

        if (type === "request" && selectedRequest) {
            DocumentRequestAPI.reject(id, adminEmail, reviewNotes);
            setRequests(DocumentRequestAPI.getAll());
            showToast("Document rejected", "success");
        } else if (type === "upload" && selectedUpload) {
            DocumentUploadAPI.reject(id, adminEmail, reviewNotes);
            setUploads(DocumentUploadAPI.getAll());
            if (selectedUpload.requestId) {
                DocumentRequestAPI.reject(selectedUpload.requestId, adminEmail, reviewNotes);
                setRequests(DocumentRequestAPI.getAll());
            }
            showToast("Upload rejected", "success");
        }
        setShowReviewModal(false);
        setReviewNotes("");
    };

    const handleDeleteRequest = (id: string) => {
        if (confirm("Are you sure you want to delete this request?")) {
            DocumentRequestAPI.delete(id);
            setRequests(DocumentRequestAPI.getAll());
            showToast("Request deleted", "success");
        }
    };

    const handleDownload = (upload: DocumentUpload) => {
        if (upload.base64) {
            const link = document.createElement("a");
            link.href = upload.base64;
            link.download = upload.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast(`Downloading ${upload.fileName}`, "success");
        } else {
            showToast("File not available for download", "error");
        }
    };

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"} text-white`}>
                    {toast.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    <span className="text-sm">{toast.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className={`text-xl font-semibold ${s.text}`}>Document Requests</h2>
                    <p className={s.textMuted}>Request and manage documents from clients</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadData} className={`${s.card} border px-3 py-2 rounded-lg ${s.hover} flex items-center gap-2`}>
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
                        <Plus className="w-4 h-4" /> Request Document
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className={`${s.card} border rounded-xl p-4`}>
                    <div className="flex items-center justify-between">
                        <FileText className={`w-5 h-5 ${s.textMuted}`} />
                        <span className={`text-xl font-bold ${s.text}`}>{stats.totalRequests}</span>
                    </div>
                    <p className={`text-xs ${s.textMuted} mt-1`}>Total Requests</p>
                </div>
                <div className={`${s.card} border rounded-xl p-4`}>
                    <div className="flex items-center justify-between">
                        <Clock className="w-5 h-5 text-amber-500" />
                        <span className="text-xl font-bold text-amber-500">{stats.pendingRequests}</span>
                    </div>
                    <p className={`text-xs ${s.textMuted} mt-1`}>Awaiting Upload</p>
                </div>
                <div className={`${s.card} border rounded-xl p-4`}>
                    <div className="flex items-center justify-between">
                        <FileUp className="w-5 h-5 text-blue-500" />
                        <span className="text-xl font-bold text-blue-500">{stats.uploadedRequests}</span>
                    </div>
                    <p className={`text-xs ${s.textMuted} mt-1`}>Uploaded</p>
                </div>
                <div className={`${s.card} border rounded-xl p-4`}>
                    <div className="flex items-center justify-between">
                        <Eye className="w-5 h-5 text-purple-500" />
                        <span className="text-xl font-bold text-purple-500">{stats.pendingUploads}</span>
                    </div>
                    <p className={`text-xs ${s.textMuted} mt-1`}>Pending Review</p>
                </div>
                <div className={`${s.card} border rounded-xl p-4`}>
                    <div className="flex items-center justify-between">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <span className="text-xl font-bold text-red-500">{stats.urgentRequests}</span>
                    </div>
                    <p className={`text-xs ${s.textMuted} mt-1`}>Urgent</p>
                </div>
            </div>

            {/* Filters */}
            <div className={`${s.card} border rounded-xl p-4`}>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex rounded-lg overflow-hidden border">
                        {[{ id: "requests", label: "Requests" }, { id: "uploads", label: "All Uploads" }].map(v => (
                            <button
                                key={v.id}
                                onClick={() => setViewMode(v.id as ViewMode)}
                                className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === v.id ? "bg-blue-600 text-white" : `${s.text} ${s.hover}`}`}
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${s.textMuted}`} />
                        <input
                            type="text"
                            placeholder="Search documents..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2 ${s.input} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                    </div>
                    {viewMode === "requests" && (
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value as FilterStatus)}
                            className={`${s.input} border rounded-lg px-3 py-2 text-sm focus:outline-none`}
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="uploaded">Uploaded</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    )}
                </div>
            </div>

            {/* Requests Table */}
            {viewMode === "requests" && (
                <div className={`${s.card} border rounded-xl overflow-hidden`}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={s.cardInner}>
                                <th className={`text-left px-4 py-3 font-medium ${s.textMuted}`}>Document</th>
                                <th className={`text-left px-4 py-3 font-medium ${s.textMuted}`}>Client</th>
                                <th className={`text-left px-4 py-3 font-medium ${s.textMuted}`}>Priority</th>
                                <th className={`text-left px-4 py-3 font-medium ${s.textMuted}`}>Status</th>
                                <th className={`text-left px-4 py-3 font-medium ${s.textMuted}`}>Due Date</th>
                                <th className={`text-left px-4 py-3 font-medium ${s.textMuted}`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${s.divider}`}>
                            {filteredRequests.length === 0 ? (
                                <tr><td colSpan={6} className={`px-4 py-8 text-center ${s.textMuted}`}>No document requests found</td></tr>
                            ) : (
                                filteredRequests.map(request => {
                                    const priorityColors = getPriorityColor(request.priority);
                                    const statusColors = getStatusColor(request.status);
                                    return (
                                        <tr key={request.id} className={s.hover}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? "bg-slate-700" : "bg-gray-100"}`}>
                                                        <FileText className={`w-5 h-5 ${s.textMuted}`} />
                                                    </div>
                                                    <div>
                                                        <p className={`font-medium ${s.text}`}>{request.documentName}</p>
                                                        <p className={`text-xs ${s.textMuted}`}>{request.category} • {getRelativeTime(request.createdAt)}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className={s.text}>{request.clientName}</p>
                                                <p className={`text-xs ${s.textMuted}`}>{request.clientEmail}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors.bg} ${priorityColors.text}`}>{request.priority}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>{request.status}</span>
                                            </td>
                                            <td className={`px-4 py-3 ${s.textMuted}`}>{request.dueDate ? formatDate(request.dueDate) : "-"}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    {request.status === "uploaded" && (
                                                        <button onClick={() => { setSelectedRequest(request); setShowReviewModal(true); }} className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" title="Review">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleDeleteRequest(request.id)} className={`p-2 rounded-lg ${s.hover}`} title="Delete">
                                                        <Trash2 className={`w-4 h-4 ${s.textMuted} hover:text-red-500`} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Uploads Table */}
            {viewMode === "uploads" && (
                <div className={`${s.card} border rounded-xl overflow-hidden`}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={s.cardInner}>
                                <th className={`text-left px-4 py-3 font-medium ${s.textMuted}`}>File</th>
                                <th className={`text-left px-4 py-3 font-medium ${s.textMuted}`}>Uploaded By</th>
                                <th className={`text-left px-4 py-3 font-medium ${s.textMuted}`}>Size</th>
                                <th className={`text-left px-4 py-3 font-medium ${s.textMuted}`}>Status</th>
                                <th className={`text-left px-4 py-3 font-medium ${s.textMuted}`}>Uploaded</th>
                                <th className={`text-left px-4 py-3 font-medium ${s.textMuted}`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${s.divider}`}>
                            {filteredUploads.length === 0 ? (
                                <tr><td colSpan={6} className={`px-4 py-8 text-center ${s.textMuted}`}>No uploads found</td></tr>
                            ) : (
                                filteredUploads.map(upload => {
                                    const statusColor = upload.status === "approved" ? "text-emerald-500 bg-emerald-500/20" :
                                        upload.status === "rejected" ? "text-red-500 bg-red-500/20" : "text-amber-500 bg-amber-500/20";
                                    return (
                                        <tr key={upload.id} className={s.hover}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <FileText className={`w-5 h-5 ${s.textMuted}`} />
                                                    <div>
                                                        <p className={`font-medium ${s.text}`}>{upload.fileName}</p>
                                                        <p className={`text-xs ${s.textMuted}`}>{upload.fileType}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`px-4 py-3 ${s.text}`}>{upload.uploadedBy}</td>
                                            <td className={`px-4 py-3 ${s.textMuted}`}>
                                                {upload.fileSize < 1024 ? `${upload.fileSize} B` :
                                                    upload.fileSize < 1048576 ? `${(upload.fileSize / 1024).toFixed(1)} KB` :
                                                        `${(upload.fileSize / 1048576).toFixed(1)} MB`}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>{upload.status.replace("_", " ")}</span>
                                            </td>
                                            <td className={`px-4 py-3 ${s.textMuted}`}>{getRelativeTime(upload.uploadedAt)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => handleDownload(upload)} className={`p-2 rounded-lg ${s.hover}`} title="Download">
                                                        <Download className={`w-4 h-4 ${s.textMuted}`} />
                                                    </button>
                                                    {upload.status === "pending_review" && (
                                                        <button onClick={() => { setSelectedUpload(upload); setShowReviewModal(true); }} className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" title="Review">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`${s.card} border rounded-xl w-full max-w-lg overflow-hidden`}>
                        <div className={`px-6 py-4 border-b ${s.divider} flex items-center justify-between`}>
                            <h3 className={`text-lg font-semibold ${s.text}`}>Request Document from Client</h3>
                            <button onClick={() => setShowCreateModal(false)} className={`p-2 rounded-lg ${s.hover}`}>
                                <X className={`w-5 h-5 ${s.textMuted}`} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className={`block text-sm font-medium ${s.textMuted} mb-1.5`}>Select Client *</label>
                                <select value={formClientId} onChange={e => setFormClientId(e.target.value)} className={`w-full px-4 py-2.5 rounded-lg border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500`}>
                                    <option value="">Choose a client...</option>
                                    {users.map(user => (
                                        <option key={user.customerId} value={user.customerId}>{user.firstName} {user.lastName} ({user.email})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${s.textMuted} mb-1.5`}>Document Name *</label>
                                <input type="text" value={formDocumentName} onChange={e => setFormDocumentName(e.target.value)} placeholder="e.g., W-2 Form 2024" className={`w-full px-4 py-2.5 rounded-lg border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${s.textMuted} mb-1.5`}>Description</label>
                                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Details about what you need..." rows={3} className={`w-full px-4 py-2.5 rounded-lg border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm font-medium ${s.textMuted} mb-1.5`}>Category</label>
                                    <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className={`w-full px-4 py-2.5 rounded-lg border ${s.input} focus:outline-none`}>
                                        {DOCUMENT_CATEGORIES.map(cat => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium ${s.textMuted} mb-1.5`}>Priority</label>
                                    <select value={formPriority} onChange={e => setFormPriority(e.target.value as DocumentRequestPriority)} className={`w-full px-4 py-2.5 rounded-lg border ${s.input} focus:outline-none`}>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${s.textMuted} mb-1.5`}>Due Date (Optional)</label>
                                <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className={`w-full px-4 py-2.5 rounded-lg border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
                            </div>
                        </div>
                        <div className={`px-6 py-4 border-t ${s.divider} flex justify-end gap-2`}>
                            <button onClick={() => setShowCreateModal(false)} className={`px-4 py-2 ${s.textMuted} text-sm`}>Cancel</button>
                            <button onClick={handleCreateRequest} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                                <Send className="w-4 h-4" /> Send Request
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {showReviewModal && (selectedRequest || selectedUpload) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`${s.card} border rounded-xl w-full max-w-lg overflow-hidden`}>
                        <div className={`px-6 py-4 border-b ${s.divider} flex items-center justify-between`}>
                            <h3 className={`text-lg font-semibold ${s.text}`}>Review Document</h3>
                            <button onClick={() => { setShowReviewModal(false); setSelectedRequest(null); setSelectedUpload(null); setReviewNotes(""); }} className={`p-2 rounded-lg ${s.hover}`}>
                                <X className={`w-5 h-5 ${s.textMuted}`} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {selectedRequest && (
                                <div className={`p-4 rounded-lg ${s.cardInner}`}>
                                    <p className={`font-medium ${s.text} mb-2`}>{selectedRequest.documentName}</p>
                                    <p className={`text-sm ${s.textMuted}`}>Requested from: {selectedRequest.clientName}</p>
                                    {selectedRequest.uploadedDocumentName && (<p className={`text-sm ${s.text} mt-2`}>📎 Uploaded: {selectedRequest.uploadedDocumentName}</p>)}
                                </div>
                            )}
                            {selectedUpload && (
                                <div className={`p-4 rounded-lg ${s.cardInner}`}>
                                    <p className={`font-medium ${s.text} mb-2`}>{selectedUpload.fileName}</p>
                                    <p className={`text-sm ${s.textMuted}`}>Uploaded by: {selectedUpload.uploadedBy}</p>
                                    {selectedUpload.base64 && (
                                        <button onClick={() => handleDownload(selectedUpload)} className="mt-2 text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1">
                                            <Download className="w-4 h-4" /> Download to review
                                        </button>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className={`block text-sm font-medium ${s.textMuted} mb-1.5`}>Review Notes</label>
                                <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Add notes (required for rejection)..." rows={3} className={`w-full px-4 py-2.5 rounded-lg border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`} />
                            </div>
                        </div>
                        <div className={`px-6 py-4 border-t ${s.divider} flex justify-end gap-2`}>
                            <button onClick={() => handleReject(selectedRequest ? "request" : "upload", selectedRequest?.id || selectedUpload?.id || "")} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">
                                <XCircle className="w-4 h-4" /> Reject
                            </button>
                            <button onClick={() => handleApprove(selectedRequest ? "request" : "upload", selectedRequest?.id || selectedUpload?.id || "")} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
                                <CheckCircle className="w-4 h-4" /> Approve
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDocumentRequests;