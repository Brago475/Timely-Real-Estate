// src/ClientPortal_views/ClientProjects.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    Inbox,
    Star,
    Archive,
    Trash2,
    RefreshCw,
    Search,
    ChevronDown,
    MoreHorizontal,
    Paperclip,
    Send,
    Calendar,
    Clock,
    User,
    CheckCircle,
    Circle,
    ChevronRight,
    X,
    MessageSquare,
    FileText,
    Filter,
    SortDesc,
    Tag,
    Flag,
    Reply,
    CornerUpLeft,
    FolderOpen,
    Download,
    ExternalLink,
} from "lucide-react";

const API_BASE = "http://localhost:4000/api";

type ClientProjectsProps = {
    userName?: string;
    userEmail?: string;
    customerId?: string;
};

interface Project {
    projectId: string;
    projectCode: string;
    projectName: string;
    status: string;
    description?: string;
    dateDue?: string;
    dateStart?: string;
    createdAt: string;
    assignedBy?: string;
    assignedByName?: string;
    read: boolean;
    starred: boolean;
    archived: boolean;
    flagged: boolean;
}

interface Comment {
    id: string;
    projectId: string;
    author: string;
    authorEmail: string;
    authorRole: "client" | "consultant" | "admin";
    content: string;
    timestamp: string;
}

interface Attachment {
    attachmentId: string;
    fileName: string;
    fileSize: string;
    fileType: string;
    uploadedBy: string;
    createdAt: string;
}

type ViewType = "inbox" | "starred" | "flagged" | "archived";
type SortType = "date" | "name" | "status";

const STORAGE_KEY = "timely_client_projects_state";

