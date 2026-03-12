// src/Style_Components/Dashboard.tsx
import React, { useState, useMemo, useEffect } from "react";
import TeamFeed from "../Views_Layouts/TeamFeed";
import { useTheme } from "../Views_Layouts/ThemeContext";
import { SkeletonCard, SkeletonList, FadeIn } from "./Skeleton";
import {
    FolderOpen, Users, UserCircle, Clock, Bell,
    ChevronLeft, ChevronRight, History, TrendingUp,
    Calendar, AlertTriangle, CheckCircle, ArrowUpRight,
    FileText, MessageSquare, Plus, BarChart3,
} from "lucide-react";

const API_BASE = "/api";
type UserRole = "admin" | "consultant" | "client";

interface DashboardProps {
    sidebarToggle: boolean;
    setSidebarToggle: (v: boolean) => void;
    onNavigate?: (page: string) => void;
    userName?: string;
    userEmail?: string;
    userRole?: UserRole;
}

const safeFetch = async (url: string) => {
    try {
        const r = await fetch(url);
        if (!r.ok) return null;
        return await r.json();
    } catch { return null; }
};

const formatHours = (h: number): string => {
    const w = Math.floor(h);
    const m = Math.round((h - w) * 60);
    return m === 0 ? `${w}h` : `${w}h ${m}m`;
};

