// src/Tabs/reports.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    BarChart2, Users, Clock, FolderOpen, AlertCircle, CheckCircle, Info, X,
    Calendar, TrendingUp, Filter, Download, RefreshCw, PieChart, Activity,
    Briefcase, AlertTriangle, PlayCircle, Timer, UserCheck, FileText, UserPlus,
    Trash2, Edit, ChevronDown, ChevronRight, Search,
} from "lucide-react";

const API_BASE = "/api";
type UserRole = "admin" | "consultant" | "client";

interface AuditLog { logId: string; timestamp: string; actionType: string; entityType: string; entityId: string; performedBy: string; details: string; }
interface Project { projectId: string; projectCode?: string; projectName: string; clientName?: string; status: string; dateCreated?: string; dateDue?: string; }
interface HoursLog { logId: string; projectId: string; consultantId: string; consultantEmail?: string; date: string; hours: number; description: string; createdAt?: string; }
interface Consultant { consultantId: string; consultantCode?: string; firstName: string; lastName: string; email: string; role?: string; status?: string; }
interface Client { customerId: string; clientCode?: string; firstName: string; lastName: string; email: string; }
interface ProjectConsultant { consultantId: string; projectId: string; }
interface Toast { id: string; message: string; type: "success" | "error" | "info"; }

const STATUS_COLORS: Record<string, { bg: string; text: string; fill: string }> = {
    planned: { bg: "bg-slate-500/10", text: "text-slate-400", fill: "#64748b" },
    planning: { bg: "bg-blue-500/10", text: "text-blue-400", fill: "#3b82f6" },
    active: { bg: "bg-emerald-500/10", text: "text-emerald-400", fill: "#10b981" },
    "in progress": { bg: "bg-blue-500/10", text: "text-blue-400", fill: "#3b82f6" },
    in_progress: { bg: "bg-blue-500/10", text: "text-blue-400", fill: "#3b82f6" },
    completed: { bg: "bg-green-500/10", text: "text-green-400", fill: "#22c55e" },
    "on hold": { bg: "bg-amber-500/10", text: "text-amber-400", fill: "#f59e0b" },
    on_hold: { bg: "bg-amber-500/10", text: "text-amber-400", fill: "#f59e0b" },
    overdue: { bg: "bg-red-500/10", text: "text-red-400", fill: "#ef4444" },
};

