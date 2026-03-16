// src/ClientPortal_views/ClientPortal.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import ClientSidebar from "./ClientSidebar";
import ClientNavbar from "./ClientNavbar";
import ClientSettings from "./ClientSettings";
import ClientProfile from "./ClientProfile";
import ClientHistory from "./ClientHistory";
import ClientDocuments from "./ClientDocuments";
import ClientMessages from "./ClientMessages";
import ClientProjects from "./ClientProjects";
import {
    FolderOpen, CheckCircle2, User, Calendar, FileText,
    RefreshCw, Mail, Phone, HelpCircle, ArrowRight,
    TrendingUp, MessageCircle, Clock, Bell, ExternalLink,
    CheckCircle, AlertCircle, Info, X,
} from "lucide-react";

const API_BASE = "/api";

const safeFetch = async (url: string) => {
    try {
        const r = await fetch(url);
        if (!r.ok || !r.headers.get("content-type")?.includes("application/json")) return null;
        return await r.json();
    } catch { return null; }
};

// ─── Types ────────────────────────────────────────────────────────────────────

type PageType = "dashboard" | "projects" | "history" | "documents" | "messages" | "settings" | "profile" | "help";

type ClientPortalProps = {
    userName?: string;
    userEmail?: string;
    customerId?: string;
    onLogout?: () => void;
};

interface Project {
    projectId: string;
    projectCode: string;
    projectName: string;
    status: string;
    dateDue?: string;
    description?: string;
    createdAt?: string;
    isPublished?: boolean;
    listingSlug?: string;
    listingStatus?: string;
    listingPrice?: string;
    address?: string;
    city?: string;
    state?: string;
    propertyType?: string;
    bedrooms?: string;
    bathrooms?: string;
    sqft?: string;
}

interface Consultant {
    consultantId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role?: string;
}

interface DocumentFile { id: string; name: string; uploadedAt: string; }
interface Message      { id: string; timestamp: string; read: boolean; }
interface Toast        { id: string; message: string; type: "success" | "error" | "info"; }

// ─── Mini charts ──────────────────────────────────────────────────────────────

const DonutChart: React.FC<{
    data: { label: string; value: number; color: string }[];
    n: Record<string, string>;
}> = ({ data, n }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return <p className={`${n.tertiary} text-sm text-center py-8`}>No project data yet</p>;

    let cum = 0;
    const segments = data.filter(d => d.value > 0).map(d => {
        const pct   = (d.value / total) * 100;
        const start = cum * 3.6;
        cum += pct;
        const end   = cum * 3.6;
        return { ...d, pct, start, end };
    });

    const arc = (s: number, e: number, r: number, ir: number) => {
        const toRad = (a: number) => (a - 90) * (Math.PI / 180);
        const x1 = 50 + r * Math.cos(toRad(s)), y1 = 50 + r * Math.sin(toRad(s));
        const x2 = 50 + r * Math.cos(toRad(e)), y2 = 50 + r * Math.sin(toRad(e));
        const x3 = 50 + ir * Math.cos(toRad(e)), y3 = 50 + ir * Math.sin(toRad(e));
        const x4 = 50 + ir * Math.cos(toRad(s)), y4 = 50 + ir * Math.sin(toRad(s));
        const lg = e - s > 180 ? 1 : 0;
        return `M${x1} ${y1} A${r} ${r} 0 ${lg} 1 ${x2} ${y2} L${x3} ${y3} A${ir} ${ir} 0 ${lg} 0 ${x4} ${y4}Z`;
    };

    return (
        <div className="flex items-center gap-6">
            <div className="relative w-28 h-28 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    {segments.map((seg, i) => (
                        <path key={i} d={arc(seg.start, seg.end, 45, 30)} fill={seg.color} className="hover:opacity-80 transition-opacity" />
                    ))}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <p className={`text-xl font-bold ${n.strong}`}>{total}</p>
                    <p className={`text-[10px] ${n.tertiary}`}>Projects</p>
                </div>
            </div>
            <div className="space-y-2">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <span className={`text-xs ${n.secondary}`}>{d.label}: <span className={`font-semibold ${n.text}`}>{d.value}</span></span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ProgressBars: React.FC<{
    projects: Project[];
    n: Record<string, string>;
    onViewAll: () => void;
}> = ({ projects, n, onViewAll }) => {
    if (projects.length === 0) return <p className={`${n.tertiary} text-sm text-center py-8`}>No projects to display</p>;

    const getColor = (s: string) =>
        s === "completed" ? "bg-blue-500" : s === "active" || s === "in_progress" ? "bg-emerald-500" : s === "on_hold" ? "bg-gray-500" : "bg-amber-500";
    const getPct = (s: string) =>
        s === "completed" ? 100 : s === "active" || s === "in_progress" ? 60 : s === "on_hold" ? 35 : 20;

    return (
        <div className="space-y-4">
            {projects.slice(0, 4).map(p => {
                const pct = getPct(p.status);
                return (
                    <div key={p.projectId}>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-sm font-medium ${n.text} truncate max-w-[65%]`}>{p.projectName}</span>
                            <span className={`text-xs ${n.tertiary}`}>{pct}%</span>
                        </div>
                        <div className={`h-1.5 rounded-full ${n.inset}`}>
                            <div className={`h-full rounded-full ${getColor(p.status)} transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                );
            })}
            {projects.length > 4 && (
                <button onClick={onViewAll} className={`text-xs ${n.link} flex items-center gap-1 pt-1`}>
                    +{projects.length - 4} more <ArrowRight className="w-3 h-3" />
                </button>
            )}
        </div>
    );
};

