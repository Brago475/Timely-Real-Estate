// src/Tabs/reports.tsx
// reports page with completely separate admin and consultant views
// admin: KPIs, audit log, charts, detailed drill-down table
// consultant: personal KPIs, hours breakdown, weekly/monthly trends, assigned projects

import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    BarChart2,
    Users,
    Clock,
    FolderOpen,
    AlertCircle,
    CheckCircle,
    Info,
    X,
    Calendar,
    TrendingUp,
    Filter,
    Download,
    RefreshCw,
    PieChart,
    Activity,
    Briefcase,
    AlertTriangle,
    PlayCircle,
    Timer,
    UserCheck,
    FileText,
    UserPlus,
    Trash2,
    Edit,
    ChevronDown,
    ChevronRight,
    Search,
} from "lucide-react";

// TASK: move to environment config
const API_BASE = "http://localhost:4000/api";

type UserRole = "admin" | "consultant" | "client";

interface AuditLog {
    logId: string;
    timestamp: string;
    actionType: string;
    entityType: string;
    entityId: string;
    performedBy: string;
    details: string;
}

interface Project {
    projectId: string;
    projectCode?: string;
    projectName: string;
    clientName?: string;
    status: string;
    dateCreated?: string;
    dateDue?: string;
}

interface HoursLog {
    logId: string;
    projectId: string;
    consultantId: string;
    consultantEmail?: string;
    date: string;
    hours: number;
    description: string;
    createdAt?: string;
}

interface Consultant {
    consultantId: string;
    consultantCode?: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
    status?: string;
}

interface Client {
    customerId: string;
    clientCode?: string;
    firstName: string;
    lastName: string;
    email: string;
}

interface ProjectConsultant {
    consultantId: string;
    projectId: string;
}

interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info";
}

const TOAST_DURATION_MS = 3000;

// project status colors
const STATUS_COLORS: Record<string, { bg: string; text: string; fill: string }> = {
    planned: { bg: "bg-slate-500/10", text: "text-slate-500", fill: "#64748b" },
    active: { bg: "bg-emerald-500/10", text: "text-emerald-500", fill: "#10b981" },
    "in progress": { bg: "bg-blue-500/10", text: "text-blue-500", fill: "#3b82f6" },
    completed: { bg: "bg-green-500/10", text: "text-green-500", fill: "#22c55e" },
    "on hold": { bg: "bg-amber-500/10", text: "text-amber-500", fill: "#f59e0b" },
    overdue: { bg: "bg-red-500/10", text: "text-red-500", fill: "#ef4444" },
};

// audit action type display config
const ACTION_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
    CREATE_PROJECT: { label: "Project Created", color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    DELETE_PROJECT: { label: "Project Deleted", color: "text-red-500", bgColor: "bg-red-500/10" },
    UPDATE_PROJECT: { label: "Project Updated", color: "text-blue-500", bgColor: "bg-blue-500/10" },
    CREATE_CLIENT: { label: "Client Added", color: "text-purple-500", bgColor: "bg-purple-500/10" },
    DELETE_CLIENT: { label: "Client Removed", color: "text-red-500", bgColor: "bg-red-500/10" },
    CREATE_CONSULTANT: { label: "Consultant Added", color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
    DELETE_CONSULTANT: { label: "Consultant Removed", color: "text-red-500", bgColor: "bg-red-500/10" },
    LOG_HOURS: { label: "Hours Logged", color: "text-amber-500", bgColor: "bg-amber-500/10" },
    ASSIGN_PROJECT: { label: "Project Assigned", color: "text-blue-500", bgColor: "bg-blue-500/10" },
    ASSIGN_CONSULTANT: { label: "Consultant Assigned", color: "text-indigo-500", bgColor: "bg-indigo-500/10" },
    SEND_EMAIL: { label: "Email Sent", color: "text-pink-500", bgColor: "bg-pink-500/10" },
};

const safeFetch = async (url: string) => {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) return null;
        return await res.json();
    } catch {
        return null;
    }
};

const getCurrentUser = (): { role: UserRole; email: string; name: string; consultantId?: string } => {
    try {
        const raw = localStorage.getItem("timely_user");
        if (!raw) return { role: "admin", email: "", name: "" };
        const parsed = JSON.parse(raw);
        const r = (parsed.role || "").toLowerCase();
        const role: UserRole = r === "admin" || r === "consultant" || r === "client" ? r : "admin";
        return { role, email: parsed.email || "", name: parsed.name || "", consultantId: parsed.consultantId };
    } catch {
        return { role: "admin", email: "", name: "" };
    }
};