const ACTION_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
    CREATE_PROJECT: { label: "Project Created", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
    DELETE_PROJECT: { label: "Project Deleted", color: "text-red-400", bgColor: "bg-red-500/10" },
    UPDATE_PROJECT: { label: "Project Updated", color: "text-blue-400", bgColor: "bg-blue-500/10" },
    UPDATE_PROJECT_DETAILS: { label: "Project Updated", color: "text-blue-400", bgColor: "bg-blue-500/10" },
    CREATE_CLIENT: { label: "Client Added", color: "text-purple-400", bgColor: "bg-purple-500/10" },
    DELETE_CLIENT: { label: "Client Removed", color: "text-red-400", bgColor: "bg-red-500/10" },
    CREATE_CONSULTANT: { label: "Consultant Added", color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
    DELETE_CONSULTANT: { label: "Consultant Removed", color: "text-red-400", bgColor: "bg-red-500/10" },
    LOG_HOURS: { label: "Hours Logged", color: "text-amber-400", bgColor: "bg-amber-500/10" },
    ASSIGN_PROJECT: { label: "Project Assigned", color: "text-blue-400", bgColor: "bg-blue-500/10" },
    ASSIGN_CONSULTANT: { label: "Consultant Assigned", color: "text-indigo-400", bgColor: "bg-indigo-500/10" },
    SEND_EMAIL: { label: "Email Sent", color: "text-pink-400", bgColor: "bg-pink-500/10" },
    LOGIN: { label: "User Login", color: "text-blue-400", bgColor: "bg-blue-500/10" },
};

const safeFetch = async (url: string) => { try { const res = await fetch(url); if (!res.ok) return null; const ct = res.headers.get("content-type") || ""; if (!ct.includes("application/json")) return null; return await res.json(); } catch { return null; } };

const getCurrentUser = (): { role: UserRole; email: string; name: string; consultantId?: string } => {
    try { const raw = localStorage.getItem("timely_user"); if (!raw) return { role: "admin", email: "", name: "" }; const parsed = JSON.parse(raw); const r = (parsed.role || "").toLowerCase(); const role: UserRole = r === "admin" || r === "consultant" || r === "client" ? r : "admin"; return { role, email: parsed.email || "", name: parsed.name || "", consultantId: parsed.consultantId }; } catch { return { role: "admin", email: "", name: "" }; }
};

const fmtStatus = (s: string): string => s ? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Active";

const ReportsTab: React.FC = () => {
    const { isDark } = useTheme();

    const n = {
        bg: isDark ? "neu-bg-dark" : "neu-bg-light",
        card: isDark ? "neu-dark" : "neu-light",
        flat: isDark ? "neu-dark-flat" : "neu-light-flat",
        inset: isDark ? "neu-dark-inset" : "neu-light-inset",
        pressed: isDark ? "neu-dark-pressed" : "neu-light-pressed",
        text: isDark ? "text-white" : "text-gray-900",
        secondary: isDark ? "text-gray-300" : "text-gray-600",
        tertiary: isDark ? "text-gray-500" : "text-gray-400",
        strong: isDark ? "text-white" : "text-black",
        label: isDark ? "text-blue-400" : "text-blue-600",
        link: isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-500",
        badge: isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700",
        input: isDark ? "bg-transparent border-gray-700 text-white" : "bg-transparent border-gray-300 text-gray-900",
        modal: isDark ? "bg-[#111111] border-gray-800" : "bg-[#f0f0f0] border-gray-300",
        btnPrimary: "bg-blue-600 hover:bg-blue-500 text-white",
        btnSecondary: isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        divider: isDark ? "border-gray-800" : "border-gray-200",
        edgeHover: isDark
            ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]"
            : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]",
        barBg: isDark ? "bg-gray-800" : "bg-gray-200",
    };

    const { role: userRole, email: currentEmail, name: currentName } = useMemo(() => getCurrentUser(), []);
    const isAdmin = userRole === "admin";
    const isConsultant = userRole === "consultant";

    const [toasts, setToasts] = useState<Toast[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [hoursLogs, setHoursLogs] = useState<HoursLog[]>([]);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [projectConsultants, setProjectConsultants] = useState<ProjectConsultant[]>([]);

    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
    const [filterConsultant, setFilterConsultant] = useState("all");
    const [filterClient, setFilterClient] = useState("all");
    const [filterProject, setFilterProject] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [auditSearch, setAuditSearch] = useState("");
    const [auditActionFilter, setAuditActionFilter] = useState("all");
    const [showAuditLog, setShowAuditLog] = useState(true);

    const showToast = (msg: string, type: "success" | "error" | "info" = "success") => { const id = `t_${Date.now()}`; setToasts(p => [...p, { id, message: msg, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000); };

    useEffect(() => { loadAllData(); }, []);

    const loadAllData = async () => {
        setIsLoading(true);
        try {
            const [auditRes, projectsRes, hoursRes, consultantsRes, clientsRes, pcRes] = await Promise.all([
                safeFetch(`${API_BASE}/audit-logs/latest?limit=100`), safeFetch(`${API_BASE}/projects`),
                safeFetch(`${API_BASE}/hours-logs`), safeFetch(`${API_BASE}/consultants`),
                safeFetch(`${API_BASE}/orgs/me`), safeFetch(`${API_BASE}/project-consultants`),
            ]);
            if (auditRes?.data) setAuditLogs(auditRes.data.reverse());
            if (projectsRes?.data) setProjects(projectsRes.data);
            if (hoursRes?.data) setHoursLogs(hoursRes.data);
            if (consultantsRes?.data) setConsultants(consultantsRes.data);
            if (clientsRes?.data) setClients(clientsRes.data);
            if (pcRes?.data) setProjectConsultants(pcRes.data);
        } catch { showToast("Failed to load data", "error"); }
        finally { setIsLoading(false); }
    };

    const handleRefresh = async () => { setIsRefreshing(true); await loadAllData(); setIsRefreshing(false); showToast("Refreshed", "success"); };
    const clearFilters = () => { setDateRange({ start: "", end: "" }); setFilterConsultant("all"); setFilterClient("all"); setFilterProject("all"); setFilterStatus("all"); };

    const getProjectStatus = (p: Project): string => { if (p.status === "completed") return "completed"; if (p.dateDue && new Date(p.dateDue) < new Date() && p.status !== "completed") return "overdue"; return p.status || "active"; };

    const filteredHoursLogs = useMemo(() => {
        let f = [...hoursLogs];
        if (dateRange.start) f = f.filter(h => h.date >= dateRange.start);
        if (dateRange.end) f = f.filter(h => h.date <= dateRange.end);
        if (filterConsultant !== "all") f = f.filter(h => (h.consultantEmail || "").toLowerCase() === filterConsultant.toLowerCase());
        if (filterProject !== "all") f = f.filter(h => h.projectId === filterProject);
        return f;
    }, [hoursLogs, dateRange, filterConsultant, filterProject]);

    const filteredProjects = useMemo(() => {
        let f = [...projects];
        if (filterClient !== "all") f = f.filter(p => (p.clientName || "").toLowerCase().includes(filterClient.toLowerCase()));
        if (filterStatus !== "all") f = f.filter(p => getProjectStatus(p).toLowerCase() === filterStatus.toLowerCase());
        return f;
    }, [projects, filterClient, filterStatus]);

    const filteredAuditLogs = useMemo(() => {
        let f = [...auditLogs];
        if (auditSearch.trim()) { const q = auditSearch.toLowerCase(); f = f.filter(l => l.details.toLowerCase().includes(q) || l.performedBy.toLowerCase().includes(q) || l.entityId.toLowerCase().includes(q)); }
        if (auditActionFilter !== "all") f = f.filter(l => l.actionType === auditActionFilter);
        return f;
    }, [auditLogs, auditSearch, auditActionFilter]);

    // Admin KPIs
    const adminKPIs = useMemo(() => {
        if (!isAdmin) return null;
        const totalHours = filteredHoursLogs.reduce((s, h) => s + (Number(h.hours) || 0), 0);
        const activeProjects = filteredProjects.filter(p => p.status === "active" || p.status === "in progress" || p.status === "in_progress").length;
        const completedProjects = filteredProjects.filter(p => p.status === "completed").length;
        const activeConsultants = consultants.filter(c => c.status !== "inactive").length;
        const overdueProjects = filteredProjects.filter(p => getProjectStatus(p) === "overdue").length;
        const avgHours = activeConsultants > 0 ? totalHours / activeConsultants : 0;
        return { totalHours, activeProjects, completedProjects, activeConsultants, overdueProjects, avgHours };
    }, [isAdmin, filteredHoursLogs, filteredProjects, consultants]);

    const hoursPerConsultant = useMemo(() => {
        if (!isAdmin) return [];
        const map = new Map<string, { name: string; hours: number }>();
        filteredHoursLogs.forEach(h => { const email = (h.consultantEmail || "").toLowerCase(); const c = consultants.find(c => c.email.toLowerCase() === email); const name = c ? `${c.firstName} ${c.lastName}` : email; const ex = map.get(email) || { name, hours: 0 }; ex.hours += Number(h.hours) || 0; map.set(email, ex); });
        return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
    }, [isAdmin, filteredHoursLogs, consultants]);

    const hoursPerProject = useMemo(() => {
        if (!isAdmin) return [];
        const map = new Map<string, { name: string; hours: number }>();
        filteredHoursLogs.forEach(h => { const p = projects.find(p => p.projectId === h.projectId); const name = p?.projectName || `Project ${h.projectId}`; const ex = map.get(h.projectId) || { name, hours: 0 }; ex.hours += Number(h.hours) || 0; map.set(h.projectId, ex); });
        return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
    }, [isAdmin, filteredHoursLogs, projects]);

    const projectStatusDist = useMemo(() => {
        if (!isAdmin) return [];
        const counts: Record<string, number> = {};
        filteredProjects.forEach(p => { const s = getProjectStatus(p).toLowerCase(); counts[s] = (counts[s] || 0) + 1; });
        return Object.entries(counts).filter(([_, c]) => c > 0).map(([status, count]) => ({ status, count }));
    }, [isAdmin, filteredProjects]);

    const consultantWorkload = useMemo(() => {
        if (!isAdmin) return [];
        return consultants.map(c => {
            const hours = filteredHoursLogs.filter(h => (h.consultantEmail || "").toLowerCase() === c.email.toLowerCase()).reduce((s, h) => s + (Number(h.hours) || 0), 0);
            const prj = projectConsultants.filter(pc => pc.consultantId === c.consultantId).length;
            return { name: `${c.firstName} ${c.lastName}`, hours, projects: prj };
        }).sort((a, b) => b.hours - a.hours);
    }, [isAdmin, consultants, filteredHoursLogs, projectConsultants]);

    const detailedTable = useMemo(() => {
        if (!isAdmin) return [];
        return filteredProjects.map(p => {
            const ph = filteredHoursLogs.filter(h => h.projectId === p.projectId);
            const totalH = ph.reduce((s, h) => s + (Number(h.hours) || 0), 0);
            const emails = [...new Set(ph.map(h => h.consultantEmail))];
            const names = emails.map(e => { const c = consultants.find(co => co.email.toLowerCase() === (e || "").toLowerCase()); return c ? `${c.firstName} ${c.lastName}` : e; }).filter(Boolean).join(", ");
            const last = ph.length > 0 ? ph.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date : null;
            return { projectName: p.projectName, clientName: p.clientName || "—", consultants: names || "None", hours: totalH, status: getProjectStatus(p), lastActivity: last };
        }).sort((a, b) => b.hours - a.hours);
    }, [isAdmin, filteredProjects, filteredHoursLogs, consultants]);

    // Consultant KPIs
    const myHours = useMemo(() => isConsultant && currentEmail ? hoursLogs.filter(h => (h.consultantEmail || "").toLowerCase() === currentEmail.toLowerCase()) : [], [isConsultant, currentEmail, hoursLogs]);

    const consultantKPIs = useMemo(() => {
        if (!isConsultant) return null;
        const totalH = myHours.reduce((s, h) => s + (Number(h.hours) || 0), 0);
        const myPids = [...new Set(myHours.map(h => h.projectId))];
        const myProj = projects.filter(p => myPids.includes(p.projectId));
        const now = new Date();
        const ws = new Date(now); ws.setDate(ws.getDate() - ws.getDay()); ws.setHours(0, 0, 0, 0);
        const weekH = myHours.filter(h => new Date(h.date) >= ws).reduce((s, h) => s + (Number(h.hours) || 0), 0);
        const ms = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthH = myHours.filter(h => new Date(h.date) >= ms).reduce((s, h) => s + (Number(h.hours) || 0), 0);
        return { totalH, activeProjects: myProj.filter(p => p.status === "active" || p.status === "in_progress" || p.status === "in progress").length, completed: myProj.filter(p => p.status === "completed").length, entries: myHours.length, weekH, monthH, totalProjects: myProj.length };
    }, [isConsultant, myHours, projects]);

    const myHoursPerProject = useMemo(() => {
        if (!isConsultant) return [];
        const map = new Map<string, { name: string; hours: number }>();
        myHours.forEach(h => { const p = projects.find(p => p.projectId === h.projectId); const name = p?.projectName || h.projectId; const ex = map.get(h.projectId) || { name, hours: 0 }; ex.hours += Number(h.hours) || 0; map.set(h.projectId, ex); });
        return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
    }, [isConsultant, myHours, projects]);

    const myWeeklyTrend = useMemo(() => {
        if (!isConsultant) return [];
        const weeks: { week: string; hours: number }[] = []; const now = new Date();
        for (let i = 7; i >= 0; i--) { const we = new Date(now); we.setDate(we.getDate() - (i * 7)); const ws = new Date(we); ws.setDate(ws.getDate() - 6); const h = myHours.filter(h => { const d = new Date(h.date); return d >= ws && d <= we; }).reduce((s, h) => s + (Number(h.hours) || 0), 0); weeks.push({ week: `${ws.getMonth() + 1}/${ws.getDate()}`, hours: h }); }
        return weeks;
    }, [isConsultant, myHours]);

    const myMonthlyTrend = useMemo(() => {
        if (!isConsultant) return [];
        const months: { month: string; hours: number }[] = []; const now = new Date();
        for (let i = 5; i >= 0; i--) { const md = new Date(now.getFullYear(), now.getMonth() - i, 1); const me = new Date(md.getFullYear(), md.getMonth() + 1, 0); const h = myHours.filter(h => { const d = new Date(h.date); return d >= md && d <= me; }).reduce((s, h) => s + (Number(h.hours) || 0), 0); months.push({ month: md.toLocaleDateString("en-US", { month: "short" }), hours: h }); }
        return months;
    }, [isConsultant, myHours]);

    const myAssignedProjects = useMemo(() => {
        if (!isConsultant) return [];
        const pids = [...new Set(myHours.map(h => h.projectId))];
        return projects.filter(p => pids.includes(p.projectId)).map(p => ({ ...p, myHours: myHours.filter(h => h.projectId === p.projectId).reduce((s, h) => s + (Number(h.hours) || 0), 0), status: getProjectStatus(p) }));
    }, [isConsultant, myHours, projects]);

    const formatDate = (d: string | null): string => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
    const formatDateTime = (d: string): string => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
    const getActionConfig = (a: string) => ACTION_CONFIG[a] || { label: a.replace(/_/g, " "), color: "text-gray-400", bgColor: "bg-gray-500/10" };
    const getActionIcon = (a: string) => { if (a.includes("CREATE")) return <UserPlus className="w-3.5 h-3.5" />; if (a.includes("DELETE")) return <Trash2 className="w-3.5 h-3.5" />; if (a.includes("UPDATE")) return <Edit className="w-3.5 h-3.5" />; if (a.includes("LOG")) return <Clock className="w-3.5 h-3.5" />; if (a.includes("ASSIGN")) return <Briefcase className="w-3.5 h-3.5" />; if (a.includes("LOGIN")) return <UserCheck className="w-3.5 h-3.5" />; return <Activity className="w-3.5 h-3.5" />; };

    const exportToCSV = (data: any[], filename: string) => {
        if (!data.length) { showToast("No data", "error"); return; }
        const headers = Object.keys(data[0]).join(",");
        const rows = data.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
        const blob = new Blob([[headers, ...rows].join("\n")], { type: "text/csv" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`; a.click();
        showToast("Exported", "success");
    };

    const BarChartComp: React.FC<{ data: { label: string; value: number }[]; max?: number; color?: string }> = ({ data, max = 8, color = "bg-blue-500" }) => {
        const items = data.slice(0, max); const maxV = Math.max(...items.map(d => d.value), 1);
        return (<div className="space-y-2">{items.map((item, i) => (<div key={i} className="flex items-center gap-3"><span className={`text-xs ${n.secondary} w-24 truncate`}>{item.label}</span><div className={`flex-1 h-5 ${n.barBg} rounded overflow-hidden`}><div className={`h-full ${color} transition-all duration-500 rounded`} style={{ width: `${(item.value / maxV) * 100}%` }} /></div><span className={`text-xs font-medium ${n.text} w-12 text-right`}>{item.value.toFixed(1)}h</span></div>))}</div>);
    };

    const PieChartComp: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
        const total = data.reduce((s, d) => s + d.value, 0);
        if (total === 0) return <p className={`text-sm ${n.tertiary}`}>No data</p>;
        let cum = 0;
        const stops = data.map(d => { const pct = (d.value / total) * 100; const start = cum; cum += pct; return `${d.color} ${start}% ${cum}%`; }).join(", ");
        return (<div className="flex items-center gap-6"><div className="w-28 h-28 rounded-full" style={{ background: `conic-gradient(${stops})` }} /><div className="space-y-1">{data.map((d, i) => (<div key={i} className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: d.color }} /><span className={`text-xs ${n.secondary}`}>{d.label}: {d.value}</span></div>))}</div></div>);
    };

    const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
        const cfg = STATUS_COLORS[status.toLowerCase()] || STATUS_COLORS.active;
        return <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>{fmtStatus(status)}</span>;
    };

    if (userRole === "client") {
        return (<div className={`${n.bg} min-h-screen ${n.text}`}><div className="max-w-3xl mx-auto px-6 py-12"><div className={`${n.card} p-6`}><div className="flex items-center gap-3 mb-3"><AlertCircle className="w-5 h-5 text-amber-500" /><h1 className={`text-lg font-semibold ${n.text}`}>Reports are for staff</h1></div><p className={n.secondary}>As a client, internal reports are not available.</p></div></div></div>);
    }

    return (
        <div className={`${n.bg} min-h-screen ${n.text}`}>
            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">{toasts.map(t => (<div key={t.id} className={`${n.card} flex items-center gap-3 px-4 py-3 rounded-xl text-sm animate-fadeIn`}>{t.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === "error" ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}<span>{t.message}</span><button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className={n.tertiary}><X className="w-3.5 h-3.5" /></button></div>))}</div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h1 className={`text-2xl font-semibold tracking-tight ${n.strong} mb-1`}>Reports</h1>
                        <p className={`text-sm ${n.secondary}`}>{isAdmin ? "System analytics and audit log" : "Your performance summary"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${n.badge}`}>{isAdmin ? "Admin View" : "My Reports"}</span>
                        <button onClick={handleRefresh} disabled={isRefreshing} className={`w-9 h-9 ${n.flat} flex items-center justify-center ${isRefreshing ? "animate-spin" : ""}`}><RefreshCw className={`w-4 h-4 ${n.secondary}`} /></button>
                    </div>
                </div>

                {/* ADMIN VIEW */}
                {isAdmin && adminKPIs && (<>
                    {/* Filters */}
                    <div className={`${n.card} p-4 mb-8`}>
                        <div className="flex items-center gap-2 mb-3"><Filter className={`w-3.5 h-3.5 ${n.label}`} /><span className={`text-xs font-medium ${n.label}`}>Filters</span><button onClick={clearFilters} className={`ml-auto text-[11px] ${n.link}`}>Clear</button></div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Start</label><input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} className={`w-full px-2 py-1.5 text-sm ${n.input} border rounded-xl focus:outline-none focus:border-blue-500`} /></div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>End</label><input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} className={`w-full px-2 py-1.5 text-sm ${n.input} border rounded-xl focus:outline-none focus:border-blue-500`} /></div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Consultant</label><select value={filterConsultant} onChange={e => setFilterConsultant(e.target.value)} className={`w-full px-2 py-1.5 text-sm ${n.input} border rounded-xl`}><option value="all">All</option>{consultants.map(c => <option key={c.consultantId} value={c.email}>{c.firstName} {c.lastName}</option>)}</select></div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Client</label><select value={filterClient} onChange={e => setFilterClient(e.target.value)} className={`w-full px-2 py-1.5 text-sm ${n.input} border rounded-xl`}><option value="all">All</option>{[...new Set(projects.map(p => p.clientName).filter(Boolean))].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Project</label><select value={filterProject} onChange={e => setFilterProject(e.target.value)} className={`w-full px-2 py-1.5 text-sm ${n.input} border rounded-xl`}><option value="all">All</option>{projects.map(p => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}</select></div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Status</label><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`w-full px-2 py-1.5 text-sm ${n.input} border rounded-xl`}><option value="all">All</option><option value="active">Active</option><option value="in progress">In Progress</option><option value="completed">Completed</option><option value="on hold">On Hold</option><option value="overdue">Overdue</option></select></div>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                        {[
                            { label: "Total Hours", value: adminKPIs.totalHours.toFixed(1), icon: Clock, color: "text-emerald-400" },
                            { label: "Active Projects", value: adminKPIs.activeProjects, icon: PlayCircle, color: "text-blue-400" },
                            { label: "Completed", value: adminKPIs.completedProjects, icon: CheckCircle, color: "text-green-400" },
                            { label: "Consultants", value: adminKPIs.activeConsultants, icon: UserCheck, color: "text-purple-400" },
                            { label: "Overdue", value: adminKPIs.overdueProjects, icon: AlertTriangle, color: adminKPIs.overdueProjects > 0 ? "text-red-400" : n.tertiary },
                            { label: "Avg Hrs/Person", value: adminKPIs.avgHours.toFixed(1), icon: Timer, color: "text-amber-400" },
                        ].map((kpi, i) => (
                            <div key={i} className={`${n.card} ${n.edgeHover} p-4 transition-all duration-200`}>
                                <div className="flex items-center gap-2 mb-2"><kpi.icon className={`w-4 h-4 ${kpi.color}`} /><span className={`text-[11px] ${n.tertiary}`}>{kpi.label}</span></div>
                                <p className={`text-2xl font-semibold ${n.strong}`}>{kpi.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Audit Log */}
                    <div className={`${n.card} overflow-hidden mb-8`}>
                        <div className={`p-4 border-b ${n.divider} flex items-center justify-between cursor-pointer`} onClick={() => setShowAuditLog(!showAuditLog)}>
                            <h3 className={`text-sm font-semibold flex items-center gap-2 ${n.text}`}><Activity className={`w-4 h-4 text-purple-400`} />Audit Log</h3>
                            <div className="flex items-center gap-2">
                                <span className={`text-[11px] ${n.tertiary}`}>{filteredAuditLogs.length} entries</span>
                                <button onClick={(e) => { e.stopPropagation(); exportToCSV(filteredAuditLogs.map(l => ({ timestamp: l.timestamp, action: l.actionType, entity: l.entityId, user: l.performedBy, details: l.details })), "audit_log"); }} className={`p-1.5 ${n.flat} rounded-lg`}><Download className="w-3.5 h-3.5" /></button>
                                {showAuditLog ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </div>
                        </div>
                        {showAuditLog && (<>
                            <div className={`p-4 border-b ${n.divider} flex flex-wrap gap-3`}>
                                <div className={`${n.flat} flex items-center gap-2 px-3 py-1.5`}><Search className={`w-3.5 h-3.5 ${n.tertiary}`} /><input type="text" placeholder="Search..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} className={`bg-transparent text-sm ${n.text} focus:outline-none w-48`} /></div>
                                <select value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)} className={`px-3 py-1.5 text-sm ${n.input} border rounded-xl`}><option value="all">All Actions</option>{Object.entries(ACTION_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {filteredAuditLogs.length === 0 ? (
                                    <div className={`p-8 text-center ${n.tertiary}`}><Activity className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No entries found</p></div>
                                ) : filteredAuditLogs.slice(0, 50).map(log => {
                                    const cfg = getActionConfig(log.actionType);
                                    return (
                                        <div key={log.logId} className={`p-4 border-b ${n.divider} ${isDark ? "hover:bg-gray-900/50" : "hover:bg-gray-100/50"} transition-colors`}>
                                            <div className="flex items-start gap-3">
                                                <div className={`w-7 h-7 rounded-lg ${cfg.bgColor} ${cfg.color} flex items-center justify-center flex-shrink-0`}>{getActionIcon(log.actionType)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2"><span className={`text-sm font-medium ${n.text}`}>{cfg.label}</span><span className={`text-[11px] ${n.tertiary}`}>by {log.performedBy}</span></div>
                                                    <p className={`text-xs ${n.secondary} mt-0.5 truncate`}>{log.details}</p>
                                                    <p className={`text-[10px] ${n.tertiary} mt-0.5`}>{formatDateTime(log.timestamp)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>)}
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-8">
                        <div className={`${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                            <div className="flex items-center justify-between mb-4"><h3 className={`text-sm font-semibold flex items-center gap-2 ${n.text}`}><Users className={`w-4 h-4 ${n.label}`} />Hours per Consultant</h3><button onClick={() => exportToCSV(hoursPerConsultant.map(h => ({ consultant: h.name, hours: h.hours.toFixed(1) })), "hours_consultant")} className={`p-1.5 ${n.flat} rounded-lg`}><Download className="w-3.5 h-3.5" /></button></div>
                            {hoursPerConsultant.length === 0 ? <p className={`text-sm ${n.tertiary}`}>No hours logged</p> : <BarChartComp data={hoursPerConsultant.map(h => ({ label: h.name, value: h.hours }))} color="bg-blue-500" />}
                        </div>
                        <div className={`${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                            <div className="flex items-center justify-between mb-4"><h3 className={`text-sm font-semibold flex items-center gap-2 ${n.text}`}><FolderOpen className={`w-4 h-4 ${n.label}`} />Hours per Project</h3><button onClick={() => exportToCSV(hoursPerProject.map(h => ({ project: h.name, hours: h.hours.toFixed(1) })), "hours_project")} className={`p-1.5 ${n.flat} rounded-lg`}><Download className="w-3.5 h-3.5" /></button></div>
                            {hoursPerProject.length === 0 ? <p className={`text-sm ${n.tertiary}`}>No hours logged</p> : <BarChartComp data={hoursPerProject.map(h => ({ label: h.name, value: h.hours }))} color="bg-emerald-500" />}
                        </div>
                    </div>

                    {/* Charts Row 2 */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-8">
                        <div className={`${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                            <h3 className={`text-sm font-semibold flex items-center gap-2 mb-4 ${n.text}`}><PieChart className={`w-4 h-4 ${n.label}`} />Project Status</h3>
                            <PieChartComp data={projectStatusDist.map(d => ({ label: fmtStatus(d.status), value: d.count, color: STATUS_COLORS[d.status]?.fill || "#64748b" }))} />
                        </div>
                        <div className={`${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                            <h3 className={`text-sm font-semibold flex items-center gap-2 mb-4 ${n.text}`}><Briefcase className={`w-4 h-4 ${n.label}`} />Consultant Workload</h3>
                            {consultantWorkload.length === 0 ? <p className={`text-sm ${n.tertiary}`}>No data</p> : (
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">{consultantWorkload.slice(0, 6).map((c, i) => (
                                    <div key={i} className={`${n.flat} p-2.5 flex items-center justify-between`}>
                                        <span className={`text-sm ${n.text} truncate`}>{c.name}</span>
                                        <div className="flex items-center gap-3 text-xs"><span className={n.tertiary}>{c.projects} prj</span><span className={`${n.label} font-medium`}>{c.hours.toFixed(1)}h</span></div>
                                    </div>
                                ))}</div>
                            )}
                        </div>
                    </div>

                    {/* Detailed Table */}
                    <div className={`${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                        <div className="flex items-center justify-between mb-4"><h3 className={`text-sm font-semibold flex items-center gap-2 ${n.text}`}><FolderOpen className={`w-4 h-4 ${n.label}`} />Project Details</h3><button onClick={() => exportToCSV(detailedTable, "project_details")} className={`p-1.5 ${n.flat} rounded-lg`}><Download className="w-3.5 h-3.5" /></button></div>
                        {detailedTable.length === 0 ? <p className={`text-sm ${n.tertiary}`}>No data</p> : (
                            <div className="overflow-x-auto"><table className="w-full text-sm">
                                <thead><tr className={`border-b ${n.divider}`}><th className={`px-3 py-2 text-left text-[11px] ${n.label}`}>Project</th><th className={`px-3 py-2 text-left text-[11px] ${n.label}`}>Client</th><th className={`px-3 py-2 text-left text-[11px] ${n.label}`}>Consultants</th><th className={`px-3 py-2 text-right text-[11px] ${n.label}`}>Hours</th><th className={`px-3 py-2 text-center text-[11px] ${n.label}`}>Status</th><th className={`px-3 py-2 text-right text-[11px] ${n.label}`}>Last Activity</th></tr></thead>
                                <tbody>{detailedTable.map((r, i) => (
                                    <tr key={i} className={`border-b ${n.divider} ${isDark ? "hover:bg-gray-900/30" : "hover:bg-gray-100/50"} transition-colors`}>
                                        <td className={`px-3 py-2.5 ${n.text} font-medium`}>{r.projectName}</td>
                                        <td className={`px-3 py-2.5 ${n.secondary}`}>{r.clientName}</td>
                                        <td className={`px-3 py-2.5 ${n.secondary} max-w-xs truncate`}>{r.consultants}</td>
                                        <td className={`px-3 py-2.5 text-right ${n.text}`}>{r.hours.toFixed(1)}h</td>
                                        <td className="px-3 py-2.5 text-center"><StatusBadge status={r.status} /></td>
                                        <td className={`px-3 py-2.5 text-right ${n.tertiary}`}>{formatDate(r.lastActivity)}</td>
                                    </tr>
                                ))}</tbody>
                            </table></div>
                        )}
                    </div>
                </>)}

                {/* CONSULTANT VIEW */}
                {isConsultant && consultantKPIs && (<>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {[
                            { label: "Total Hours", value: consultantKPIs.totalH.toFixed(1), sub: `${consultantKPIs.entries} entries`, icon: Clock, color: "text-emerald-400" },
                            { label: "My Projects", value: consultantKPIs.totalProjects, sub: `${consultantKPIs.activeProjects} active`, icon: FolderOpen, color: "text-blue-400" },
                            { label: "This Week", value: `${consultantKPIs.weekH.toFixed(1)}h`, sub: "", icon: Calendar, color: "text-purple-400" },
                            { label: "This Month", value: `${consultantKPIs.monthH.toFixed(1)}h`, sub: "", icon: TrendingUp, color: "text-amber-400" },
                        ].map((kpi, i) => (
                            <div key={i} className={`${n.card} ${n.edgeHover} p-4 transition-all duration-200`}>
                                <div className="flex items-center gap-2 mb-2"><kpi.icon className={`w-4 h-4 ${kpi.color}`} /><span className={`text-[11px] ${n.tertiary}`}>{kpi.label}</span></div>
                                <p className={`text-2xl font-semibold ${n.strong}`}>{kpi.value}</p>
                                {kpi.sub && <p className={`text-[11px] ${n.tertiary} mt-0.5`}>{kpi.sub}</p>}
                            </div>
                        ))}
                    </div>

                    {/* Trends */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-8">
                        {[
                            { title: "Weekly Trend", data: myWeeklyTrend, color: "bg-blue-500", icon: TrendingUp },
                            { title: "Monthly Trend", data: myMonthlyTrend.map(m => ({ week: m.month, hours: m.hours })), color: "bg-purple-500", icon: Calendar },
                        ].map((chart, ci) => (
                            <div key={ci} className={`${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                                <h3 className={`text-sm font-semibold flex items-center gap-2 mb-4 ${n.text}`}><chart.icon className={`w-4 h-4 ${n.label}`} />{chart.title}</h3>
                                {chart.data.every(w => w.hours === 0) ? <p className={`text-sm ${n.tertiary}`}>No hours logged</p> : (
                                    <div className="flex items-end gap-2 h-32">{chart.data.map((w, i) => {
                                        const maxH = Math.max(...chart.data.map(x => x.hours), 1);
                                        return (<div key={i} className="flex-1 flex flex-col items-center gap-1"><span className={`text-[10px] ${n.text}`}>{w.hours.toFixed(0)}h</span><div className={`w-full ${n.barBg} rounded-t flex-1 relative`} style={{ minHeight: "4px" }}><div className={`absolute bottom-0 w-full ${chart.color} rounded-t transition-all`} style={{ height: `${(w.hours / maxH) * 100}%` }} /></div><span className={`text-[10px] ${n.tertiary}`}>{w.week}</span></div>);
                                    })}</div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Hours per project + stats */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-8">
                        <div className={`${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                            <div className="flex items-center justify-between mb-4"><h3 className={`text-sm font-semibold flex items-center gap-2 ${n.text}`}><FolderOpen className={`w-4 h-4 ${n.label}`} />Hours per Project</h3><button onClick={() => exportToCSV(myHoursPerProject.map(h => ({ project: h.name, hours: h.hours.toFixed(1) })), "my_hours")} className={`p-1.5 ${n.flat} rounded-lg`}><Download className="w-3.5 h-3.5" /></button></div>
                            {myHoursPerProject.length === 0 ? <p className={`text-sm ${n.tertiary}`}>No hours</p> : <BarChartComp data={myHoursPerProject.map(h => ({ label: h.name, value: h.hours }))} color="bg-emerald-500" />}
                        </div>
                        <div className={`${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                            <h3 className={`text-sm font-semibold flex items-center gap-2 mb-4 ${n.text}`}><BarChart2 className={`w-4 h-4 ${n.label}`} />Your Stats</h3>
                            <div className="space-y-1.5">
                                {[
                                    { label: "Avg Hours/Entry", value: consultantKPIs.entries > 0 ? (consultantKPIs.totalH / consultantKPIs.entries).toFixed(1) + "h" : "0h" },
                                    { label: "Completed Projects", value: consultantKPIs.completed },
                                    { label: "Weekly Average", value: (myWeeklyTrend.reduce((s, w) => s + w.hours, 0) / 8).toFixed(1) + "h" },
                                ].map((s, i) => (
                                    <div key={i} className={`${n.flat} p-3 flex items-center justify-between`}>
                                        <span className={n.secondary}>{s.label}</span>
                                        <span className={`font-semibold ${n.text}`}>{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* My Projects */}
                    <div className={`${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                        <div className="flex items-center justify-between mb-4"><h3 className={`text-sm font-semibold flex items-center gap-2 ${n.text}`}><Briefcase className={`w-4 h-4 ${n.label}`} />My Projects</h3><button onClick={() => exportToCSV(myAssignedProjects.map(p => ({ project: p.projectName, client: p.clientName || "—", hours: p.myHours.toFixed(1), status: p.status })), "my_projects")} className={`p-1.5 ${n.flat} rounded-lg`}><Download className="w-3.5 h-3.5" /></button></div>
                        {myAssignedProjects.length === 0 ? <p className={`text-sm ${n.tertiary}`}>No projects</p> : (
                            <div className="overflow-x-auto"><table className="w-full text-sm">
                                <thead><tr className={`border-b ${n.divider}`}><th className={`px-3 py-2 text-left text-[11px] ${n.label}`}>Project</th><th className={`px-3 py-2 text-left text-[11px] ${n.label}`}>Client</th><th className={`px-3 py-2 text-right text-[11px] ${n.label}`}>My Hours</th><th className={`px-3 py-2 text-center text-[11px] ${n.label}`}>Status</th><th className={`px-3 py-2 text-right text-[11px] ${n.label}`}>Due</th></tr></thead>
                                <tbody>{myAssignedProjects.map((p, i) => (
                                    <tr key={i} className={`border-b ${n.divider} ${isDark ? "hover:bg-gray-900/30" : "hover:bg-gray-100/50"} transition-colors`}>
                                        <td className={`px-3 py-2.5 ${n.text} font-medium`}>{p.projectName}</td>
                                        <td className={`px-3 py-2.5 ${n.secondary}`}>{p.clientName || "—"}</td>
                                        <td className={`px-3 py-2.5 text-right ${n.text}`}>{p.myHours.toFixed(1)}h</td>
                                        <td className="px-3 py-2.5 text-center"><StatusBadge status={p.status} /></td>
                                        <td className={`px-3 py-2.5 text-right ${n.tertiary}`}>{formatDate(p.dateDue || null)}</td>
                                    </tr>
                                ))}</tbody>
                            </table></div>
                        )}
                    </div>
                </>)}
            </div>

            {isLoading && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"><div className={`${n.card} p-6 flex items-center gap-3`}><RefreshCw className="w-5 h-5 animate-spin text-blue-500" /><span className={n.text}>Loading...</span></div></div>)}
        </div>
    );
};

export default ReportsTab;