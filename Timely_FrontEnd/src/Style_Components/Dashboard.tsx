// src/Style_Components/Dashboard.tsx
// main dashboard page - the primary landing page for admin and consultant users
// displays key metrics, alerts, calendar, recent activity, and quick actions
// content adapts based on user role (admin sees everything, consultant sees their data)

import React, { useState, useMemo, useEffect } from "react";
import TeamFeed from "../Views_Layouts/TeamFeed";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    FolderOpen,
    Users,
    UserCircle,
    Clock,
    Bell,
    ChevronLeft,
    ChevronRight,
    History,
    TrendingUp,
    Calendar,
    AlertTriangle,
    CheckCircle,
    Info,
    X,
    FileText,
    MessageSquare,
} from "lucide-react";

// TASK: move to environment config
const API_BASE = "http://localhost:4000/api";

const TOAST_DURATION_MS = 3000;

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
    clientType?: string;
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
    status?: string;
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

interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info";
}

// returns null instead of throwing so components can render even when api fails
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

// formats decimal hours to readable string (e.g., 2.5 -> "2h 30m")
const formatHoursDisplay = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return minutes === 0 ? `${wholeHours}h` : `${wholeHours}h ${minutes}m`;
};

// generates US federal holidays including floating holidays like thanksgiving
const getUSHolidays = (year: number): Record<string, string> => {
    const holidays: Record<string, string> = {
        [`${year}-01-01`]: "New Year's Day",
        [`${year}-07-04`]: "Independence Day",
        [`${year}-12-25`]: "Christmas Day",
        [`${year}-11-11`]: "Veterans Day",
    };

    // helper to get nth weekday of month (e.g., 3rd monday)
    const getNthWeekday = (y: number, month: number, weekday: number, n: number): string => {
        let count = 0;
        let date = new Date(y, month, 1);
        while (count < n) {
            if (date.getDay() === weekday) count++;
            if (count < n) date.setDate(date.getDate() + 1);
        }
        return `${y}-${String(month + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };

    // helper to get last weekday of month (e.g., last monday of may)
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

    const styles = {
        bg: isDark ? "bg-slate-950" : "bg-gray-50",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-600",
        textSubtle: isDark ? "text-slate-500" : "text-gray-400",
        card: isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200",
        cardHover: isDark ? "hover:bg-slate-800" : "hover:bg-gray-50",
        cardInner: isDark ? "bg-slate-800" : "bg-gray-100",
        input: isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900",
        divider: isDark ? "border-slate-700" : "border-gray-200",
        button: isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        buttonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
        chip: isDark ? "bg-slate-800 text-slate-200" : "bg-gray-100 text-gray-700",
    };

    const isAdmin = userRole === "admin";
    const isConsultant = userRole === "consultant";

    const [toasts, setToasts] = useState<Toast[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [hoursLogs, setHoursLogs] = useState<HoursLog[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        const id = `toast_${Date.now()}`;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_DURATION_MS);
    };

    const ToastIcon = ({ type }: { type: string }) => {
        if (type === "success") return <CheckCircle className="w-5 h-5 text-emerald-400" />;
        if (type === "error") return <AlertTriangle className="w-5 h-5 text-red-400" />;
        return <Info className="w-5 h-5 text-blue-400" />;
    };

    // TASK: consolidate api calls into shared data layer (react-query or custom context)
    // same calls are duplicated in navbar, sidebar, and other components
    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            // fetch and merge projects from api and localStorage (for offline capability)
            let projectsList: Project[] = [];
            const projectsResponse = await safeFetch(`${API_BASE}/projects`);
            if (projectsResponse?.data) projectsList = projectsResponse.data;

            const localProjects = JSON.parse(localStorage.getItem("timely_projects") || "[]");
            localProjects.forEach((lp: Project) => {
                if (!projectsList.find(p => p.projectId === lp.projectId)) projectsList.push(lp);
            });

            // TASK: this N+1 query should be a single batch api call
            for (const project of projectsList) {
                const details = await safeFetch(`${API_BASE}/project-details/${project.projectId}`);
                if (details?.data) {
                    project.dateCreated = details.data.dateCreated;
                    project.dateDue = details.data.dateDue;
                }
            }
            setProjects(projectsList);

            // fetch clients and merge with extended localStorage data (phone, notes, etc)
            let clientsList: Client[] = [];
            const clientsResponse = await safeFetch(`${API_BASE}/users-report`);
            if (clientsResponse?.data) clientsList = clientsResponse.data;
            const extendedData = JSON.parse(localStorage.getItem("timely_clients_extended") || "{}");
            clientsList = clientsList.map(c => ({ ...c, ...extendedData[c.customerId] }));
            setClients(clientsList);

            // fetch consultants
            let consultantsList: Consultant[] = [];
            const consultantsResponse = await safeFetch(`${API_BASE}/consultants`);
            if (consultantsResponse?.data) consultantsList = consultantsResponse.data;
            setConsultants(consultantsList);

            // fetch hours logs
            const hoursResponse = await safeFetch(`${API_BASE}/hours-logs`);
            if (hoursResponse?.data) setHoursLogs(hoursResponse.data);

            // fetch audit logs for activity feed
            const auditResponse = await safeFetch(`${API_BASE}/audit-logs/latest?limit=10`);
            if (auditResponse?.data) {
                setActivities(auditResponse.data.map((log: any, i: number) => ({
                    id: i,
                    user: log.performedBy || "System",
                    action: log.actionType?.toLowerCase().replace(/_/g, " ") || "action",
                    target: log.details || log.entityId,
                    timestamp: formatRelativeTime(log.timestamp),
                    color: log.actionType?.includes("DELETE") ? "text-red-400" : "text-emerald-400",
                })));
            }

            generateAlerts(projectsList, clientsList, consultantsList);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // generates contextual alerts based on data state and user role
    // alerts are limited to 5 most important items to avoid overwhelming user
    const generateAlerts = (projectsList: Project[], clientsList: Client[], consultantsList: Consultant[]) => {
        const newAlerts: Alert[] = [];
        const today = new Date();

        // admin-only: system health alerts for empty states
        if (isAdmin) {
            if (clientsList.length === 0) {
                newAlerts.push({ id: 900, type: "warning", message: "No clients in the system yet. Add clients to get started.", time: "Action needed", color: "text-amber-500", page: "admin" });
            }
            if (consultantsList.length === 0) {
                newAlerts.push({ id: 901, type: "warning", message: "No consultants registered. Invite consultants using Create Account.", time: "Action needed", color: "text-amber-500", page: "EmailGenerator" });
            }
        }

        // project deadline alerts (overdue and upcoming within 7 days)
        projectsList.forEach((p, i) => {
            if (p.dateDue && p.status !== "completed") {
                const daysUntilDue = Math.ceil((new Date(p.dateDue).getTime() - today.getTime()) / 86400000);
                if (daysUntilDue < 0) {
                    newAlerts.push({ id: i, type: "overdue", message: `"${p.projectName}" overdue by ${Math.abs(daysUntilDue)} days`, time: `Due: ${p.dateDue}`, color: "text-red-500", page: "projects" });
                } else if (daysUntilDue <= 7) {
                    newAlerts.push({ id: i + 100, type: "deadline", message: `"${p.projectName}" due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`, time: `Due: ${p.dateDue}`, color: "text-amber-500", page: "projects" });
                }
            }
        });

        // client follow-up reminders
        clientsList.forEach((c, i) => {
            if (c.nextFollowUp) {
                const days = Math.ceil((new Date(c.nextFollowUp).getTime() - today.getTime()) / 86400000);
                if (days <= 0) {
                    newAlerts.push({ id: i + 200, type: "followup", message: `Follow up with ${c.firstName} ${c.lastName}`, time: days === 0 ? "Today" : `${Math.abs(days)} days overdue`, color: "text-cyan-500", page: "client" });
                }
            }
        });

        // new leads aggregated into single alert
        const newLeadsCount = clientsList.filter(c => c.status === "new_lead").length;
        if (newLeadsCount > 0) {
            newAlerts.push({ id: 998, type: "leads", message: `${newLeadsCount} new lead${newLeadsCount > 1 ? "s" : ""} awaiting contact`, time: "Action needed", color: "text-emerald-500", page: "client" });
        }

        // consultant-only: hours logging reminder if none logged this week
        if (isConsultant) {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            weekStart.setHours(0, 0, 0, 0);
            const myHoursThisWeek = hoursLogs.filter(h => new Date(h.date) >= weekStart && (h.consultantEmail || "").toLowerCase() === userEmail?.toLowerCase());
            if (myHoursThisWeek.length === 0) {
                newAlerts.push({ id: 999, type: "hours", message: "You haven't logged any hours this week", time: "Reminder", color: "text-amber-500", page: "hours" });
            }
        }

        setAlerts(newAlerts.slice(0, 5));
    };

    // key metrics for stats cards
    const stats = useMemo(() => {
        const active = projects.filter(p => p.status === "active").length;
        const completed = projects.filter(p => p.status === "completed").length;
        const total = projects.length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekHours = hoursLogs.filter(l => new Date(l.date) >= weekStart).reduce((s, l) => s + l.hours, 0);

        return { active, completed, total, progress, clients: clients.length, consultants: consultants.length, totalHours: hoursLogs.reduce((s, l) => s + l.hours, 0), weekHours };
    }, [projects, clients, consultants, hoursLogs]);

    // calendar data
    const holidays = useMemo(() => getUSHolidays(currentDate.getFullYear()), [currentDate]);

    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfWeek = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: (number | null)[] = [];
        for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
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
    const hasFollowUp = (day: number | null): boolean => day ? clients.some(c => c.nextFollowUp === getDateStr(day)) : false;
    const isHoliday = (day: number | null): string | false => day ? holidays[getDateStr(day)] || false : false;

    // recent data for sidebar widgets
    const recentProjects = useMemo(() => projects.filter(p => p.status === "active").slice(0, 4), [projects]);
    const recentClients = useMemo(() => [...clients].sort((a, b) => (b.lastContactDate || "").localeCompare(a.lastContactDate || "")).slice(0, 4), [clients]);

    // quick actions differ by role: admins get system management, consultants get personal workflow
    const quickActions = useMemo(() => {
        if (isAdmin) {
            return [
                { label: "New Project", page: "projects", color: "bg-blue-600 hover:bg-blue-700", icon: FolderOpen },
                { label: "Add Client", page: "admin", color: "bg-purple-600 hover:bg-purple-700", icon: Users },
                { label: "Create Account", page: "EmailGenerator", color: "bg-emerald-600 hover:bg-emerald-700", icon: UserCircle },
                { label: "Review Hours", page: "hours", color: "bg-amber-500 hover:bg-amber-600", icon: Clock },
            ];
        }
        if (isConsultant) {
            return [
                { label: "Log Hours", page: "hours", color: "bg-emerald-600 hover:bg-emerald-700", icon: Clock },
                { label: "My Projects", page: "projects", color: "bg-blue-600 hover:bg-blue-700", icon: FolderOpen },
                { label: "My Clients", page: "client", color: "bg-purple-600 hover:bg-purple-700", icon: Users },
            ];
        }
        return [
            { label: "View Projects", page: "projects", color: "bg-blue-600 hover:bg-blue-700", icon: FolderOpen },
            { label: "Upload Documents", page: "settings", color: "bg-purple-600 hover:bg-purple-700", icon: FileText },
            { label: "Contact Support", page: "settings", color: "bg-emerald-600 hover:bg-emerald-700", icon: MessageSquare },
        ];
    }, [isAdmin, isConsultant]);

    // user display info
    const roleLabel = isAdmin ? "Admin" : isConsultant ? "Consultant" : "Client";
    const firstName = userName?.split(" ")[0] || "User";
    const initials = (userName || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    const welcomeMessage = isAdmin ? "Review activity across clients, consultants, and projects." : isConsultant ? "Here's a snapshot of your projects, clients, and hours." : "Track your projects and stay connected with your consultant.";

    const today = new Date();
    const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
    const monthName = today.toLocaleDateString("en-US", { month: "long" });

    const handleNavigate = (page: string) => { if (onNavigate) onNavigate(page); };

    return (
        <div className={`${styles.bg} ${styles.text}`}>
            {/* toast notifications */}
            <div className="fixed top-20 right-4 z-[10000] space-y-2">
                {toasts.map(t => (
                    <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${styles.card}`}>
                        <ToastIcon type={t.type} />
                        <span>{t.message}</span>
                        <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className={styles.textMuted}><X className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>

            <div className="px-6 pb-10 max-w-7xl mx-auto">
                {/* header: date, greeting, user chip */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
                    <div>
                        <p className={`text-sm ${styles.textSubtle}`}>{dayName}, {monthName} {today.getDate()}</p>
                        <h1 className={`text-3xl font-bold ${styles.text}`}>Dashboard</h1>
                        <p className={`mt-1 text-sm ${styles.textMuted}`}>Welcome back, <span className="font-semibold">{firstName}</span>. {welcomeMessage}</p>
                    </div>
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${styles.card}`}>
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-semibold">{initials}</div>
                        <div>
                            <p className={`text-sm font-medium ${styles.text}`}>{userName}</p>
                            <p className={`text-xs ${styles.textSubtle}`}>{roleLabel}{userEmail ? ` • ${userEmail}` : ""}</p>
                        </div>
                    </div>
                </div>

                {/* stats cards: clickable to navigate to detail pages */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: "Projects", value: stats.total, sub: `${stats.active} active`, icon: FolderOpen, color: "text-blue-500", bgColor: "bg-blue-600/10", page: "projects" },
                        { label: "Clients", value: stats.clients, sub: "Total clients", icon: Users, color: "text-purple-500", bgColor: "bg-purple-600/10", page: "client" },
                        { label: "Consultants", value: stats.consultants, sub: "Team members", icon: UserCircle, color: "text-emerald-500", bgColor: "bg-emerald-600/10", page: "consultants" },
                        { label: "Hours", value: formatHoursDisplay(stats.weekHours), sub: "This week", icon: Clock, color: "text-amber-500", bgColor: "bg-amber-500/10", page: "hours" },
                    ].map((stat, i) => (
                        <div key={i} onClick={() => handleNavigate(stat.page)} className={`${styles.card} border rounded-xl p-5 cursor-pointer ${styles.cardHover} transition-colors`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-10 h-10 rounded-xl ${stat.bgColor} ${stat.color} flex items-center justify-center`}><stat.icon className="w-5 h-5" /></div>
                                <span className={`text-2xl font-bold ${styles.text}`}>{stat.value}</span>
                            </div>
                            <p className={`text-sm font-medium ${styles.text}`}>{stat.label}</p>
                            <p className={`text-xs ${styles.textMuted}`}>{stat.sub}</p>
                        </div>
                    ))}
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* main column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* alerts: shows overdue projects, follow-ups, and system warnings */}
                        <section className={`${styles.card} border rounded-xl p-5`}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className={`font-semibold flex items-center gap-2 ${styles.text}`}><Bell className="w-5 h-5 text-amber-500" />Alerts</h2>
                                <span className={`text-sm ${styles.textMuted}`}>{alerts.length === 0 ? "All caught up" : `${alerts.length} active`}</span>
                            </div>
                            {alerts.length === 0 ? (
                                <div className={`flex flex-col items-center justify-center gap-2 py-6 rounded-xl ${styles.cardInner}`}>
                                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                                    <p className={styles.textMuted}>No alerts right now</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {alerts.map(a => (
                                        <div key={a.id} onClick={() => a.page && handleNavigate(a.page)} className={`flex items-start gap-3 p-3 rounded-lg ${styles.cardInner} cursor-pointer ${styles.cardHover} transition-colors`}>
                                            <AlertTriangle className={`w-5 h-5 ${a.color} mt-0.5 flex-shrink-0`} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm ${styles.text}`}>{a.message}</p>
                                                <p className={`text-xs ${styles.textMuted}`}>{a.time}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* quick actions: role-specific shortcuts */}
                        <section className={`${styles.card} border rounded-xl p-5`}>
                            <h2 className={`font-semibold mb-4 ${styles.text}`}>Quick Actions</h2>
                            <div className={`grid ${quickActions.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"} gap-3`}>
                                {quickActions.map((action, i) => (
                                    <button key={i} onClick={() => handleNavigate(action.page)} className={`${action.color} text-white rounded-lg p-4 hover:opacity-90 transition-opacity flex flex-col items-center justify-center gap-2`}>
                                        <action.icon className="w-5 h-5" />
                                        <p className="text-sm font-medium">{action.label}</p>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* progress: project completion rate and weekly focus */}
                        <section className={`${styles.card} border rounded-xl p-5`}>
                            <h2 className={`font-semibold mb-4 flex items-center gap-2 ${styles.text}`}><TrendingUp className="w-5 h-5 text-emerald-500" />Progress</h2>
                            <div className="mb-4">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className={styles.textMuted}>Project Completion</span>
                                    <span className={styles.text}>{stats.progress}%</span>
                                </div>
                                <div className={`w-full h-2 ${styles.cardInner} rounded-full overflow-hidden`}>
                                    <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${stats.progress}%` }} />
                                </div>
                                <div className={`flex justify-between text-xs mt-2 ${styles.textMuted}`}>
                                    <span>{stats.completed} completed</span>
                                    <span>{stats.total} total</span>
                                </div>
                            </div>
                            <div className={`mt-4 pt-4 border-t ${styles.divider}`}>
                                <h3 className={`text-sm font-medium mb-2 ${styles.text}`}>This week's focus</h3>
                                <p className={`text-sm ${styles.textMuted} mb-3`}>
                                    {isAdmin ? "Review hours logged by consultants and ensure active projects are progressing." : isConsultant ? "Log your time daily and keep project notes up to date." : "Check your project updates and upload any requested documents."}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <span className={`px-2.5 py-1 rounded-full text-xs ${styles.chip}`}><Clock className="w-3 h-3 inline mr-1" />{formatHoursDisplay(stats.weekHours)} this week</span>
                                    <span className={`px-2.5 py-1 rounded-full text-xs ${styles.chip}`}><FolderOpen className="w-3 h-3 inline mr-1" />{stats.active} active projects</span>
                                </div>
                            </div>
                        </section>

                        {/* recent activity: audit log of system actions */}
                        <section className={`${styles.card} border rounded-xl p-5`}>
                            <h2 className={`font-semibold mb-4 flex items-center gap-2 ${styles.text}`}><History className="w-5 h-5" />Recent Activity</h2>
                            {activities.length === 0 ? (
                                <p className={`text-center py-6 ${styles.textMuted}`}>No recent activity</p>
                            ) : (
                                <div className={`divide-y ${styles.divider}`}>
                                    {activities.slice(0, 5).map(a => (
                                        <div key={a.id} className="py-3 flex items-start gap-3">
                                            <div className={`w-2 h-2 rounded-full mt-2 ${a.color === "text-red-400" ? "bg-red-400" : "bg-emerald-400"}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm ${styles.text}`}><span className="font-medium">{a.user}</span> {a.action}</p>
                                                <p className={`text-xs ${styles.textMuted} truncate`}>{a.target}</p>
                                            </div>
                                            <span className={`text-xs ${styles.textSubtle} flex-shrink-0`}>{a.timestamp}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* right column */}
                    <div className="space-y-6">
                        {/* calendar: highlights holidays, deadlines, and follow-ups */}
                        <section className={`${styles.card} border rounded-xl p-5`}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className={`font-semibold flex items-center gap-2 ${styles.text}`}><Calendar className="w-5 h-5 text-blue-500" />Calendar</h2>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className={`p-1 rounded ${styles.cardHover}`}><ChevronLeft className="w-4 h-4" /></button>
                                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className={`p-1 rounded ${styles.cardHover}`}><ChevronRight className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <p className={`text-sm ${styles.textMuted} mb-3`}>{currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                    <div key={i} className={`text-center text-xs ${styles.textSubtle} py-1`}>{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((day, i) => (
                                    <div key={i} onClick={() => day && setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))} className={`aspect-square flex items-center justify-center text-xs rounded relative cursor-pointer transition-colors ${!day ? "" : isToday(day) ? "bg-blue-600 text-white font-bold" : `${styles.cardInner} ${styles.cardHover}`}`}>
                                        {day}
                                        {day && (hasDeadline(day) || hasFollowUp(day) || isHoliday(day)) && (
                                            <div className="absolute bottom-0.5 flex gap-0.5">
                                                {isHoliday(day) && <div className="w-1 h-1 bg-red-500 rounded-full" />}
                                                {hasDeadline(day) && <div className="w-1 h-1 bg-amber-400 rounded-full" />}
                                                {hasFollowUp(day) && <div className="w-1 h-1 bg-cyan-400 rounded-full" />}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className={`mt-3 pt-3 border-t ${styles.divider} flex justify-center gap-4 text-xs ${styles.textMuted}`}>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full" />Holiday</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-amber-400 rounded-full" />Due</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-cyan-400 rounded-full" />Follow-up</span>
                            </div>
                        </section>

                        {/* active projects widget */}
                        <section className={`${styles.card} border rounded-xl p-5`}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className={`font-semibold ${styles.text}`}>Active Projects</h2>
                                <button onClick={() => handleNavigate("projects")} className="text-sm text-blue-500 hover:underline">View All</button>
                            </div>
                            {recentProjects.length === 0 ? (
                                <p className={`text-center py-4 ${styles.textMuted}`}>No active projects</p>
                            ) : (
                                <div className="space-y-3">
                                    {recentProjects.map(p => (
                                        <div key={p.projectId} onClick={() => handleNavigate("projects")} className={`p-3 rounded-lg ${styles.cardInner} cursor-pointer ${styles.cardHover} transition-colors`}>
                                            <p className={`text-sm font-medium ${styles.text} truncate`}>{p.projectName}</p>
                                            <p className={`text-xs ${styles.textMuted}`}>{p.dateDue ? `Due: ${p.dateDue}` : "No deadline"}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* recent clients widget */}
                        <section className={`${styles.card} border rounded-xl p-5`}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className={`font-semibold ${styles.text}`}>Recent Clients</h2>
                                <button onClick={() => handleNavigate("client")} className="text-sm text-blue-500 hover:underline">View All</button>
                            </div>
                            {recentClients.length === 0 ? (
                                <p className={`text-center py-4 ${styles.textMuted}`}>No clients yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {recentClients.map(c => (
                                        <div key={c.customerId} onClick={() => handleNavigate("client")} className={`flex items-center gap-3 p-3 rounded-lg ${styles.cardInner} cursor-pointer ${styles.cardHover} transition-colors`}>
                                            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium">{c.firstName[0]}{c.lastName[0]}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium ${styles.text} truncate`}>{c.firstName} {c.lastName}</p>
                                                <p className={`text-xs ${styles.textMuted}`}>{(c.status || "new_lead").replace("_", " ")}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                </div>

                {/* team feed: social feed for team communication */}
                <div className="mt-6">
                    <TeamFeed userName={userName || "User"} userEmail={userEmail || ""} userRole={userRole} maxPosts={10} />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;