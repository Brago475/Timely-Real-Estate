// src/Style_Components/Dashboard.tsx
import React, { useState, useMemo, useEffect } from "react";
import TeamFeed from "../Views_Layouts/TeamFeed";
import { useTheme } from "../Views_Layouts/ThemeContext";
import { SkeletonCard, SkeletonList, FadeIn } from "./Skeleton";
import {
    FolderOpen, Users, UserCircle, Clock, Bell,
    ChevronLeft, ChevronRight, History, TrendingUp,
    Calendar, AlertTriangle, CheckCircle, ArrowRight,
    Plus, BarChart3, Circle,
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

const fmtH = (h: number): string => {
    const w = Math.floor(h);
    const m = Math.round((h - w) * 60);
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

    // Monochrome design system — no color unless absolutely necessary
    const s = {
        bg: isDark ? "bg-black" : "bg-white",
        text: isDark ? "text-neutral-100" : "text-neutral-900",
        secondary: isDark ? "text-neutral-400" : "text-neutral-500",
        tertiary: isDark ? "text-neutral-600" : "text-neutral-400",
        card: isDark ? "bg-neutral-900 border-neutral-800" : "bg-neutral-50 border-neutral-200",
        cardHover: isDark ? "hover:bg-neutral-800/70" : "hover:bg-neutral-100",
        inner: isDark ? "bg-neutral-800" : "bg-neutral-100",
        border: isDark ? "border-neutral-800" : "border-neutral-200",
        row: isDark ? "hover:bg-neutral-800/50" : "hover:bg-neutral-50",
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
                    time: fmtRel(l.timestamp),
                    isDelete: l.actionType?.includes("DELETE"),
                })));
            }
            const newAlerts: any[] = [];
            if (isAdmin && (cR?.data || []).length === 0)
                newAlerts.push({ msg: "No clients yet", page: "admin" });
            if (isAdmin && (coR?.data || []).length === 0)
                newAlerts.push({ msg: "No consultants registered", page: "EmailGenerator" });
            (pR?.data || []).forEach((p: any) => {
                if (p.dateDue && p.status !== "completed") {
                    const d = Math.ceil((new Date(p.dateDue).getTime() - Date.now()) / 86400000);
                    if (d < 0) newAlerts.push({ msg: `${p.projectName} — overdue by ${Math.abs(d)}d`, page: "projects" });
                    else if (d <= 7) newAlerts.push({ msg: `${p.projectName} — due in ${d}d`, page: "projects" });
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
        const weekH = hoursLogs.filter(l => new Date(l.date) >= ws).reduce((sm, l) => sm + l.hours, 0);
        const totalH = hoursLogs.reduce((sm, l) => sm + l.hours, 0);
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

    // Skeleton
    if (isLoading) {
        return (
            <div className={`${s.bg} px-6 pb-10 max-w-6xl mx-auto`}>
                <div className="mb-10 pt-4">
                    <div className={`h-4 w-32 rounded ${isDark ? "bg-neutral-800" : "bg-neutral-200"} animate-pulse mb-3`} />
                    <div className={`h-7 w-56 rounded ${isDark ? "bg-neutral-800" : "bg-neutral-200"} animate-pulse`} />
                </div>
                <div className="grid grid-cols-4 gap-4 mb-10">
                    <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2"><div className={`rounded-xl border p-6 ${s.card}`}><SkeletonList rows={4} /></div></div>
                    <div><div className={`rounded-xl border p-6 ${s.card}`}><div className={`h-52 rounded ${isDark ? "bg-neutral-800" : "bg-neutral-200"} animate-pulse`} /></div></div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${s.bg} ${s.text} min-h-screen`}>
            <div className="px-6 pb-12 max-w-6xl mx-auto">

                {/* Header — clean, quiet */}
                <FadeIn>
                    <div className="mb-10">
                        <p className={`text-[11px] tracking-[0.15em] uppercase ${s.tertiary} mb-1`}>
                            {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        </p>
                        <h1 className={`text-2xl font-semibold tracking-tight ${s.text}`}>
                            {greeting}, {firstName}
                        </h1>
                    </div>
                </FadeIn>

                {/* Stats — flat, no icons, just numbers */}
                <FadeIn delay={50}>
                    <div className={`grid grid-cols-2 lg:grid-cols-4 border rounded-xl overflow-hidden mb-10 ${s.border}`}>
                        {[
                            { label: "Projects", value: stats.total, detail: `${stats.active} active`, page: "projects" },
                            { label: "Clients", value: stats.clients, detail: "accounts", page: "client" },
                            { label: "Consultants", value: stats.consultants, detail: "team", page: "consultants" },
                            { label: "Hours", value: fmtH(stats.weekH), detail: "this week", page: "hours" },
                        ].map((st, i) => (
                            <div
                                key={i}
                                onClick={() => nav(st.page)}
                                className={`p-5 cursor-pointer transition-colors ${s.row}
                                    ${i < 3 ? (isDark ? "border-r border-neutral-800" : "border-r border-neutral-200") : ""}
                                    ${i < 2 ? (isDark ? "lg:border-r" : "lg:border-r") : ""}
                                    ${isDark ? "bg-neutral-900" : "bg-white"}`}
                            >
                                <p className={`text-[11px] uppercase tracking-wider ${s.tertiary} mb-2`}>{st.label}</p>
                                <p className={`text-2xl font-semibold tracking-tight ${s.text}`}>{st.value}</p>
                                <p className={`text-xs ${s.secondary} mt-1`}>{st.detail}</p>
                            </div>
                        ))}
                    </div>
                </FadeIn>

                {/* Quick Actions — text buttons, no background pills */}
                <FadeIn delay={80}>
                    <div className={`flex items-center gap-6 mb-10 pb-6 border-b ${s.border}`}>
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
                                className={`flex items-center gap-2 text-[13px] ${s.secondary} hover:${s.text} transition-colors`}
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

                        {/* Alerts — simple list, no cards */}
                        {alerts.length > 0 && (
                            <FadeIn delay={100}>
                                <div>
                                    <h2 className={`text-[11px] uppercase tracking-wider ${s.tertiary} mb-3`}>Alerts</h2>
                                    <div className={`border rounded-xl overflow-hidden ${s.border}`}>
                                        {alerts.map((a, i) => (
                                            <div
                                                key={i}
                                                onClick={() => a.page && nav(a.page)}
                                                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${s.row}
                                                    ${i < alerts.length - 1 ? `border-b ${s.border}` : ""}
                                                    ${isDark ? "bg-neutral-900" : "bg-white"}`}
                                            >
                                                <Circle className={`w-2 h-2 fill-amber-500 text-amber-500 flex-shrink-0`} />
                                                <p className={`text-sm ${s.text} flex-1`}>{a.msg}</p>
                                                <ArrowRight className={`w-3.5 h-3.5 ${s.tertiary}`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </FadeIn>
                        )}

                        {/* Progress — thin bar, minimal */}
                        <FadeIn delay={130}>
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className={`text-[11px] uppercase tracking-wider ${s.tertiary}`}>Completion</h2>
                                    <span className={`text-sm font-medium ${s.text}`}>{stats.progress}%</span>
                                </div>
                                <div className={`w-full h-1.5 ${s.inner} rounded-full overflow-hidden`}>
                                    <div
                                        className={`h-full ${isDark ? "bg-neutral-400" : "bg-neutral-900"} rounded-full transition-all duration-700`}
                                        style={{ width: `${stats.progress}%` }}
                                    />
                                </div>
                                <div className={`flex gap-4 mt-3 text-xs ${s.secondary}`}>
                                    <span>{stats.completed} completed</span>
                                    <span>{stats.active} in progress</span>
                                    <span>{stats.total} total</span>
                                </div>
                            </div>
                        </FadeIn>

                        {/* Projects — clean table rows */}
                        <FadeIn delay={160}>
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className={`text-[11px] uppercase tracking-wider ${s.tertiary}`}>Projects</h2>
                                    <button onClick={() => nav("projects")} className={`text-xs ${s.secondary} hover:${s.text} transition-colors`}>
                                        View all
                                    </button>
                                </div>
                                {projects.length === 0 ? (
                                    <div className={`border rounded-xl p-8 text-center ${s.border} ${isDark ? "bg-neutral-900" : "bg-white"}`}>
                                        <p className={`text-sm ${s.secondary}`}>No projects yet</p>
                                        {isAdmin && (
                                            <button onClick={() => nav("projects")} className={`mt-2 text-xs ${s.secondary} underline`}>
                                                Create your first project
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className={`border rounded-xl overflow-hidden ${s.border}`}>
                                        {projects.slice(0, 6).map((p, i) => (
                                            <div
                                                key={p.projectId}
                                                onClick={() => nav("projects")}
                                                className={`flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-colors ${s.row}
                                                    ${i < Math.min(projects.length, 6) - 1 ? `border-b ${s.border}` : ""}
                                                    ${isDark ? "bg-neutral-900" : "bg-white"}`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg ${s.inner} flex items-center justify-center flex-shrink-0`}>
                                                    <FolderOpen className={`w-3.5 h-3.5 ${s.secondary}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium ${s.text} truncate`}>{p.projectName}</p>
                                                    <p className={`text-[11px] ${s.tertiary}`}>
                                                        {p.projectCode}{p.clientName ? ` · ${p.clientName}` : ""}
                                                    </p>
                                                </div>
                                                <span className={`text-[11px] px-2.5 py-1 rounded-md ${isDark ? "bg-neutral-800 text-neutral-400" : "bg-neutral-100 text-neutral-500"}`}>
                                                    {p.status || "Planning"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </FadeIn>

                        {/* Activity — timeline style */}
                        <FadeIn delay={190}>
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className={`text-[11px] uppercase tracking-wider ${s.tertiary}`}>Activity</h2>
                                    <button onClick={() => nav("reports")} className={`text-xs ${s.secondary} hover:${s.text} transition-colors`}>
                                        View all
                                    </button>
                                </div>
                                {activities.length === 0 ? (
                                    <p className={`text-sm ${s.secondary} py-4`}>No recent activity</p>
                                ) : (
                                    <div className="relative pl-6">
                                        {/* Timeline line */}
                                        <div className={`absolute left-[7px] top-2 bottom-2 w-px ${isDark ? "bg-neutral-800" : "bg-neutral-200"}`} />

                                        <div className="space-y-0">
                                            {activities.slice(0, 6).map(a => (
                                                <div key={a.id} className="relative flex items-start gap-3 py-2.5">
                                                    {/* Dot */}
                                                    <div className={`absolute -left-6 top-3.5 w-[9px] h-[9px] rounded-full border-2
                                                        ${a.isDelete
                                                            ? (isDark ? "border-red-500/50 bg-red-500/20" : "border-red-400 bg-red-50")
                                                            : (isDark ? "border-neutral-600 bg-neutral-800" : "border-neutral-300 bg-white")}`}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm ${s.text}`}>
                                                            <span className="font-medium">{a.user}</span>
                                                            <span className={` ${s.secondary}`}> {a.action}</span>
                                                        </p>
                                                        <p className={`text-[11px] ${s.tertiary} truncate mt-0.5`}>{a.target}</p>
                                                    </div>
                                                    <span className={`text-[11px] ${s.tertiary} flex-shrink-0 pt-0.5`}>{a.time}</span>
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
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className={`text-[11px] uppercase tracking-wider ${s.tertiary}`}>
                                        {calDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                                    </h2>
                                    <div className="flex gap-1">
                                        <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1))}
                                            className={`p-1 rounded ${s.row} transition-colors`}>
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1))}
                                            className={`p-1 rounded ${s.row} transition-colors`}>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div className={`border rounded-xl p-4 ${s.border} ${isDark ? "bg-neutral-900" : "bg-white"}`}>
                                    <div className="grid grid-cols-7 gap-0.5 mb-1">
                                        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                            <div key={i} className={`text-center text-[10px] font-medium ${s.tertiary} py-1`}>{d}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-0.5">
                                        {calDays.map((day, i) => (
                                            <div key={i} className={`aspect-square flex items-center justify-center text-[11px] rounded-lg relative
                                                ${!day ? "" :
                                                isToday(day)
                                                    ? (isDark ? "bg-white text-black font-semibold" : "bg-neutral-900 text-white font-semibold")
                                                    : `cursor-pointer ${s.row}`}`}>
                                                {day}
                                                {day && (hasDue(day) || isHol(day)) && (
                                                    <div className="absolute bottom-0.5 flex gap-0.5">
                                                        {isHol(day) && <div className={`w-1 h-1 rounded-full ${isDark ? "bg-neutral-500" : "bg-neutral-400"}`} />}
                                                        {hasDue(day) && <div className={`w-1 h-1 rounded-full ${isDark ? "bg-neutral-400" : "bg-neutral-600"}`} />}
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
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className={`text-[11px] uppercase tracking-wider ${s.tertiary}`}>Clients</h2>
                                    <button onClick={() => nav("client")} className={`text-xs ${s.secondary} hover:${s.text} transition-colors`}>
                                        View all
                                    </button>
                                </div>
                                {clients.length === 0 ? (
                                    <p className={`text-sm ${s.secondary}`}>No clients yet</p>
                                ) : (
                                    <div className={`border rounded-xl overflow-hidden ${s.border}`}>
                                        {clients.slice(0, 5).map((c, i) => (
                                            <div
                                                key={c.customerId}
                                                onClick={() => nav("client")}
                                                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${s.row}
                                                    ${i < Math.min(clients.length, 5) - 1 ? `border-b ${s.border}` : ""}
                                                    ${isDark ? "bg-neutral-900" : "bg-white"}`}
                                            >
                                                <div className={`w-7 h-7 rounded-full ${s.inner} flex items-center justify-center text-[10px] font-medium ${s.secondary} flex-shrink-0`}>
                                                    {c.firstName?.[0]}{c.lastName?.[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm ${s.text} truncate`}>{c.firstName} {c.lastName}</p>
                                                    <p className={`text-[11px] ${s.tertiary} truncate`}>{c.email}</p>
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
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className={`text-[11px] uppercase tracking-wider ${s.tertiary}`}>Team</h2>
                                    <button onClick={() => nav("consultants")} className={`text-xs ${s.secondary} hover:${s.text} transition-colors`}>
                                        View all
                                    </button>
                                </div>
                                {consultants.length === 0 ? (
                                    <p className={`text-sm ${s.secondary}`}>No consultants yet</p>
                                ) : (
                                    <div className={`border rounded-xl overflow-hidden ${s.border}`}>
                                        {consultants.slice(0, 5).map((c, i) => (
                                            <div
                                                key={c.consultantId}
                                                onClick={() => nav("consultants")}
                                                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${s.row}
                                                    ${i < Math.min(consultants.length, 5) - 1 ? `border-b ${s.border}` : ""}
                                                    ${isDark ? "bg-neutral-900" : "bg-white"}`}
                                            >
                                                <div className={`w-7 h-7 rounded-full ${s.inner} flex items-center justify-center text-[10px] font-medium ${s.secondary} flex-shrink-0`}>
                                                    {c.firstName?.[0]}{c.lastName?.[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm ${s.text} truncate`}>{c.firstName} {c.lastName}</p>
                                                    <p className={`text-[11px] ${s.tertiary} truncate`}>{c.email}</p>
                                                </div>
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
                        <TeamFeed userName={userName || "User"} userEmail={userEmail || ""} userRole={userRole || "admin"} maxPosts={10} />
                    </div>
                </FadeIn>
            </div>
        </div>
    );
};

export default Dashboard;