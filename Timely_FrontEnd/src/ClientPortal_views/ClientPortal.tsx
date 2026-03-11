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
    FolderOpen,
    CheckCircle2,
    User,
    Calendar,
    FileText,
    RefreshCw,
    Mail,
    Phone,
    HelpCircle,
    ExternalLink,
    ArrowRight,
    TrendingUp,
    MessageCircle,
    Clock,
    Bell,
} from "lucide-react";

const API_BASE = "http://localhost:4000/api";

const safeFetch = async (url: string) => {
    try {
        const response = await fetch(url);
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
            return null;
        }
        return await response.json();
    } catch {
        return null;
    }
};

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
}

interface Consultant {
    consultantId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role?: string;
}

interface DocumentFile {
    id: string;
    name: string;
    uploadedAt: string;
}

interface Message {
    id: string;
    timestamp: string;
    read: boolean;
}

type PageType = "dashboard" | "projects" | "history" | "documents" | "messages" | "settings" | "profile" | "help";


// Donut Chart for Project Status
const ProjectStatusChart: React.FC<{
    data: { label: string; value: number; color: string }[];
    isDark: boolean;
}> = ({ data, isDark }) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) {
        return (
            <div className="flex items-center justify-center h-40">
                <p className={isDark ? "text-slate-500" : "text-gray-400"}>No project data</p>
            </div>
        );
    }

    let cumulativePercent = 0;
    const segments = data.filter(d => d.value > 0).map((d) => {
        const percent = (d.value / total) * 100;
        const startAngle = cumulativePercent * 3.6;
        cumulativePercent += percent;
        const endAngle = cumulativePercent * 3.6;
        return { ...d, percent, startAngle, endAngle };
    });

    const createArcPath = (startAngle: number, endAngle: number, radius: number, innerRadius: number) => {
        const startRad = (startAngle - 90) * (Math.PI / 180);
        const endRad = (endAngle - 90) * (Math.PI / 180);

        const x1 = 50 + radius * Math.cos(startRad);
        const y1 = 50 + radius * Math.sin(startRad);
        const x2 = 50 + radius * Math.cos(endRad);
        const y2 = 50 + radius * Math.sin(endRad);

        const x3 = 50 + innerRadius * Math.cos(endRad);
        const y3 = 50 + innerRadius * Math.sin(endRad);
        const x4 = 50 + innerRadius * Math.cos(startRad);
        const y4 = 50 + innerRadius * Math.sin(startRad);

        const largeArc = endAngle - startAngle > 180 ? 1 : 0;

        return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    };

    return (
        <div className="flex items-center gap-6">
            <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    {segments.map((seg, i) => (
                        <path
                            key={i}
                            d={createArcPath(seg.startAngle, seg.endAngle, 45, 30)}
                            fill={seg.color}
                            className="transition-all duration-300 hover:opacity-80"
                        />
                    ))}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                        <p className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{total}</p>
                        <p className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>Projects</p>
                    </div>
                </div>
            </div>
            <div className="space-y-2">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className={`text-sm ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                            {d.label}: {d.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Bar Chart for Monthly Activity
const ActivityBarChart: React.FC<{
    data: { month: string; documents: number; messages: number }[];
    isDark: boolean;
}> = ({ data, isDark }) => {
    const maxValue = Math.max(...data.flatMap(d => [d.documents, d.messages]), 1);

    if (data.every(d => d.documents === 0 && d.messages === 0)) {
        return (
            <div className="flex items-center justify-center h-40">
                <p className={isDark ? "text-slate-500" : "text-gray-400"}>No activity data</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between gap-2 h-32">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="flex items-end gap-0.5 h-24 w-full justify-center">
                            <div
                                className="w-3 bg-blue-500 rounded-t transition-all duration-300"
                                style={{ height: `${(d.documents / maxValue) * 100}%`, minHeight: d.documents > 0 ? '4px' : '0' }}
                                title={`Documents: ${d.documents}`}
                            />
                            <div
                                className="w-3 bg-emerald-500 rounded-t transition-all duration-300"
                                style={{ height: `${(d.messages / maxValue) * 100}%`, minHeight: d.messages > 0 ? '4px' : '0' }}
                                title={`Messages: ${d.messages}`}
                            />
                        </div>
                        <span className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>{d.month}</span>
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-blue-500 rounded" />
                    <span className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>Documents</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-emerald-500 rounded" />
                    <span className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>Messages</span>
                </div>
            </div>
        </div>
    );
};

// Timeline Chart for Project Progress
const ProjectTimelineChart: React.FC<{
    projects: Project[];
    isDark: boolean;
}> = ({ projects, isDark }) => {
    if (projects.length === 0) {
        return (
            <div className="flex items-center justify-center h-32">
                <p className={isDark ? "text-slate-500" : "text-gray-400"}>No projects to display</p>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed": return "bg-blue-500";
            case "active": return "bg-emerald-500";
            case "pending": return "bg-amber-500";
            case "on_hold": return "bg-gray-500";
            default: return "bg-emerald-500";
        }
    };

    return (
        <div className="space-y-3">
            {projects.slice(0, 5).map((p) => {
                const progress = p.status === "completed" ? 100 : p.status === "active" ? 60 : 20;
                return (
                    <div key={p.projectId} className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"} truncate max-w-[60%]`}>
                                {p.projectName}
                            </span>
                            <span className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>
                                {p.status === "completed" ? "Complete" : `${progress}%`}
                            </span>
                        </div>
                        <div className={`h-2 rounded-full ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>
                            <div
                                className={`h-full rounded-full ${getStatusColor(p.status)} transition-all duration-500`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ==================== MAIN COMPONENT ====================

const ClientPortal: React.FC<ClientPortalProps> = ({
    userName = "Client",
    userEmail = "",
    customerId = "",
    onLogout,
}) => {
    const { isDark } = useTheme();

    const s = {
        bg: isDark ? "bg-slate-950" : "bg-gray-50",
        card: isDark ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200",
        cardHover: isDark ? "hover:bg-slate-800/80 active:bg-slate-800" : "hover:bg-gray-50 active:bg-gray-100",
        cardInner: isDark ? "bg-slate-800" : "bg-gray-100",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-600",
        textSubtle: isDark ? "text-slate-500" : "text-gray-400",
        divider: isDark ? "border-slate-800" : "border-gray-200",
        button: isDark ? "bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white" : "bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800",
        buttonPrimary: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white",
        accent: isDark ? "text-blue-400" : "text-blue-600",
        // Interactive states
        clickable: "cursor-pointer active:scale-[0.98] transition-all duration-150",
        hoverLift: "hover:-translate-y-1 hover:shadow-xl transition-all duration-300",
        hoverGlow: isDark ? "hover:shadow-lg hover:shadow-blue-500/10" : "hover:shadow-lg hover:shadow-blue-500/5",
        cardClickable: "cursor-pointer transition-all duration-200 hover:shadow-lg active:scale-[0.99] active:shadow-md",
    };

    // sidebarToggle = true means collapsed (w-20), false means expanded (w-64)
    const [sidebarToggle, setSidebarToggle] = useState(false);
    const [activePage, setActivePage] = useState<PageType>("dashboard");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [projects, setProjects] = useState<Project[]>([]);
    const [assignedConsultant, setAssignedConsultant] = useState<Consultant | null>(null);
    const [documents, setDocuments] = useState<DocumentFile[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);

    const firstName = userName.split(" ")[0] || "Client";

    useEffect(() => {
        loadClientData();
    }, [customerId]);

    const loadClientData = async () => {
        setRefreshing(true);
        try {
            // Load projects assigned to this client
            const projectClients = JSON.parse(localStorage.getItem("timely_project_clients") || "[]");
            const clientProjectIds = projectClients
                .filter((pc: any) => String(pc.clientId) === String(customerId))
                .map((pc: any) => String(pc.projectId));

            const projectsRes = await safeFetch(`${API_BASE}/projects`);
            if (projectsRes?.data) {
                const clientProjects = projectsRes.data.filter((p: Project) =>
                    clientProjectIds.includes(String(p.projectId))
                );

                const projectsWithDetails = await Promise.all(
                    clientProjects.map(async (p: Project) => {
                        const details = await safeFetch(`${API_BASE}/project-details/${p.projectId}`);
                        return {
                            ...p,
                            dateDue: details?.data?.dateDue,
                            description: details?.data?.description,
                            createdAt: details?.data?.createdAt || new Date().toISOString(),
                        };
                    })
                );
                setProjects(projectsWithDetails);
            }

            // Load assigned consultant
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

            // Load documents from localStorage
            const storedDocs = localStorage.getItem(`timely_client_documents_${customerId}`);
            if (storedDocs) {
                setDocuments(JSON.parse(storedDocs));
            }

            // Load messages from localStorage
            const storedMsgs = localStorage.getItem(`timely_client_messages_${customerId}`);
            if (storedMsgs) {
                setMessages(JSON.parse(storedMsgs));
            }

        } catch (e) {
            console.error("Error loading client data:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Stats
    const stats = useMemo(() => {
        const active = projects.filter((p) => p.status === "active" || !p.status).length;
        const completed = projects.filter((p) => p.status === "completed").length;
        const pending = projects.filter((p) => p.status === "pending" || p.status === "on_hold").length;
        return { active, completed, pending, total: projects.length };
    }, [projects]);

    // Chart data - derived from real data
    const projectStatusData = useMemo(() => [
        { label: "In Progress", value: stats.active, color: "#10b981" },
        { label: "Completed", value: stats.completed, color: "#3b82f6" },
        { label: "Pending", value: stats.pending, color: "#f59e0b" },
    ], [stats]);

    // Monthly activity data - derived from documents and messages
    const monthlyActivityData = useMemo(() => {
        const months: { month: string; documents: number; messages: number }[] = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = date.toLocaleDateString("en-US", { month: "short" });
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

            const docsInMonth = documents.filter(d => {
                const docDate = new Date(d.uploadedAt);
                return docDate >= monthStart && docDate <= monthEnd;
            }).length;

            const msgsInMonth = messages.filter(m => {
                const msgDate = new Date(m.timestamp);
                return msgDate >= monthStart && msgDate <= monthEnd;
            }).length;

            months.push({ month: monthStr, documents: docsInMonth, messages: msgsInMonth });
        }

        return months;
    }, [documents, messages]);

    const formatDate = (d: string) => {
        if (!d) return null;
        return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    const getStatusStyle = (status: string) => {
        const styles: { [key: string]: { bg: string; text: string; label: string } } = {
            active: { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "In Progress" },
            completed: { bg: "bg-blue-500/10", text: "text-blue-500", label: "Completed" },
            pending: { bg: "bg-amber-500/10", text: "text-amber-500", label: "Pending" },
            on_hold: { bg: "bg-gray-500/10", text: "text-gray-500", label: "On Hold" },
        };
        return styles[status] || styles.active;
    };

    const handleNavigate = (page: string) => {
        setActivePage(page as PageType);
    };

    const renderDashboard = () => (
        <div className="space-y-6">
            {/* Welcome Header */}
            <div className={`${s.card} border rounded-2xl p-6`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/20">
                            {firstName[0]}
                        </div>
                        <div>
                            <h1 className={`text-2xl font-bold ${s.text}`}>
                                Welcome back, {firstName}!
                            </h1>
                            <p className={`mt-1 ${s.textMuted}`}>
                                Here's what's happening with your projects today.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={loadClientData}
                        disabled={refreshing}
                        className={`p-3 rounded-xl ${s.button} transition-all duration-200 hover:shadow-md active:scale-95`}
                    >
                        <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : "hover:rotate-180 transition-transform duration-500"}`} />
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`${s.card} border rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-sm font-medium ${s.textMuted}`}>Total Projects</p>
                            <p className={`text-3xl font-bold ${s.text} mt-1`}>{stats.total}</p>
                            <p className={`text-xs ${s.textSubtle} mt-1`}>All time</p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                            <FolderOpen className="w-7 h-7 text-white" />
                        </div>
                    </div>
                </div>

                <div className={`${s.card} border rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-sm font-medium ${s.textMuted}`}>In Progress</p>
                            <p className={`text-3xl font-bold ${s.text} mt-1`}>{stats.active}</p>
                            <p className={`text-xs ${s.textSubtle} mt-1`}>Active now</p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                            <TrendingUp className="w-7 h-7 text-white" />
                        </div>
                    </div>
                </div>

                <div className={`${s.card} border rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-sm font-medium ${s.textMuted}`}>Completed</p>
                            <p className={`text-3xl font-bold ${s.text} mt-1`}>{stats.completed}</p>
                            <p className={`text-xs ${s.textSubtle} mt-1`}>All time</p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                            <CheckCircle2 className="w-7 h-7 text-white" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Project Status Chart */}
                <div className={`${s.card} border rounded-2xl p-6`}>
                    <h2 className={`font-semibold ${s.text} mb-4 flex items-center gap-2`}>
                        <FolderOpen className={`w-5 h-5 ${s.accent}`} />
                        Project Status
                    </h2>
                    <ProjectStatusChart data={projectStatusData} isDark={isDark} />
                </div>

                {/* Activity Chart */}
                <div className={`${s.card} border rounded-2xl p-6`}>
                    <h2 className={`font-semibold ${s.text} mb-4 flex items-center gap-2`}>
                        <TrendingUp className={`w-5 h-5 ${s.accent}`} />
                        Activity (Last 6 Months)
                    </h2>
                    <ActivityBarChart data={monthlyActivityData} isDark={isDark} />
                </div>
            </div>

            {/* Project Progress Timeline */}
            <div className={`${s.card} border rounded-2xl p-6`}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className={`font-semibold ${s.text} flex items-center gap-2`}>
                        <Clock className={`w-5 h-5 ${s.accent}`} />
                        Project Progress
                    </h2>
                    <button
                        onClick={() => setActivePage("projects")}
                        className={`text-sm ${s.accent} hover:underline flex items-center gap-1 font-medium`}
                    >
                        View all <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
                <ProjectTimelineChart projects={projects} isDark={isDark} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Recent Projects */}
                <div className={`lg:col-span-2 ${s.card} border rounded-2xl overflow-hidden`}>
                    <div className={`px-6 py-4 border-b ${s.divider} flex items-center justify-between`}>
                        <h2 className={`font-semibold ${s.text} flex items-center gap-2`}>
                            <FolderOpen className={`w-5 h-5 ${s.accent}`} />
                            Your Projects
                        </h2>
                        <button
                            onClick={() => setActivePage("projects")}
                            className={`text-sm ${s.accent} hover:underline flex items-center gap-1 font-medium`}
                        >
                            View all <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                    <div className={`divide-y ${s.divider}`}>
                        {projects.length === 0 ? (
                            <div className="p-10 text-center">
                                <FolderOpen className={`w-12 h-12 ${s.textSubtle} mx-auto mb-3`} />
                                <p className={`${s.textMuted} font-medium`}>No projects yet</p>
                                <p className={`${s.textSubtle} text-sm mt-1`}>Your projects will appear here</p>
                            </div>
                        ) : (
                            projects.slice(0, 4).map((p) => {
                                const status = getStatusStyle(p.status);
                                return (
                                    <div key={p.projectId} className={`px-6 py-4 ${s.cardHover} transition-all duration-200 cursor-pointer group active:bg-opacity-80`} onClick={() => setActivePage("projects")}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-amber-500/20 group-hover:scale-105 group-hover:rotate-2 transition-transform duration-200">
                                                    {p.projectName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className={`font-semibold ${s.text} group-hover:text-blue-500 transition-colors`}>{p.projectName}</p>
                                                    <p className={`text-sm ${s.textMuted}`}>{p.projectCode}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {p.dateDue && (
                                                    <span className={`text-sm ${s.textMuted} hidden sm:flex items-center gap-1`}>
                                                        <Calendar className="w-4 h-4" />
                                                        {formatDate(p.dateDue)}
                                                    </span>
                                                )}
                                                <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${status.bg} ${status.text} group-hover:scale-105 transition-transform`}>
                                                    {status.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Consultant Card */}
                <div className={`${s.card} border rounded-2xl overflow-hidden`}>
                    <div className={`px-6 py-4 border-b ${s.divider}`}>
                        <h2 className={`font-semibold ${s.text} flex items-center gap-2`}>
                            <User className={`w-5 h-5 ${s.accent}`} />
                            Your Consultant
                        </h2>
                    </div>
                    <div className="p-6">
                        {assignedConsultant ? (
                            <div className="space-y-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                                        {assignedConsultant.firstName[0]}{assignedConsultant.lastName[0]}
                                    </div>
                                    <div>
                                        <p className={`font-semibold ${s.text}`}>
                                            {assignedConsultant.firstName} {assignedConsultant.lastName}
                                        </p>
                                        {assignedConsultant.role && (
                                            <p className={`text-sm ${s.textMuted}`}>{assignedConsultant.role}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <a
                                        href={`mailto:${assignedConsultant.email}`}
                                        className={`flex items-center gap-3 p-3 rounded-xl ${s.cardInner} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group`}
                                    >
                                        <Mail className={`w-5 h-5 ${s.textMuted} group-hover:text-blue-500 transition-colors`} />
                                        <span className={`text-sm ${s.text} truncate group-hover:text-blue-500 transition-colors`}>{assignedConsultant.email}</span>
                                    </a>
                                    {assignedConsultant.phone && (
                                        <a
                                            href={`tel:${assignedConsultant.phone}`}
                                            className={`flex items-center gap-3 p-3 rounded-xl ${s.cardInner} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group`}
                                        >
                                            <Phone className={`w-5 h-5 ${s.textMuted} group-hover:text-emerald-500 transition-colors`} />
                                            <span className={`text-sm ${s.text} group-hover:text-emerald-500 transition-colors`}>{assignedConsultant.phone}</span>
                                        </a>
                                    )}
                                </div>

                                <button
                                    onClick={() => setActivePage("messages")}
                                    className={`w-full ${s.buttonPrimary} py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md`}
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    Send Message
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <User className={`w-12 h-12 ${s.textSubtle} mx-auto mb-3`} />
                                <p className={`${s.textMuted} font-medium`}>No consultant assigned</p>
                                <p className={`${s.textSubtle} text-sm mt-1`}>One will be assigned soon</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className={`${s.card} border rounded-2xl p-6`}>
                <h2 className={`font-semibold ${s.text} mb-4 flex items-center gap-2`}>
                    <Bell className={`w-5 h-5 ${s.accent}`} />
                    Quick Actions
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "View Projects", icon: FolderOpen, page: "projects", color: "from-amber-500 to-amber-600", shadow: "shadow-amber-500/20" },
                        { label: "Documents", icon: FileText, page: "documents", color: "from-blue-500 to-blue-600", shadow: "shadow-blue-500/20" },
                        { label: "Messages", icon: MessageCircle, page: "messages", color: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/20" },
                        { label: "Get Help", icon: HelpCircle, page: "help", color: "from-purple-500 to-purple-600", shadow: "shadow-purple-500/20" },
                    ].map((action) => (
                        <button
                            key={action.page}
                            onClick={() => setActivePage(action.page as PageType)}
                            className={`flex flex-col items-center gap-3 p-5 rounded-2xl ${s.cardInner} transition-all duration-300 hover:shadow-xl hover:-translate-y-2 active:translate-y-0 active:shadow-md group cursor-pointer`}
                        >
                            <div className={`w-12 h-12 bg-gradient-to-br ${action.color} rounded-xl flex items-center justify-center shadow-lg ${action.shadow} group-hover:scale-110 group-hover:rotate-6 group-active:scale-95 transition-all duration-300`}>
                                <action.icon className="w-6 h-6 text-white" />
                            </div>
                            <span className={`text-sm font-medium ${s.text} group-hover:${s.accent}`}>{action.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    // ==================== HELP ====================
    const renderHelp = () => (
        <div className="space-y-6">
            <div>
                <h1 className={`text-2xl font-bold ${s.text}`}>Help & Support</h1>
                <p className={`mt-1 ${s.textMuted}`}>Get assistance with your account</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className={`${s.card} border rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group`}>
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                        <HelpCircle className="w-6 h-6 text-white" />
                    </div>
                    <h3 className={`font-semibold ${s.text} mb-2`}>FAQ</h3>
                    <p className={`text-sm ${s.textMuted} mb-4`}>Find answers to common questions about our services.</p>
                    <button className={`${s.button} px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:shadow-md active:scale-95`}>
                        View FAQ <ExternalLink className="w-4 h-4" />
                    </button>
                </div>

                <div className={`${s.card} border rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group`}>
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                        <Mail className="w-6 h-6 text-white" />
                    </div>
                    <h3 className={`font-semibold ${s.text} mb-2`}>Contact Support</h3>
                    <p className={`text-sm ${s.textMuted} mb-4`}>Our team is here to help with any questions.</p>
                    <a
                        href="mailto:support@timely.com"
                        className={`${s.buttonPrimary} px-4 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2 transition-all duration-200 hover:shadow-md active:scale-95`}
                    >
                        <Mail className="w-4 h-4" /> Email Support
                    </a>
                </div>

                {assignedConsultant && (
                    <div className={`${s.card} border rounded-2xl p-6 md:col-span-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group`}>
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                            <User className="w-6 h-6 text-white" />
                        </div>
                        <h3 className={`font-semibold ${s.text} mb-2`}>Your Consultant</h3>
                        <p className={`text-sm ${s.textMuted} mb-4`}>
                            {assignedConsultant.firstName} {assignedConsultant.lastName} is your dedicated consultant.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <a
                                href={`mailto:${assignedConsultant.email}`}
                                className={`${s.buttonPrimary} px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0`}
                            >
                                <Mail className="w-4 h-4" /> {assignedConsultant.email}
                            </a>
                            {assignedConsultant.phone && (
                                <a
                                    href={`tel:${assignedConsultant.phone}`}
                                    className={`${s.button} px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0`}
                                >
                                    <Phone className="w-4 h-4" /> {assignedConsultant.phone}
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <RefreshCw className={`w-8 h-8 ${s.accent} animate-spin mx-auto mb-3`} />
                        <p className={s.textMuted}>Loading your dashboard...</p>
                    </div>
                </div>
            );
        }

        switch (activePage) {
            case "dashboard": return renderDashboard();
            case "projects": return <ClientProjects userName={userName} userEmail={userEmail} customerId={customerId} />;
            case "history": return <ClientHistory userName={userName} userEmail={userEmail} customerId={customerId} />;
            case "documents": return <ClientDocuments userName={userName} userEmail={userEmail} customerId={customerId} />;
            case "messages": return <ClientMessages userName={userName} userEmail={userEmail} customerId={customerId} />;
            case "settings": return <ClientSettings userName={userName} userEmail={userEmail} customerId={customerId} />;
            case "profile": return <ClientProfile userName={userName} userEmail={userEmail} customerId={customerId} />;
            case "help": return renderHelp();
            default: return renderDashboard();
        }
    };

    return (
        <div className={`min-h-screen ${s.bg}`}>
            <ClientSidebar
                sidebarToggle={sidebarToggle}
                setSidebarToggle={setSidebarToggle}
                activePage={activePage}
                onNavigate={handleNavigate}
                onLogout={onLogout}
                userName={userName}
                userEmail={userEmail}
            />

            {/* Main content area - adjusts based on sidebar state */}
            <div className={`min-h-screen transition-all duration-300 ${sidebarToggle ? "ml-20" : "ml-64"}`}>
                <ClientNavbar
                    sidebarToggle={sidebarToggle}
                    setSidebarToggle={setSidebarToggle}
                    activePage={activePage}
                    onNavigate={handleNavigate}
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