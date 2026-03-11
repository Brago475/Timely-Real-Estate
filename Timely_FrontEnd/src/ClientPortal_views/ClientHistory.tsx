// src/ClientPortal_views/ClientHistory.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    History,
    Search,
    Filter,
    Download,
    Calendar,
    Clock,
    User,
    FolderOpen,
    FileText,
    MessageCircle,
    Upload,
    Trash2,
    Edit3,
    Eye,
    UserPlus,
    UserMinus,
    CheckCircle,
    X,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    ArrowUpDown,
    Plus,
    Settings,
    LogIn,
    LogOut,
    Flag,
    Activity,
    TrendingUp,
} from "lucide-react";

const API_BASE = "http://localhost:4000/api";

type ClientHistoryProps = {
    userName?: string;
    userEmail?: string;
    customerId?: string;
};

type ActionType =
    | "LOGIN"
    | "LOGOUT"
    | "CREATE_CLIENT"
    | "DELETE_CLIENT"
    | "CREATE_PROJECT"
    | "DELETE_PROJECT"
    | "ASSIGN_PROJECT"
    | "ASSIGN_CONSULTANT"
    | "LOG_HOURS"
    | "DELETE_HOURS_LOG"
    | "CREATE_COMMENT"
    | "UPLOAD_ATTACHMENT"
    | "CREATE_POST"
    | "DELETE_POST"
    | "UPDATE_PROJECT_DETAILS"
    | "CREATE_PROJECT_DETAILS"
    | "other";

type CategoryType = "all" | "account" | "projects" | "hours" | "documents" | "consultants" | "feed";

interface HistoryEntry {
    id: string;
    action: string;
    category: CategoryType;
    title: string;
    description: string;
    entityId?: string;
    entityType?: string;
    performedBy?: string;
    timestamp: string;
}

interface FilterState {
    category: CategoryType;
    dateFrom: string;
    dateTo: string;
    searchQuery: string;
}

