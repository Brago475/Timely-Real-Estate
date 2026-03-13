// src/Style_Components/Dashboard.tsx
import React, { useState, useMemo, useEffect } from "react";
import TeamFeed from "../Views_Layouts/TeamFeed";
import { useTheme } from "../Views_Layouts/ThemeContext";
import { SkeletonCard, SkeletonList, FadeIn } from "./Skeleton";
import {
    FolderOpen, Users, UserCircle, Clock, Bell,
    ChevronLeft, ChevronRight, History, TrendingUp,
    Calendar, AlertTriangle, CheckCircle, ArrowRight,
    Plus, BarChart3,
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
    try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); }
    catch { return null; }
};

const fmtH = (h: number): string => {
    const w = Math.floor(h), m = Math.round((h - w) * 60);
    return m === 0 ? `${w}h` : `${w}h ${m}m`;
};

const fmtRel = (ts: string): string => {
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
        [`${year}-01-01`]: "New Year's", [`${year}-07-04`]: "Independence Day",
        [`${year}-12-25`]: "Christmas", [`${year}-11-11`]: "Veterans Day",
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
    h[nth(year, 0, 1, 3)] = "MLK Day"; h[nth(year, 1, 1, 3)] = "Presidents' Day";
    h[last(year, 4, 1)] = "Memorial Day"; h[nth(year, 8, 1, 1)] = "Labor Day";
    h[nth(year, 10, 4, 4)] = "Thanksgiving";
    return h;
};