// ─── Component ────────────────────────────────────────────────────────────────

const ClientPortal: React.FC<ClientPortalProps> = ({
    userName = "Client",
    userEmail = "",
    customerId = "",
    onLogout,
}) => {
    const { isDark } = useTheme();

    // ── Neumorphic tokens — same system as staff side ────────────────────────
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
        link:         isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-500",
        divider:      isDark ? "border-gray-800"    : "border-gray-200",
        btnPrimary:   "bg-blue-600 hover:bg-blue-500 text-white",
        btnSecondary: isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        edgeHover: isDark
            ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]"
            : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]",
    };

    const [sidebarToggle, setSidebarToggle] = useState(false);
    const [activePage, setActivePage]       = useState<PageType>("dashboard");
    const [loading, setLoading]             = useState(true);
    const [refreshing, setRefreshing]       = useState(false);
    const [toasts, setToasts]               = useState<Toast[]>([]);

    const [projects, setProjects]                 = useState<Project[]>([]);
    const [assignedConsultant, setAssignedConsultant] = useState<Consultant | null>(null);
    const [documents, setDocuments]               = useState<DocumentFile[]>([]);
    const [messages, setMessages]                 = useState<Message[]>([]);

    const firstName = userName.split(" ")[0] || "Client";

    const showToast = (message: string, type: Toast["type"] = "success") => {
        const id = `t_${Date.now()}`;
        setToasts(p => [...p, { id, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    useEffect(() => { loadClientData(); }, [customerId]);

    const loadClientData = async () => {
        setRefreshing(true);
        try {
            // Projects assigned to this client
            const projectClients = JSON.parse(localStorage.getItem("timely_project_clients") || "[]");
            const clientProjectIds = projectClients
                .filter((pc: any) => String(pc.clientId) === String(customerId))
                .map((pc: any) => String(pc.projectId));

            // Also check AssignmentService format
            const assignmentData = JSON.parse(localStorage.getItem("timely_assignments") || "{}");
            if (assignmentData.projectClients) {
                assignmentData.projectClients.forEach((pc: any) => {
                    if (String(pc.clientId) === String(customerId) && !clientProjectIds.includes(String(pc.projectId))) {
                        clientProjectIds.push(String(pc.projectId));
                    }
                });
            }

            // Load all projects from localStorage (includes property/listing fields)
            const localProjects: Project[] = JSON.parse(localStorage.getItem("timely_projects") || "[]");
            const apiProjectsRes = await safeFetch(`${API_BASE}/projects`);
            const apiProjects: Project[] = apiProjectsRes?.data || [];

            // Merge: API base + local property/listing enrichment
            const allProjects = [...apiProjects];
            localProjects.forEach(lp => {
                if (!allProjects.find(ap => String(ap.projectId) === String(lp.projectId))) {
                    allProjects.push(lp);
                } else {
                    const idx = allProjects.findIndex(ap => String(ap.projectId) === String(lp.projectId));
                    allProjects[idx] = { ...allProjects[idx], ...lp };
                }
            });

            const clientProjects = allProjects.filter(p => clientProjectIds.includes(String(p.projectId)));
            setProjects(clientProjects);

            // Assigned consultant
            const clientConsultants = await safeFetch(`${API_BASE}/client-consultants`);
            if (clientConsultants?.data) {
                const assignment = clientConsultants.data.find((cc: any) => String(cc.clientId) === String(customerId));
                if (assignment) {
                    const consultantsRes = await safeFetch(`${API_BASE}/consultants`);
                    if (consultantsRes?.data) {
                        const consultant = consultantsRes.data.find((c: Consultant) =>
                            String(c.consultantId) === String(assignment.consultantId)
                        );
                        if (consultant) {
                            const ext = JSON.parse(localStorage.getItem("timely_consultants_extended") || "{}");
                            setAssignedConsultant({ ...consultant, ...ext[consultant.consultantId] });
                        }
                    }
                }
            }

            // Documents + messages from localStorage
            const storedDocs = localStorage.getItem(`timely_client_documents_${customerId}`);
            if (storedDocs) setDocuments(JSON.parse(storedDocs));
            const storedMsgs = localStorage.getItem(`timely_client_messages_${customerId}`);
            if (storedMsgs) setMessages(JSON.parse(storedMsgs));

        } catch (e) {
            console.error("Error loading client data:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // ── Derived stats ─────────────────────────────────────────────────────────
    const stats = useMemo(() => ({
        total:     projects.length,
        active:    projects.filter(p => p.status === "active" || p.status === "in_progress").length,
        completed: projects.filter(p => p.status === "completed").length,
        pending:   projects.filter(p => p.status === "pending" || p.status === "on_hold").length,
        listed:    projects.filter(p => p.isPublished).length,
    }), [projects]);

    const donutData = useMemo(() => [
        { label: "Active",    value: stats.active,    color: "#10b981" },
        { label: "Completed", value: stats.completed, color: "#3b82f6" },
        { label: "Pending",   value: stats.pending,   color: "#f59e0b" },
    ], [stats]);

    const formatDate = (d: string) => d
        ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : null;

    const statusBadge = (status: string) => ({
        active:      { bg: "bg-emerald-500/10 text-emerald-500", label: "In Progress" },
        in_progress: { bg: "bg-emerald-500/10 text-emerald-500", label: "In Progress" },
        completed:   { bg: "bg-blue-500/10 text-blue-500",       label: "Completed" },
        pending:     { bg: "bg-amber-500/10 text-amber-500",     label: "Pending" },
        on_hold:     { bg: "bg-gray-500/10 text-gray-500",       label: "On Hold" },
        planning:    { bg: "bg-blue-500/10 text-blue-400",       label: "Planning" },
    }[status] || { bg: "bg-emerald-500/10 text-emerald-500", label: "Active" });

    // ── Dashboard ─────────────────────────────────────────────────────────────
    const renderDashboard = () => (
        <div className="space-y-6">

            {/* Welcome */}
            <div className={`${n.card} rounded-2xl p-6`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg">
                            {firstName[0]}
                        </div>
                        <div>
                            <h1 className={`text-xl font-semibold ${n.strong}`}>Welcome back, {firstName}</h1>
                            <p className={`text-sm ${n.secondary} mt-0.5`}>Here's an overview of your projects</p>
                        </div>
                    </div>
                    <button onClick={loadClientData} disabled={refreshing} className={`w-9 h-9 ${n.flat} flex items-center justify-center rounded-xl`}>
                        <RefreshCw className={`w-4 h-4 ${n.secondary} ${refreshing ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Total Projects", value: stats.total,     dot: "bg-blue-500",    icon: FolderOpen },
                    { label: "In Progress",    value: stats.active,    dot: "bg-emerald-500", icon: TrendingUp },
                    { label: "Completed",      value: stats.completed, dot: "bg-blue-500",    icon: CheckCircle2 },
                    { label: "Listings",       value: stats.listed,    dot: "bg-emerald-500", icon: ExternalLink },
                ].map((st, i) => (
                    <div key={i} className={`${n.card} ${n.edgeHover} p-4 rounded-2xl transition-all`}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            <span className={`text-[11px] uppercase tracking-widest ${n.tertiary}`}>{st.label}</span>
                        </div>
                        <div className={`text-3xl font-semibold ${n.strong} tabular-nums`}>{st.value}</div>
                    </div>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid gap-5 lg:grid-cols-2">
                {/* Donut */}
                <div className={`${n.card} rounded-2xl p-5`}>
                    <div className="flex items-center gap-2 mb-5">
                        <FolderOpen className={`w-4 h-4 ${n.label}`} />
                        <h2 className={`font-semibold ${n.text}`}>Project Status</h2>
                    </div>
                    <DonutChart data={donutData} n={n} />
                </div>

                {/* Progress bars */}
                <div className={`${n.card} rounded-2xl p-5`}>
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${n.label}`} />
                            <h2 className={`font-semibold ${n.text}`}>Project Progress</h2>
                        </div>
                        <button onClick={() => setActivePage("projects")} className={`text-xs ${n.link} flex items-center gap-1`}>
                            View all <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                    <ProgressBars projects={projects} n={n} onViewAll={() => setActivePage("projects")} />
                </div>
            </div>

            {/* Recent projects + consultant */}
            <div className="grid gap-5 lg:grid-cols-3">

                {/* Recent projects */}
                <div className={`lg:col-span-2 ${n.card} rounded-2xl overflow-hidden`}>
                    <div className={`px-5 py-4 border-b ${n.divider} flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                            <FolderOpen className={`w-4 h-4 ${n.label}`} />
                            <h2 className={`font-semibold ${n.text}`}>Your Projects</h2>
                        </div>
                        <button onClick={() => setActivePage("projects")} className={`text-xs ${n.link} flex items-center gap-1`}>
                            View all <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div>
                        {projects.length === 0 ? (
                            <div className="p-10 text-center">
                                <FolderOpen className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} strokeWidth={1.5} />
                                <p className={`${n.secondary} text-sm font-medium`}>No projects yet</p>
                                <p className={`${n.tertiary} text-xs mt-1`}>Projects assigned to you will appear here</p>
                            </div>
                        ) : (
                            projects.slice(0, 4).map((p, i) => {
                                const badge = statusBadge(p.status);
                                return (
                                    <div
                                        key={p.projectId}
                                        onClick={() => setActivePage("projects")}
                                        className={`px-5 py-3.5 flex items-center justify-between cursor-pointer transition-all ${i < projects.slice(0, 4).length - 1 ? `border-b ${n.divider}` : ""} ${isDark ? "hover:bg-gray-800/50" : "hover:bg-black/5"}`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                                                {p.projectName.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`font-medium ${n.text} text-sm truncate`}>{p.projectName}</p>
                                                <p className={`${n.tertiary} text-[11px] font-mono`}>{p.projectCode}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                                            {p.dateDue && (
                                                <span className={`text-xs ${n.tertiary} hidden sm:flex items-center gap-1`}>
                                                    <Calendar className="w-3 h-3" />{formatDate(p.dateDue)}
                                                </span>
                                            )}
                                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${badge.bg}`}>{badge.label}</span>
                                            {p.isPublished && (
                                                <span className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 flex items-center gap-1">
                                                    <ExternalLink className="w-2.5 h-2.5" />Listing
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Consultant */}
                <div className={`${n.card} rounded-2xl overflow-hidden`}>
                    <div className={`px-5 py-4 border-b ${n.divider} flex items-center gap-2`}>
                        <User className={`w-4 h.4 ${n.label}`} />
                        <h2 className={`font-semibold ${n.text}`}>Your Consultant</h2>
                    </div>
                    <div className="p-5">
                        {assignedConsultant ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold">
                                        {assignedConsultant.firstName[0]}{assignedConsultant.lastName[0]}
                                    </div>
                                    <div>
                                        <p className={`font-semibold ${n.text} text-sm`}>{assignedConsultant.firstName} {assignedConsultant.lastName}</p>
                                        {assignedConsultant.role && <p className={`text-xs ${n.tertiary}`}>{assignedConsultant.role}</p>}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <a href={`mailto:${assignedConsultant.email}`} className={`flex items-center gap-2.5 px-3 py-2.5 ${n.flat} rounded-xl text-sm ${n.secondary} hover:${n.label} transition-colors`}>
                                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span className="truncate text-xs">{assignedConsultant.email}</span>
                                    </a>
                                    {assignedConsultant.phone && (
                                        <a href={`tel:${assignedConsultant.phone}`} className={`flex items-center gap-2.5 px-3 py-2.5 ${n.flat} rounded-xl text-sm ${n.secondary} transition-colors`}>
                                            <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span className="text-xs">{assignedConsultant.phone}</span>
                                        </a>
                                    )}
                                </div>
                                <button onClick={() => setActivePage("messages")} className={`w-full px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm font-medium flex items-center justify-center gap-2`}>
                                    <MessageCircle className="w-4 h-4" />Send Message
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <User className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} strokeWidth={1.5} />
                                <p className={`${n.secondary} text-sm`}>No consultant assigned</p>
                                <p className={`${n.tertiary} text-xs mt-1`}>One will be assigned soon</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick actions */}
            <div className={`${n.card} rounded-2xl p-5`}>
                <div className="flex items-center gap-2 mb-5">
                    <Bell className={`w-4 h-4 ${n.label}`} />
                    <h2 className={`font-semibold ${n.text}`}>Quick Actions</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: "My Projects", page: "projects",  color: "from-blue-500 to-blue-700",    icon: FolderOpen },
                        { label: "Documents",   page: "documents", color: "from-emerald-500 to-emerald-700", icon: FileText },
                        { label: "Messages",    page: "messages",  color: "from-amber-500 to-amber-700",  icon: MessageCircle },
                        { label: "Help",        page: "help",      color: "from-gray-500 to-gray-700",    icon: HelpCircle },
                    ].map(action => (
                        <button key={action.page} onClick={() => setActivePage(action.page as PageType)} className={`${n.flat} ${n.edgeHover} flex flex-col items-center gap-3 p-5 rounded-2xl transition-all group`}>
                            <div className={`w-11 h-11 bg-gradient-to-br ${action.color} rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform`}>
                                <action.icon className="w-5 h-5 text-white" />
                            </div>
                            <span className={`text-xs font-medium ${n.secondary}`}>{action.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    // ── Help ──────────────────────────────────────────────────────────────────
    const renderHelp = () => (
        <div className="space-y-6">
            <div>
                <h1 className={`text-xl font-semibold ${n.strong}`}>Help & Support</h1>
                <p className={`text-sm ${n.secondary} mt-1`}>Get assistance with your account</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <div className={`${n.card} ${n.edgeHover} rounded-2xl p-5 transition-all`}>
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center mb-4">
                        <HelpCircle className="w-5 h-5 text-white" />
                    </div>
                    <h3 className={`font-semibold ${n.text} mb-1.5`}>FAQ</h3>
                    <p className={`text-sm ${n.secondary} mb-4`}>Find answers to common questions about our services.</p>
                    <button className={`px-4 py-2 ${n.flat} rounded-xl text-sm ${n.secondary} flex items-center gap-2`}>
                        View FAQ <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                </div>
                <div className={`${n.card} ${n.edgeHover} rounded-2xl p-5 transition-all`}>
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center mb-4">
                        <Mail className="w-5 h-5 text-white" />
                    </div>
                    <h3 className={`font-semibold ${n.text} mb-1.5`}>Contact Support</h3>
                    <p className={`text-sm ${n.secondary} mb-4`}>Our team is here to help with any questions.</p>
                    <a href="mailto:support@timely.com" className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm inline-flex items-center gap-2`}>
                        <Mail className="w-3.5 h-3.5" />Email Support
                    </a>
                </div>
                {assignedConsultant && (
                    <div className={`${n.card} ${n.edgeHover} rounded-2xl p-5 transition-all md:col-span-2`}>
                        <div className="w-10 h-10 bg-gradient-to-br from-gray-500 to-gray-700 rounded-xl flex items-center justify-center mb-4">
                            <User className="w-5 h-5 text-white" />
                        </div>
                        <h3 className={`font-semibold ${n.text} mb-1.5`}>Your Consultant</h3>
                        <p className={`text-sm ${n.secondary} mb-4`}>{assignedConsultant.firstName} {assignedConsultant.lastName} is your dedicated consultant.</p>
                        <div className="flex flex-wrap gap-3">
                            <a href={`mailto:${assignedConsultant.email}`} className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-2`}>
                                <Mail className="w-3.5 h-3.5" />{assignedConsultant.email}
                            </a>
                            {assignedConsultant.phone && (
                                <a href={`tel:${assignedConsultant.phone}`} className={`px-4 py-2 ${n.flat} rounded-xl text-sm ${n.secondary} flex items-center gap-2`}>
                                    <Phone className="w-3.5 h-3.5" />{assignedConsultant.phone}
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    // ── Content router ────────────────────────────────────────────────────────
    const renderContent = () => {
        if (loading) return (
            <div className="flex items-center justify-center py-24">
                <div className="text-center">
                    <RefreshCw className={`w-7 h-7 ${n.label} animate-spin mx-auto mb-3`} />
                    <p className={`${n.secondary} text-sm`}>Loading your dashboard…</p>
                </div>
            </div>
        );

        switch (activePage) {
            case "dashboard":  return renderDashboard();
            case "projects":   return <ClientProjects userName={userName} userEmail={userEmail} customerId={customerId} />;
            case "history":    return <ClientHistory  userName={userName} userEmail={userEmail} customerId={customerId} />;
            case "documents":  return <ClientDocuments userName={userName} userEmail={userEmail} customerId={customerId} />;
            case "messages":   return <ClientMessages  userName={userName} userEmail={userEmail} customerId={customerId} />;
            case "settings":   return <ClientSettings  userName={userName} userEmail={userEmail} customerId={customerId} />;
            case "profile":    return <ClientProfile   userName={userName} userEmail={userEmail} customerId={customerId} />;
            case "help":       return renderHelp();
            default:           return renderDashboard();
        }
    };

    return (
        <div className={`min-h-screen ${n.bg} ${n.text}`}>

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

            <ClientSidebar
                sidebarToggle={sidebarToggle}
                setSidebarToggle={setSidebarToggle}
                activePage={activePage}
                onNavigate={(page) => setActivePage(page as PageType)}
                onLogout={onLogout}
                userName={userName}
                userEmail={userEmail}
            />

            <div className={`min-h-screen transition-all duration-300 ${sidebarToggle ? "ml-20" : "ml-64"}`}>
                <ClientNavbar
                    sidebarToggle={sidebarToggle}
                    setSidebarToggle={setSidebarToggle}
                    activePage={activePage}
                    onNavigate={(page) => setActivePage(page as PageType)}
                    onLogout={onLogout}
                    userName={userName}
                    userEmail={userEmail}
                    customerId={customerId}
                />
                <main className="pt-20 px-6 pb-8">
                    <div className="max-w-6xl mx-auto">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ClientPortal;