const formatRelTime = (ts: string): string => {
    if (!ts) return "";
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const getHolidays = (year: number): Record<string, string> => {
    const h: Record<string, string> = {
        [`${year}-01-01`]: "New Year's",
        [`${year}-07-04`]: "Independence Day",
        [`${year}-12-25`]: "Christmas",
        [`${year}-11-11`]: "Veterans Day",
    };
    const nth = (y: number, mo: number, wd: number, n: number) => {
        let c = 0, d = new Date(y, mo, 1);
        while (c < n) { if (d.getDay() === wd) c++; if (c < n) d.setDate(d.getDate() + 1); }
        return `${y}-${String(mo + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const last = (y: number, mo: number, wd: number) => {
        let d = new Date(y, mo + 1, 0);
        while (d.getDay() !== wd) d.setDate(d.getDate() - 1);
        return `${y}-${String(mo + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    h[nth(year, 0, 1, 3)] = "MLK Day";
    h[nth(year, 1, 1, 3)] = "Presidents' Day";
    h[last(year, 4, 1)] = "Memorial Day";
    h[nth(year, 8, 1, 1)] = "Labor Day";
    h[nth(year, 10, 4, 4)] = "Thanksgiving";
    return h;
};

const Dashboard: React.FC<DashboardProps> = ({
    sidebarToggle, setSidebarToggle, onNavigate,
    userName = "Admin", userEmail = "", userRole = "admin",
}) => {
    const { isDark } = useTheme();

    const s = {
        bg: isDark ? "bg-slate-950" : "bg-gray-50",
        text: isDark ? "text-white" : "text-gray-900",
        muted: isDark ? "text-slate-400" : "text-gray-500",
        subtle: isDark ? "text-slate-500" : "text-gray-400",
        card: isDark ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200",
        cardHover: isDark ? "hover:border-slate-700" : "hover:border-gray-300",
        inner: isDark ? "bg-slate-800/50" : "bg-gray-50",
        divider: isDark ? "border-slate-800" : "border-gray-100",
    };

    const isAdmin = userRole === "admin";
    const isConsultant = userRole === "consultant";

    const [projects, setProjects] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [consultants, setConsultants] = useState<any[]>([]);
    const [hoursLogs, setHoursLogs] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [calDate, setCalDate] = useState(new Date());

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            const [pR, cR, coR, hR, aR] = await Promise.all([
                safeFetch(`${API_BASE}/projects`),
                safeFetch(`${API_BASE}/users-report`),
                safeFetch(`${API_BASE}/consultants`),
                safeFetch(`${API_BASE}/hours-logs`),
                safeFetch(`${API_BASE}/audit-logs/latest?limit=10`),
            ]);
            setProjects(pR?.data || []);
            setClients(cR?.data || []);
            setConsultants(coR?.data || []);
            setHoursLogs(hR?.data || []);
            if (aR?.data) {
                setActivities(aR.data.map((l: any, i: number) => ({
                    id: i, user: l.performedBy || "System",
                    action: l.actionType?.toLowerCase().replace(/_/g, " ") || "action",
                    target: l.details || l.entityId,
                    time: formatRelTime(l.timestamp),
                    isDelete: l.actionType?.includes("DELETE"),
                })));
            }
            // Alerts
            const newAlerts: any[] = [];
            if (isAdmin && (cR?.data || []).length === 0)
                newAlerts.push({ msg: "No clients yet. Add your first client.", color: "amber", page: "admin" });
            if (isAdmin && (coR?.data || []).length === 0)
                newAlerts.push({ msg: "No consultants registered.", color: "amber", page: "EmailGenerator" });
            (pR?.data || []).forEach((p: any) => {
                if (p.dateDue && p.status !== "completed") {
                    const d = Math.ceil((new Date(p.dateDue).getTime() - Date.now()) / 86400000);
                    if (d < 0) newAlerts.push({ msg: `"${p.projectName}" overdue by ${Math.abs(d)} days`, color: "red", page: "projects" });
                    else if (d <= 7) newAlerts.push({ msg: `"${p.projectName}" due in ${d} day${d !== 1 ? "s" : ""}`, color: "amber", page: "projects" });
                }
            });
            setAlerts(newAlerts.slice(0, 4));
            setIsLoading(false);
        })();
    }, []);

    const stats = useMemo(() => {
        const active = projects.filter(p => (p.status || "").toLowerCase() === "in progress").length;
        const completed = projects.filter(p => (p.status || "").toLowerCase() === "completed").length;
        const total = projects.length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        const ws = new Date(); ws.setDate(ws.getDate() - ws.getDay()); ws.setHours(0, 0, 0, 0);
        const weekH = hoursLogs.filter(l => new Date(l.date) >= ws).reduce((s, l) => s + l.hours, 0);
        const totalH = hoursLogs.reduce((s, l) => s + l.hours, 0);
        return { active, completed, total, progress, weekH, totalH, clients: clients.length, consultants: consultants.length };
    }, [projects, clients, consultants, hoursLogs]);

    const holidays = useMemo(() => getHolidays(calDate.getFullYear()), [calDate]);
    const calDays = useMemo(() => {
        const f = new Date(calDate.getFullYear(), calDate.getMonth(), 1).getDay();
        const d = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0).getDate();
        const arr: (number | null)[] = [];
        for (let i = 0; i < f; i++) arr.push(null);
        for (let i = 1; i <= d; i++) arr.push(i);
        return arr;
    }, [calDate]);

    const isToday = (d: number | null) => {
        if (!d) return false;
        const t = new Date();
        return d === t.getDate() && calDate.getMonth() === t.getMonth() && calDate.getFullYear() === t.getFullYear();
    };
    const ds = (d: number) => `${calDate.getFullYear()}-${String(calDate.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const hasDue = (d: number | null) => d ? projects.some(p => p.dateDue === ds(d)) : false;
    const isHol = (d: number | null) => d ? holidays[ds(d)] || false : false;

    const firstName = userName?.split(" ")[0] || "User";
    const initials = (userName || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    const today = new Date();
    const nav = (p: string) => onNavigate?.(p);

    if (isLoading) {
        return (
            <div className={`${s.bg} px-6 pb-10 max-w-7xl mx-auto`}>
                <div className="mb-8 pt-2">
                    <div className={`h-3 w-40 rounded ${isDark ? "bg-slate-800" : "bg-gray-200"} animate-pulse mb-3`} />
                    <div className={`h-8 w-48 rounded ${isDark ? "bg-slate-800" : "bg-gray-200"} animate-pulse mb-2`} />
                    <div className={`h-4 w-72 rounded ${isDark ? "bg-slate-800" : "bg-gray-200"} animate-pulse`} />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className={`rounded-2xl border p-5 ${s.card}`}><SkeletonList rows={3} /></div>
                    </div>
                    <div><div className={`rounded-2xl border p-5 ${s.card}`}><div className={`h-48 rounded-lg ${isDark ? "bg-slate-800" : "bg-gray-200"} animate-pulse`} /></div></div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${s.bg} ${s.text}`}>
            <div className="px-6 pb-10 max-w-7xl mx-auto">

                {/* Hero Header */}
                <FadeIn>
                    <div className="mb-8">
                        <p className={`text-[11px] font-medium tracking-[0.2em] uppercase ${s.subtle}`}>
                            {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        </p>
                        <h1 className={`text-3xl font-bold tracking-tight mt-1 ${s.text}`}>
                            Good {today.getHours() < 12 ? "morning" : today.getHours() < 18 ? "afternoon" : "evening"}, {firstName}
                        </h1>
                        <p className={`mt-1 text-sm ${s.muted}`}>
                            {isAdmin ? `${stats.total} projects, ${stats.clients} clients, ${stats.consultants} consultants` :
                             isConsultant ? `${stats.total} projects, ${formatHours(stats.weekH)} logged this week` :
                             "Here's what's happening with your projects"}
                        </p>
                    </div>
                </FadeIn>

                {/* Stats Row */}
                <FadeIn delay={50}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {[
                            { label: "Projects", value: stats.total, sub: `${stats.active} in progress`, icon: FolderOpen, color: "blue", page: "projects" },
                            { label: "Clients", value: stats.clients, sub: "Total accounts", icon: Users, color: "purple", page: "client" },
                            { label: "Team", value: stats.consultants, sub: "Consultants", icon: UserCircle, color: "emerald", page: "consultants" },
                            { label: "Hours", value: formatHours(stats.weekH), sub: `${formatHours(stats.totalH)} total`, icon: Clock, color: "amber", page: "hours" },
                        ].map((st, i) => (
                            <div
                                key={i}
                                onClick={() => nav(st.page)}
                                className={`group ${s.card} border rounded-2xl p-5 cursor-pointer ${s.cardHover} transition-all duration-200 active:scale-[0.98]`}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`w-11 h-11 rounded-xl bg-${st.color}-500/10 text-${st.color}-500 flex items-center justify-center`}>
                                        <st.icon className="w-5 h-5" />
                                    </div>
                                    <ArrowUpRight className={`w-4 h-4 ${s.subtle} opacity-0 group-hover:opacity-100 transition-opacity`} />
                                </div>
                                <p className={`text-2xl font-bold tracking-tight ${s.text}`}>{st.value}</p>
                                <p className={`text-xs ${s.muted} mt-1`}>{st.label}</p>
                                <p className={`text-[11px] ${s.subtle} mt-0.5`}>{st.sub}</p>
                            </div>
                        ))}
                    </div>
                </FadeIn>

                {/* Quick Actions Bar */}
                <FadeIn delay={100}>
                    <div className={`${s.card} border rounded-2xl p-4 mb-8`}>
                        <div className="flex items-center justify-between gap-4 overflow-x-auto">
                            <div className="flex items-center gap-2">
                                {(isAdmin ? [
                                    { label: "New Project", page: "projects", icon: Plus, gradient: "from-blue-500 to-blue-600" },
                                    { label: "Add Client", page: "admin", icon: Users, gradient: "from-purple-500 to-purple-600" },
                                    { label: "Create Account", page: "EmailGenerator", icon: UserCircle, gradient: "from-emerald-500 to-emerald-600" },
                                    { label: "Review Hours", page: "hours", icon: Clock, gradient: "from-amber-500 to-amber-600" },
                                ] : isConsultant ? [
                                    { label: "Log Hours", page: "hours", icon: Clock, gradient: "from-emerald-500 to-emerald-600" },
                                    { label: "My Projects", page: "projects", icon: FolderOpen, gradient: "from-blue-500 to-blue-600" },
                                    { label: "My Clients", page: "client", icon: Users, gradient: "from-purple-500 to-purple-600" },
                                ] : [
                                    { label: "Projects", page: "projects", icon: FolderOpen, gradient: "from-blue-500 to-blue-600" },
                                    { label: "Documents", page: "settings", icon: FileText, gradient: "from-purple-500 to-purple-600" },
                                ]).map((a, i) => (
                                    <button
                                        key={i}
                                        onClick={() => nav(a.page)}
                                        className={`bg-gradient-to-r ${a.gradient} text-white rounded-xl px-4 py-2.5 text-xs font-medium flex items-center gap-2 hover:opacity-90 active:scale-[0.97] transition-all whitespace-nowrap shadow-sm`}
                                    >
                                        <a.icon className="w-3.5 h-3.5" />
                                        {a.label}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => nav("reports")} className={`flex items-center gap-1.5 text-xs font-medium ${s.muted} hover:${s.text} transition-colors whitespace-nowrap`}>
                                <BarChart3 className="w-3.5 h-3.5" /> Reports
                            </button>
                        </div>
                    </div>
                </FadeIn>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Left 2/3 */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Alerts + Progress Combined */}
                        <FadeIn delay={150}>
                            <div className="grid md:grid-cols-2 gap-4">
                                {/* Alerts */}
                                <div className={`${s.card} border rounded-2xl p-5`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className={`text-sm font-semibold flex items-center gap-2 ${s.text}`}>
                                            <Bell className="w-4 h-4 text-amber-500" /> Alerts
                                        </h2>
                                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${alerts.length === 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                                            {alerts.length === 0 ? "All clear" : `${alerts.length} active`}
                                        </span>
                                    </div>
                                    {alerts.length === 0 ? (
                                        <div className={`flex flex-col items-center py-6 ${s.inner} rounded-xl`}>
                                            <CheckCircle className="w-8 h-8 text-emerald-500/60 mb-2" />
                                            <p className={`text-xs ${s.muted}`}>No alerts right now</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {alerts.map((a, i) => (
                                                <div key={i} onClick={() => a.page && nav(a.page)}
                                                    className={`flex items-start gap-2.5 p-2.5 rounded-xl ${s.inner} cursor-pointer ${s.cardHover} transition-all text-xs`}>
                                                    <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-${a.color}-500`} />
                                                    <p className={s.text}>{a.msg}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Progress Ring */}
                                <div className={`${s.card} border rounded-2xl p-5`}>
                                    <h2 className={`text-sm font-semibold flex items-center gap-2 mb-4 ${s.text}`}>
                                        <TrendingUp className="w-4 h-4 text-emerald-500" /> Progress
                                    </h2>
                                    <div className="flex items-center gap-6">
                                        {/* SVG Ring */}
                                        <div className="relative w-24 h-24 flex-shrink-0">
                                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                                <circle cx="50" cy="50" r="42" fill="none"
                                                    stroke={isDark ? "#1e293b" : "#f1f5f9"} strokeWidth="8" />
                                                <circle cx="50" cy="50" r="42" fill="none"
                                                    stroke="url(#progressGrad)" strokeWidth="8"
                                                    strokeLinecap="round"
                                                    strokeDasharray={`${stats.progress * 2.64} 264`}
                                                    className="transition-all duration-1000 ease-out" />
                                                <defs>
                                                    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                        <stop offset="0%" stopColor="#3b82f6" />
                                                        <stop offset="100%" stopColor="#60a5fa" />
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className={`text-xl font-bold ${s.text}`}>{stats.progress}%</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div>
                                                <p className={`text-xs ${s.muted}`}>Completed</p>
                                                <p className={`text-lg font-semibold ${s.text}`}>{stats.completed}<span className={`text-sm ${s.subtle}`}>/{stats.total}</span></p>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${s.inner} ${s.muted}`}>
                                                    <Clock className="w-3 h-3 inline mr-1" />{formatHours(stats.weekH)}/wk
                                                </div>
                                                <div className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${s.inner} ${s.muted}`}>
                                                    <FolderOpen className="w-3 h-3 inline mr-1" />{stats.active} active
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </FadeIn>

                        {/* Recent Activity */}
                        <FadeIn delay={200}>
                            <div className={`${s.card} border rounded-2xl p-5`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-sm font-semibold flex items-center gap-2 ${s.text}`}>
                                        <History className="w-4 h-4" /> Recent Activity
                                    </h2>
                                    <button onClick={() => nav("reports")} className={`text-[11px] font-medium ${s.muted} hover:${s.text} transition-colors`}>
                                        View all →
                                    </button>
                                </div>
                                {activities.length === 0 ? (
                                    <p className={`text-center py-8 text-xs ${s.muted}`}>No recent activity</p>
                                ) : (
                                    <div className="space-y-1">
                                        {activities.slice(0, 6).map(a => (
                                            <div key={a.id} className={`flex items-start gap-3 p-2.5 rounded-xl ${s.cardHover} transition-colors`}>
                                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.isDelete ? "bg-red-400" : "bg-emerald-400"}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs ${s.text}`}>
                                                        <span className="font-medium">{a.user}</span>{" "}
                                                        <span className={s.muted}>{a.action}</span>
                                                    </p>
                                                    <p className={`text-[11px] ${s.subtle} truncate mt-0.5`}>{a.target}</p>
                                                </div>
                                                <span className={`text-[10px] ${s.subtle} flex-shrink-0 mt-0.5`}>{a.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </FadeIn>

                        {/* Active Projects Table */}
                        <FadeIn delay={250}>
                            <div className={`${s.card} border rounded-2xl p-5`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-sm font-semibold ${s.text}`}>Projects</h2>
                                    <button onClick={() => nav("projects")} className={`text-[11px] font-medium ${s.muted} hover:${s.text} transition-colors`}>
                                        View all →
                                    </button>
                                </div>
                                {projects.length === 0 ? (
                                    <div className={`text-center py-8 ${s.inner} rounded-xl`}>
                                        <FolderOpen className={`w-8 h-8 mx-auto mb-2 ${s.subtle} opacity-40`} />
                                        <p className={`text-xs ${s.muted}`}>No projects yet</p>
                                        {isAdmin && (
                                            <button onClick={() => nav("projects")} className="mt-3 text-xs text-blue-500 font-medium hover:text-blue-400">
                                                Create your first project →
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {projects.slice(0, 5).map(p => {
                                            const statusColor =
                                                (p.status || "").toLowerCase() === "completed" ? "emerald" :
                                                (p.status || "").toLowerCase() === "in progress" ? "blue" :
                                                (p.status || "").toLowerCase() === "on hold" ? "amber" : "slate";
                                            return (
                                                <div key={p.projectId}
                                                    onClick={() => nav("projects")}
                                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${s.cardHover} transition-all`}>
                                                    <div className={`w-9 h-9 rounded-lg bg-${statusColor}-500/10 text-${statusColor}-500 flex items-center justify-center flex-shrink-0`}>
                                                        <FolderOpen className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-medium ${s.text} truncate`}>{p.projectName}</p>
                                                        <p className={`text-[11px] ${s.subtle}`}>{p.projectCode} {p.clientName ? `• ${p.clientName}` : ""}</p>
                                                    </div>
                                                    <span className={`text-[10px] px-2 py-1 rounded-lg font-medium bg-${statusColor}-500/10 text-${statusColor}-500`}>
                                                        {p.status || "Planning"}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </FadeIn>
                    </div>

                    {/* Right 1/3 */}
                    <div className="space-y-6">

                        {/* Calendar */}
                        <FadeIn delay={100}>
                            <div className={`${s.card} border rounded-2xl p-5`}>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className={`text-sm font-semibold flex items-center gap-2 ${s.text}`}>
                                        <Calendar className="w-4 h-4 text-blue-500" />
                                        {calDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                                    </h2>
                                    <div className="flex gap-0.5">
                                        <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1))}
                                            className={`p-1.5 rounded-lg ${s.cardHover} transition-colors`}>
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1))}
                                            className={`p-1.5 rounded-lg ${s.cardHover} transition-colors`}>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-7 gap-0.5 mb-1">
                                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                        <div key={i} className={`text-center text-[10px] font-medium ${s.subtle} py-1`}>{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-0.5">
                                    {calDays.map((day, i) => (
                                        <div key={i} className={`aspect-square flex items-center justify-center text-[11px] rounded-lg relative transition-all
                                            ${!day ? "" :
                                            isToday(day) ? "bg-blue-600 text-white font-bold shadow-sm shadow-blue-600/30" :
                                            `${isDark ? "hover:bg-slate-800" : "hover:bg-gray-100"} cursor-pointer`}`}>
                                            {day}
                                            {day && (hasDue(day) || isHol(day)) && (
                                                <div className="absolute bottom-0 flex gap-0.5">
                                                    {isHol(day) && <div className="w-1 h-1 bg-red-500 rounded-full" />}
                                                    {hasDue(day) && <div className="w-1 h-1 bg-amber-400 rounded-full" />}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className={`mt-2 pt-2 border-t ${s.divider} flex justify-center gap-4 text-[10px] ${s.muted}`}>
                                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-red-500 rounded-full" />Holiday</span>
                                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />Deadline</span>
                                </div>
                            </div>
                        </FadeIn>

                        {/* Recent Clients */}
                        <FadeIn delay={150}>
                            <div className={`${s.card} border rounded-2xl p-5`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-sm font-semibold ${s.text}`}>Clients</h2>
                                    <button onClick={() => nav("client")} className={`text-[11px] font-medium ${s.muted} hover:${s.text} transition-colors`}>
                                        View all →
                                    </button>
                                </div>
                                {clients.length === 0 ? (
                                    <p className={`text-center py-6 text-xs ${s.muted}`}>No clients yet</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {clients.slice(0, 5).map(c => (
                                            <div key={c.customerId} onClick={() => nav("client")}
                                                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer ${s.cardHover} transition-all`}>
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                                                    {c.firstName?.[0]}{c.lastName?.[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs font-medium ${s.text} truncate`}>{c.firstName} {c.lastName}</p>
                                                    <p className={`text-[10px] ${s.subtle} truncate`}>{c.email}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </FadeIn>

                        {/* Team */}
                        <FadeIn delay={200}>
                            <div className={`${s.card} border rounded-2xl p-5`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-sm font-semibold ${s.text}`}>Team</h2>
                                    <button onClick={() => nav("consultants")} className={`text-[11px] font-medium ${s.muted} hover:${s.text} transition-colors`}>
                                        View all →
                                    </button>
                                </div>
                                {consultants.length === 0 ? (
                                    <p className={`text-center py-6 text-xs ${s.muted}`}>No consultants yet</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {consultants.slice(0, 5).map(c => (
                                            <div key={c.consultantId} onClick={() => nav("consultants")}
                                                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer ${s.cardHover} transition-all`}>
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                                                    {c.firstName?.[0]}{c.lastName?.[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs font-medium ${s.text} truncate`}>{c.firstName} {c.lastName}</p>
                                                    <p className={`text-[10px] ${s.subtle} truncate`}>{c.email}</p>
                                                </div>
                                                <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </FadeIn>
                    </div>
                </div>

                {/* Team Feed */}
                <FadeIn delay={300}>
                    <div className="mt-6">
                        <TeamFeed userName={userName || "User"} userEmail={userEmail || ""} userRole={userRole || "admin"} maxPosts={10} />
                    </div>
                </FadeIn>
            </div>
        </div>
    );
};

export default Dashboard;