const Dashboard: React.FC<DashboardProps> = ({
    sidebarToggle, setSidebarToggle, onNavigate,
    userName = "Admin", userEmail = "", userRole = "admin",
}) => {
    const { isDark } = useTheme();

    const n = {
        bg: isDark ? "neu-bg-dark" : "neu-bg-light",
        card: isDark ? "neu-dark" : "neu-light",
        cardSm: isDark ? "neu-dark-sm" : "neu-light-sm",
        flat: isDark ? "neu-dark-flat" : "neu-light-flat",
        inset: isDark ? "neu-dark-inset" : "neu-light-inset",
        pressed: isDark ? "neu-dark-pressed" : "neu-light-pressed",
        text: isDark ? "text-gray-200" : "text-gray-800",
        secondary: isDark ? "text-gray-400" : "text-gray-500",
        tertiary: isDark ? "text-gray-600" : "text-gray-400",
        strong: isDark ? "text-white" : "text-gray-900",
        link: isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900",
        progress: isDark ? "bg-gray-400" : "bg-gray-700",
        progressTrack: isDark ? "bg-gray-800" : "bg-gray-300",
        avatar: isDark ? "bg-gray-700 text-gray-300" : "bg-gray-300 text-gray-600",
        badge: isDark ? "bg-gray-800 text-gray-400" : "bg-gray-300 text-gray-600",
        todayBg: isDark ? "bg-white text-black" : "bg-gray-900 text-white",
        dot: isDark ? "bg-gray-500" : "bg-gray-400",
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
                safeFetch(`${API_BASE}/projects`), safeFetch(`${API_BASE}/users-report`),
                safeFetch(`${API_BASE}/consultants`), safeFetch(`${API_BASE}/hours-logs`),
                safeFetch(`${API_BASE}/audit-logs/latest?limit=10`),
            ]);
            setProjects(pR?.data || []); setClients(cR?.data || []);
            setConsultants(coR?.data || []); setHoursLogs(hR?.data || []);
            if (aR?.data) {
                setActivities(aR.data.map((l: any, i: number) => ({
                    id: i, user: l.performedBy || "System",
                    action: l.actionType?.toLowerCase().replace(/_/g, " ") || "action",
                    target: l.details || l.entityId, time: fmtRel(l.timestamp),
                    isDelete: l.actionType?.includes("DELETE"),
                })));
            }
            const al: any[] = [];
            if (isAdmin && (cR?.data || []).length === 0) al.push({ msg: "No clients yet", page: "admin" });
            if (isAdmin && (coR?.data || []).length === 0) al.push({ msg: "No consultants registered", page: "EmailGenerator" });
            (pR?.data || []).forEach((p: any) => {
                if (p.dateDue && p.status !== "completed") {
                    const d = Math.ceil((new Date(p.dateDue).getTime() - Date.now()) / 86400000);
                    if (d < 0) al.push({ msg: `${p.projectName} — overdue ${Math.abs(d)}d`, page: "projects" });
                    else if (d <= 7) al.push({ msg: `${p.projectName} — due in ${d}d`, page: "projects" });
                }
            });
            setAlerts(al.slice(0, 4));
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
    const today = new Date();
    const nav = (p: string) => onNavigate?.(p);
    const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 18 ? "Good afternoon" : "Good evening";

    if (isLoading) {
        return (
            <div className={`${n.bg} min-h-screen px-6 pb-10 max-w-6xl mx-auto`}>
                <div className="mb-10 pt-6">
                    <div className={`h-4 w-32 rounded-lg ${n.pressed} animate-pulse mb-3`} />
                    <div className={`h-7 w-56 rounded-lg ${n.pressed} animate-pulse`} />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    {[1,2,3,4].map(i => <div key={i} className={`h-28 ${n.card}`} />)}
                </div>
            </div>
        );
    }

    return (
        <div className={`${n.bg} ${n.text} min-h-screen`}>
            <div className="px-6 pb-12 max-w-6xl mx-auto">

                {/* Header */}
                <FadeIn>
                    <div className="mb-10">
                        <p className={`text-[11px] tracking-[0.15em] uppercase ${n.tertiary} mb-1`}>
                            {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        </p>
                        <h1 className={`text-2xl font-semibold tracking-tight ${n.strong}`}>
                            {greeting}, {firstName}
                        </h1>
                    </div>
                </FadeIn>

                {/* Stats */}
                <FadeIn delay={50}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
                        {[
                            { label: "Projects", value: stats.total, detail: `${stats.active} active`, page: "projects" },
                            { label: "Clients", value: stats.clients, detail: "accounts", page: "client" },
                            { label: "Consultants", value: stats.consultants, detail: "team", page: "consultants" },
                            { label: "Hours", value: fmtH(stats.weekH), detail: "this week", page: "hours" },
                        ].map((st, i) => (
                            <div
                                key={i}
                                onClick={() => nav(st.page)}
                                className={`${n.card} p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02]`}
                            >
                                <p className={`text-[11px] uppercase tracking-wider ${n.tertiary} mb-3`}>{st.label}</p>
                                <p className={`text-3xl font-semibold tracking-tight ${n.strong}`}>{st.value}</p>
                                <p className={`text-xs ${n.secondary} mt-1`}>{st.detail}</p>
                            </div>
                        ))}
                    </div>
                </FadeIn>

                {/* Quick Actions */}
                <FadeIn delay={80}>
                    <div className={`${n.card} p-2 mb-10 flex items-center gap-1 overflow-x-auto`}>
                        {(isAdmin ? [
                            { label: "New project", page: "projects", icon: Plus },
                            { label: "Add client", page: "admin", icon: Users },
                            { label: "Create account", page: "EmailGenerator", icon: UserCircle },
                            { label: "Review hours", page: "hours", icon: Clock },
                            { label: "Reports", page: "reports", icon: BarChart3 },
                        ] : isConsultant ? [
                            { label: "Log hours", page: "hours", icon: Clock },
                            { label: "My projects", page: "projects", icon: FolderOpen },
                            { label: "My clients", page: "client", icon: Users },
                            { label: "Reports", page: "reports", icon: BarChart3 },
                        ] : [
                            { label: "Projects", page: "projects", icon: FolderOpen },
                            { label: "Documents", page: "settings", icon: FolderOpen },
                        ]).map((a, i) => (
                            <button
                                key={i}
                                onClick={() => nav(a.page)}
                                className={`flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl whitespace-nowrap transition-all duration-200 ${n.secondary} hover:${n.strong} active:scale-95`}
                                style={{
                                    background: "transparent",
                                }}
                                onMouseDown={(e) => e.currentTarget.classList.add(n.pressed)}
                                onMouseUp={(e) => e.currentTarget.classList.remove(n.pressed)}
                                onMouseLeave={(e) => e.currentTarget.classList.remove(n.pressed)}
                            >
                                <a.icon className="w-3.5 h-3.5" />
                                {a.label}
                            </button>
                        ))}
                    </div>
                </FadeIn>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Alerts */}
                        {alerts.length > 0 && (
                            <FadeIn delay={100}>
                                <div>
                                    <h2 className={`text-[11px] uppercase tracking-wider font-medium ${n.tertiary} mb-4`}>Alerts</h2>
                                    <div className={`${n.card} p-1.5 space-y-1.5`}>
                                        {alerts.map((a, i) => (
                                            <div
                                                key={i}
                                                onClick={() => a.page && nav(a.page)}
                                                className={`${n.flat} flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all duration-200`}
                                            >
                                                <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                                                <p className={`text-sm ${n.text} flex-1`}>{a.msg}</p>
                                                <ArrowRight className={`w-3.5 h-3.5 ${n.tertiary}`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </FadeIn>
                        )}

                        {/* Progress */}
                        <FadeIn delay={130}>
                            <div className={`${n.card} p-6`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-[11px] uppercase tracking-wider font-medium ${n.tertiary}`}>Completion</h2>
                                    <span className={`text-lg font-semibold ${n.strong}`}>{stats.progress}%</span>
                                </div>
                                <div className={`${n.inset} p-1`}>
                                    <div className="h-2 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${n.progress} rounded-full transition-all duration-700`}
                                            style={{ width: `${stats.progress}%` }}
                                        />
                                    </div>
                                </div>
                                <div className={`flex gap-6 mt-4 text-xs ${n.secondary}`}>
                                    <span>{stats.completed} completed</span>
                                    <span>{stats.active} in progress</span>
                                    <span>{stats.total} total</span>
                                </div>
                            </div>
                        </FadeIn>

                        {/* Projects */}
                        <FadeIn delay={160}>
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-[11px] uppercase tracking-wider font-medium ${n.tertiary}`}>Projects</h2>
                                    <button onClick={() => nav("projects")} className={`text-xs transition-colors ${n.link}`}>View all</button>
                                </div>
                                {projects.length === 0 ? (
                                    <div className={`${n.card} p-10 text-center`}>
                                        <FolderOpen className={`w-8 h-8 mx-auto mb-3 ${n.tertiary}`} />
                                        <p className={`text-sm ${n.secondary}`}>No projects yet</p>
                                        {isAdmin && (
                                            <button onClick={() => nav("projects")} className={`mt-2 text-xs underline ${n.link}`}>Create first project</button>
                                        )}
                                    </div>
                                ) : (
                                    <div className={`${n.card} p-1.5 space-y-1.5`}>
                                        {projects.slice(0, 6).map(p => (
                                            <div
                                                key={p.projectId}
                                                onClick={() => nav("projects")}
                                                className={`${n.flat} flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-all duration-200`}
                                            >
                                                <div className={`w-9 h-9 rounded-xl ${n.inset} flex items-center justify-center flex-shrink-0`}>
                                                    <FolderOpen className={`w-4 h-4 ${n.secondary}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium ${n.text} truncate`}>{p.projectName}</p>
                                                    <p className={`text-[11px] ${n.tertiary}`}>{p.projectCode}{p.clientName ? ` · ${p.clientName}` : ""}</p>
                                                </div>
                                                <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${n.badge}`}>
                                                    {p.status || "Planning"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </FadeIn>

                        {/* Activity */}
                        <FadeIn delay={190}>
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-[11px] uppercase tracking-wider font-medium ${n.tertiary}`}>Activity</h2>
                                    <button onClick={() => nav("reports")} className={`text-xs transition-colors ${n.link}`}>View all</button>
                                </div>
                                {activities.length === 0 ? (
                                    <p className={`text-sm ${n.secondary} py-4`}>No recent activity</p>
                                ) : (
                                    <div className={`${n.card} p-5`}>
                                        <div className="relative pl-6">
                                            <div className={`absolute left-[7px] top-1 bottom-1 w-px ${isDark ? "bg-gray-800" : "bg-gray-300"}`} />

                                            {activities.slice(0, 6).map(a => (
                                                <div key={a.id} className="relative flex items-start gap-3 py-3 group">
                                                    <div className={`absolute -left-6 top-4 w-[9px] h-[9px] rounded-full border-2 transition-all
                                                        ${a.isDelete
                                                            ? (isDark ? "border-red-400 bg-red-400/20" : "border-red-400 bg-red-50")
                                                            : (isDark ? "border-gray-600 bg-gray-800 group-hover:border-gray-400" : "border-gray-300 bg-white group-hover:border-gray-500")}`}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm ${n.text}`}>
                                                            <span className="font-medium">{a.user}</span>
                                                            <span className={`${n.secondary}`}> {a.action}</span>
                                                        </p>
                                                        <p className={`text-[11px] ${n.tertiary} truncate mt-0.5`}>{a.target}</p>
                                                    </div>
                                                    <span className={`text-[11px] ${n.tertiary} flex-shrink-0 pt-0.5`}>{a.time}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </FadeIn>
                    </div>

                    {/* Right */}
                    <div className="space-y-8">

                        {/* Calendar */}
                        <FadeIn delay={100}>
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-[11px] uppercase tracking-wider font-medium ${n.tertiary}`}>
                                        {calDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                                    </h2>
                                    <div className="flex gap-2">
                                        <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1))}
                                            className={`w-8 h-8 ${n.flat} flex items-center justify-center cursor-pointer`}>
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1))}
                                            className={`w-8 h-8 ${n.flat} flex items-center justify-center cursor-pointer`}>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div className={`${n.card} p-5`}>
                                    <div className="grid grid-cols-7 gap-1 mb-2">
                                        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                            <div key={i} className={`text-center text-[10px] font-medium ${n.tertiary} py-1`}>{d}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1">
                                        {calDays.map((day, i) => (
                                            <div key={i} className={`aspect-square flex items-center justify-center text-[11px] rounded-lg relative transition-all duration-150
                                                ${!day ? "" :
                                                isToday(day)
                                                    ? `${n.todayBg} font-bold`
                                                    : `cursor-pointer ${n.secondary} hover:${n.strong}`}`}>
                                                {day}
                                                {day && (hasDue(day) || isHol(day)) && (
                                                    <div className="absolute bottom-0.5 flex gap-0.5">
                                                        {isHol(day) && <div className={`w-1 h-1 rounded-full ${n.dot}`} />}
                                                        {hasDue(day) && <div className={`w-1 h-1 rounded-full ${isDark ? "bg-gray-300" : "bg-gray-700"}`} />}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </FadeIn>

                        {/* Clients */}
                        <FadeIn delay={150}>
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-[11px] uppercase tracking-wider font-medium ${n.tertiary}`}>Clients</h2>
                                    <button onClick={() => nav("client")} className={`text-xs transition-colors ${n.link}`}>View all</button>
                                </div>
                                {clients.length === 0 ? (
                                    <div className={`${n.card} p-8 text-center`}>
                                        <p className={`text-sm ${n.secondary}`}>No clients yet</p>
                                    </div>
                                ) : (
                                    <div className={`${n.card} p-1.5 space-y-1.5`}>
                                        {clients.slice(0, 5).map(c => (
                                            <div
                                                key={c.customerId}
                                                onClick={() => nav("client")}
                                                className={`${n.flat} flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200`}
                                            >
                                                <div className={`w-8 h-8 rounded-full ${n.inset} flex items-center justify-center text-[10px] font-semibold ${n.secondary} flex-shrink-0`}>
                                                    {c.firstName?.[0]}{c.lastName?.[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium ${n.text} truncate`}>{c.firstName} {c.lastName}</p>
                                                    <p className={`text-[11px] ${n.tertiary} truncate`}>{c.email}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </FadeIn>

                        {/* Team */}
                        <FadeIn delay={200}>
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-[11px] uppercase tracking-wider font-medium ${n.tertiary}`}>Team</h2>
                                    <button onClick={() => nav("consultants")} className={`text-xs transition-colors ${n.link}`}>View all</button>
                                </div>
                                {consultants.length === 0 ? (
                                    <div className={`${n.card} p-8 text-center`}>
                                        <p className={`text-sm ${n.secondary}`}>No consultants yet</p>
                                    </div>
                                ) : (
                                    <div className={`${n.card} p-1.5 space-y-1.5`}>
                                        {consultants.slice(0, 5).map(c => (
                                            <div
                                                key={c.consultantId}
                                                onClick={() => nav("consultants")}
                                                className={`${n.flat} flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200`}
                                            >
                                                <div className={`w-8 h-8 rounded-full ${n.inset} flex items-center justify-center text-[10px] font-semibold ${n.secondary} flex-shrink-0`}>
                                                    {c.firstName?.[0]}{c.lastName?.[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium ${n.text} truncate`}>{c.firstName} {c.lastName}</p>
                                                    <p className={`text-[11px] ${n.tertiary} truncate`}>{c.email}</p>
                                                </div>
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </FadeIn>
                    </div>
                </div>

                {/* Team Feed */}
                <FadeIn delay={250}>
                    <div className="mt-10">
                        <h2 className={`text-[11px] uppercase tracking-wider font-medium ${n.tertiary} mb-4`}>Team Feed</h2>
                        <div className={`${n.card} p-5`}>
                            <TeamFeed userName={userName || "User"} userEmail={userEmail || ""} userRole={userRole || "admin"} maxPosts={10} />
                        </div>
                    </div>
                </FadeIn>
            </div>
        </div>
    );
};

export default Dashboard;