const ReportsTab: React.FC = () => {
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
        tableHeader: isDark ? "bg-slate-800" : "bg-gray-100",
        tableRow: isDark ? "border-slate-700 hover:bg-slate-800/50" : "border-gray-200 hover:bg-gray-50",
    };

    const { role: userRole, email: currentEmail, name: currentName } = useMemo(() => getCurrentUser(), []);
    const isAdmin = userRole === "admin";
    const isConsultant = userRole === "consultant";

    const [toasts, setToasts] = useState<Toast[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // data state - all from API, no localStorage
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [hoursLogs, setHoursLogs] = useState<HoursLog[]>([]);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [projectConsultants, setProjectConsultants] = useState<ProjectConsultant[]>([]);

    // filter state
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
    const [filterConsultant, setFilterConsultant] = useState<string>("all");
    const [filterClient, setFilterClient] = useState<string>("all");
    const [filterProject, setFilterProject] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    // audit log filter state
    const [auditSearch, setAuditSearch] = useState("");
    const [auditActionFilter, setAuditActionFilter] = useState("all");
    const [showAuditLog, setShowAuditLog] = useState(true);

    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        const id = `toast_${Date.now()}`;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_DURATION_MS);
    };

    const ToastIcon = ({ type }: { type: string }) => {
        if (type === "success") return <CheckCircle className="w-5 h-5 text-emerald-400" />;
        if (type === "error") return <AlertCircle className="w-5 h-5 text-red-400" />;
        return <Info className="w-5 h-5 text-blue-400" />;
    };

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setIsLoading(true);
        try {
            // fetch all data fresh from API - no localStorage
            const [auditRes, projectsRes, hoursRes, consultantsRes, clientsRes, pcRes] = await Promise.all([
                safeFetch(`${API_BASE}/audit-logs/latest?limit=100`),
                safeFetch(`${API_BASE}/projects`),
                safeFetch(`${API_BASE}/hours-logs`),
                safeFetch(`${API_BASE}/consultants`),
                safeFetch(`${API_BASE}/users-report`),
                safeFetch(`${API_BASE}/project-consultants`),
            ]);

            if (auditRes?.data) setAuditLogs(auditRes.data.reverse());
            if (projectsRes?.data) {
                let projectsList = projectsRes.data;
                for (const project of projectsList) {
                    const details = await safeFetch(`${API_BASE}/project-details/${project.projectId}`);
                    if (details?.data) {
                        project.dateCreated = details.data.dateCreated;
                        project.dateDue = details.data.dateDue;
                    }
                }
                setProjects(projectsList);
            }
            if (hoursRes?.data) setHoursLogs(hoursRes.data);
            if (consultantsRes?.data) setConsultants(consultantsRes.data);
            if (clientsRes?.data) setClients(clientsRes.data);
            if (pcRes?.data) setProjectConsultants(pcRes.data);
        } catch (error) {
            console.error("Error loading report data:", error);
            showToast("Failed to load report data", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadAllData();
        setIsRefreshing(false);
        showToast("Data refreshed", "success");
    };

    const clearFilters = () => {
        setDateRange({ start: "", end: "" });
        setFilterConsultant("all");
        setFilterClient("all");
        setFilterProject("all");
        setFilterStatus("all");
    };

    // filter hours logs
    const filteredHoursLogs = useMemo(() => {
        let filtered = [...hoursLogs];
        if (dateRange.start) filtered = filtered.filter(h => h.date >= dateRange.start);
        if (dateRange.end) filtered = filtered.filter(h => h.date <= dateRange.end);
        if (filterConsultant !== "all") filtered = filtered.filter(h => (h.consultantEmail || "").toLowerCase() === filterConsultant.toLowerCase());
        if (filterProject !== "all") filtered = filtered.filter(h => h.projectId === filterProject);
        return filtered;
    }, [hoursLogs, dateRange, filterConsultant, filterProject]);

    // filter projects
    const filteredProjects = useMemo(() => {
        let filtered = [...projects];
        if (filterClient !== "all") filtered = filtered.filter(p => (p.clientName || "").toLowerCase().includes(filterClient.toLowerCase()));
        if (filterStatus !== "all") filtered = filtered.filter(p => getProjectStatus(p).toLowerCase() === filterStatus.toLowerCase());
        return filtered;
    }, [projects, filterClient, filterStatus]);

    // filter audit logs
    const filteredAuditLogs = useMemo(() => {
        let filtered = [...auditLogs];
        if (auditSearch.trim()) {
            const q = auditSearch.toLowerCase();
            filtered = filtered.filter(log => log.details.toLowerCase().includes(q) || log.performedBy.toLowerCase().includes(q) || log.entityId.toLowerCase().includes(q));
        }
        if (auditActionFilter !== "all") filtered = filtered.filter(log => log.actionType === auditActionFilter);
        return filtered;
    }, [auditLogs, auditSearch, auditActionFilter]);

    const getProjectStatus = (project: Project): string => {
        if (project.status === "completed") return "completed";
        if (project.dateDue && new Date(project.dateDue) < new Date() && project.status !== "completed") return "overdue";
        return project.status || "active";
    };

    // ADMIN KPIs - calculated from filtered data
    const adminKPIs = useMemo(() => {
        if (!isAdmin) return null;
        const totalHours = filteredHoursLogs.reduce((sum, h) => sum + (Number(h.hours) || 0), 0);
        const activeProjects = filteredProjects.filter(p => p.status === "active" || p.status === "in progress").length;
        const completedProjects = filteredProjects.filter(p => p.status === "completed").length;
        const activeConsultants = consultants.filter(c => c.status !== "inactive").length;
        const overdueProjects = filteredProjects.filter(p => getProjectStatus(p) === "overdue").length;
        const avgHoursPerConsultant = activeConsultants > 0 ? totalHours / activeConsultants : 0;
        return { totalHours, activeProjects, completedProjects, activeConsultants, overdueProjects, avgHoursPerConsultant };
    }, [isAdmin, filteredHoursLogs, filteredProjects, consultants]);

    // chart data: hours per consultant
    const hoursPerConsultant = useMemo(() => {
        if (!isAdmin) return [];
        const map = new Map<string, { name: string; email: string; hours: number }>();
        filteredHoursLogs.forEach(log => {
            const email = (log.consultantEmail || "unknown").toLowerCase();
            const consultant = consultants.find(c => c.email.toLowerCase() === email);
            const name = consultant ? `${consultant.firstName} ${consultant.lastName}` : email;
            const existing = map.get(email) || { name, email, hours: 0 };
            existing.hours += Number(log.hours) || 0;
            map.set(email, existing);
        });
        return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
    }, [isAdmin, filteredHoursLogs, consultants]);

    // chart data: hours per project
    const hoursPerProject = useMemo(() => {
        if (!isAdmin) return [];
        const map = new Map<string, { name: string; projectId: string; hours: number }>();
        filteredHoursLogs.forEach(log => {
            const project = projects.find(p => p.projectId === log.projectId);
            const name = project?.projectName || `Project ${log.projectId}`;
            const existing = map.get(log.projectId) || { name, projectId: log.projectId, hours: 0 };
            existing.hours += Number(log.hours) || 0;
            map.set(log.projectId, existing);
        });
        return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
    }, [isAdmin, filteredHoursLogs, projects]);

    // chart data: hours per client
    const hoursPerClient = useMemo(() => {
        if (!isAdmin) return [];
        const map = new Map<string, { name: string; hours: number }>();
        filteredHoursLogs.forEach(log => {
            const project = projects.find(p => p.projectId === log.projectId);
            const clientName = project?.clientName || "Unassigned";
            const existing = map.get(clientName) || { name: clientName, hours: 0 };
            existing.hours += Number(log.hours) || 0;
            map.set(clientName, existing);
        });
        return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
    }, [isAdmin, filteredHoursLogs, projects]);

    // chart data: project status distribution
    const projectStatusDistribution = useMemo(() => {
        if (!isAdmin) return [];
        const counts: Record<string, number> = { planned: 0, active: 0, "in progress": 0, completed: 0, "on hold": 0, overdue: 0 };
        filteredProjects.forEach(p => {
            const status = getProjectStatus(p).toLowerCase();
            if (counts[status] !== undefined) counts[status]++;
            else counts.active++;
        });
        return Object.entries(counts).filter(([_, count]) => count > 0).map(([status, count]) => ({ status, count }));
    }, [isAdmin, filteredProjects]);

    // chart data: consultant workload
    const consultantWorkload = useMemo(() => {
        if (!isAdmin) return [];
        return consultants.map(c => {
            const email = c.email.toLowerCase();
            const hours = filteredHoursLogs.filter(h => (h.consultantEmail || "").toLowerCase() === email).reduce((sum, h) => sum + (Number(h.hours) || 0), 0);
            const assignedProjects = projectConsultants.filter(pc => pc.consultantId === c.consultantId).length;
            return { name: `${c.firstName} ${c.lastName}`, email, hours, projects: assignedProjects };
        }).sort((a, b) => b.hours - a.hours);
    }, [isAdmin, consultants, filteredHoursLogs, projectConsultants]);

    // client activity data
    const clientActivity = useMemo(() => {
        if (!isAdmin) return [];
        const clientMap = new Map<string, { name: string; projects: number; hours: number; completed: number; total: number }>();
        filteredProjects.forEach(p => {
            const clientName = p.clientName || "Unassigned";
            const existing = clientMap.get(clientName) || { name: clientName, projects: 0, hours: 0, completed: 0, total: 0 };
            existing.projects++;
            existing.total++;
            if (p.status === "completed") existing.completed++;
            clientMap.set(clientName, existing);
        });
        filteredHoursLogs.forEach(log => {
            const project = projects.find(p => p.projectId === log.projectId);
            const clientName = project?.clientName || "Unassigned";
            const existing = clientMap.get(clientName);
            if (existing) existing.hours += Number(log.hours) || 0;
        });
        return Array.from(clientMap.values()).map(c => ({ ...c, completionRate: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0 })).sort((a, b) => b.hours - a.hours);
    }, [isAdmin, filteredProjects, filteredHoursLogs, projects]);

    // detailed table data
    const detailedTableData = useMemo(() => {
        if (!isAdmin) return [];
        return filteredProjects.map(p => {
            const projectHours = filteredHoursLogs.filter(h => h.projectId === p.projectId);
            const totalHours = projectHours.reduce((sum, h) => sum + (Number(h.hours) || 0), 0);
            const consultantEmails = [...new Set(projectHours.map(h => h.consultantEmail))];
            const consultantNames = consultantEmails.map(email => {
                const c = consultants.find(con => con.email.toLowerCase() === (email || "").toLowerCase());
                return c ? `${c.firstName} ${c.lastName}` : email;
            }).filter(Boolean).join(", ");
            const lastActivity = projectHours.length > 0 ? projectHours.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date : null;
            return { projectId: p.projectId, projectName: p.projectName, clientName: p.clientName || "Unassigned", consultants: consultantNames || "None", hoursLogged: totalHours, status: getProjectStatus(p), lastActivity };
        }).sort((a, b) => b.hoursLogged - a.hoursLogged);
    }, [isAdmin, filteredProjects, filteredHoursLogs, consultants]);

    // CONSULTANT: my hours
    const myHoursLogs = useMemo(() => {
        if (!isConsultant || !currentEmail) return [];
        return hoursLogs.filter(h => (h.consultantEmail || "").toLowerCase() === currentEmail.toLowerCase());
    }, [isConsultant, currentEmail, hoursLogs]);

    // CONSULTANT KPIs
    const consultantKPIs = useMemo(() => {
        if (!isConsultant) return null;
        const totalHours = myHoursLogs.reduce((sum, h) => sum + (Number(h.hours) || 0), 0);
        const myProjectIds = [...new Set(myHoursLogs.map(h => h.projectId))];
        const myProjects = projects.filter(p => myProjectIds.includes(p.projectId));
        const activeProjects = myProjects.filter(p => p.status === "active" || p.status === "in progress").length;
        const completedProjects = myProjects.filter(p => p.status === "completed").length;
        const totalEntries = myHoursLogs.length;

        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const thisWeekHours = myHoursLogs.filter(h => new Date(h.date) >= weekStart).reduce((sum, h) => sum + (Number(h.hours) || 0), 0);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthHours = myHoursLogs.filter(h => new Date(h.date) >= monthStart).reduce((sum, h) => sum + (Number(h.hours) || 0), 0);

        return { totalHours, activeProjects, completedProjects, totalEntries, thisWeekHours, thisMonthHours, totalProjects: myProjects.length };
    }, [isConsultant, myHoursLogs, projects]);

    // CONSULTANT: hours per project
    const myHoursPerProject = useMemo(() => {
        if (!isConsultant) return [];
        const map = new Map<string, { name: string; hours: number }>();
        myHoursLogs.forEach(log => {
            const project = projects.find(p => p.projectId === log.projectId);
            const name = project?.projectName || `Project ${log.projectId}`;
            const existing = map.get(log.projectId) || { name, hours: 0 };
            existing.hours += Number(log.hours) || 0;
            map.set(log.projectId, existing);
        });
        return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
    }, [isConsultant, myHoursLogs, projects]);

    // CONSULTANT: weekly trend
    const myWeeklyTrend = useMemo(() => {
        if (!isConsultant) return [];
        const weeks: { week: string; hours: number }[] = [];
        const now = new Date();
        for (let i = 7; i >= 0; i--) {
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() - (i * 7));
            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekStart.getDate() - 6);
            const weekHours = myHoursLogs.filter(h => {
                const date = new Date(h.date);
                return date >= weekStart && date <= weekEnd;
            }).reduce((sum, h) => sum + (Number(h.hours) || 0), 0);
            weeks.push({ week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`, hours: weekHours });
        }
        return weeks;
    }, [isConsultant, myHoursLogs]);

    // CONSULTANT: monthly trend
    const myMonthlyTrend = useMemo(() => {
        if (!isConsultant) return [];
        const months: { month: string; hours: number }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
            const monthName = monthDate.toLocaleDateString("en-US", { month: "short" });
            const monthHours = myHoursLogs.filter(h => {
                const date = new Date(h.date);
                return date >= monthDate && date <= monthEnd;
            }).reduce((sum, h) => sum + (Number(h.hours) || 0), 0);
            months.push({ month: monthName, hours: monthHours });
        }
        return months;
    }, [isConsultant, myHoursLogs]);

    // CONSULTANT: my projects
    const myAssignedProjects = useMemo(() => {
        if (!isConsultant) return [];
        const myProjectIds = [...new Set(myHoursLogs.map(h => h.projectId))];
        return projects.filter(p => myProjectIds.includes(p.projectId)).map(p => {
            const hours = myHoursLogs.filter(h => h.projectId === p.projectId).reduce((sum, h) => sum + (Number(h.hours) || 0), 0);
            return { ...p, myHours: hours, status: getProjectStatus(p) };
        });
    }, [isConsultant, myHoursLogs, projects]);

    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return "N/A";
        return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    const formatDateTime = (dateStr: string): string => {
        if (!dateStr) return "N/A";
        return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    };

    const getActionConfig = (actionType: string) => ACTION_CONFIG[actionType] || { label: actionType.replace(/_/g, " "), color: "text-slate-500", bgColor: "bg-slate-500/10" };

    const getActionIcon = (actionType: string) => {
        if (actionType.includes("CREATE")) return <UserPlus className="w-4 h-4" />;
        if (actionType.includes("DELETE")) return <Trash2 className="w-4 h-4" />;
        if (actionType.includes("UPDATE") || actionType.includes("EDIT")) return <Edit className="w-4 h-4" />;
        if (actionType.includes("LOG_HOURS")) return <Clock className="w-4 h-4" />;
        if (actionType.includes("ASSIGN")) return <Briefcase className="w-4 h-4" />;
        if (actionType.includes("EMAIL")) return <FileText className="w-4 h-4" />;
        return <Activity className="w-4 h-4" />;
    };

    const exportToCSV = (data: any[], filename: string) => {
        if (data.length === 0) { showToast("No data to export", "error"); return; }
        const headers = Object.keys(data[0]).join(",");
        const rows = data.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
        const csv = [headers, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Export complete", "success");
    };

    // bar chart component
    const BarChart: React.FC<{ data: { label: string; value: number }[]; maxItems?: number; color?: string }> = ({ data, maxItems = 8, color = "bg-blue-500" }) => {
        const items = data.slice(0, maxItems);
        const maxValue = Math.max(...items.map(d => d.value), 1);
        return (
            <div className="space-y-2">
                {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <span className={`text-xs ${styles.textMuted} w-24 truncate`} title={item.label}>{item.label}</span>
                        <div className="flex-1 h-6 bg-slate-700/30 rounded overflow-hidden">
                            <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${(item.value / maxValue) * 100}%` }} />
                        </div>
                        <span className={`text-xs font-medium ${styles.text} w-12 text-right`}>{item.value.toFixed(1)}h</span>
                    </div>
                ))}
            </div>
        );
    };

    // pie chart component
    const PieChartDisplay: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
        const total = data.reduce((sum, d) => sum + d.value, 0);
        if (total === 0) return <p className={`text-sm ${styles.textMuted}`}>No data</p>;
        let cumulativePercent = 0;
        const gradientStops = data.map(d => {
            const percent = (d.value / total) * 100;
            const start = cumulativePercent;
            cumulativePercent += percent;
            return `${d.color} ${start}% ${cumulativePercent}%`;
        }).join(", ");
        return (
            <div className="flex items-center gap-6">
                <div className="w-32 h-32 rounded-full" style={{ background: `conic-gradient(${gradientStops})` }} />
                <div className="space-y-1">
                    {data.map((d, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: d.color }} />
                            <span className={`text-xs ${styles.textMuted}`}>{d.label}: {d.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
        const config = STATUS_COLORS[status.toLowerCase()] || STATUS_COLORS.active;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
    };

    // client view
    if (userRole === "client") {
        return (
            <div className={`${styles.bg} min-h-screen`}>
                <div className="max-w-3xl mx-auto px-6 py-12">
                    <div className={`${styles.card} border rounded-xl p-6`}>
                        <div className="flex items-center gap-3 mb-3">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            <h1 className={`text-lg font-semibold ${styles.text}`}>Reports are for staff</h1>
                        </div>
                        <p className={styles.textMuted}>As a client, you don't see internal reports.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.bg} min-h-screen`}>
            {/* toast */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">
                {toasts.map(toast => (
                    <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${styles.card}`}>
                        <ToastIcon type={toast.type} />
                        <span className={styles.text}>{toast.message}</span>
                        <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className={styles.textMuted}><X className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>

            {/* header */}
            <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className={`text-2xl font-semibold ${styles.text}`}>Reports</h1>
                    <p className={styles.textMuted}>{isAdmin ? "System-wide analytics, audit log, and performance metrics" : "Your personal performance and activity summary"}</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"}`}>
                        <BarChart2 className="w-3 h-3 inline mr-1" />{isAdmin ? "Admin View" : "My Reports"}
                    </span>
                    <button onClick={handleRefresh} disabled={isRefreshing} className={`p-2 ${styles.button} rounded-lg disabled:opacity-50`}>
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* ADMIN VIEW */}
            {isAdmin && adminKPIs && (
                <>
                    {/* filters */}
                    <div className={`${styles.card} border rounded-xl p-4 mb-6`}>
                        <div className="flex items-center gap-2 mb-3">
                            <Filter className="w-4 h-4 text-blue-500" />
                            <span className={`text-sm font-medium ${styles.text}`}>Filters</span>
                            <button onClick={clearFilters} className={`ml-auto text-xs ${styles.textMuted} hover:text-blue-500`}>Clear All</button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            <div>
                                <label className={`text-xs ${styles.textMuted} block mb-1`}>Start Date</label>
                                <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className={`w-full px-2 py-1.5 text-sm ${styles.input} border rounded`} />
                            </div>
                            <div>
                                <label className={`text-xs ${styles.textMuted} block mb-1`}>End Date</label>
                                <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className={`w-full px-2 py-1.5 text-sm ${styles.input} border rounded`} />
                            </div>
                            <div>
                                <label className={`text-xs ${styles.textMuted} block mb-1`}>Consultant</label>
                                <select value={filterConsultant} onChange={e => setFilterConsultant(e.target.value)} className={`w-full px-2 py-1.5 text-sm ${styles.input} border rounded`}>
                                    <option value="all">All Consultants</option>
                                    {consultants.map(c => <option key={c.consultantId} value={c.email}>{c.firstName} {c.lastName}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={`text-xs ${styles.textMuted} block mb-1`}>Client</label>
                                <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className={`w-full px-2 py-1.5 text-sm ${styles.input} border rounded`}>
                                    <option value="all">All Clients</option>
                                    {[...new Set(projects.map(p => p.clientName).filter(Boolean))].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={`text-xs ${styles.textMuted} block mb-1`}>Project</label>
                                <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className={`w-full px-2 py-1.5 text-sm ${styles.input} border rounded`}>
                                    <option value="all">All Projects</option>
                                    {projects.map(p => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={`text-xs ${styles.textMuted} block mb-1`}>Status</label>
                                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`w-full px-2 py-1.5 text-sm ${styles.input} border rounded`}>
                                    <option value="all">All Statuses</option>
                                    <option value="active">Active</option>
                                    <option value="in progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="on hold">On Hold</option>
                                    <option value="overdue">Overdue</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* KPI cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                        <div className={`${styles.card} border rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-emerald-500" /><span className={`text-xs ${styles.textMuted}`}>Total Hours</span></div>
                            <p className={`text-2xl font-bold ${styles.text}`}>{adminKPIs.totalHours.toFixed(1)}</p>
                        </div>
                        <div className={`${styles.card} border rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-2"><PlayCircle className="w-4 h-4 text-blue-500" /><span className={`text-xs ${styles.textMuted}`}>Active Projects</span></div>
                            <p className={`text-2xl font-bold ${styles.text}`}>{adminKPIs.activeProjects}</p>
                        </div>
                        <div className={`${styles.card} border rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-4 h-4 text-green-500" /><span className={`text-xs ${styles.textMuted}`}>Completed</span></div>
                            <p className={`text-2xl font-bold ${styles.text}`}>{adminKPIs.completedProjects}</p>
                        </div>
                        <div className={`${styles.card} border rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-2"><UserCheck className="w-4 h-4 text-purple-500" /><span className={`text-xs ${styles.textMuted}`}>Active Consultants</span></div>
                            <p className={`text-2xl font-bold ${styles.text}`}>{adminKPIs.activeConsultants}</p>
                        </div>
                        <div className={`${styles.card} border rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-red-500" /><span className={`text-xs ${styles.textMuted}`}>Overdue</span></div>
                            <p className={`text-2xl font-bold ${adminKPIs.overdueProjects > 0 ? "text-red-500" : styles.text}`}>{adminKPIs.overdueProjects}</p>
                        </div>
                        <div className={`${styles.card} border rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-2"><Timer className="w-4 h-4 text-amber-500" /><span className={`text-xs ${styles.textMuted}`}>Avg Hrs/Consultant</span></div>
                            <p className={`text-2xl font-bold ${styles.text}`}>{adminKPIs.avgHoursPerConsultant.toFixed(1)}</p>
                        </div>
                    </div>

                    {/* audit log section */}
                    <div className={`${styles.card} border rounded-xl overflow-hidden mb-6`}>
                        <div className={`p-4 border-b ${styles.divider} flex items-center justify-between cursor-pointer`} onClick={() => setShowAuditLog(!showAuditLog)}>
                            <h3 className={`font-semibold flex items-center gap-2 ${styles.text}`}><Activity className="w-5 h-5 text-purple-500" />Audit Log</h3>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs ${styles.textMuted}`}>{filteredAuditLogs.length} entries</span>
                                <button onClick={(e) => { e.stopPropagation(); exportToCSV(filteredAuditLogs.map(l => ({ timestamp: l.timestamp, action: l.actionType, entity: l.entityId, user: l.performedBy, details: l.details })), "audit_log"); }} className={`p-1.5 ${styles.button} rounded`}><Download className="w-4 h-4" /></button>
                                {showAuditLog ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </div>
                        </div>
                        {showAuditLog && (
                            <>
                                <div className={`p-4 border-b ${styles.divider} flex flex-wrap gap-3`}>
                                    <div className="relative">
                                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${styles.textMuted}`} />
                                        <input type="text" placeholder="Search audit log..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} className={`pl-9 pr-3 py-1.5 text-sm ${styles.input} border rounded-lg w-64`} />
                                    </div>
                                    <select value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)} className={`px-3 py-1.5 text-sm ${styles.input} border rounded-lg`}>
                                        <option value="all">All Actions</option>
                                        {Object.entries(ACTION_CONFIG).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}
                                    </select>
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {filteredAuditLogs.length === 0 ? (
                                        <div className={`p-8 text-center ${styles.textMuted}`}><Activity className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No audit entries found</p></div>
                                    ) : (
                                        <div className={`divide-y ${styles.divider}`}>
                                            {filteredAuditLogs.slice(0, 50).map(log => {
                                                const config = getActionConfig(log.actionType);
                                                return (
                                                    <div key={log.logId} className={`p-4 ${styles.cardHover}`}>
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-8 h-8 rounded-lg ${config.bgColor} ${config.color} flex items-center justify-center flex-shrink-0`}>{getActionIcon(log.actionType)}</div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className={`text-sm font-medium ${styles.text}`}>{config.label}</span>
                                                                    <span className={`text-xs ${styles.textSubtle}`}>by {log.performedBy}</span>
                                                                </div>
                                                                <p className={`text-sm ${styles.textMuted} mt-1 truncate`}>{log.details}</p>
                                                                <p className={`text-xs ${styles.textSubtle} mt-1`}>{formatDateTime(log.timestamp)}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* charts row 1 */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-6">
                        <div className={`${styles.card} border rounded-xl p-5`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`font-semibold flex items-center gap-2 ${styles.text}`}><Users className="w-4 h-4 text-blue-500" />Hours per Consultant</h3>
                                <button onClick={() => exportToCSV(hoursPerConsultant.map(h => ({ consultant: h.name, hours: h.hours.toFixed(1) })), "hours_per_consultant")} className={`p-1.5 ${styles.button} rounded`}><Download className="w-4 h-4" /></button>
                            </div>
                            {hoursPerConsultant.length === 0 ? <p className={`text-sm ${styles.textMuted}`}>No hours logged</p> : <BarChart data={hoursPerConsultant.map(h => ({ label: h.name, value: h.hours }))} color="bg-blue-500" />}
                        </div>
                        <div className={`${styles.card} border rounded-xl p-5`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`font-semibold flex items-center gap-2 ${styles.text}`}><FolderOpen className="w-4 h-4 text-emerald-500" />Hours per Project</h3>
                                <button onClick={() => exportToCSV(hoursPerProject.map(h => ({ project: h.name, hours: h.hours.toFixed(1) })), "hours_per_project")} className={`p-1.5 ${styles.button} rounded`}><Download className="w-4 h-4" /></button>
                            </div>
                            {hoursPerProject.length === 0 ? <p className={`text-sm ${styles.textMuted}`}>No hours logged</p> : <BarChart data={hoursPerProject.map(h => ({ label: h.name, value: h.hours }))} color="bg-emerald-500" />}
                        </div>
                    </div>

                    {/* charts row 2 */}
                    <div className="grid lg:grid-cols-3 gap-6 mb-6">
                        <div className={`${styles.card} border rounded-xl p-5`}>
                            <h3 className={`font-semibold flex items-center gap-2 mb-4 ${styles.text}`}><PieChart className="w-4 h-4 text-purple-500" />Project Status</h3>
                            <PieChartDisplay data={projectStatusDistribution.map(d => ({ label: d.status.charAt(0).toUpperCase() + d.status.slice(1), value: d.count, color: STATUS_COLORS[d.status]?.fill || "#64748b" }))} />
                        </div>
                        <div className={`${styles.card} border rounded-xl p-5`}>
                            <h3 className={`font-semibold flex items-center gap-2 mb-4 ${styles.text}`}><Briefcase className="w-4 h-4 text-amber-500" />Consultant Workload</h3>
                            {consultantWorkload.length === 0 ? <p className={`text-sm ${styles.textMuted}`}>No data</p> : (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {consultantWorkload.slice(0, 6).map((c, i) => (
                                        <div key={i} className={`p-2 rounded ${styles.cardInner} flex items-center justify-between`}>
                                            <span className={`text-sm ${styles.text} truncate`}>{c.name}</span>
                                            <div className="flex items-center gap-3 text-xs">
                                                <span className={styles.textMuted}>{c.projects} projects</span>
                                                <span className="text-emerald-500 font-medium">{c.hours.toFixed(1)}h</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className={`${styles.card} border rounded-xl p-5`}>
                            <h3 className={`font-semibold flex items-center gap-2 mb-4 ${styles.text}`}><Users className="w-4 h-4 text-cyan-500" />Hours per Client</h3>
                            {hoursPerClient.length === 0 ? <p className={`text-sm ${styles.textMuted}`}>No hours logged</p> : <BarChart data={hoursPerClient.map(h => ({ label: h.name, value: h.hours }))} maxItems={6} color="bg-cyan-500" />}
                        </div>
                    </div>

                    {/* client activity */}
                    <div className={`${styles.card} border rounded-xl p-5 mb-6`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`font-semibold flex items-center gap-2 ${styles.text}`}><Activity className="w-4 h-4 text-pink-500" />Client Activity Report</h3>
                            <button onClick={() => exportToCSV(clientActivity.map(c => ({ client: c.name, projects: c.projects, hours: c.hours.toFixed(1), completionRate: c.completionRate + "%" })), "client_activity")} className={`p-1.5 ${styles.button} rounded`}><Download className="w-4 h-4" /></button>
                        </div>
                        {clientActivity.length === 0 ? <p className={`text-sm ${styles.textMuted}`}>No client data</p> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className={styles.tableHeader}><tr><th className="px-3 py-2 text-left font-semibold">Client</th><th className="px-3 py-2 text-right font-semibold">Projects</th><th className="px-3 py-2 text-right font-semibold">Hours</th><th className="px-3 py-2 text-right font-semibold">Completion</th></tr></thead>
                                    <tbody>
                                        {clientActivity.slice(0, 10).map((c, i) => (
                                            <tr key={i} className={`border-b ${styles.tableRow}`}>
                                                <td className={`px-3 py-2 ${styles.text}`}>{c.name}</td>
                                                <td className={`px-3 py-2 text-right ${styles.textMuted}`}>{c.projects}</td>
                                                <td className={`px-3 py-2 text-right ${styles.text}`}>{c.hours.toFixed(1)}h</td>
                                                <td className="px-3 py-2 text-right"><span className={`${c.completionRate >= 75 ? "text-emerald-500" : c.completionRate >= 50 ? "text-amber-500" : "text-red-500"}`}>{c.completionRate}%</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* detailed table */}
                    <div className={`${styles.card} border rounded-xl p-5`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`font-semibold flex items-center gap-2 ${styles.text}`}><FolderOpen className="w-4 h-4 text-blue-500" />Detailed Project Report</h3>
                            <button onClick={() => exportToCSV(detailedTableData, "detailed_report")} className={`p-1.5 ${styles.button} rounded`}><Download className="w-4 h-4" /></button>
                        </div>
                        {detailedTableData.length === 0 ? <p className={`text-sm ${styles.textMuted}`}>No data</p> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className={styles.tableHeader}><tr><th className="px-3 py-2 text-left font-semibold">Project</th><th className="px-3 py-2 text-left font-semibold">Client</th><th className="px-3 py-2 text-left font-semibold">Consultants</th><th className="px-3 py-2 text-right font-semibold">Hours</th><th className="px-3 py-2 text-center font-semibold">Status</th><th className="px-3 py-2 text-right font-semibold">Last Activity</th></tr></thead>
                                    <tbody>
                                        {detailedTableData.map((row, i) => (
                                            <tr key={i} className={`border-b ${styles.tableRow}`}>
                                                <td className={`px-3 py-2 ${styles.text} font-medium`}>{row.projectName}</td>
                                                <td className={`px-3 py-2 ${styles.textMuted}`}>{row.clientName}</td>
                                                <td className={`px-3 py-2 ${styles.textMuted} max-w-xs truncate`}>{row.consultants}</td>
                                                <td className={`px-3 py-2 text-right ${styles.text}`}>{row.hoursLogged.toFixed(1)}h</td>
                                                <td className="px-3 py-2 text-center"><StatusBadge status={row.status} /></td>
                                                <td className={`px-3 py-2 text-right ${styles.textMuted}`}>{formatDate(row.lastActivity)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* CONSULTANT VIEW */}
            {isConsultant && consultantKPIs && (
                <>
                    {/* consultant KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className={`${styles.card} border rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-emerald-500" /><span className={`text-xs ${styles.textMuted}`}>Total Hours</span></div>
                            <p className={`text-2xl font-bold ${styles.text}`}>{consultantKPIs.totalHours.toFixed(1)}</p>
                            <p className={`text-xs ${styles.textMuted} mt-1`}>{consultantKPIs.totalEntries} entries</p>
                        </div>
                        <div className={`${styles.card} border rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-2"><FolderOpen className="w-4 h-4 text-blue-500" /><span className={`text-xs ${styles.textMuted}`}>My Projects</span></div>
                            <p className={`text-2xl font-bold ${styles.text}`}>{consultantKPIs.totalProjects}</p>
                            <p className={`text-xs ${styles.textMuted} mt-1`}>{consultantKPIs.activeProjects} active</p>
                        </div>
                        <div className={`${styles.card} border rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-purple-500" /><span className={`text-xs ${styles.textMuted}`}>This Week</span></div>
                            <p className={`text-2xl font-bold ${styles.text}`}>{consultantKPIs.thisWeekHours.toFixed(1)}h</p>
                        </div>
                        <div className={`${styles.card} border rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-amber-500" /><span className={`text-xs ${styles.textMuted}`}>This Month</span></div>
                            <p className={`text-2xl font-bold ${styles.text}`}>{consultantKPIs.thisMonthHours.toFixed(1)}h</p>
                        </div>
                    </div>

                    {/* trends */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-6">
                        <div className={`${styles.card} border rounded-xl p-5`}>
                            <h3 className={`font-semibold flex items-center gap-2 mb-4 ${styles.text}`}><TrendingUp className="w-4 h-4 text-blue-500" />Weekly Trend (Last 8 Weeks)</h3>
                            {myWeeklyTrend.every(w => w.hours === 0) ? <p className={`text-sm ${styles.textMuted}`}>No hours logged</p> : (
                                <div className="flex items-end gap-2 h-32">
                                    {myWeeklyTrend.map((w, i) => {
                                        const maxHours = Math.max(...myWeeklyTrend.map(x => x.hours), 1);
                                        const height = (w.hours / maxHours) * 100;
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                <span className={`text-xs ${styles.text}`}>{w.hours.toFixed(0)}h</span>
                                                <div className="w-full bg-slate-700/30 rounded-t flex-1 relative" style={{ minHeight: "4px" }}>
                                                    <div className="absolute bottom-0 w-full bg-blue-500 rounded-t transition-all" style={{ height: `${height}%` }} />
                                                </div>
                                                <span className={`text-xs ${styles.textMuted}`}>{w.week}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className={`${styles.card} border rounded-xl p-5`}>
                            <h3 className={`font-semibold flex items-center gap-2 mb-4 ${styles.text}`}><Calendar className="w-4 h-4 text-purple-500" />Monthly Trend (Last 6 Months)</h3>
                            {myMonthlyTrend.every(m => m.hours === 0) ? <p className={`text-sm ${styles.textMuted}`}>No hours logged</p> : (
                                <div className="flex items-end gap-3 h-32">
                                    {myMonthlyTrend.map((m, i) => {
                                        const maxHours = Math.max(...myMonthlyTrend.map(x => x.hours), 1);
                                        const height = (m.hours / maxHours) * 100;
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                <span className={`text-xs ${styles.text}`}>{m.hours.toFixed(0)}h</span>
                                                <div className="w-full bg-slate-700/30 rounded-t flex-1 relative" style={{ minHeight: "4px" }}>
                                                    <div className="absolute bottom-0 w-full bg-purple-500 rounded-t transition-all" style={{ height: `${height}%` }} />
                                                </div>
                                                <span className={`text-xs ${styles.textMuted}`}>{m.month}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* hours per project + stats */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-6">
                        <div className={`${styles.card} border rounded-xl p-5`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`font-semibold flex items-center gap-2 ${styles.text}`}><FolderOpen className="w-4 h-4 text-emerald-500" />Hours per Project</h3>
                                <button onClick={() => exportToCSV(myHoursPerProject.map(h => ({ project: h.name, hours: h.hours.toFixed(1) })), "my_hours")} className={`p-1.5 ${styles.button} rounded`}><Download className="w-4 h-4" /></button>
                            </div>
                            {myHoursPerProject.length === 0 ? <p className={`text-sm ${styles.textMuted}`}>No hours logged</p> : <BarChart data={myHoursPerProject.map(h => ({ label: h.name, value: h.hours }))} color="bg-emerald-500" />}
                        </div>
                        <div className={`${styles.card} border rounded-xl p-5`}>
                            <h3 className={`font-semibold flex items-center gap-2 mb-4 ${styles.text}`}><BarChart2 className="w-4 h-4 text-amber-500" />Your Stats</h3>
                            <div className="space-y-3">
                                <div className={`p-3 rounded-lg ${styles.cardInner} flex items-center justify-between`}>
                                    <span className={styles.textMuted}>Average Hours/Entry</span>
                                    <span className={`font-bold ${styles.text}`}>{consultantKPIs.totalEntries > 0 ? (consultantKPIs.totalHours / consultantKPIs.totalEntries).toFixed(1) : "0"}h</span>
                                </div>
                                <div className={`p-3 rounded-lg ${styles.cardInner} flex items-center justify-between`}>
                                    <span className={styles.textMuted}>Completed Projects</span>
                                    <span className={`font-bold ${styles.text}`}>{consultantKPIs.completedProjects}</span>
                                </div>
                                <div className={`p-3 rounded-lg ${styles.cardInner} flex items-center justify-between`}>
                                    <span className={styles.textMuted}>Weekly Average</span>
                                    <span className={`font-bold ${styles.text}`}>{(myWeeklyTrend.reduce((s, w) => s + w.hours, 0) / 8).toFixed(1)}h</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* my projects table */}
                    <div className={`${styles.card} border rounded-xl p-5`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`font-semibold flex items-center gap-2 ${styles.text}`}><Briefcase className="w-4 h-4 text-blue-500" />My Assigned Projects</h3>
                            <button onClick={() => exportToCSV(myAssignedProjects.map(p => ({ project: p.projectName, client: p.clientName || "N/A", hours: p.myHours.toFixed(1), status: p.status })), "my_projects")} className={`p-1.5 ${styles.button} rounded`}><Download className="w-4 h-4" /></button>
                        </div>
                        {myAssignedProjects.length === 0 ? <p className={`text-sm ${styles.textMuted}`}>No projects</p> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className={styles.tableHeader}><tr><th className="px-3 py-2 text-left font-semibold">Project</th><th className="px-3 py-2 text-left font-semibold">Client</th><th className="px-3 py-2 text-right font-semibold">My Hours</th><th className="px-3 py-2 text-center font-semibold">Status</th><th className="px-3 py-2 text-right font-semibold">Due Date</th></tr></thead>
                                    <tbody>
                                        {myAssignedProjects.map((p, i) => (
                                            <tr key={i} className={`border-b ${styles.tableRow}`}>
                                                <td className={`px-3 py-2 ${styles.text} font-medium`}>{p.projectName}</td>
                                                <td className={`px-3 py-2 ${styles.textMuted}`}>{p.clientName || "N/A"}</td>
                                                <td className={`px-3 py-2 text-right ${styles.text}`}>{p.myHours.toFixed(1)}h</td>
                                                <td className="px-3 py-2 text-center"><StatusBadge status={p.status} /></td>
                                                <td className={`px-3 py-2 text-right ${styles.textMuted}`}>{formatDate(p.dateDue || null)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {isLoading && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className={`${styles.card} border rounded-xl p-6 flex items-center gap-3`}>
                        <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                        <span className={styles.text}>Loading...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsTab;