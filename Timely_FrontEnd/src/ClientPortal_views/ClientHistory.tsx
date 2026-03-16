// src/ClientPortal_views/ClientHistory.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    History, Search, Filter, Download, Calendar, Clock, User,
    FolderOpen, FileText, MessageCircle, Upload, Trash2, Edit3,
    Eye, UserPlus, UserMinus, CheckCircle, X, ChevronLeft,
    ChevronRight, RefreshCw, ArrowUpDown, Plus, LogIn, LogOut,
    Activity, TrendingUp, Info,
} from "lucide-react";

import { getAssignedProjectIds } from "./Clientassignmentservice";

const API_BASE = "/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientHistoryProps = { userName?: string; userEmail?: string; customerId?: string; };
type CategoryType = "all" | "account" | "projects" | "hours" | "documents" | "consultants" | "feed";

interface HistoryEntry {
    id: string; action: string; category: CategoryType;
    title: string; description: string;
    entityId?: string; entityType?: string;
    performedBy?: string; timestamp: string;
}

interface FilterState {
    category: CategoryType; dateFrom: string; dateTo: string; searchQuery: string;
}

// ─── Action config ────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string; category: CategoryType }> = {
    LOGIN:                   { icon: LogIn,        color: "bg-emerald-600", label: "Login",               category: "account" },
    LOGOUT:                  { icon: LogOut,        color: "bg-gray-600",   label: "Logout",              category: "account" },
    CREATE_CLIENT:           { icon: UserPlus,      color: "bg-blue-600",   label: "Client Created",      category: "account" },
    DELETE_CLIENT:           { icon: UserMinus,     color: "bg-red-600",    label: "Client Deleted",      category: "account" },
    CREATE_PROJECT:          { icon: Plus,          color: "bg-blue-600",   label: "Project Created",     category: "projects" },
    DELETE_PROJECT:          { icon: Trash2,        color: "bg-red-600",    label: "Project Deleted",     category: "projects" },
    ASSIGN_PROJECT:          { icon: FolderOpen,    color: "bg-blue-600",   label: "Project Assigned",    category: "projects" },
    UPDATE_PROJECT_DETAILS:  { icon: Edit3,         color: "bg-amber-600",  label: "Project Updated",     category: "projects" },
    CREATE_PROJECT_DETAILS:  { icon: Plus,          color: "bg-emerald-600",label: "Project Details Added", category: "projects" },
    ASSIGN_CONSULTANT:       { icon: UserPlus,      color: "bg-blue-600",   label: "Consultant Assigned", category: "consultants" },
    CREATE_CONSULTANT:       { icon: UserPlus,      color: "bg-emerald-600",label: "Consultant Created",  category: "consultants" },
    DELETE_CONSULTANT:       { icon: UserMinus,     color: "bg-red-600",    label: "Consultant Deleted",  category: "consultants" },
    LOG_HOURS:               { icon: Clock,         color: "bg-amber-600",  label: "Hours Logged",        category: "hours" },
    DELETE_HOURS_LOG:        { icon: Trash2,        color: "bg-red-600",    label: "Hours Deleted",       category: "hours" },
    CREATE_COMMENT:          { icon: MessageCircle, color: "bg-blue-600",   label: "Comment Added",       category: "projects" },
    UPLOAD_ATTACHMENT:       { icon: Upload,        color: "bg-blue-600",   label: "File Uploaded",       category: "documents" },
    CREATE_POST:             { icon: Edit3,         color: "bg-blue-600",   label: "Post Created",        category: "feed" },
    DELETE_POST:             { icon: Trash2,        color: "bg-red-600",    label: "Post Deleted",        category: "feed" },
};

const getActionConfig = (action: string) =>
    ACTION_CONFIG[action] || { icon: Eye, color: "bg-gray-600", label: action, category: "account" as CategoryType };

const CATEGORY_CONFIG: Record<CategoryType, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
    all:         { icon: History,    label: "All Activity" },
    account:     { icon: User,       label: "Account" },
    projects:    { icon: FolderOpen, label: "Projects" },
    hours:       { icon: Clock,      label: "Hours" },
    documents:   { icon: FileText,   label: "Documents" },
    consultants: { icon: UserPlus,   label: "Consultants" },
    feed:        { icon: MessageCircle, label: "Team Feed" },
};

// ─── Component ────────────────────────────────────────────────────────────────