const ClientHistory: React.FC<ClientHistoryProps> = ({
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
        input: isDark
            ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500"
            : "bg-white border-gray-300 text-gray-900 placeholder-gray-400",
        dropdown: isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200",
        // Interactive
        clickable: "cursor-pointer active:scale-[0.98] transition-all duration-150",
        hoverLift: "hover:-translate-y-1 hover:shadow-xl transition-all duration-300",
    };

    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
    const [showExportMenu, setShowExportMenu] = useState(false);
    const itemsPerPage = 15;

    const [filters, setFilters] = useState<FilterState>({
        category: "all",
        dateFrom: "",
        dateTo: "",
        searchQuery: "",
    });

    // Action icon/color mapping with gradients
    const getActionConfig = (actionType: string) => {
        const configs: Record<string, { icon: React.ElementType; color: string; bgColor: string; gradient: string; label: string; category: CategoryType }> = {
            LOGIN: { icon: LogIn, color: "text-emerald-500", bgColor: "bg-emerald-500/10", gradient: "from-emerald-500 to-emerald-600", label: "Login", category: "account" },
            LOGOUT: { icon: LogOut, color: "text-gray-500", bgColor: "bg-gray-500/10", gradient: "from-gray-500 to-gray-600", label: "Logout", category: "account" },
            CREATE_CLIENT: { icon: UserPlus, color: "text-green-500", bgColor: "bg-green-500/10", gradient: "from-green-500 to-green-600", label: "Client Created", category: "account" },
            DELETE_CLIENT: { icon: UserMinus, color: "text-red-500", bgColor: "bg-red-500/10", gradient: "from-red-500 to-red-600", label: "Client Deleted", category: "account" },
            CREATE_PROJECT: { icon: Plus, color: "text-blue-500", bgColor: "bg-blue-500/10", gradient: "from-blue-500 to-blue-600", label: "Project Created", category: "projects" },
            DELETE_PROJECT: { icon: Trash2, color: "text-red-500", bgColor: "bg-red-500/10", gradient: "from-red-500 to-red-600", label: "Project Deleted", category: "projects" },
            ASSIGN_PROJECT: { icon: FolderOpen, color: "text-purple-500", bgColor: "bg-purple-500/10", gradient: "from-purple-500 to-purple-600", label: "Project Assigned", category: "projects" },
            ASSIGN_CONSULTANT: { icon: UserPlus, color: "text-indigo-500", bgColor: "bg-indigo-500/10", gradient: "from-indigo-500 to-indigo-600", label: "Consultant Assigned", category: "consultants" },
            LOG_HOURS: { icon: Clock, color: "text-amber-500", bgColor: "bg-amber-500/10", gradient: "from-amber-500 to-amber-600", label: "Hours Logged", category: "hours" },
            DELETE_HOURS_LOG: { icon: Trash2, color: "text-red-500", bgColor: "bg-red-500/10", gradient: "from-red-500 to-red-600", label: "Hours Deleted", category: "hours" },
            CREATE_COMMENT: { icon: MessageCircle, color: "text-pink-500", bgColor: "bg-pink-500/10", gradient: "from-pink-500 to-pink-600", label: "Comment Added", category: "projects" },
            UPLOAD_ATTACHMENT: { icon: Upload, color: "text-cyan-500", bgColor: "bg-cyan-500/10", gradient: "from-cyan-500 to-cyan-600", label: "File Uploaded", category: "documents" },
            CREATE_POST: { icon: Edit3, color: "text-violet-500", bgColor: "bg-violet-500/10", gradient: "from-violet-500 to-violet-600", label: "Post Created", category: "feed" },
            DELETE_POST: { icon: Trash2, color: "text-red-500", bgColor: "bg-red-500/10", gradient: "from-red-500 to-red-600", label: "Post Deleted", category: "feed" },
            UPDATE_PROJECT_DETAILS: { icon: Edit3, color: "text-amber-500", bgColor: "bg-amber-500/10", gradient: "from-amber-500 to-amber-600", label: "Project Updated", category: "projects" },
            CREATE_PROJECT_DETAILS: { icon: Plus, color: "text-green-500", bgColor: "bg-green-500/10", gradient: "from-green-500 to-green-600", label: "Project Details Added", category: "projects" },
            CREATE_CONSULTANT: { icon: UserPlus, color: "text-green-500", bgColor: "bg-green-500/10", gradient: "from-green-500 to-green-600", label: "Consultant Created", category: "consultants" },
            DELETE_CONSULTANT: { icon: UserMinus, color: "text-red-500", bgColor: "bg-red-500/10", gradient: "from-red-500 to-red-600", label: "Consultant Deleted", category: "consultants" },
        };
        return configs[actionType] || { icon: Eye, color: "text-gray-500", bgColor: "bg-gray-500/10", gradient: "from-gray-500 to-gray-600", label: actionType, category: "account" as CategoryType };
    };

    // Category configurations with gradients
    const categoryConfig: Record<CategoryType, { icon: React.ElementType; label: string; gradient: string }> = {
        all: { icon: History, label: "All Activity", gradient: "from-blue-500 to-blue-600" },
        account: { icon: User, label: "Account", gradient: "from-emerald-500 to-emerald-600" },
        projects: { icon: FolderOpen, label: "Projects", gradient: "from-purple-500 to-purple-600" },
        hours: { icon: Clock, label: "Hours", gradient: "from-amber-500 to-amber-600" },
        documents: { icon: FileText, label: "Documents", gradient: "from-cyan-500 to-cyan-600" },
        consultants: { icon: UserPlus, label: "Consultants", gradient: "from-indigo-500 to-indigo-600" },
        feed: { icon: MessageCircle, label: "Team Feed", gradient: "from-pink-500 to-pink-600" },
    };

    // Load history from API
    useEffect(() => {
        loadHistory();
    }, [customerId]);

    const loadHistory = async () => {
        setLoading(true);
        const entries: HistoryEntry[] = [];

        try {
            // Get client's project IDs for filtering
            const projectClients = JSON.parse(localStorage.getItem("timely_project_clients") || "[]");
            const clientProjectIds = new Set(
                projectClients
                    .filter((pc: any) => String(pc.clientId) === String(customerId))
                    .map((pc: any) => String(pc.projectId))
            );

            // Fetch audit logs from API (get more to have enough after filtering)
            const auditRes = await fetch(`${API_BASE}/audit-logs/latest?limit=500`);
            if (auditRes.ok) {
                const auditData = await auditRes.json();
                if (auditData.data && Array.isArray(auditData.data)) {
                    auditData.data.forEach((log: any) => {
                        // Filter: show only client-related entries
                        const isClientRelated =
                            // Login/logout by this client
                            (log.performedBy === userEmail) ||
                            // Actions on client's projects
                            (log.entityType === "project" && clientProjectIds.has(String(log.entityId?.replace("P", "")))) ||
                            (log.entityType === "project_assignment" && log.entityId?.includes(`C${customerId}`)) ||
                            // Client-consultant assignments for this client
                            (log.entityType === "client_consultant" && log.entityId?.includes(`C${customerId}`)) ||
                            // Hours logged on client's projects
                            (log.entityType === "hours_log" && log.details?.includes(`project`)) ||
                            // Comments on client's projects
                            (log.entityType === "comment") ||
                            // Attachments on client's projects
                            (log.entityType === "attachment");

                        if (isClientRelated) {
                            const config = getActionConfig(log.actionType);
                            entries.push({
                                id: log.logId || `audit_${log.timestamp}`,
                                action: log.actionType,
                                category: config.category,
                                title: config.label,
                                description: log.details || "Activity recorded",
                                entityId: log.entityId,
                                entityType: log.entityType,
                                performedBy: log.performedBy,
                                timestamp: log.timestamp,
                            });
                        }
                    });
                }
            }

            // Also fetch hours logs directly for client's projects
            const hoursRes = await fetch(`${API_BASE}/hours-logs`);
            if (hoursRes.ok) {
                const hoursData = await hoursRes.json();
                if (hoursData.data && Array.isArray(hoursData.data)) {
                    // Get project names
                    const projectsRes = await fetch(`${API_BASE}/projects`);
                    const projectsData = projectsRes.ok ? await projectsRes.json() : { data: [] };
                    const projectsMap = new Map(
                        (projectsData.data || []).map((p: any) => [String(p.projectId), p.projectName])
                    );

                    hoursData.data
                        .filter((h: any) => clientProjectIds.has(String(h.projectId)))
                        .forEach((h: any) => {
                            const projectName = projectsMap.get(String(h.projectId)) || `Project ${h.projectId}`;
                            // Avoid duplicates with audit log
                            const existingId = `hours_${h.logId}`;
                            if (!entries.some(e => e.id === existingId)) {
                                entries.push({
                                    id: existingId,
                                    action: "LOG_HOURS",
                                    category: "hours",
                                    title: "Hours Logged",
                                    description: `${h.hours}h logged on ${projectName}${h.description ? `: ${h.description}` : ""}`,
                                    entityId: h.logId,
                                    timestamp: h.createdAt || h.date,
                                });
                            }
                        });
                }
            }

            // Fetch project comments
            for (const projectId of clientProjectIds) {
                try {
                    const commentsRes = await fetch(`${API_BASE}/project-comments/${projectId}`);
                    if (commentsRes.ok) {
                        const commentsData = await commentsRes.json();
                        if (commentsData.data && Array.isArray(commentsData.data)) {
                            commentsData.data.forEach((c: any) => {
                                const existingId = `comment_${c.commentId}`;
                                if (!entries.some(e => e.id === existingId)) {
                                    entries.push({
                                        id: existingId,
                                        action: "CREATE_COMMENT",
                                        category: "projects",
                                        title: "Comment Added",
                                        description: `${c.author}: "${c.commentText?.substring(0, 50)}${c.commentText?.length > 50 ? '...' : ''}"`,
                                        entityId: c.commentId,
                                        performedBy: c.author,
                                        timestamp: c.createdAt,
                                    });
                                }
                            });
                        }
                    }
                } catch (e) {
                    // Skip if error
                }
            }

            // Fetch attachments for client's projects
            for (const projectId of clientProjectIds) {
                try {
                    const attachRes = await fetch(`${API_BASE}/project-attachments/${projectId}`);
                    if (attachRes.ok) {
                        const attachData = await attachRes.json();
                        if (attachData.data && Array.isArray(attachData.data)) {
                            attachData.data.forEach((a: any) => {
                                const existingId = `attachment_${a.attachmentId}`;
                                if (!entries.some(e => e.id === existingId)) {
                                    entries.push({
                                        id: existingId,
                                        action: "UPLOAD_ATTACHMENT",
                                        category: "documents",
                                        title: "File Uploaded",
                                        description: `${a.fileName} uploaded by ${a.uploadedBy || "Unknown"}`,
                                        entityId: a.attachmentId,
                                        performedBy: a.uploadedBy,
                                        timestamp: a.createdAt,
                                    });
                                }
                            });
                        }
                    }
                } catch (e) {
                    // Skip if error
                }
            }

            setHistory(entries);
        } catch (e) {
            console.error("Error loading history:", e);
        } finally {
            setLoading(false);
        }
    };

    // Filter and sort history
    const filteredHistory = useMemo(() => {
        let result = [...history];

        if (filters.category !== "all") {
            result = result.filter((h) => h.category === filters.category);
        }

        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            result = result.filter((h) => h.timestamp && new Date(h.timestamp) >= fromDate);
        }

        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            result = result.filter((h) => h.timestamp && new Date(h.timestamp) <= toDate);
        }

        if (filters.searchQuery.trim()) {
            const query = filters.searchQuery.toLowerCase();
            result = result.filter(
                (h) =>
                    h.title.toLowerCase().includes(query) ||
                    h.description.toLowerCase().includes(query) ||
                    (h.performedBy && h.performedBy.toLowerCase().includes(query))
            );
        }

        result.sort((a, b) => {
            const dateA = new Date(a.timestamp || 0).getTime();
            const dateB = new Date(b.timestamp || 0).getTime();
            return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [history, filters, sortOrder]);

    // Pagination
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    const paginatedHistory = filteredHistory.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Format timestamp
    const formatTimestamp = (ts: string) => {
        if (!ts) return "Unknown";
        const date = new Date(ts);
        if (isNaN(date.getTime())) return "Unknown";

        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });
    };

    const formatFullDate = (ts: string) => {
        if (!ts) return "Unknown";
        const date = new Date(ts);
        if (isNaN(date.getTime())) return "Unknown";

        return date.toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Export history
    const exportHistory = (format: "csv" | "json") => {
        if (filteredHistory.length === 0) return;

        const data = filteredHistory.map((h) => ({
            Date: formatFullDate(h.timestamp),
            Action: h.title,
            Category: categoryConfig[h.category]?.label || h.category,
            Description: h.description,
            PerformedBy: h.performedBy || "",
        }));

        if (format === "json") {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            downloadBlob(blob, `history_export_${Date.now()}.json`);
        } else {
            const headers = Object.keys(data[0]).join(",");
            const rows = data.map((row) => Object.values(row).map((v) => `"${v}"`).join(","));
            const csv = [headers, ...rows].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            downloadBlob(blob, `history_export_${Date.now()}.csv`);
        }
        setShowExportMenu(false);
    };

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const clearFilters = () => {
        setFilters({
            category: "all",
            dateFrom: "",
            dateTo: "",
            searchQuery: "",
        });
        setCurrentPage(1);
    };

    const hasActiveFilters =
        filters.category !== "all" ||
        filters.dateFrom ||
        filters.dateTo ||
        filters.searchQuery;

    // Stats
    const stats = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thisWeek = new Date(today);
        thisWeek.setDate(thisWeek.getDate() - 7);
        const thisMonth = new Date(today);
        thisMonth.setMonth(thisMonth.getMonth() - 1);

        return {
            total: history.length,
            today: history.filter((h) => h.timestamp && new Date(h.timestamp) >= today).length,
            thisWeek: history.filter((h) => h.timestamp && new Date(h.timestamp) >= thisWeek).length,
            thisMonth: history.filter((h) => h.timestamp && new Date(h.timestamp) >= thisMonth).length,
        };
    }, [history]);

    return (
        <div className={`${s.bg} min-h-full`}>
            {/* Entry Detail Modal */}
            {selectedEntry && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className={`${s.card} border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200`}>
                        <div className={`px-6 py-4 border-b ${s.divider} flex items-center justify-between`}>
                            <div className="flex items-center gap-3">
                                {(() => {
                                    const config = getActionConfig(selectedEntry.action);
                                    return (
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
                                            <config.icon className="w-5 h-5 text-white" />
                                        </div>
                                    );
                                })()}
                                <h3 className={`text-lg font-bold ${s.text}`}>Activity Details</h3>
                            </div>
                            <button
                                onClick={() => setSelectedEntry(null)}
                                className={`p-2 rounded-xl ${s.cardHover} transition-all duration-200 hover:shadow-md active:scale-95`}
                            >
                                <X className={`w-5 h-5 ${s.textMuted}`} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-start gap-4">
                                {(() => {
                                    const config = getActionConfig(selectedEntry.action);
                                    const IconComponent = config.icon;
                                    return (
                                        <>
                                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-xl`}>
                                                <IconComponent className="w-7 h-7 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-bold text-lg ${s.text}`}>{selectedEntry.title}</p>
                                                <p className={`text-sm ${s.textMuted} mt-1`}>{selectedEntry.description}</p>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            <div className={`p-4 ${s.cardInner} rounded-xl space-y-3`}>
                                <div className="flex justify-between items-center">
                                    <span className={`text-sm ${s.textMuted} flex items-center gap-2`}>
                                        <Calendar className="w-4 h-4" /> Date & Time
                                    </span>
                                    <span className={`text-sm font-medium ${s.text}`}>{formatFullDate(selectedEntry.timestamp)}</span>
                                </div>
                                <div className={`border-t ${s.divider} pt-3 flex justify-between items-center`}>
                                    <span className={`text-sm ${s.textMuted} flex items-center gap-2`}>
                                        <FolderOpen className="w-4 h-4" /> Category
                                    </span>
                                    <span className={`text-sm font-medium ${s.text} px-2 py-1 rounded-lg ${s.cardInner}`}>
                                        {categoryConfig[selectedEntry.category]?.label || selectedEntry.category}
                                    </span>
                                </div>
                                {selectedEntry.performedBy && (
                                    <div className={`border-t ${s.divider} pt-3 flex justify-between items-center`}>
                                        <span className={`text-sm ${s.textMuted} flex items-center gap-2`}>
                                            <User className="w-4 h-4" /> Performed By
                                        </span>
                                        <span className={`text-sm font-medium ${s.text}`}>{selectedEntry.performedBy}</span>
                                    </div>
                                )}
                                {selectedEntry.entityId && (
                                    <div className={`border-t ${s.divider} pt-3 flex justify-between items-center`}>
                                        <span className={`text-sm ${s.textMuted} flex items-center gap-2`}>
                                            <FileText className="w-4 h-4" /> Reference ID
                                        </span>
                                        <span className={`text-sm font-mono ${s.text} px-2 py-1 rounded-lg ${s.cardInner}`}>{selectedEntry.entityId}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className={`px-6 py-4 border-t ${s.divider}`}>
                            <button
                                onClick={() => setSelectedEntry(null)}
                                className={`w-full ${s.button} py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-md active:scale-[0.98]`}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className={`text-2xl font-bold ${s.text}`}>History</h1>
                        <p className={`text-sm ${s.textMuted} mt-1`}>Track all activity on your account</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={loadHistory}
                            disabled={loading}
                            className={`p-2.5 rounded-xl ${s.button} transition-all duration-200 hover:shadow-md active:scale-95`}
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : "hover:rotate-180 transition-transform duration-500"}`} />
                        </button>
                        {filteredHistory.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    className={`${s.button} px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all duration-200 hover:shadow-md active:scale-95`}
                                >
                                    <Download className="w-4 h-4" />
                                    Export
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showExportMenu ? "rotate-180" : ""}`} />
                                </button>
                                {showExportMenu && (
                                    <div className={`absolute right-0 top-full mt-2 ${s.dropdown} border rounded-xl overflow-hidden shadow-xl z-10 min-w-[160px] animate-in fade-in slide-in-from-top-2 duration-200`}>
                                        <button
                                            onClick={() => exportHistory("csv")}
                                            className={`w-full px-4 py-3 text-left text-sm ${s.text} ${s.cardHover} flex items-center gap-2 transition-all duration-200 active:scale-[0.98]`}
                                        >
                                            <FileText className="w-4 h-4" />
                                            Export as CSV
                                        </button>
                                        <button
                                            onClick={() => exportHistory("json")}
                                            className={`w-full px-4 py-3 text-left text-sm ${s.text} ${s.cardHover} flex items-center gap-2 transition-all duration-200 active:scale-[0.98]`}
                                        >
                                            <FileText className="w-4 h-4" />
                                            Export as JSON
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Total Events", value: stats.total, icon: Activity, gradient: "from-blue-500 to-blue-600", shadow: "shadow-blue-500/20" },
                        { label: "Today", value: stats.today, icon: Calendar, gradient: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/20" },
                        { label: "This Week", value: stats.thisWeek, icon: TrendingUp, gradient: "from-purple-500 to-purple-600", shadow: "shadow-purple-500/20" },
                        { label: "This Month", value: stats.thisMonth, icon: Clock, gradient: "from-amber-500 to-amber-600", shadow: "shadow-amber-500/20" },
                    ].map((stat, i) => (
                        <div
                            key={i}
                            style={{ animationDelay: `${i * 100}ms` }}
                            className={`${s.card} border rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group animate-in fade-in slide-in-from-bottom`}
                        >
                            <div className="flex items-center justify-between">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg ${stat.shadow} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                                    <stat.icon className="w-6 h-6 text-white" />
                                </div>
                                <span className={`text-3xl font-bold ${s.text}`}>{stat.value}</span>
                            </div>
                            <p className={`text-sm ${s.textMuted} mt-3`}>{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Search & Filters */}
                <div className={`${s.card} border rounded-2xl p-4`}>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${s.textMuted} group-focus-within:text-blue-500 transition-colors`} />
                            <input
                                type="text"
                                placeholder="Search history..."
                                value={filters.searchQuery}
                                onChange={(e) => {
                                    setFilters((f) => ({ ...f, searchQuery: e.target.value }));
                                    setCurrentPage(1);
                                }}
                                className={`w-full pl-10 pr-4 py-3 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200`}
                            />
                        </div>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`${showFilters || hasActiveFilters ? s.buttonPrimary + " shadow-lg shadow-blue-500/20" : s.button} px-5 py-3 rounded-xl flex items-center gap-2 transition-all duration-200 hover:shadow-md active:scale-95`}
                        >
                            <Filter className="w-4 h-4" />
                            Filters
                            {hasActiveFilters && (
                                <span className="w-5 h-5 rounded-full bg-white/20 text-xs flex items-center justify-center font-bold">
                                    {[filters.category !== "all", filters.dateFrom, filters.dateTo].filter(Boolean).length}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                            className={`${s.button} px-5 py-3 rounded-xl flex items-center gap-2 transition-all duration-200 hover:shadow-md active:scale-95`}
                        >
                            <ArrowUpDown className={`w-4 h-4 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                            {sortOrder === "desc" ? "Newest" : "Oldest"}
                        </button>
                    </div>

                    {showFilters && (
                        <div className={`mt-4 pt-4 border-t ${s.divider} grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top duration-200`}>
                            <div>
                                <label className={`block text-sm font-semibold ${s.textMuted} mb-2`}>Category</label>
                                <select
                                    value={filters.category}
                                    onChange={(e) => {
                                        setFilters((f) => ({ ...f, category: e.target.value as CategoryType }));
                                        setCurrentPage(1);
                                    }}
                                    className={`w-full px-4 py-3 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 cursor-pointer`}
                                >
                                    {Object.entries(categoryConfig).map(([key, { label }]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className={`block text-sm font-semibold ${s.textMuted} mb-2`}>From Date</label>
                                <input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => {
                                        setFilters((f) => ({ ...f, dateFrom: e.target.value }));
                                        setCurrentPage(1);
                                    }}
                                    className={`w-full px-4 py-3 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 cursor-pointer`}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-semibold ${s.textMuted} mb-2`}>To Date</label>
                                <input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => {
                                        setFilters((f) => ({ ...f, dateTo: e.target.value }));
                                        setCurrentPage(1);
                                    }}
                                    className={`w-full px-4 py-3 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 cursor-pointer`}
                                />
                            </div>

                            {hasActiveFilters && (
                                <div className="md:col-span-3">
                                    <button
                                        onClick={clearFilters}
                                        className={`text-sm text-red-500 hover:text-red-600 flex items-center gap-1.5 transition-colors duration-200`}
                                    >
                                        <X className="w-4 h-4" />
                                        Clear all filters
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Results Info */}
                <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${s.textMuted}`}>
                        {filteredHistory.length === 0
                            ? "No activity found"
                            : `Showing ${paginatedHistory.length} of ${filteredHistory.length} entries`}
                    </p>
                </div>

                {/* History List */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                        <p className={s.textMuted}>Loading history...</p>
                    </div>
                ) : paginatedHistory.length === 0 ? (
                    <div className={`${s.card} border-2 border-dashed rounded-2xl p-12 text-center`}>
                        <div className={`w-20 h-20 rounded-2xl ${isDark ? "bg-slate-800" : "bg-gray-100"} flex items-center justify-center mx-auto mb-6`}>
                            <History className={`w-10 h-10 ${s.textSubtle}`} />
                        </div>
                        <p className={`text-xl font-bold ${s.text} mb-2`}>
                            {hasActiveFilters ? "No matching activity" : "No activity yet"}
                        </p>
                        <p className={s.textMuted}>
                            {hasActiveFilters ? "Try adjusting your filters" : "Activity will appear here as you use the portal"}
                        </p>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className={`mt-4 text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors`}
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className={`${s.card} border rounded-2xl overflow-hidden`}>
                        {paginatedHistory.map((entry, index) => {
                            const config = getActionConfig(entry.action);
                            const IconComponent = config.icon;
                            return (
                                <div
                                    key={entry.id}
                                    onClick={() => setSelectedEntry(entry)}
                                    style={{ animationDelay: `${index * 30}ms` }}
                                    className={`flex items-center gap-4 p-4 cursor-pointer transition-all duration-200 group animate-in fade-in slide-in-from-left ${s.cardHover} active:scale-[0.99] ${index !== paginatedHistory.length - 1 ? `border-b ${s.divider}` : ""
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                                        <IconComponent className="w-6 h-6 text-white" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className={`font-semibold ${s.text} group-hover:text-blue-500 transition-colors`}>{entry.title}</p>
                                            <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${s.cardInner} ${s.textMuted}`}>
                                                {categoryConfig[entry.category]?.label || entry.category}
                                            </span>
                                        </div>
                                        <p className={`text-sm ${s.textMuted} truncate mt-0.5`}>{entry.description}</p>
                                    </div>

                                    <div className="text-right flex-shrink-0 flex items-center gap-3">
                                        <p className={`text-sm font-medium ${s.textMuted}`}>{formatTimestamp(entry.timestamp)}</p>
                                        <ChevronRight className={`w-5 h-5 ${s.textSubtle} group-hover:translate-x-1 group-hover:text-blue-500 transition-all`} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className={`p-2.5 rounded-xl ${s.button} disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md active:scale-95`}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-10 h-10 rounded-xl font-semibold transition-all duration-200 hover:shadow-md active:scale-95 ${currentPage === pageNum
                                                ? `${s.buttonPrimary} shadow-lg shadow-blue-500/20`
                                                : s.button
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className={`p-2.5 rounded-xl ${s.button} disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md active:scale-95`}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientHistory;