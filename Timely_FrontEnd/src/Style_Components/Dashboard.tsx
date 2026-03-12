// src/Style_Components/Dashboard.tsx
// Apple-style dashboard with skeleton loading and smooth animations

import React, { useState, useMemo, useEffect } from "react";
import TeamFeed from "../Views_Layouts/TeamFeed";
import { useTheme } from "../Views_Layouts/ThemeContext";
import { SkeletonCard, SkeletonList, FadeIn } from "./Skeleton";
import {
    FolderOpen, Users, UserCircle, Clock, Bell,
    ChevronLeft, ChevronRight, History, TrendingUp,
    Calendar, AlertTriangle, CheckCircle, Info, X,
    FileText, MessageSquare,
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

interface Project {
    projectId: string;
    projectCode: string;
    projectName: string;
    clientName: string;
    status: string;
    dateCreated?: string;
    dateDue?: string;
}

interface Client {
    customerId: string;
    clientCode: string;
    firstName: string;
    lastName: string;
    email: string;
    status?: string;
    lastContactDate?: string;
    nextFollowUp?: string;
}

interface Consultant {
    consultantId: string;
    consultantCode: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
}

interface HoursLog {
    logId: string;
    projectId: string;
    consultantId: string;
    consultantEmail?: string;
    date: string;
    hours: number;
    description: string;
}

interface Alert {
    id: number;
    type: string;
    message: string;
    time: string;
    color: string;
    page?: string;
}

interface Activity {
    id: number;
    user: string;
    action: string;
    target: string;
    timestamp: string;
    color: string;
}

const safeFetch = async (url: string) => {
    try {
        const response = await fetch(url);
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return null;
        return await response.json();
    } catch { return null; }
};

const formatRelativeTime = (timestamp: string): string => {
    if (!timestamp) return "Unknown";
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
};

const formatHoursDisplay = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return minutes === 0 ? `${wholeHours}h` : `${wholeHours}h ${minutes}m`;
};

const getUSHolidays = (year: number): Record<string, string> => {
    const holidays: Record<string, string> = {
        [`${year}-01-01`]: "New Year's Day",
        [`${year}-07-04`]: "Independence Day",
        [`${year}-12-25`]: "Christmas Day",
        [`${year}-11-11`]: "Veterans Day",
    };
    const getNthWeekday = (y: number, month: number, weekday: number, n: number): string => {
        let count = 0;
        let date = new Date(y, month, 1);
        while (count < n) {
            if (date.getDay() === weekday) count++;
            if (count < n) date.setDate(date.getDate() + 1);
        }
        return `${y}-${String(month + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    const getLastWeekday = (y: number, month: number, weekday: number): string => {
        let date = new Date(y, month + 1, 0);
        while (date.getDay() !== weekday) date.setDate(date.getDate() - 1);
        return `${y}-${String(month + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    holidays[getNthWeekday(year, 0, 1, 3)] = "MLK Day";
    holidays[getNthWeekday(year, 1, 1, 3)] = "Presidents' Day";
    holidays[getLastWeekday(year, 4, 1)] = "Memorial Day";
    holidays[getNthWeekday(year, 8, 1, 1)] = "Labor Day";
    holidays[getNthWeekday(year, 10, 4, 4)] = "Thanksgiving";
    return holidays;
};

const Dashboard: React.FC<DashboardProps> = ({
    sidebarToggle,
    setSidebarToggle,
    onNavigate,
    userName = "Admin",
    userEmail = "admin@timely.com",
    userRole = "admin",
}) => {
    const { isDark } = useTheme();

    const s = {
        bg: isDark ? "bg-slate-950" : "bg-gray-50",
        text: isDark ? "text-white" : "text-gray-900",
        muted: isDark ? "text-slate-400" : "text-gray-500",
        subtle: isDark ? "text-slate-500" : "text-gray-400",
        card: isDark ? "bg-slate-900/80 border-slate-800 backdrop-blur-sm" : "bg-white/80 border-gray-200 backdrop-blur-sm",
        cardHover: isDark ? "hover:bg-slate-800/80 hover:border-slate-700" : "hover:bg-gray-50 hover:border-gray-300",
        inner: isDark ? "bg-slate-800/60" : "bg-gray-100/80",
        divider: isDark ? "border-slate-800" : "border-gray-100",
        chip: isDark ? "bg-slate-800 text-slate-300" : "bg-gray-100 text-gray-600",
    };

    const isAdmin = userRole === "admin";
    const isConsultant = userRole === "consultant";

    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [hoursLogs, setHoursLogs] = useState<HoursLog[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => { fetchDashboardData(); }, []);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            const [projectsRes, clientsRes, consultantsRes, hoursRes, auditRes] = await Promise.all([
                safeFetch(`${API_BASE}/projects`),
                safeFetch(`${API_BASE}/users-report`),
                safeFetch(`${API_BASE}/consultants`),
                safeFetch(`${API_BASE}/hours-logs`),
                safeFetch(`${API_BASE}/audit-logs/latest?limit=10`),
            ]);

            const projectsList = projectsRes?.data || [];
            setProjects(projectsList);
            setClients(clientsRes?.data || []);
            setConsultants(consultantsRes?.data || []);
            setHoursLogs(hoursRes?.data || []);

            if (auditRes?.data) {
                setActivities(auditRes.data.map((log: any, i: number) => ({
                    id: i,
                    user: log.performedBy || "System",
                    action: log.actionType?.toLowerCase().replace(/_/g, " ") || "action",
                    target: log.details || log.entityId,
                    timestamp: formatRelativeTime(log.timestamp),
                    color: log.actionType?.includes("DELETE") ? "text-red-400" : "text-emerald-400",
                })));
            }

            generateAlerts(projectsList, clientsRes?.data || [], consultantsRes?.data || []);
        } catch (error) {
            console.error("Error fetching dashboard:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const generateAlerts = (projectsList: Project[], clientsList: Client[], consultantsList: Consultant[]) => {
        const newAlerts: Alert[] = [];
        const today = new Date();

        if (isAdmin) {
            if (clientsList.length === 0)
                newAlerts.push({ id: 900, type: "warning", message: "No clients yet. Add your first client to get started.", time: "Action needed", color: "text-amber-500", page: "admin" });
            if (consultantsList.length === 0)
                newAlerts.push({ id: 901, type: "warning", message: "No consultants registered. Create an account to invite one.", time: "Action needed", color: "text-amber-500", page: "EmailGenerator" });
        }

        projectsList.forEach((p, i) => {
            if (p.dateDue && p.status !== "completed") {
                const daysUntilDue = Math.ceil((new Date(p.dateDue).getTime() - today.getTime()) / 86400000);
                if (daysUntilDue < 0)
                    newAlerts.push({ id: i, type: "overdue", message: `"${p.projectName}" is overdue by ${Math.abs(daysUntilDue)} days`, time: `Due: ${p.dateDue}`, color: "text-red-500", page: "projects" });
                else if (daysUntilDue <= 7)
                    newAlerts.push({ id: i + 100, type: "deadline", message: `"${p.projectName}" due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`, time: `Due: ${p.dateDue}`, color: "text-amber-500", page: "projects" });
            }
        });

        setAlerts(newAlerts.slice(0, 5));
    };

    const stats = useMemo(() => {
        const active = projects.filter(p => (p.status || "").toLowerCase() === "in progress").length;
        const completed = projects.filter(p => (p.status || "").toLowerCase() === "completed").length;
        const total = projects.length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekHours = hoursLogs.filter(l => new Date(l.date) >= weekStart).reduce((sum, l) => sum + l.hours, 0);
        return { active, completed, total, progress, clients: clients.length, consultants: consultants.length, totalHours: hoursLogs.reduce((sum, l) => sum + l.hours, 0), weekHours };
    }, [projects, clients, consultants, hoursLogs]);

    const holidays = useMemo(() => getUSHolidays(currentDate.getFullYear()), [currentDate]);

    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: (number | null)[] = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let d = 1; d <= daysInMonth; d++) days.push(d);
        return days;
    }, [currentDate]);

    const isToday = (day: number | null): boolean => {
        if (!day) return false;
        const t = new Date();
        return day === t.getDate() && currentDate.getMonth() === t.getMonth() && currentDate.getFullYear() === t.getFullYear();
    };

    const getDateStr = (day: number): string => `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const hasDeadline = (day: number | null): boolean => day ? projects.some(p => p.dateDue === getDateStr(day)) : false;
    const isHoliday = (day: number | null): string | false => day ? holidays[getDateStr(day)] || false : false;

    const recentProjects = useMemo(() => projects.filter(p => (p.status || "").toLowerCase() !== "completed").slice(0, 4), [projects]);
    const recentClients = useMemo(() => [...clients].slice(0, 4), [clients]);

    const quickActions = useMemo(() => {
        if (isAdmin) return [
            { label: "New Project", page: "projects", icon: FolderOpen, gradient: "from-blue-500 to-blue-600" },
            { label: "Add Client", page: "admin", icon: Users, gradient: "from-purple-500 to-purple-600" },
            { label: "Create Account", page: "EmailGenerator", icon: UserCircle, gradient: "from-emerald-500 to-emerald-600" },
            { label: "Review Hours", page: "hours", icon: Clock, gradient: "from-amber-500 to-amber-600" },
        ];
        if (isConsultant) return [
            { label: "Log Hours", page: "hours", icon: Clock, gradient: "from-emerald-500 to-emerald-600" },
            { label: "My Projects", page: "projects", icon: FolderOpen, gradient: "from-blue-500 to-blue-600" },
            { label: "My Clients", page: "client", icon: Users, gradient: "from-purple-500 to-purple-600" },
        ];
        return [
            { label: "View Projects", page: "projects", icon: FolderOpen, gradient: "from-blue-500 to-blue-600" },
            { label: "Documents", page: "settings", icon: FileText, gradient: "from-purple-500 to-purple-600" },
            { label: "Contact", page: "settings", icon: MessageSquare, gradient: "from-emerald-500 to-emerald-600" },
        ];
    }, [isAdmin, isConsultant]);

    const roleLabel = isAdmin ? "Admin" : isConsultant ? "Consultant" : "Client";
    const firstName = userName?.split(" ")[0] || "User";
    const initials = (userName || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    const today = new Date();
    const handleNavigate = (page: string) => { if (onNavigate) onNavigate(page); };

    // Skeleton loading state
    if (isLoading) {
        return (
            <div className={`${s.bg} ${s.text} px-6 pb-10 max-w-7xl mx-auto`}>
                {/* Header skeleton */}
                <div className="mb-8 pt-2">
                    <div className={`h-3 w-40 rounded ${isDark ? "bg-slate-800" : "bg-gray-200"} animate-pulse mb-3`} />
                    <div className={`h-8 w-48 rounded ${isDark ? "bg-slate-800" : "bg-gray-200"} animate-pulse mb-2`} />
                    <div className={`h-4 w-72 rounded ${isDark ? "bg-slate-800" : "bg-gray-200"} animate-pulse`} />
                </div>

                {/* Stats skeleton */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>

                {/* Content skeleton */}
                <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className={`rounded-xl border p-5 ${s.card}`}>
                            <div className={`h-5 w-24 rounded ${isDark ? "bg-slate-800" : "bg-gray-200"} animate-pulse mb-4`} />
                            <SkeletonList rows={3} />
                        </div>
                        <div className={`rounded-xl border p-5 ${s.card}`}>
                            <div className={`h-5 w-32 rounded ${isDark ? "bg-slate-800" : "bg-gray-200"} animate-pulse mb-4`} />
                            <div className="grid grid-cols-4 gap-3">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className={`h-20 rounded-xl ${isDark ? "bg-slate-800" : "bg-gray-200"} animate-pulse`} />
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className={`rounded-xl border p-5 ${s.card}`}>
                            <div className={`h-5 w-24 rounded ${isDark ? "bg-slate-800" : "bg-gray-200"} animate-pulse mb-4`} />
                            <div className={`h-48 rounded-lg ${isDark ? "bg-slate-800" : "bg-gray-200"} animate-pulse`} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${s.bg} ${s.text}`}>
            <div className="px-6 pb-10 max-w-7xl mx-auto">

                {/* Header */}
                <FadeIn>
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
                        <div>
                            <p className={`text-xs font-medium tracking-widest uppercase ${s.subtle}`}>
                                {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                            </p>
                            <h1 className={`text-3xl font-semibold tracking-tight mt-1 ${s.text}`}>
                                Dashboard
                            </h1>
                            <p className={`mt-1 text-sm ${s.muted}`}>
                                Welcome back, {firstName}.
                            </p>
                        </div>
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${s.card} transition-smooth`}>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                                {initials}
                            </div>
                            <div>
                                <p className={`text-sm font-medium ${s.text}`}>{userName}</p>
                                <p className={`text-xs ${s.subtle}`}>{roleLabel}</p>
                            </div>
                        </div>
                    </div>
                </FadeIn>

                {/* Stats Cards */}
                <FadeIn delay={50}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {[
                            { label: "Projects", value: stats.total, sub: `${stats.active} active`, icon: FolderOpen, color: "text-blue-500", bg: "bg-blue-500/10", page: "projects" },
                            { label: "Clients", value: stats.clients, sub: "Total clients", icon: Users, color: "text-purple-500", bg: "bg-purple-500/10", page: "client" },
                            { label: "Consultants", value: stats.consultants, sub: "Team members", icon: UserCircle, color: "text-emerald-500", bg: "bg-emerald-500/10", page: "consultants" },
                            { label: "Hours", value: formatHoursDisplay(stats.weekHours), sub: "This week", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", page: "hours" },
                        ].map((stat, i) => (
                            <div
                                key={i}
                                onClick={() => handleNavigate(stat.page)}
                                className={`${s.card} border rounded-2xl p-5 cursor-pointer ${s.cardHover} transition-all duration-200 active:scale-[0.98]`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                                        <stat.icon className="w-5 h-5" />
                                    </div>
                                    <span className={`text-2xl font-semibold tracking-tight ${s.text}`}>{stat.value}</span>
                                </div>
                                <p className={`text-sm font-medium ${s.text}`}>{stat.label}</p>
                                <p className={`text-xs ${s.muted}`}>{stat.sub}</p>
                            </div>
                        ))}
                    </div>
                </FadeIn>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Column */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Alerts */}
                        <FadeIn delay={100}>
                            <section className={`${s.card} border rounded-2xl p-5`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-base font-semibold flex items-center gap-2 ${s.text}`}>
                                        <Bell className="w-4 h-4 text-amber-500" /> Alerts
                                    </h2>
                                    <span className={`text-xs ${s.muted}`}>
                                        {alerts.length === 0 ? "All caught up" : `${alerts.length} active`}
                                    </span>
                                </div>
                                {alerts.length === 0 ? (
                                    <div className={`flex flex-col items-center justify-center gap-2 py-8 rounded-xl ${s.inner}`}>
                                        <CheckCircle className="w-8 h-8 text-emerald-500 opacity-80" />
                                        <p className={`text-sm ${s.muted}`}>No alerts right now</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {alerts.map(a => (
                                            <div
                                                key={a.id}
                                                onClick={() => a.page && handleNavigate(a.page)}
                                                className={`flex items-start gap-3 p-3 rounded-xl ${s.inner} cursor-pointer ${s.cardHover} transition-all duration-200`}
                                            >
                                                <AlertTriangle className={`w-4 h-4 ${a.color} mt-0.5 flex-shrink-0`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm ${s.text}`}>{a.message}</p>
                                                    <p className={`text-xs ${s.muted} mt-0.5`}>{a.time}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </FadeIn>

                        {/* Quick Actions */}
                        <FadeIn delay={150}>
                            <section className={`${s.card} border rounded-2xl p-5`}>
                                <h2 className={`text-base font-semibold mb-4 ${s.text}`}>Quick Actions</h2>
                                <div className={`grid ${quickActions.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"} gap-3`}>
                                    {quickActions.map((action, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleNavigate(action.page)}
                                            className={`bg-gradient-to-br ${action.gradient} text-white rounded-xl p-4 transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-[0.97] flex flex-col items-center justify-center gap-2`}
                                        >
                                            <action.icon className="w-5 h-5" />
                                            <p className="text-xs font-medium">{action.label}</p>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </FadeIn>

                        {/* Progress */}
                        <FadeIn delay={200}>
                            <section className={`${s.card} border rounded-2xl p-5`}>
                                <h2 className={`text-base font-semibold mb-4 flex items-center gap-2 ${s.text}`}>
                                    <TrendingUp className="w-4 h-4 text-emerald-500" /> Progress
                                </h2>
                                <div className="mb-4">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className={s.muted}>Project Completion</span>
                                        <span className={`font-medium ${s.text}`}>{stats.progress}%</span>
                                    </div>
                                    <div className={`w-full h-2 ${s.inner} rounded-full overflow-hidden`}>
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700 ease-out"
                                            style={{ width: `${stats.progress}%` }}
                                        />
                                    </div>
                                    <div className={`flex justify-between text-xs mt-2 ${s.muted}`}>
                                        <span>{stats.completed} completed</span>
                                        <span>{stats.total} total</span>
                                    </div>
                                </div>
                                <div className={`mt-4 pt-4 border-t ${s.divider}`}>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${s.chip}`}>
                                            <Clock className="w-3 h-3 inline mr-1.5" />{formatHoursDisplay(stats.weekHours)} this week
                                        </span>
                                        <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${s.chip}`}>
                                            <FolderOpen className="w-3 h-3 inline mr-1.5" />{stats.active} active projects
                                        </span>
                                    </div>
                                </div>
                            </section>
                        </FadeIn>

                        {/* Recent Activity */}
                        <FadeIn delay={250}>
                            <section className={`${s.card} border rounded-2xl p-5`}>
                                <h2 className={`text-base font-semibold mb-4 flex items-center gap-2 ${s.text}`}>
                                    <History className="w-4 h-4" /> Recent Activity
                                </h2>
                                {activities.length === 0 ? (
                                    <p className={`text-center py-8 text-sm ${s.muted}`}>No recent activity</p>
                                ) : (
                                    <div className={`divide-y ${s.divider}`}>
                                        {activities.slice(0, 5).map(a => (
                                            <div key={a.id} className="py-3 flex items-start gap-3">
                                                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${a.color === "text-red-400" ? "bg-red-400" : "bg-emerald-400"}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm ${s.text}`}>
                                                        <span className="font-medium">{a.user}</span>{" "}
                                                        <span className={s.muted}>{a.action}</span>
                                                    </p>
                                                    <p className={`text-xs ${s.muted} truncate mt-0.5`}>{a.target}</p>
                                                </div>
                                                <span className={`text-xs ${s.subtle} flex-shrink-0`}>{a.timestamp}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </FadeIn>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">

                        {/* Calendar */}
                        <FadeIn delay={100}>
                            <section className={`${s.card} border rounded-2xl p-5`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-base font-semibold flex items-center gap-2 ${s.text}`}>
                                        <Calendar className="w-4 h-4 text-blue-500" /> Calendar
                                    </h2>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className={`p-1.5 rounded-lg ${s.cardHover} transition-colors`}>
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className={`p-1.5 rounded-lg ${s.cardHover} transition-colors`}>
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className={`text-sm font-medium ${s.muted} mb-3`}>
                                    {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                                </p>
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                        <div key={i} className={`text-center text-xs font-medium ${s.subtle} py-1`}>{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {calendarDays.map((day, i) => (
                                        <div
                                            key={i}
                                            className={`aspect-square flex items-center justify-center text-xs rounded-lg relative cursor-pointer transition-all duration-150
                                                ${!day ? "" :
                                                isToday(day) ? "bg-blue-600 text-white font-semibold shadow-sm shadow-blue-600/30" :
                                                `${s.inner} ${s.cardHover}`}`}
                                        >
                                            {day}
                                            {day && (hasDeadline(day) || isHoliday(day)) && (
                                                <div className="absolute bottom-0.5 flex gap-0.5">
                                                    {isHoliday(day) && <div className="w-1 h-1 bg-red-500 rounded-full" />}
                                                    {hasDeadline(day) && <div className="w-1 h-1 bg-amber-400 rounded-full" />}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className={`mt-3 pt-3 border-t ${s.divider} flex justify-center gap-4 text-xs ${s.muted}`}>
                                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-red-500 rounded-full" />Holiday</span>
                                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />Deadline</span>
                                </div>
                            </section>
                        </FadeIn>

                        {/* Active Projects */}
                        <FadeIn delay={150}>
                            <section className={`${s.card} border rounded-2xl p-5`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-base font-semibold ${s.text}`}>Active Projects</h2>
                                    <button onClick={() => handleNavigate("projects")} className="text-xs text-blue-500 hover:text-blue-400 font-medium transition-colors">
                                        View all →
                                    </button>
                                </div>
                                {recentProjects.length === 0 ? (
                                    <p className={`text-center py-6 text-sm ${s.muted}`}>No active projects</p>
                                ) : (
                                    <div className="space-y-2">
                                        {recentProjects.map(p => (
                                            <div
                                                key={p.projectId}
                                                onClick={() => handleNavigate("projects")}
                                                className={`p-3 rounded-xl ${s.inner} cursor-pointer ${s.cardHover} transition-all duration-200`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                                                        <FolderOpen className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-medium ${s.text} truncate`}>{p.projectName}</p>
                                                        <p className={`text-xs ${s.muted}`}>{p.dateDue ? `Due ${p.dateDue}` : "No deadline"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </FadeIn>

                        {/* Recent Clients */}
                        <FadeIn delay={200}>
                            <section className={`${s.card} border rounded-2xl p-5`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-base font-semibold ${s.text}`}>Recent Clients</h2>
                                    <button onClick={() => handleNavigate("client")} className="text-xs text-blue-500 hover:text-blue-400 font-medium transition-colors">
                                        View all →
                                    </button>
                                </div>
                                {recentClients.length === 0 ? (
                                    <p className={`text-center py-6 text-sm ${s.muted}`}>No clients yet</p>
                                ) : (
                                    <div className="space-y-2">
                                        {recentClients.map(c => (
                                            <div
                                                key={c.customerId}
                                                onClick={() => handleNavigate("client")}
                                                className={`flex items-center gap-3 p-3 rounded-xl ${s.inner} cursor-pointer ${s.cardHover} transition-all duration-200`}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                                    {c.firstName[0]}{c.lastName[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium ${s.text} truncate`}>{c.firstName} {c.lastName}</p>
                                                    <p className={`text-xs ${s.muted}`}>{c.email}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </FadeIn>
                    </div>
                </div>

                {/* Team Feed */}
                <FadeIn delay={300}>
                    <div className="mt-6">
                        <TeamFeed userName={userName || "User"} userEmail={userEmail || ""} userRole={userRole} maxPosts={10} />
                    </div>
                </FadeIn>
            </div>
        </div>
    );
};

export default Dashboard;