const ClientHistory: React.FC<ClientHistoryProps> = ({
    userName = "Client", userEmail = "", customerId = "",
}) => {
    const { isDark } = useTheme();

    const n = {
        bg:           isDark ? "neu-bg-dark"       : "neu-bg-light",
        card:         isDark ? "neu-dark"           : "neu-light",
        flat:         isDark ? "neu-dark-flat"      : "neu-light-flat",
        inset:        isDark ? "neu-dark-inset"     : "neu-light-inset",
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
        rowHover:     isDark ? "hover:bg-gray-800/60" : "hover:bg-black/5",
        edgeHover: isDark
            ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]"
            : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]",
    };

    const [history,         setHistory]         = useState<HistoryEntry[]>([]);
    const [loading,         setLoading]         = useState(true);
    const [showFilters,     setShowFilters]     = useState(false);
    const [selectedEntry,   setSelectedEntry]   = useState<HistoryEntry | null>(null);
    const [currentPage,     setCurrentPage]     = useState(1);
    const [sortOrder,       setSortOrder]       = useState<"desc" | "asc">("desc");
    const [showExportMenu,  setShowExportMenu]  = useState(false);
    const ITEMS = 15;

    const [filters, setFilters] = useState<FilterState>({
        category: "all", dateFrom: "", dateTo: "", searchQuery: "",
    });

    useEffect(() => { loadHistory(); }, [customerId]);

    const loadHistory = async () => {
        setLoading(true);
        const entries: HistoryEntry[] = [];
        try {
            // Use shared service — handles all formats, deduplicates
            const clientProjectIds = new Set(getAssignedProjectIds(customerId));

            const auditRes = await fetch(`${API_BASE}/audit-logs/latest?limit=500`);
            if (auditRes.ok) {
                const auditData = await auditRes.json();
                (auditData.data || []).forEach((log: any) => {
                    const isRelated =
                        log.performedBy === userEmail ||
                        (log.entityType === "project" && clientProjectIds.has(String(log.entityId?.replace("P", "")))) ||
                        (log.entityType === "client_consultant" && log.entityId?.includes(`C${customerId}`));
                    if (isRelated) {
                        const config = getActionConfig(log.actionType);
                        entries.push({ id: log.logId || `audit_${log.timestamp}`, action: log.actionType, category: config.category, title: config.label, description: log.details || "Activity recorded", entityId: log.entityId, entityType: log.entityType, performedBy: log.performedBy, timestamp: log.timestamp });
                    }
                });
            }

            const hoursRes = await fetch(`${API_BASE}/hours-logs`);
            if (hoursRes.ok) {
                const hd = await hoursRes.json();
                const prRes = await fetch(`${API_BASE}/projects`);
                const prData = prRes.ok ? await prRes.json() : { data: [] };
                const prMap = new Map((prData.data || []).map((p: any) => [String(p.projectId), p.projectName]));
                (hd.data || []).filter((h: any) => clientProjectIds.has(String(h.projectId))).forEach((h: any) => {
                    const id = `hours_${h.logId}`;
                    if (!entries.some(e => e.id === id))
                        entries.push({ id, action: "LOG_HOURS", category: "hours", title: "Hours Logged", description: `${h.hours}h on ${prMap.get(String(h.projectId)) || `Project ${h.projectId}`}${h.description ? `: ${h.description}` : ""}`, entityId: h.logId, timestamp: h.createdAt || h.date });
                });
            }

            for (const pid of clientProjectIds) {
                try {
                    const cRes = await fetch(`${API_BASE}/project-comments/${pid}`);
                    if (cRes.ok) {
                        const cd = await cRes.json();
                        (cd.data || []).forEach((c: any) => {
                            const id = `comment_${c.commentId}`;
                            if (!entries.some(e => e.id === id))
                                entries.push({ id, action: "CREATE_COMMENT", category: "projects", title: "Comment Added", description: `${c.author}: "${(c.commentText || "").slice(0, 50)}${c.commentText?.length > 50 ? "…" : ""}"`, entityId: c.commentId, performedBy: c.author, timestamp: c.createdAt });
                        });
                    }
                    const aRes = await fetch(`${API_BASE}/project-attachments/${pid}`);
                    if (aRes.ok) {
                        const ad = await aRes.json();
                        (ad.data || []).forEach((a: any) => {
                            const id = `attachment_${a.attachmentId}`;
                            if (!entries.some(e => e.id === id))
                                entries.push({ id, action: "UPLOAD_ATTACHMENT", category: "documents", title: "File Uploaded", description: `${a.fileName} by ${a.uploadedBy || "Unknown"}`, entityId: a.attachmentId, performedBy: a.uploadedBy, timestamp: a.createdAt });
                        });
                    }
                } catch {}
            }
            setHistory(entries);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const filteredHistory = useMemo(() => {
        let r = [...history];
        if (filters.category !== "all")  r = r.filter(h => h.category === filters.category);
        if (filters.dateFrom)             r = r.filter(h => h.timestamp && new Date(h.timestamp) >= new Date(filters.dateFrom));
        if (filters.dateTo)               { const d = new Date(filters.dateTo); d.setHours(23,59,59,999); r = r.filter(h => h.timestamp && new Date(h.timestamp) <= d); }
        if (filters.searchQuery.trim()) {
            const q = filters.searchQuery.toLowerCase();
            r = r.filter(h => h.title.toLowerCase().includes(q) || h.description.toLowerCase().includes(q) || (h.performedBy || "").toLowerCase().includes(q));
        }
        return r.sort((a, b) => {
            const diff = new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
            return sortOrder === "desc" ? diff : -diff;
        });
    }, [history, filters, sortOrder]);

    const totalPages    = Math.ceil(filteredHistory.length / ITEMS);
    const paginated     = filteredHistory.slice((currentPage - 1) * ITEMS, currentPage * ITEMS);
    const hasFilters    = filters.category !== "all" || filters.dateFrom || filters.dateTo || filters.searchQuery;

    const stats = useMemo(() => {
        const now = new Date();
        const today = new Date(now); today.setHours(0,0,0,0);
        const week  = new Date(today); week.setDate(week.getDate() - 7);
        const month = new Date(today); month.setMonth(month.getMonth() - 1);
        return {
            total:     history.length,
            today:     history.filter(h => h.timestamp && new Date(h.timestamp) >= today).length,
            thisWeek:  history.filter(h => h.timestamp && new Date(h.timestamp) >= week).length,
            thisMonth: history.filter(h => h.timestamp && new Date(h.timestamp) >= month).length,
        };
    }, [history]);

    const fmtRelative = (ts: string) => {
        if (!ts) return "Unknown";
        const d = new Date(ts); if (isNaN(d.getTime())) return "Unknown";
        const diff = Date.now() - d.getTime();
        if (diff < 60000)   return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000)return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000)return `${Math.floor(diff / 86400000)}d ago`;
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const fmtFull = (ts: string) => {
        if (!ts) return "Unknown";
        const d = new Date(ts); if (isNaN(d.getTime())) return "Unknown";
        return d.toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    const exportHistory = (format: "csv" | "json") => {
        const data = filteredHistory.map(h => ({ Date: fmtFull(h.timestamp), Action: h.title, Category: CATEGORY_CONFIG[h.category]?.label || h.category, Description: h.description, PerformedBy: h.performedBy || "" }));
        const blob = format === "json"
            ? new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
            : new Blob([[Object.keys(data[0]).join(","), ...data.map(r => Object.values(r).map(v => `"${v}"`).join(","))].join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `history_${Date.now()}.${format}`; a.click(); URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    const PageBtn: React.FC<{ page: number }> = ({ page }) => (
        <button onClick={() => setCurrentPage(page)}
            className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${currentPage === page ? n.btnPrimary : `${n.flat} ${n.secondary}`}`}>
            {page}
        </button>
    );

    const pageNumbers = useMemo(() => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
        if (currentPage <= 3) return [1, 2, 3, 4, 5];
        if (currentPage >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
    }, [currentPage, totalPages]);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* ── Detail Modal ── */}
            {selectedEntry && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-md w-full overflow-hidden`}>
                        <div className={`px-5 py-4 border-b ${n.divider} flex items-center justify-between ${n.modalHead}`}>
                            <div className="flex items-center gap-3">
                                {(() => { const c = getActionConfig(selectedEntry.action); return (<div className={`w-9 h-9 ${c.color} rounded-xl flex items-center justify-center`}><c.icon className="w-4 h-4 text-white" /></div>); })()}
                                <h3 className={`font-semibold ${n.text}`}>Activity Details</h3>
                            </div>
                            <button onClick={() => setSelectedEntry(null)} className={`p-2 rounded-lg ${isDark ? "hover:bg-gray-800" : "hover:bg-black/10"}`}>
                                <X className={`w-4 h-4 ${n.tertiary}`} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex items-start gap-3">
                                {(() => { const c = getActionConfig(selectedEntry.action); return (<div className={`w-11 h-11 ${c.color} rounded-xl flex items-center justify-center flex-shrink-0`}><c.icon className="w-5 h-5 text-white" /></div>); })()}
                                <div>
                                    <p className={`font-semibold ${n.strong}`}>{selectedEntry.title}</p>
                                    <p className={`text-sm ${n.secondary} mt-0.5 leading-relaxed`}>{selectedEntry.description}</p>
                                </div>
                            </div>
                            <div className={`${n.flat} p-4 rounded-xl space-y-3`}>
                                {[
                                    { icon: Calendar, label: "Date & Time",  value: fmtFull(selectedEntry.timestamp) },
                                    { icon: FolderOpen, label: "Category",   value: CATEGORY_CONFIG[selectedEntry.category]?.label || selectedEntry.category },
                                    ...(selectedEntry.performedBy ? [{ icon: User, label: "Performed By", value: selectedEntry.performedBy }] : []),
                                    ...(selectedEntry.entityId    ? [{ icon: FileText, label: "Reference ID", value: selectedEntry.entityId, mono: true }] : []),
                                ].map((row, i) => (
                                    <div key={i} className={`${i > 0 ? `border-t ${n.divider} pt-3` : ""} flex items-center justify-between gap-4`}>
                                        <span className={`text-xs ${n.tertiary} flex items-center gap-1.5 flex-shrink-0`}><row.icon className="w-3.5 h-3.5" />{row.label}</span>
                                        <span className={`text-xs font-medium ${n.text} text-right ${(row as any).mono ? "font-mono" : ""}`}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className={`px-5 py-4 border-t ${n.divider} ${n.modalHead}`}>
                            <button onClick={() => setSelectedEntry(null)} className={`w-full py-2.5 ${n.flat} rounded-xl text-sm ${n.secondary}`}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className={`text-xl font-semibold ${n.strong}`}>History</h1>
                    <p className={`text-sm ${n.secondary} mt-0.5`}>Track all activity on your account</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadHistory} disabled={loading} className={`w-9 h-9 ${n.flat} flex items-center justify-center rounded-xl`}>
                        <RefreshCw className={`w-4 h-4 ${n.secondary} ${loading ? "animate-spin" : ""}`} />
                    </button>
                    {filteredHistory.length > 0 && (
                        <div className="relative">
                            <button onClick={() => setShowExportMenu(!showExportMenu)} className={`px-3 py-2 ${n.flat} rounded-xl text-sm ${n.secondary} flex items-center gap-1.5`}>
                                <Download className="w-3.5 h-3.5" />Export
                            </button>
                            {showExportMenu && (
                                <div className={`absolute right-0 top-full mt-1 ${n.modal} border rounded-xl overflow-hidden z-10 min-w-36 shadow-xl`}>
                                    <button onClick={() => exportHistory("csv")}  className={`w-full px-4 py-2.5 text-left text-sm ${n.secondary} ${isDark ? "hover:bg-gray-800" : "hover:bg-black/5"} flex items-center gap-2`}><FileText className="w-3.5 h-3.5" />CSV</button>
                                    <button onClick={() => exportHistory("json")} className={`w-full px-4 py-2.5 text-left text-sm ${n.secondary} ${isDark ? "hover:bg-gray-800" : "hover:bg-black/5"} flex items-center gap-2`}><FileText className="w-3.5 h-3.5" />JSON</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: "Total Events", value: stats.total,     dot: "bg-blue-500",    icon: Activity },
                    { label: "Today",        value: stats.today,     dot: "bg-emerald-500", icon: Calendar },
                    { label: "This Week",    value: stats.thisWeek,  dot: "bg-blue-500",    icon: TrendingUp },
                    { label: "This Month",   value: stats.thisMonth, dot: "bg-amber-500",   icon: Clock },
                ].map((st, i) => (
                    <div key={i} className={`${n.card} ${n.edgeHover} p-4 rounded-2xl transition-all`}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            <span className={`text-[11px] uppercase tracking-widest ${n.tertiary}`}>{st.label}</span>
                        </div>
                        <div className={`text-2xl font-semibold ${n.strong} tabular-nums`}>{st.value}</div>
                    </div>
                ))}
            </div>

            {/* Search + filter bar */}
            <div className={`${n.card} rounded-2xl p-4`}>
                <div className="flex gap-3">
                    <div className={`flex-1 ${n.flat} flex items-center gap-2 px-4 py-2.5 rounded-xl`}>
                        <Search className={`w-4 h-4 ${n.tertiary} flex-shrink-0`} />
                        <input type="text" placeholder="Search history…" value={filters.searchQuery}
                            onChange={e => { setFilters(f => ({ ...f, searchQuery: e.target.value })); setCurrentPage(1); }}
                            className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} />
                        {filters.searchQuery && <button onClick={() => setFilters(f => ({ ...f, searchQuery: "" }))}><X className={`w-3.5 h-3.5 ${n.tertiary}`} /></button>}
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)} className={`w-9 h-9 ${showFilters || hasFilters ? "bg-blue-600 text-white" : n.flat} flex items-center justify-center rounded-xl transition-all`}>
                        <Filter className="w-4 h-4" />
                    </button>
                    <button onClick={() => setSortOrder(s => s === "desc" ? "asc" : "desc")} className={`px-3 py-2 ${n.flat} rounded-xl text-xs ${n.secondary} flex items-center gap-1.5`}>
                        <ArrowUpDown className="w-3.5 h-3.5" />{sortOrder === "desc" ? "Newest" : "Oldest"}
                    </button>
                </div>

                {showFilters && (
                    <div className={`mt-4 pt-4 border-t ${n.divider} grid grid-cols-1 md:grid-cols-3 gap-3`}>
                        <div>
                            <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>Category</label>
                            <select value={filters.category} onChange={e => { setFilters(f => ({ ...f, category: e.target.value as CategoryType })); setCurrentPage(1); }}
                                className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`}>
                                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>From Date</label>
                            <input type="date" value={filters.dateFrom} onChange={e => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setCurrentPage(1); }}
                                className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} />
                        </div>
                        <div>
                            <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>To Date</label>
                            <input type="date" value={filters.dateTo} onChange={e => { setFilters(f => ({ ...f, dateTo: e.target.value })); setCurrentPage(1); }}
                                className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`} />
                        </div>
                        {hasFilters && (
                            <div className="md:col-span-3">
                                <button onClick={() => { setFilters({ category: "all", dateFrom: "", dateTo: "", searchQuery: "" }); setCurrentPage(1); }} className="text-xs text-red-400 flex items-center gap-1">
                                    <X className="w-3 h-3" />Clear all filters
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Results count */}
            <p className={`text-xs ${n.tertiary}`}>
                {filteredHistory.length === 0 ? "No activity found" : `${paginated.length} of ${filteredHistory.length} entries`}
            </p>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <RefreshCw className={`w-7 h-7 ${n.label} animate-spin mx-auto mb-3`} />
                        <p className={`${n.secondary} text-sm`}>Loading history…</p>
                    </div>
                </div>
            ) : paginated.length === 0 ? (
                <div className={`${n.card} rounded-2xl text-center py-20`}>
                    <History className={`w-12 h-12 ${n.tertiary} mx-auto mb-4`} strokeWidth={1.5} />
                    <p className={`${n.secondary} text-sm font-medium`}>{hasFilters ? "No matching activity" : "No activity yet"}</p>
                    {hasFilters && <button onClick={() => setFilters({ category: "all", dateFrom: "", dateTo: "", searchQuery: "" })} className={`mt-3 text-xs ${n.label}`}>Clear filters</button>}
                </div>
            ) : (
                <div className={`${n.card} rounded-2xl overflow-hidden`}>
                    {paginated.map((entry, i) => {
                        const config = getActionConfig(entry.action);
                        return (
                            <div key={entry.id} onClick={() => setSelectedEntry(entry)}
                                className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-all group ${n.rowHover}
                                    ${i < paginated.length - 1 ? `border-b ${n.divider}` : ""}`}>
                                <div className={`w-10 h-10 ${config.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                    <config.icon className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className={`text-sm font-semibold ${n.text}`}>{entry.title}</p>
                                        <span className={`text-[10px] px-2 py-0.5 ${n.flat} rounded-lg ${n.tertiary}`}>
                                            {CATEGORY_CONFIG[entry.category]?.label || entry.category}
                                        </span>
                                    </div>
                                    <p className={`text-xs ${n.secondary} truncate mt-0.5`}>{entry.description}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-xs ${n.tertiary}`}>{fmtRelative(entry.timestamp)}</span>
                                    <ChevronRight className={`w-4 h-4 ${n.tertiary} group-hover:translate-x-0.5 transition-transform`} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1.5">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                        className={`w-9 h-9 ${n.flat} rounded-xl flex items-center justify-center ${n.secondary} disabled:opacity-40`}>
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    {pageNumbers.map(p => <PageBtn key={p} page={p} />)}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                        className={`w-9 h-9 ${n.flat} rounded-xl flex items-center justify-center ${n.secondary} disabled:opacity-40`}>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ClientHistory;