const ClientProjects: React.FC<ClientProjectsProps> = ({
    userName = "Client",
    userEmail = "",
    customerId = "",
}) => {
    const { isDark } = useTheme();

    // Modern theme with better hover states
    const s = {
        // Main backgrounds
        bg: isDark ? "bg-slate-950" : "bg-gray-50",
        sidebar: isDark ? "bg-slate-900" : "bg-white",
        list: isDark ? "bg-slate-900" : "bg-white",
        detail: isDark ? "bg-slate-950" : "bg-gray-50",

        // Cards and items
        card: isDark ? "bg-slate-800" : "bg-white",
        cardHover: isDark ? "hover:bg-slate-700/50" : "hover:bg-gray-50",
        cardActive: isDark ? "bg-blue-600/20 border-l-blue-500" : "bg-blue-50 border-l-blue-500",
        cardUnread: isDark ? "bg-slate-800" : "bg-white",

        // Text
        text: isDark ? "text-white" : "text-gray-900",
        textSecondary: isDark ? "text-slate-400" : "text-gray-600",
        textTertiary: isDark ? "text-slate-500" : "text-gray-400",

        // Borders
        border: isDark ? "border-slate-800" : "border-gray-200",
        divider: isDark ? "border-slate-700" : "border-gray-200",

        // Inputs
        input: isDark
            ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500"
            : "bg-white border-gray-300 text-gray-900 placeholder-gray-400",

        // Buttons
        button: isDark
            ? "bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white"
            : "bg-white hover:bg-gray-100 active:bg-gray-200 text-gray-900 border border-gray-300",
        buttonPrimary: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white",

        // Interactive states
        clickable: "cursor-pointer active:scale-[0.98] transition-all duration-150",
        hoverLift: "hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200",
        hoverGlow: isDark ? "hover:shadow-blue-500/20" : "hover:shadow-blue-500/10",
    };

    const [projects, setProjects] = useState<Project[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [attachments, setAttachments] = useState<{ [key: string]: Attachment[] }>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [currentView, setCurrentView] = useState<ViewType>("inbox");
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<SortType>("date");

    const [newComment, setNewComment] = useState("");
    const [sending, setSending] = useState(false);
    const [showSortMenu, setShowSortMenu] = useState(false);

    const commentsEndRef = useRef<HTMLDivElement>(null);

    // Load data
    useEffect(() => {
        loadProjects();
    }, [customerId]);

    const loadProjects = async () => {
        setRefreshing(true);
        try {
            // Get project-client assignments from localStorage
            const projectClients = JSON.parse(localStorage.getItem("timely_project_clients") || "[]");
            const clientProjectIds = projectClients
                .filter((pc: any) => String(pc.clientId) === String(customerId))
                .map((pc: any) => String(pc.projectId));

            // Get saved state (read, starred, etc.)
            const savedState = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_${customerId}`) || "{}");

            // Fetch projects from API
            const response = await fetch(`${API_BASE}/projects`);
            if (response.ok) {
                const data = await response.json();
                const allProjects = data.data || [];

                // Filter and enrich projects
                const clientProjects: Project[] = await Promise.all(
                    allProjects
                        .filter((p: any) => clientProjectIds.includes(String(p.projectId)))
                        .map(async (p: any) => {
                            // Get project details
                            let details: any = {};
                            try {
                                const res = await fetch(`${API_BASE}/project-details/${p.projectId}`);
                                if (res.ok) {
                                    const d = await res.json();
                                    details = d.data || {};
                                }
                            } catch { }

                            const assignment = projectClients.find(
                                (pc: any) => String(pc.projectId) === String(p.projectId) && String(pc.clientId) === String(customerId)
                            );

                            const state = savedState[p.projectId] || {};

                            return {
                                projectId: p.projectId,
                                projectCode: p.projectCode,
                                projectName: p.projectName,
                                status: p.status || "active",
                                description: details.description || "",
                                dateDue: details.dateDue,
                                dateStart: details.dateStart,
                                createdAt: assignment?.assignedAt || details.createdAt || new Date().toISOString(),
                                assignedBy: assignment?.assignedBy || "",
                                assignedByName: assignment?.assignedByName || "Admin",
                                read: state.read ?? false,
                                starred: state.starred ?? false,
                                archived: state.archived ?? false,
                                flagged: state.flagged ?? false,
                            };
                        })
                );

                clientProjects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setProjects(clientProjects);

                // Load attachments
                const attMap: { [key: string]: Attachment[] } = {};
                for (const p of clientProjects) {
                    try {
                        const res = await fetch(`${API_BASE}/project-attachments/${p.projectId}`);
                        if (res.ok) {
                            const d = await res.json();
                            attMap[p.projectId] = d.data || [];
                        }
                    } catch { }
                }
                setAttachments(attMap);

                // Load comments
                const allComments: Comment[] = [];
                for (const p of clientProjects) {
                    try {
                        const res = await fetch(`${API_BASE}/project-comments/${p.projectId}`);
                        if (res.ok) {
                            const d = await res.json();
                            (d.data || []).forEach((c: any) => {
                                allComments.push({
                                    id: c.commentId,
                                    projectId: c.projectId,
                                    author: c.author,
                                    authorEmail: c.authorEmail || "",
                                    authorRole: c.authorRole || "consultant",
                                    content: c.commentText,
                                    timestamp: c.createdAt,
                                });
                            });
                        }
                    } catch { }
                }
                setComments(allComments);
            }
        } catch (e) {
            console.error("Error loading projects:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Save state
    const saveState = (updated: Project[]) => {
        const state: any = {};
        updated.forEach((p) => {
            state[p.projectId] = {
                read: p.read,
                starred: p.starred,
                archived: p.archived,
                flagged: p.flagged,
            };
        });
        localStorage.setItem(`${STORAGE_KEY}_${customerId}`, JSON.stringify(state));
    };

    // Actions
    const markAsRead = (id: string) => {
        const updated = projects.map((p) => (p.projectId === id ? { ...p, read: true } : p));
        setProjects(updated);
        saveState(updated);
    };

    const toggleStar = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const updated = projects.map((p) => (p.projectId === id ? { ...p, starred: !p.starred } : p));
        setProjects(updated);
        saveState(updated);
    };

    const toggleFlag = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const updated = projects.map((p) => (p.projectId === id ? { ...p, flagged: !p.flagged } : p));
        setProjects(updated);
        saveState(updated);
    };

    const archiveProject = (id: string) => {
        const updated = projects.map((p) => (p.projectId === id ? { ...p, archived: true } : p));
        setProjects(updated);
        saveState(updated);
        if (selectedProject?.projectId === id) setSelectedProject(null);
    };

    const unarchiveProject = (id: string) => {
        const updated = projects.map((p) => (p.projectId === id ? { ...p, archived: false } : p));
        setProjects(updated);
        saveState(updated);
    };

    const openProject = (project: Project) => {
        setSelectedProject(project);
        if (!project.read) markAsRead(project.projectId);
    };

    // Send comment
    const handleSendComment = async () => {
        if (!newComment.trim() || !selectedProject) return;
        setSending(true);

        const comment: Comment = {
            id: `cm_${Date.now()}`,
            projectId: selectedProject.projectId,
            author: userName,
            authorEmail: userEmail,
            authorRole: "client",
            content: newComment.trim(),
            timestamp: new Date().toISOString(),
        };

        setComments([...comments, comment]);

        try {
            await fetch(`${API_BASE}/project-comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: selectedProject.projectId,
                    author: userName,
                    commentText: newComment.trim(),
                    performedBy: userEmail,
                }),
            });
        } catch { }

        setNewComment("");
        setSending(false);
        setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };

    // Filter & sort
    const filteredProjects = useMemo(() => {
        let result = projects;

        switch (currentView) {
            case "starred": result = result.filter((p) => p.starred && !p.archived); break;
            case "flagged": result = result.filter((p) => p.flagged && !p.archived); break;
            case "archived": result = result.filter((p) => p.archived); break;
            default: result = result.filter((p) => !p.archived); break;
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter((p) =>
                p.projectName.toLowerCase().includes(q) ||
                p.projectCode.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q)
            );
        }

        switch (sortBy) {
            case "name": result.sort((a, b) => a.projectName.localeCompare(b.projectName)); break;
            case "status": result.sort((a, b) => a.status.localeCompare(b.status)); break;
            default: result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        return result;
    }, [projects, currentView, searchQuery, sortBy]);

    const projectComments = useMemo(() => {
        if (!selectedProject) return [];
        return comments
            .filter((c) => c.projectId === selectedProject.projectId)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [comments, selectedProject]);

    // Stats
    const stats = {
        unread: projects.filter((p) => !p.read && !p.archived).length,
        starred: projects.filter((p) => p.starred && !p.archived).length,
        flagged: projects.filter((p) => p.flagged && !p.archived).length,
        archived: projects.filter((p) => p.archived).length,
    };

    // Formatters
    const formatDate = (d: string) => {
        const date = new Date(d);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / 86400000);

        if (days === 0) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        if (days === 1) return "Yesterday";
        if (days < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const formatFullDate = (d: string) => {
        if (!d) return "";
        return new Date(d).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const getStatusBadge = (status: string) => {
        const styles: any = {
            active: { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "In Progress", color: "emerald" },
            completed: { bg: "bg-blue-500/10", text: "text-blue-500", label: "Completed", color: "blue" },
            pending: { bg: "bg-amber-500/10", text: "text-amber-500", label: "Pending", color: "amber" },
            on_hold: { bg: "bg-gray-500/10", text: "text-gray-500", label: "On Hold", color: "gray" },
        };
        return styles[status] || styles.active;
    };

    const getViewIcon = (view: ViewType) => {
        switch (view) {
            case "inbox": return Inbox;
            case "starred": return Star;
            case "flagged": return Flag;
            case "archived": return Archive;
        }
    };

    const getViewLabel = (view: ViewType) => {
        switch (view) {
            case "inbox": return "Inbox";
            case "starred": return "Starred";
            case "flagged": return "Flagged";
            case "archived": return "Archive";
        }
    };

    return (
        <div className={`${s.bg} min-h-full -mx-6 -mt-20 pt-20`}>
            <div className="flex h-[calc(100vh-5rem)]">
                {/* Left Sidebar - Folders */}
                <div className={`w-56 ${s.sidebar} border-r ${s.border} flex flex-col shrink-0`}>
                    <div className="p-4">
                        <button
                            onClick={loadProjects}
                            disabled={refreshing}
                            className={`w-full ${s.buttonPrimary} px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md`}
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : "hover:rotate-180 transition-transform duration-500"}`} />
                            {refreshing ? "Refreshing..." : "Refresh"}
                        </button>
                    </div>

                    <nav className="flex-1 px-3 space-y-1">
                        <p className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${s.textTertiary}`}>
                            Folders
                        </p>
                        {[
                            { id: "inbox", label: "Inbox", icon: Inbox, count: stats.unread, color: "blue" },
                            { id: "starred", label: "Starred", icon: Star, count: stats.starred, color: "amber" },
                            { id: "flagged", label: "Flagged", icon: Flag, count: stats.flagged, color: "red" },
                            { id: "archived", label: "Archive", icon: Archive, count: stats.archived, color: "gray" },
                        ].map((item) => {
                            const isActive = currentView === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => { setCurrentView(item.id as ViewType); setSelectedProject(null); }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-200 active:scale-[0.98] group ${isActive
                                            ? `bg-blue-600/20 text-blue-500 font-semibold shadow-md ${isDark ? "shadow-blue-500/10" : "shadow-blue-500/20"}`
                                            : `${s.text} ${s.cardHover} hover:shadow-md`
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive
                                                ? "bg-blue-500 shadow-lg shadow-blue-500/30"
                                                : `${isDark ? "bg-slate-700" : "bg-gray-100"} group-hover:scale-105`
                                            }`}>
                                            <item.icon className={`w-4 h-4 ${isActive ? "text-white" : s.textSecondary}`} />
                                        </div>
                                        {item.label}
                                    </div>
                                    {item.count !== undefined && item.count > 0 && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full transition-all ${isActive
                                                ? "bg-blue-500 text-white"
                                                : `${isDark ? "bg-slate-700" : "bg-gray-200"} ${s.textSecondary}`
                                            }`}>
                                            {item.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Stats Footer */}
                    <div className={`p-4 border-t ${s.border}`}>
                        <div className={`p-3 rounded-xl ${isDark ? "bg-slate-800" : "bg-gray-100"}`}>
                            <p className={`text-xs font-semibold ${s.textSecondary} mb-2`}>Summary</p>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="text-center">
                                    <p className={`text-lg font-bold ${s.text}`}>{projects.filter(p => !p.archived).length}</p>
                                    <p className={`text-xs ${s.textTertiary}`}>Active</p>
                                </div>
                                <div className="text-center">
                                    <p className={`text-lg font-bold ${s.text}`}>{stats.unread}</p>
                                    <p className={`text-xs ${s.textTertiary}`}>Unread</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Middle - Project List */}
                <div className={`w-96 ${s.list} border-r ${s.border} flex flex-col shrink-0`}>
                    {/* Search & Filter Bar */}
                    <div className={`p-4 border-b ${s.border}`}>
                        <div className="relative group">
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${s.textTertiary} group-focus-within:text-blue-500 transition-colors`} />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${s.input} text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200`}
                            />
                        </div>
                        <div className="flex items-center justify-between mt-3">
                            <span className={`text-xs font-medium ${s.textSecondary}`}>
                                {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""}
                            </span>
                            <div className="relative">
                                <button
                                    onClick={() => setShowSortMenu(!showSortMenu)}
                                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg ${s.button} transition-all duration-200 hover:shadow-md active:scale-95`}
                                >
                                    <SortDesc className="w-3.5 h-3.5" />
                                    Sort
                                    <ChevronDown className={`w-3 h-3 transition-transform ${showSortMenu ? "rotate-180" : ""}`} />
                                </button>
                                {showSortMenu && (
                                    <div className={`absolute right-0 top-full mt-2 ${s.card} border ${s.border} rounded-xl shadow-xl py-2 z-10 min-w-[120px] animate-in fade-in slide-in-from-top-2 duration-200`}>
                                        {[
                                            { id: "date", label: "Date", icon: Calendar },
                                            { id: "name", label: "Name", icon: FileText },
                                            { id: "status", label: "Status", icon: Tag },
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => { setSortBy(opt.id as SortType); setShowSortMenu(false); }}
                                                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-all duration-150 ${s.cardHover} active:scale-[0.98] ${sortBy === opt.id ? "text-blue-500 font-semibold" : s.text
                                                    }`}
                                            >
                                                <opt.icon className="w-4 h-4" />
                                                {opt.label}
                                                {sortBy === opt.id && <CheckCircle className="w-4 h-4 ml-auto" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Project List */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <RefreshCw className={`w-8 h-8 text-blue-500 animate-spin mb-3`} />
                                <p className={s.textSecondary}>Loading projects...</p>
                            </div>
                        ) : filteredProjects.length === 0 ? (
                            <div className="text-center py-16">
                                <div className={`w-16 h-16 rounded-2xl ${isDark ? "bg-slate-800" : "bg-gray-100"} flex items-center justify-center mx-auto mb-4`}>
                                    <FolderOpen className={`w-8 h-8 ${s.textTertiary}`} />
                                </div>
                                <p className={`font-semibold ${s.text} mb-1`}>No projects</p>
                                <p className={`text-sm ${s.textSecondary}`}>
                                    {currentView === "inbox" ? "No projects in your inbox" : `No ${currentView} projects`}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800/50">
                                {filteredProjects.map((project, index) => {
                                    const isSelected = selectedProject?.projectId === project.projectId;
                                    const hasAttachments = (attachments[project.projectId]?.length || 0) > 0;
                                    const commentCount = comments.filter((c) => c.projectId === project.projectId).length;
                                    const status = getStatusBadge(project.status);

                                    return (
                                        <div
                                            key={project.projectId}
                                            onClick={() => openProject(project)}
                                            style={{ animationDelay: `${index * 30}ms` }}
                                            className={`px-4 py-4 cursor-pointer transition-all duration-200 animate-in fade-in slide-in-from-left-2 group ${isSelected
                                                    ? `${s.cardActive} border-l-4`
                                                    : `${s.cardHover} border-l-4 border-l-transparent hover:border-l-blue-500/50`
                                                } ${!project.read ? "bg-blue-500/5" : ""}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Unread indicator / Avatar */}
                                                <div className="relative">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm transition-all duration-200 group-hover:scale-105 ${project.status === "completed" ? "bg-gradient-to-br from-blue-500 to-blue-600" :
                                                            project.status === "pending" ? "bg-gradient-to-br from-amber-500 to-amber-600" :
                                                                "bg-gradient-to-br from-emerald-500 to-emerald-600"
                                                        } shadow-lg ${project.status === "completed" ? "shadow-blue-500/20" :
                                                            project.status === "pending" ? "shadow-amber-500/20" :
                                                                "shadow-emerald-500/20"
                                                        }`}>
                                                        {project.projectName.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    {!project.read && (
                                                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900 animate-pulse" />
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className={`text-xs font-medium ${s.textSecondary}`}>
                                                            {project.assignedByName || "Admin"}
                                                        </span>
                                                        <span className={`text-xs ${s.textTertiary}`}>
                                                            {formatDate(project.createdAt)}
                                                        </span>
                                                    </div>

                                                    <p className={`text-sm font-semibold ${s.text} truncate group-hover:text-blue-500 transition-colors`}>
                                                        {project.projectName}
                                                    </p>

                                                    <p className={`text-xs ${s.textSecondary} truncate mt-0.5`}>
                                                        {project.description || project.projectCode}
                                                    </p>

                                                    {/* Meta row */}
                                                    <div className="flex items-center gap-2 mt-2">
                                                        {hasAttachments && (
                                                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isDark ? "bg-slate-700" : "bg-gray-100"}`}>
                                                                <Paperclip className={`w-3 h-3 ${s.textTertiary}`} />
                                                            </div>
                                                        )}
                                                        {commentCount > 0 && (
                                                            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isDark ? "bg-slate-700" : "bg-gray-100"}`}>
                                                                <MessageSquare className={`w-3 h-3 ${s.textTertiary}`} />
                                                                <span className={`text-xs ${s.textTertiary}`}>{commentCount}</span>
                                                            </div>
                                                        )}
                                                        <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${status.bg} ${status.text}`}>
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                    <button
                                                        onClick={(e) => toggleStar(project.projectId, e)}
                                                        className={`p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 ${project.starred ? "bg-amber-500/20" : "hover:bg-slate-700/50"
                                                            }`}
                                                    >
                                                        <Star className={`w-4 h-4 transition-colors ${project.starred ? "fill-amber-500 text-amber-500" : s.textTertiary}`} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => toggleFlag(project.projectId, e)}
                                                        className={`p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 ${project.flagged ? "bg-red-500/20" : "hover:bg-slate-700/50"
                                                            }`}
                                                    >
                                                        <Flag className={`w-4 h-4 transition-colors ${project.flagged ? "fill-red-500 text-red-500" : s.textTertiary}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right - Project Detail */}
                <div className={`flex-1 ${s.detail} flex flex-col min-w-0`}>
                    {!selectedProject ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className={`w-24 h-24 rounded-3xl ${isDark ? "bg-slate-800" : "bg-gray-100"} flex items-center justify-center mx-auto mb-6`}>
                                    <Inbox className={`w-12 h-12 ${s.textTertiary}`} />
                                </div>
                                <p className={`text-xl font-semibold ${s.text} mb-2`}>Select a project</p>
                                <p className={s.textSecondary}>Choose a project from the list to view details</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className={`px-6 py-5 border-b ${s.border} ${s.card}`}>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg ${selectedProject.status === "completed" ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20" :
                                                selectedProject.status === "pending" ? "bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/20" :
                                                    "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/20"
                                            }`}>
                                            {selectedProject.projectName.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h1 className={`text-xl font-bold ${s.text}`}>
                                                {selectedProject.projectName}
                                            </h1>
                                            <div className={`flex items-center gap-3 mt-1`}>
                                                <span className={`text-sm ${s.textSecondary}`}>{selectedProject.projectCode}</span>
                                                <span className={`text-sm px-2.5 py-1 rounded-lg font-medium ${getStatusBadge(selectedProject.status).bg} ${getStatusBadge(selectedProject.status).text}`}>
                                                    {getStatusBadge(selectedProject.status).label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => toggleStar(selectedProject.projectId)}
                                            className={`p-2.5 rounded-xl transition-all duration-200 hover:shadow-md active:scale-95 ${selectedProject.starred ? "bg-amber-500/20" : s.cardHover
                                                }`}
                                        >
                                            <Star className={`w-5 h-5 ${selectedProject.starred ? "fill-amber-500 text-amber-500" : s.textTertiary}`} />
                                        </button>
                                        <button
                                            onClick={() => toggleFlag(selectedProject.projectId)}
                                            className={`p-2.5 rounded-xl transition-all duration-200 hover:shadow-md active:scale-95 ${selectedProject.flagged ? "bg-red-500/20" : s.cardHover
                                                }`}
                                        >
                                            <Flag className={`w-5 h-5 ${selectedProject.flagged ? "fill-red-500 text-red-500" : s.textTertiary}`} />
                                        </button>
                                        {selectedProject.archived ? (
                                            <button
                                                onClick={() => unarchiveProject(selectedProject.projectId)}
                                                className={`p-2.5 rounded-xl ${s.cardHover} transition-all duration-200 hover:shadow-md active:scale-95`}
                                            >
                                                <Archive className={`w-5 h-5 text-blue-500`} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => archiveProject(selectedProject.projectId)}
                                                className={`p-2.5 rounded-xl ${s.cardHover} transition-all duration-200 hover:shadow-md active:scale-95`}
                                            >
                                                <Archive className={`w-5 h-5 ${s.textTertiary}`} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setSelectedProject(null)}
                                            className={`p-2.5 rounded-xl ${s.cardHover} transition-all duration-200 hover:shadow-md active:scale-95 ml-2`}
                                        >
                                            <X className={`w-5 h-5 ${s.textTertiary}`} />
                                        </button>
                                    </div>
                                </div>

                                {/* From / Date */}
                                <div className={`flex items-center gap-4 mt-5 pt-5 border-t ${s.border}`}>
                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold shadow-lg shadow-blue-500/20">
                                        {(selectedProject.assignedByName || "A")[0]}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-semibold ${s.text}`}>{selectedProject.assignedByName || "Admin"}</p>
                                        <p className={`text-sm ${s.textSecondary}`}>{formatFullDate(selectedProject.createdAt)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto">
                                {/* Project Description */}
                                <div className={`px-6 py-6 border-b ${s.border}`}>
                                    {selectedProject.description ? (
                                        <p className={`${s.text} whitespace-pre-wrap leading-relaxed`}>
                                            {selectedProject.description}
                                        </p>
                                    ) : (
                                        <p className={`${s.textTertiary} italic`}>No description provided.</p>
                                    )}

                                    {/* Dates */}
                                    {(selectedProject.dateStart || selectedProject.dateDue) && (
                                        <div className={`flex items-center gap-4 mt-5 pt-5 border-t ${s.border}`}>
                                            {selectedProject.dateStart && (
                                                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDark ? "bg-slate-800" : "bg-gray-100"}`}>
                                                    <Calendar className={`w-4 h-4 text-blue-500`} />
                                                    <div>
                                                        <p className={`text-xs ${s.textTertiary}`}>Start</p>
                                                        <p className={`text-sm font-medium ${s.text}`}>{new Date(selectedProject.dateStart).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                            )}
                                            {selectedProject.dateDue && (
                                                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDark ? "bg-slate-800" : "bg-gray-100"}`}>
                                                    <Clock className={`w-4 h-4 text-amber-500`} />
                                                    <div>
                                                        <p className={`text-xs ${s.textTertiary}`}>Due</p>
                                                        <p className={`text-sm font-medium ${s.text}`}>{new Date(selectedProject.dateDue).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Attachments */}
                                    {(attachments[selectedProject.projectId]?.length || 0) > 0 && (
                                        <div className={`mt-5 pt-5 border-t ${s.border}`}>
                                            <p className={`text-sm font-semibold ${s.text} mb-3 flex items-center gap-2`}>
                                                <Paperclip className="w-4 h-4 text-blue-500" />
                                                Attachments ({attachments[selectedProject.projectId].length})
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {attachments[selectedProject.projectId].map((att) => (
                                                    <div
                                                        key={att.attachmentId}
                                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${s.border} ${s.cardHover} cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group`}
                                                    >
                                                        <div className={`w-10 h-10 rounded-lg ${isDark ? "bg-slate-700" : "bg-gray-100"} flex items-center justify-center`}>
                                                            <FileText className={`w-5 h-5 ${s.textSecondary}`} />
                                                        </div>
                                                        <div>
                                                            <p className={`text-sm font-medium ${s.text}`}>{att.fileName}</p>
                                                            <p className={`text-xs ${s.textTertiary}`}>{att.fileSize}</p>
                                                        </div>
                                                        <Download className={`w-4 h-4 ${s.textTertiary} opacity-0 group-hover:opacity-100 transition-opacity`} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Comments Section */}
                                <div className="px-6 py-5">
                                    <h3 className={`text-sm font-bold ${s.text} mb-4 flex items-center gap-2`}>
                                        <MessageSquare className="w-4 h-4 text-blue-500" />
                                        Conversation ({projectComments.length})
                                    </h3>

                                    {projectComments.length === 0 ? (
                                        <div className={`text-center py-10 rounded-2xl border-2 border-dashed ${s.border}`}>
                                            <MessageSquare className={`w-10 h-10 ${s.textTertiary} mx-auto mb-3`} />
                                            <p className={`font-medium ${s.text}`}>No comments yet</p>
                                            <p className={`text-sm ${s.textSecondary}`}>Start the conversation below</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {projectComments.map((comment, index) => {
                                                const isOwn = comment.authorEmail === userEmail || comment.author === userName;
                                                return (
                                                    <div
                                                        key={comment.id}
                                                        style={{ animationDelay: `${index * 50}ms` }}
                                                        className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 ${isOwn ? "flex-row-reverse" : ""}`}
                                                    >
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-semibold shrink-0 shadow-lg ${isOwn
                                                                ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20"
                                                                : "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/20"
                                                            }`}>
                                                            {comment.author[0]}
                                                        </div>
                                                        <div className={`max-w-[70%] ${isOwn ? "items-end" : ""}`}>
                                                            <div className={`flex items-center gap-2 mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                                                                <span className={`text-sm font-semibold ${s.text}`}>{comment.author}</span>
                                                                <span className={`text-xs ${s.textTertiary}`}>
                                                                    {formatDate(comment.timestamp)}
                                                                </span>
                                                            </div>
                                                            <div className={`px-4 py-3 rounded-2xl transition-all duration-200 hover:shadow-md ${isOwn
                                                                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md shadow-lg shadow-blue-500/20"
                                                                    : `${s.card} border ${s.border} rounded-bl-md`
                                                                }`}>
                                                                <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isOwn ? "text-white" : s.text}`}>
                                                                    {comment.content}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div ref={commentsEndRef} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Reply Box */}
                            <div className={`px-6 py-4 border-t ${s.border} ${s.card}`}>
                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold shrink-0 shadow-lg shadow-blue-500/20">
                                        {userName[0]}
                                    </div>
                                    <div className="flex-1">
                                        <textarea
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder="Write a reply..."
                                            rows={2}
                                            className={`w-full px-4 py-3 rounded-xl border ${s.input} text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none transition-all duration-200`}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                                    handleSendComment();
                                                }
                                            }}
                                        />
                                        <div className="flex items-center justify-between mt-3">
                                            <span className={`text-xs ${s.textTertiary}`}>
                                                <kbd className={`px-1.5 py-0.5 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>Ctrl</kbd>
                                                {" + "}
                                                <kbd className={`px-1.5 py-0.5 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>Enter</kbd>
                                                {" to send"}
                                            </span>
                                            <button
                                                onClick={handleSendComment}
                                                disabled={!newComment.trim() || sending}
                                                className={`${s.buttonPrimary} px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg`}
                                            >
                                                {sending ? (
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Send className="w-4 h-4" />
                                                )}
                                                {sending ? "Sending..." : "Send"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClientProjects;