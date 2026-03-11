// src/Tabs/admin.tsx
// admin dashboard - central hub for system administration
// provides management for clients, consultants, projects, time logs, emails, alerts, documents, and messages
// only accessible by users with admin role

import React, { useEffect, useState, useMemo } from "react";
import {
    Users, Briefcase, FolderOpen, Mail, Shield, Clock, AlertTriangle,
    RefreshCw, Search, Key, UserCheck, BarChart3, PieChart,
    Send, Check, X, Download, Megaphone, Ban, CheckCircle, XCircle,
    Plus, Edit2, Trash2, Timer, FileText, MessageCircle
} from "lucide-react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import AdminDocumentRequests from "./AdminDocumentRequests";
import AdminMessages from "./AdminMessages";

// TASK: move to environment config
const API_BASE = "http://localhost:4000";

const TOAST_DURATION_MS = 3000;

type UserRole = "admin" | "consultant" | "client";
type UserStatus = "active" | "inactive" | "suspended";
type ApprovalStatus = "pending" | "approved" | "denied";
type AlertType = "warning" | "error" | "info";
type AdminView = "dashboard" | "users" | "consultants" | "projects" | "timelogs" | "emails" | "alerts" | "documents" | "messages";

interface User {
    customerId: string;
    clientCode: string;
    firstName: string;
    middleName: string;
    lastName: string;
    email: string;
    tempPassword: string;
    status?: UserStatus;
    role?: string;
}

interface Consultant {
    consultantId: string;
    consultantCode: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    status?: UserStatus;
}

interface Project {
    projectId: string;
    projectCode: string;
    projectName: string;
    clientName: string;
    status: string;
}

interface HoursLog {
    logId: string;
    projectId: string;
    consultantId: string;
    date: string;
    hours: number;
    description: string;
    createdAt: string;
    approvalStatus?: ApprovalStatus;
}

interface Email {
    emailId: string;
    to: string;
    from: string;
    subject: string;
    body: string;
    status: string;
    createdAt: string;
}

interface Alert {
    id: string;
    type: AlertType;
    message: string;
    timestamp: string;
    expiresAt?: string;
    isCustom?: boolean;
}

interface AdminTabProps {
    onNavigate?: (page: string) => void;
}

// generates a random password with mixed characters for security
const generateRandomPassword = (): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
        password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
};

// formats iso date string to readable locale format
const formatDate = (iso: string): string => {
    if (!iso) return "";
    return new Date(iso).toLocaleString();
};

// exports data array to csv file for download
const exportToCSV = (data: any[], filename: string, onSuccess: (msg: string) => void, onError: (msg: string) => void) => {
    if (data.length === 0) {
        onError("No data to export");
        return;
    }
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(","),
        ...data.map(row => headers.map(h => {
            const val = row[h] ?? "";
            return typeof val === "string" && (val.includes(",") || val.includes('"'))
                ? `"${val.replace(/"/g, '""')}"`
                : val;
        }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onSuccess(`Exported ${data.length} records`);
};

// helper to get pending document requests count
const getPendingDocumentRequestsCount = (): number => {
    try {
        const requests = JSON.parse(localStorage.getItem("timely_document_requests") || "[]");
        return requests.filter((r: any) => r.status === "uploaded").length;
    } catch {
        return 0;
    }
};

// helper to get unread messages count
const getUnreadMessagesCount = (): number => {
    try {
        const messages = JSON.parse(localStorage.getItem("timely_global_messages") || "[]");
        return messages.filter((m: any) => !m.read && m.from?.role === "client").length;
    } catch {
        return 0;
    }
};


const AdminTab: React.FC<AdminTabProps> = ({ onNavigate }) => {
    const { isDark } = useTheme();

    // centralized style definitions for consistent theming
    const styles = {
        card: isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200",
        cardInner: isDark ? "bg-slate-900" : "bg-gray-50",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-500",
        input: isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900",
        hover: isDark ? "hover:bg-slate-700" : "hover:bg-gray-100",
        selected: isDark ? "bg-slate-700" : "bg-blue-50",
        divider: isDark ? "divide-slate-700" : "divide-gray-200",
        border: isDark ? "border-slate-700" : "border-gray-200",
    };

    // navigation and user state
    const [currentView, setCurrentView] = useState<AdminView>("dashboard");
    const [adminEmail, setAdminEmail] = useState("admin@timely.com");
    const [adminName, setAdminName] = useState("Admin");

    // data state - fetched from api
    const [users, setUsers] = useState<User[]>([]);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [hoursLogs, setHoursLogs] = useState<HoursLog[]>([]);
    const [emails, setEmails] = useState<Email[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [pendingDocRequests, setPendingDocRequests] = useState(0);
    const [unreadMessages, setUnreadMessages] = useState(0);

    // ui state
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [userStatusFilter, setUserStatusFilter] = useState<"all" | UserStatus>("all");
    const [timelogStatusFilter, setTimelogStatusFilter] = useState<"all" | ApprovalStatus>("all");

    // selection state for detail panels
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

    // modal visibility state
    const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
    const [showChangeRoleModal, setShowChangeRoleModal] = useState(false);
    const [showComposeEmailModal, setShowComposeEmailModal] = useState(false);
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [editingAlert, setEditingAlert] = useState<Alert | null>(null);

    // form state for modals
    const [newPassword, setNewPassword] = useState("");
    const [newRole, setNewRole] = useState("");
    const [composeTo, setComposeTo] = useState("");
    const [composeSubject, setComposeSubject] = useState("");
    const [composeBody, setComposeBody] = useState("");
    const [emailSuggestions, setEmailSuggestions] = useState<{ name: string; email: string }[]>([]);
    const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
    const [announcementSubject, setAnnouncementSubject] = useState("");
    const [announcementBody, setAnnouncementBody] = useState("");
    const [announcementTarget, setAnnouncementTarget] = useState<"all" | "clients" | "consultants">("all");
    const [newAlertMessage, setNewAlertMessage] = useState("");
    const [newAlertType, setNewAlertType] = useState<AlertType>("info");
    const [newAlertExpiry, setNewAlertExpiry] = useState("");

    // toast notification state
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const showToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), TOAST_DURATION_MS);
    };

    // api fetch functions
    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/users-report`);
            if (res.ok) {
                const json = await res.json();
                const usersWithDefaults = (json.data || []).map((u: User) => ({
                    ...u,
                    status: u.status || "active",
                    role: u.role || "client"
                }));
                setUsers(usersWithDefaults);
            }
        } catch (err) {
            console.error("Error fetching users:", err);
        }
    };

    const fetchConsultants = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/consultants`);
            if (res.ok) {
                const json = await res.json();
                const consultantsWithDefaults = (json.data || []).map((c: Consultant) => ({
                    ...c,
                    status: c.status || "active"
                }));
                setConsultants(consultantsWithDefaults);
            }
        } catch (err) {
            console.error("Error fetching consultants:", err);
        }
    };

    const fetchProjects = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/projects`);
            if (res.ok) {
                const json = await res.json();
                setProjects(json.data || []);
            }
        } catch (err) {
            console.error("Error fetching projects:", err);
        }
    };

    const fetchHoursLogs = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/hours-logs`);
            if (res.ok) {
                const json = await res.json();
                setHoursLogs(json.data || []);
            }
        } catch (err) {
            console.error("Error fetching hours:", err);
        }
    };

    const fetchEmails = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/emails/outbox?limit=100`);
            if (res.ok) {
                const json = await res.json();
                setEmails(json.data || []);
            }
        } catch (err) {
            console.error("Error fetching emails:", err);
        }
    };

    const generateSystemAlerts = () => {
        const systemAlerts: Alert[] = [];
        const suspendedCount = users.filter(u => u.status === "suspended").length;
        const pendingLogsCount = hoursLogs.filter(l => l.approvalStatus === "pending").length;

        if (suspendedCount > 0) {
            systemAlerts.push({
                id: "sys-suspended",
                type: "warning",
                message: `${suspendedCount} user(s) currently suspended`,
                timestamp: new Date().toISOString()
            });
        }
        if (pendingLogsCount > 0) {
            systemAlerts.push({
                id: "sys-pending",
                type: "warning",
                message: `${pendingLogsCount} time log(s) pending approval`,
                timestamp: new Date().toISOString()
            });
        }

        const customAlerts = alerts.filter(a => a.isCustom);
        const validCustomAlerts = customAlerts.filter(a => !a.expiresAt || new Date(a.expiresAt) > new Date());

        setAlerts([...systemAlerts, ...validCustomAlerts]);
    };

    const refreshAllData = async () => {
        setIsLoading(true);
        await Promise.all([fetchUsers(), fetchConsultants(), fetchProjects(), fetchHoursLogs(), fetchEmails()]);
        setPendingDocRequests(getPendingDocumentRequestsCount());
        setUnreadMessages(getUnreadMessagesCount());
        setIsLoading(false);
    };

    useEffect(() => {
        try {
            const stored = localStorage.getItem("timely_user");
            if (stored) {
                const user = JSON.parse(stored);
                if (user?.email) setAdminEmail(user.email);
                if (user?.firstName) setAdminName(`${user.firstName} ${user.lastName || ""}`);
            }
            const savedAlerts = localStorage.getItem("timely_custom_alerts");
            if (savedAlerts) {
                const parsed = JSON.parse(savedAlerts);
                setAlerts(parsed.filter((a: Alert) => a.isCustom));
            }
        } catch { }
        refreshAllData();
    }, []);

    useEffect(() => {
        generateSystemAlerts();
    }, [users, projects, hoursLogs]);

    useEffect(() => {
        const customAlerts = alerts.filter(a => a.isCustom);
        localStorage.setItem("timely_custom_alerts", JSON.stringify(customAlerts));
    }, [alerts]);

    useEffect(() => {
        if (currentView === "documents") {
            setPendingDocRequests(getPendingDocumentRequestsCount());
        }
        if (currentView === "messages") {
            setUnreadMessages(getUnreadMessagesCount());
        }
    }, [currentView]);

    const stats = useMemo(() => {
        const activeUsers = users.filter(u => u.status === "active").length;
        const inactiveUsers = users.filter(u => u.status === "inactive").length;
        const suspendedUsers = users.filter(u => u.status === "suspended").length;
        const totalHours = hoursLogs.reduce((sum, l) => sum + (Number(l.hours) || 0), 0);
        const pendingLogs = hoursLogs.filter(l => l.approvalStatus === "pending").length;
        const approvedLogs = hoursLogs.filter(l => l.approvalStatus === "approved").length;
        const deniedLogs = hoursLogs.filter(l => l.approvalStatus === "denied").length;

        return { activeUsers, inactiveUsers, suspendedUsers, totalHours, pendingLogs, approvedLogs, deniedLogs };
    }, [users, hoursLogs]);

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesSearch = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFilter = userStatusFilter === "all" || u.status === userStatusFilter;
            return matchesSearch && matchesFilter;
        });
    }, [users, searchTerm, userStatusFilter]);

    const filteredTimeLogs = useMemo(() => {
        return hoursLogs.filter(l => timelogStatusFilter === "all" || l.approvalStatus === timelogStatusFilter);
    }, [hoursLogs, timelogStatusFilter]);

    const getConsultantName = (consultantId: string): string => {
        const consultant = consultants.find(c => c.consultantId === consultantId);
        return consultant ? `${consultant.firstName} ${consultant.lastName}` : `#${consultantId}`;
    };

    const getProjectName = (projectId: string): string => {
        const project = projects.find(p => p.projectId === projectId);
        return project ? project.projectName : `#${projectId}`;
    };

    const getConsultantHours = (consultantId: string): number => {
        return hoursLogs
            .filter(l => l.consultantId === consultantId)
            .reduce((sum, l) => sum + (Number(l.hours) || 0), 0);
    };

    const getProjectHours = (projectId: string): number => {
        return hoursLogs
            .filter(l => l.projectId === projectId)
            .reduce((sum, l) => sum + (Number(l.hours) || 0), 0);
    };

    const handleEmailInput = (value: string) => {
        setComposeTo(value);
        if (value.length >= 2) {
            const allPeople = [
                ...users.map(u => ({ name: `${u.firstName} ${u.lastName}`, email: u.email })),
                ...consultants.map(c => ({ name: `${c.firstName} ${c.lastName}`, email: c.email }))
            ];
            const matches = allPeople.filter(p =>
                p.name.toLowerCase().includes(value.toLowerCase()) ||
                p.email.toLowerCase().includes(value.toLowerCase())
            );
            setEmailSuggestions(matches.slice(0, 5));
            setShowEmailSuggestions(matches.length > 0);
        } else {
            setShowEmailSuggestions(false);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedUser || !newPassword) return;
        showToast(`Password reset for ${selectedUser.email}`, "success");
        setShowResetPasswordModal(false);
        setNewPassword("");
        setSelectedUser(null);
    };

    const handleChangeRole = async () => {
        if (!selectedUser || !newRole) return;
        setUsers(prev => prev.map(u =>
            u.customerId === selectedUser.customerId ? { ...u, role: newRole } : u
        ));
        showToast(`Role updated to ${newRole}`, "success");
        setShowChangeRoleModal(false);
        setNewRole("");
        setSelectedUser(null);
    };

    const handleToggleUserSuspension = (user: User) => {
        const newStatus: UserStatus = user.status === "suspended" ? "active" : "suspended";
        setUsers(prev => prev.map(u =>
            u.customerId === user.customerId ? { ...u, status: newStatus } : u
        ));
        showToast(`${user.firstName} ${user.lastName} ${newStatus === "suspended" ? "suspended" : "unsuspended"}`, "success");
    };

    const handleToggleConsultantSuspension = (consultant: Consultant) => {
        const newStatus: UserStatus = consultant.status === "suspended" ? "active" : "suspended";
        setConsultants(prev => prev.map(c =>
            c.consultantId === consultant.consultantId ? { ...c, status: newStatus } : c
        ));
        showToast(`${consultant.firstName} ${consultant.lastName} ${newStatus === "suspended" ? "suspended" : "unsuspended"}`, "success");
    };

    const handleApproveTimeLog = (logId: string) => {
        setHoursLogs(prev => prev.map(l =>
            l.logId === logId ? { ...l, approvalStatus: "approved" as const } : l
        ));
        showToast("Time log approved", "success");
    };

    const handleDenyTimeLog = (logId: string) => {
        setHoursLogs(prev => prev.map(l =>
            l.logId === logId ? { ...l, approvalStatus: "denied" as const } : l
        ));
        showToast("Time log denied", "success");
    };

    const handleSendEmail = async () => {
        if (!composeTo || !composeSubject) {
            showToast("To and Subject are required", "error");
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/emails/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to: composeTo,
                    from: "noreply@timely.com",
                    subject: composeSubject,
                    body: composeBody
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast("Email sent successfully", "success");
                setShowComposeEmailModal(false);
                setComposeTo("");
                setComposeSubject("");
                setComposeBody("");
                setTimeout(() => fetchEmails(), 500);
            } else {
                throw new Error(data.error || "Failed to send");
            }
        } catch (err: any) {
            showToast(err.message || "Failed to send email", "error");
        }
    };

    const handleSendAnnouncement = async () => {
        if (!announcementSubject || !announcementBody) {
            showToast("Subject and body required", "error");
            return;
        }

        let recipients: string[] = [];
        if (announcementTarget === "all" || announcementTarget === "clients") {
            recipients = [...recipients, ...users.map(u => u.email)];
        }
        if (announcementTarget === "all" || announcementTarget === "consultants") {
            recipients = [...recipients, ...consultants.map(c => c.email)];
        }

        let sentCount = 0;
        for (const email of recipients) {
            try {
                const res = await fetch(`${API_BASE}/api/emails/send`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        to: email,
                        from: "noreply@timely.com",
                        subject: `[Announcement] ${announcementSubject}`,
                        body: announcementBody
                    })
                });
                if (res.ok) sentCount++;
            } catch { }
        }

        showToast(`Announcement sent to ${sentCount} recipient(s)`, "success");
        setShowAnnouncementModal(false);
        setAnnouncementSubject("");
        setAnnouncementBody("");
        setTimeout(() => fetchEmails(), 500);
    };

    const handleCreateAlert = () => {
        if (!newAlertMessage) {
            showToast("Alert message required", "error");
            return;
        }
        const newAlert: Alert = {
            id: `custom-${Date.now()}`,
            type: newAlertType,
            message: newAlertMessage,
            timestamp: new Date().toISOString(),
            expiresAt: newAlertExpiry || undefined,
            isCustom: true
        };
        setAlerts(prev => [...prev, newAlert]);
        resetAlertForm();
        showToast("Alert created", "success");
    };

    const handleUpdateAlert = () => {
        if (!editingAlert || !newAlertMessage) return;
        setAlerts(prev => prev.map(a =>
            a.id === editingAlert.id
                ? { ...a, message: newAlertMessage, type: newAlertType, expiresAt: newAlertExpiry || undefined }
                : a
        ));
        setEditingAlert(null);
        resetAlertForm();
        showToast("Alert updated", "success");
    };

    const handleDeleteAlert = (alertId: string) => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
        showToast("Alert deleted", "success");
    };

    const resetAlertForm = () => {
        setNewAlertMessage("");
        setNewAlertExpiry("");
        setShowAlertModal(false);
    };

    // navigation tabs configuration - includes documents and messages tabs
    const navigationTabs: { id: AdminView; label: string; icon: any; badge?: number }[] = [
        { id: "dashboard", label: "Overview", icon: BarChart3 },
        { id: "users", label: "Clients", icon: Users },
        { id: "consultants", label: "Consultants", icon: Briefcase },
        { id: "projects", label: "Projects", icon: FolderOpen },
        { id: "timelogs", label: "Time Logs", icon: Clock, badge: stats.pendingLogs || undefined },
        { id: "documents", label: "Documents", icon: FileText, badge: pendingDocRequests || undefined },
        { id: "messages", label: "Messages", icon: MessageCircle, badge: unreadMessages || undefined },
        { id: "emails", label: "Emails", icon: Mail },
        { id: "alerts", label: "Alerts", icon: AlertTriangle, badge: alerts.length || undefined },
    ];

    // dashboard overview
    const renderDashboard = () => (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowAnnouncementModal(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium">
                    <Megaphone className="w-4 h-4" /> Send Announcement
                </button>
                <button onClick={() => onNavigate?.("EmailGenerator")} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                    <Plus className="w-4 h-4" /> Add Client
                </button>
                <button onClick={() => onNavigate?.("projects")} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
                    <FolderOpen className="w-4 h-4" /> View Projects
                </button>
                <button onClick={() => onNavigate?.("hours")} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium">
                    <Clock className="w-4 h-4" /> Log Hours
                </button>
                <button onClick={() => setCurrentView("documents")} className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-medium">
                    <FileText className="w-4 h-4" /> Request Documents
                </button>
                <button onClick={() => setCurrentView("messages")} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
                    <MessageCircle className="w-4 h-4" /> Messages {unreadMessages > 0 && <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-xs">{unreadMessages}</span>}
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className={`${styles.card} border rounded-xl p-4`}>
                    <p className={`${styles.textMuted} text-xs`}>Total Clients</p>
                    <p className={`text-2xl font-bold ${styles.text}`}>{users.length}</p>
                </div>
                <div className={`${styles.card} border rounded-xl p-4`}>
                    <p className={`${styles.textMuted} text-xs`}>Active</p>
                    <p className="text-2xl font-bold text-emerald-500">{stats.activeUsers}</p>
                </div>
                <div className={`${styles.card} border rounded-xl p-4`}>
                    <p className={`${styles.textMuted} text-xs`}>Suspended</p>
                    <p className="text-2xl font-bold text-red-500">{stats.suspendedUsers}</p>
                </div>
                <div className={`${styles.card} border rounded-xl p-4`}>
                    <p className={`${styles.textMuted} text-xs`}>Consultants</p>
                    <p className="text-2xl font-bold text-purple-500">{consultants.length}</p>
                </div>
                <div className={`${styles.card} border rounded-xl p-4`}>
                    <p className={`${styles.textMuted} text-xs`}>Projects</p>
                    <p className="text-2xl font-bold text-blue-500">{projects.length}</p>
                </div>
                <div className={`${styles.card} border rounded-xl p-4`}>
                    <p className={`${styles.textMuted} text-xs`}>Total Hours</p>
                    <p className="text-2xl font-bold text-amber-500">{stats.totalHours.toFixed(1)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`${styles.card} border rounded-xl p-5`}>
                    <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${styles.text}`}>
                        <PieChart className="w-4 h-4" /> User Status
                    </h3>
                    <div className="flex items-center justify-center">
                        <div className="relative w-32 h-32">
                            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                {users.length > 0 ? (
                                    <>
                                        <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#10b981" strokeWidth="3" strokeDasharray={`${(stats.activeUsers / users.length) * 100} 100`} />
                                        <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#6b7280" strokeWidth="3" strokeDasharray={`${(stats.inactiveUsers / users.length) * 100} 100`} strokeDashoffset={`-${(stats.activeUsers / users.length) * 100}`} />
                                        <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#ef4444" strokeWidth="3" strokeDasharray={`${(stats.suspendedUsers / users.length) * 100} 100`} strokeDashoffset={`-${((stats.activeUsers + stats.inactiveUsers) / users.length) * 100}`} />
                                    </>
                                ) : (
                                    <circle cx="18" cy="18" r="15.9" fill="transparent" stroke={isDark ? "#374151" : "#e5e7eb"} strokeWidth="3" />
                                )}
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-lg font-bold ${styles.text}`}>{users.length}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-center gap-4 mt-4 text-xs">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className={styles.textMuted}>Active</span></div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-gray-500" /><span className={styles.textMuted}>Inactive</span></div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" /><span className={styles.textMuted}>Suspended</span></div>
                    </div>
                </div>

                <div className={`${styles.card} border rounded-xl p-5`}>
                    <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${styles.text}`}>
                        <BarChart3 className="w-4 h-4" /> Time Log Status
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <div className={`flex justify-between text-xs mb-1 ${styles.textMuted}`}>
                                <span>Pending</span>
                                <span className="text-amber-500">{stats.pendingLogs}</span>
                            </div>
                            <div className={`h-3 ${isDark ? "bg-slate-700" : "bg-gray-200"} rounded-full overflow-hidden`}>
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${hoursLogs.length ? (stats.pendingLogs / hoursLogs.length) * 100 : 0}%` }} />
                            </div>
                        </div>
                        <div>
                            <div className={`flex justify-between text-xs mb-1 ${styles.textMuted}`}>
                                <span>Approved</span>
                                <span className="text-emerald-500">{stats.approvedLogs}</span>
                            </div>
                            <div className={`h-3 ${isDark ? "bg-slate-700" : "bg-gray-200"} rounded-full overflow-hidden`}>
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${hoursLogs.length ? (stats.approvedLogs / hoursLogs.length) * 100 : 0}%` }} />
                            </div>
                        </div>
                        <div>
                            <div className={`flex justify-between text-xs mb-1 ${styles.textMuted}`}>
                                <span>Denied</span>
                                <span className="text-red-500">{stats.deniedLogs}</span>
                            </div>
                            <div className={`h-3 ${isDark ? "bg-slate-700" : "bg-gray-200"} rounded-full overflow-hidden`}>
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${hoursLogs.length ? (stats.deniedLogs / hoursLogs.length) * 100 : 0}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`${styles.card} border rounded-xl p-5`}>
                    <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${styles.text}`}>
                        <Clock className="w-4 h-4" /> Hours by Consultant
                    </h3>
                    <div className="space-y-2 max-h-44 overflow-y-auto">
                        {consultants.length === 0 ? (
                            <p className={`${styles.textMuted} text-sm text-center py-4`}>No consultants</p>
                        ) : (
                            consultants.slice(0, 6).map(c => {
                                const hours = getConsultantHours(c.consultantId);
                                const maxHours = Math.max(...consultants.map(con => getConsultantHours(con.consultantId)), 1);
                                return (
                                    <div key={c.consultantId}>
                                        <div className={`flex justify-between text-xs mb-1 ${styles.textMuted}`}>
                                            <span className="truncate">{c.firstName} {c.lastName}</span>
                                            <span className="text-blue-500">{hours}h</span>
                                        </div>
                                        <div className={`h-2 ${isDark ? "bg-slate-700" : "bg-gray-200"} rounded-full overflow-hidden`}>
                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(hours / maxHours) * 100}%` }} />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {alerts.length > 0 && (
                <div className={`${styles.card} border rounded-xl p-5`}>
                    <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${styles.text}`}>
                        <AlertTriangle className="w-4 h-4 text-amber-500" /> Recent Alerts
                    </h3>
                    <div className="space-y-2">
                        {alerts.slice(0, 3).map(alert => (
                            <div key={alert.id} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${alert.type === "error" ? "bg-red-500/10" : alert.type === "warning" ? "bg-amber-500/10" : "bg-blue-500/10"}`}>
                                <AlertTriangle className={`w-3 h-3 ${alert.type === "error" ? "text-red-500" : alert.type === "warning" ? "text-amber-500" : "text-blue-500"}`} />
                                <span className={styles.text}>{alert.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    // users/clients management view
    const renderUsers = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className={`text-xl font-semibold ${styles.text}`}>Client Management</h2>
                <div className="flex gap-2">
                    <button onClick={() => exportToCSV(users, "clients", showToast, (msg) => showToast(msg, "error"))} className={`flex items-center gap-2 px-3 py-2 ${styles.card} border rounded-lg text-sm ${styles.hover}`}>
                        <Download className="w-4 h-4" /> Export
                    </button>
                    <button onClick={fetchUsers} className={`flex items-center gap-2 px-3 py-2 ${styles.card} border rounded-lg text-sm ${styles.hover}`}>
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${styles.textMuted}`} />
                    <input type="text" placeholder="Search clients..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`w-full pl-10 pr-4 py-2 ${styles.input} border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`} />
                </div>
                <select value={userStatusFilter} onChange={e => setUserStatusFilter(e.target.value as any)} className={`${styles.input} border rounded-lg px-3 py-2 text-sm focus:outline-none`}>
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`lg:col-span-2 ${styles.card} border rounded-xl overflow-hidden`}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={styles.cardInner}>
                                <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Client</th>
                                <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Email</th>
                                <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Status</th>
                                <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${styles.divider}`}>
                            {filteredUsers.length === 0 ? (
                                <tr><td colSpan={4} className={`px-4 py-8 text-center ${styles.textMuted}`}>No clients found</td></tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.customerId} onClick={() => setSelectedUser(user)} className={`cursor-pointer ${styles.hover} ${selectedUser?.customerId === user.customerId ? styles.selected : ""}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full ${isDark ? "bg-slate-700" : "bg-gray-200"} flex items-center justify-center text-sm font-medium`}>
                                                    {user.firstName[0]}{user.lastName[0]}
                                                </div>
                                                <div>
                                                    <p className={`font-medium ${styles.text}`}>{user.firstName} {user.lastName}</p>
                                                    <p className={`${styles.textMuted} text-xs`}>{user.clientCode}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 ${styles.textMuted}`}>{user.email}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs ${user.status === "active" ? "bg-emerald-500/20 text-emerald-500" : user.status === "suspended" ? "bg-red-500/20 text-red-500" : "bg-gray-500/20 text-gray-500"}`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button onClick={e => { e.stopPropagation(); setSelectedUser(user); setShowResetPasswordModal(true); }} className={`p-2 rounded-lg ${styles.hover}`}>
                                                    <Key className={`w-4 h-4 ${styles.textMuted}`} />
                                                </button>
                                                <button onClick={e => { e.stopPropagation(); handleToggleUserSuspension(user); }} className={`p-2 rounded-lg ${styles.hover}`}>
                                                    <Ban className={`w-4 h-4 ${user.status === "suspended" ? "text-red-500" : styles.textMuted}`} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className={`${styles.card} border rounded-xl p-5`}>
                    {selectedUser ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                                    {selectedUser.firstName[0]}{selectedUser.lastName[0]}
                                </div>
                                <div>
                                    <h3 className={`text-lg font-semibold ${styles.text}`}>{selectedUser.firstName} {selectedUser.lastName}</h3>
                                    <p className={styles.textMuted}>{selectedUser.clientCode}</p>
                                </div>
                            </div>
                            <div className={`space-y-3 pt-3 border-t ${styles.border}`}>
                                <div className="flex items-center gap-3"><Mail className={`w-4 h-4 ${styles.textMuted}`} /><span className={`text-sm ${styles.text}`}>{selectedUser.email}</span></div>
                                <div className="flex items-center gap-3"><Shield className={`w-4 h-4 ${styles.textMuted}`} /><span className={`text-sm capitalize ${styles.text}`}>{selectedUser.role}</span></div>
                                <div className="flex items-center gap-3"><UserCheck className={`w-4 h-4 ${styles.textMuted}`} /><span className={`text-sm capitalize ${selectedUser.status === "active" ? "text-emerald-500" : selectedUser.status === "suspended" ? "text-red-500" : styles.textMuted}`}>{selectedUser.status}</span></div>
                                <div className="flex items-center gap-3"><Key className={`w-4 h-4 ${styles.textMuted}`} /><span className={`text-sm font-mono ${styles.text}`}>{selectedUser.tempPassword}</span></div>
                            </div>
                            <div className={`flex gap-2 pt-3 border-t ${styles.border}`}>
                                <button onClick={() => { setNewRole(selectedUser.role || "client"); setShowChangeRoleModal(true); }} className={`flex-1 px-3 py-2 ${styles.card} border rounded-lg text-sm ${styles.hover}`}>
                                    Change Role
                                </button>
                                <button onClick={() => setShowResetPasswordModal(true)} className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
                                    Reset Password
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={`flex flex-col items-center justify-center h-64 ${styles.textMuted}`}>
                            <Users className="w-12 h-12 mb-2 opacity-50" />
                            <p className="text-sm">Select a client to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // consultants management view
    const renderConsultants = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className={`text-xl font-semibold ${styles.text}`}>Consultant Management</h2>
                <div className="flex gap-2">
                    <button onClick={() => exportToCSV(consultants, "consultants", showToast, (msg) => showToast(msg, "error"))} className={`flex items-center gap-2 px-3 py-2 ${styles.card} border rounded-lg text-sm ${styles.hover}`}>
                        <Download className="w-4 h-4" /> Export
                    </button>
                    <button onClick={fetchConsultants} className={`flex items-center gap-2 px-3 py-2 ${styles.card} border rounded-lg text-sm ${styles.hover}`}>
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`lg:col-span-2 ${styles.card} border rounded-xl overflow-hidden`}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={styles.cardInner}>
                                <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Consultant</th>
                                <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Role</th>
                                <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Hours</th>
                                <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Status</th>
                                <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${styles.divider}`}>
                            {consultants.length === 0 ? (
                                <tr><td colSpan={5} className={`px-4 py-8 text-center ${styles.textMuted}`}>No consultants</td></tr>
                            ) : (
                                consultants.map(consultant => (
                                    <tr key={consultant.consultantId} onClick={() => setSelectedConsultant(consultant)} className={`cursor-pointer ${styles.hover} ${selectedConsultant?.consultantId === consultant.consultantId ? styles.selected : ""}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-medium text-purple-500">
                                                    {consultant.firstName[0]}{consultant.lastName[0]}
                                                </div>
                                                <div>
                                                    <p className={`font-medium ${styles.text}`}>{consultant.firstName} {consultant.lastName}</p>
                                                    <p className={`${styles.textMuted} text-xs`}>{consultant.consultantCode}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 bg-purple-500/20 text-purple-500 rounded text-xs">{consultant.role || "Consultant"}</span>
                                        </td>
                                        <td className={`px-4 py-3 ${styles.textMuted}`}>{getConsultantHours(consultant.consultantId)}h</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs ${consultant.status === "active" ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"}`}>
                                                {consultant.status || "active"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button onClick={e => { e.stopPropagation(); handleToggleConsultantSuspension(consultant); }} className={`p-2 rounded-lg ${styles.hover}`}>
                                                <Ban className={`w-4 h-4 ${consultant.status === "suspended" ? "text-red-500" : styles.textMuted}`} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className={`${styles.card} border rounded-xl p-5`}>
                    {selectedConsultant ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-2xl font-bold text-white">
                                    {selectedConsultant.firstName[0]}{selectedConsultant.lastName[0]}
                                </div>
                                <div>
                                    <h3 className={`text-lg font-semibold ${styles.text}`}>{selectedConsultant.firstName} {selectedConsultant.lastName}</h3>
                                    <p className={styles.textMuted}>{selectedConsultant.consultantCode}</p>
                                </div>
                            </div>
                            <div className={`space-y-3 pt-3 border-t ${styles.border}`}>
                                <div className="flex items-center gap-3"><Mail className={`w-4 h-4 ${styles.textMuted}`} /><span className={`text-sm ${styles.text}`}>{selectedConsultant.email}</span></div>
                                <div className="flex items-center gap-3"><Briefcase className={`w-4 h-4 ${styles.textMuted}`} /><span className={`text-sm ${styles.text}`}>{selectedConsultant.role || "Consultant"}</span></div>
                                <div className="flex items-center gap-3"><Clock className={`w-4 h-4 ${styles.textMuted}`} /><span className={`text-sm ${styles.text}`}>{getConsultantHours(selectedConsultant.consultantId)}h logged</span></div>
                            </div>
                        </div>
                    ) : (
                        <div className={`flex flex-col items-center justify-center h-64 ${styles.textMuted}`}>
                            <Briefcase className="w-12 h-12 mb-2 opacity-50" />
                            <p className="text-sm">Select a consultant</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // projects management view
    const renderProjects = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className={`text-xl font-semibold ${styles.text}`}>Project Management</h2>
                <div className="flex gap-2">
                    <button onClick={() => exportToCSV(projects, "projects", showToast, (msg) => showToast(msg, "error"))} className={`flex items-center gap-2 px-3 py-2 ${styles.card} border rounded-lg text-sm ${styles.hover}`}>
                        <Download className="w-4 h-4" /> Export
                    </button>
                    <button onClick={fetchProjects} className={`flex items-center gap-2 px-3 py-2 ${styles.card} border rounded-lg text-sm ${styles.hover}`}>
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`lg:col-span-2 ${styles.card} border rounded-xl overflow-hidden`}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={styles.cardInner}>
                                <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Project</th>
                                <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Client</th>
                                <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Status</th>
                                <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Hours</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${styles.divider}`}>
                            {projects.length === 0 ? (
                                <tr><td colSpan={4} className={`px-4 py-8 text-center ${styles.textMuted}`}>No projects</td></tr>
                            ) : (
                                projects.map(project => (
                                    <tr key={project.projectId} onClick={() => setSelectedProject(project)} className={`cursor-pointer ${styles.hover} ${selectedProject?.projectId === project.projectId ? styles.selected : ""}`}>
                                        <td className="px-4 py-3">
                                            <p className={`font-medium ${styles.text}`}>{project.projectName}</p>
                                            <p className={`${styles.textMuted} text-xs`}>{project.projectCode}</p>
                                        </td>
                                        <td className={`px-4 py-3 ${styles.textMuted}`}>{project.clientName || "-"}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs ${(project.status || "").toLowerCase() === "complete" ? "bg-emerald-500/20 text-emerald-500" : (project.status || "").toLowerCase() === "in progress" ? "bg-blue-500/20 text-blue-500" : "bg-gray-500/20 text-gray-500"}`}>
                                                {project.status || "Pending"}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 ${styles.textMuted}`}>{getProjectHours(project.projectId)}h</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className={`${styles.card} border rounded-xl p-5`}>
                    {selectedProject ? (
                        <div className="space-y-4">
                            <div>
                                <h3 className={`text-lg font-semibold ${styles.text}`}>{selectedProject.projectName}</h3>
                                <p className={styles.textMuted}>{selectedProject.projectCode}</p>
                            </div>
                            <div className={`space-y-3 pt-3 border-t ${styles.border}`}>
                                <div className="flex items-center gap-3"><Users className={`w-4 h-4 ${styles.textMuted}`} /><span className={`text-sm ${styles.text}`}>Client: {selectedProject.clientName || "Unassigned"}</span></div>
                                <div className="flex items-center gap-3"><FolderOpen className={`w-4 h-4 ${styles.textMuted}`} /><span className={`text-sm ${styles.text}`}>Status: {selectedProject.status || "Pending"}</span></div>
                                <div className="flex items-center gap-3"><Clock className={`w-4 h-4 ${styles.textMuted}`} /><span className={`text-sm ${styles.text}`}>{getProjectHours(selectedProject.projectId)}h logged</span></div>
                            </div>
                        </div>
                    ) : (
                        <div className={`flex flex-col items-center justify-center h-64 ${styles.textMuted}`}>
                            <FolderOpen className="w-12 h-12 mb-2 opacity-50" />
                            <p className="text-sm">Select a project</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // time logs approval view
    const renderTimeLogs = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className={`text-xl font-semibold ${styles.text}`}>Time Log Approvals</h2>
                <div className="flex gap-2">
                    <button onClick={() => exportToCSV(hoursLogs.map(l => ({ ...l, consultant: getConsultantName(l.consultantId), project: getProjectName(l.projectId) })), "timelogs", showToast, (msg) => showToast(msg, "error"))} className={`flex items-center gap-2 px-3 py-2 ${styles.card} border rounded-lg text-sm ${styles.hover}`}>
                        <Download className="w-4 h-4" /> Export
                    </button>
                    <button onClick={fetchHoursLogs} className={`flex items-center gap-2 px-3 py-2 ${styles.card} border rounded-lg text-sm ${styles.hover}`}>
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <select value={timelogStatusFilter} onChange={e => setTimelogStatusFilter(e.target.value as any)} className={`${styles.input} border rounded-lg px-3 py-2 text-sm focus:outline-none`}>
                <option value="all">All ({hoursLogs.length})</option>
                <option value="pending">Pending ({stats.pendingLogs})</option>
                <option value="approved">Approved ({stats.approvedLogs})</option>
                <option value="denied">Denied ({stats.deniedLogs})</option>
            </select>

            <div className={`${styles.card} border rounded-xl overflow-hidden`}>
                <table className="w-full text-sm">
                    <thead>
                        <tr className={styles.cardInner}>
                            <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Date</th>
                            <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Consultant</th>
                            <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Project</th>
                            <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Hours</th>
                            <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Status</th>
                            <th className={`text-left px-4 py-3 font-medium ${styles.textMuted}`}>Actions</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${styles.divider}`}>
                        {filteredTimeLogs.length === 0 ? (
                            <tr><td colSpan={6} className={`px-4 py-8 text-center ${styles.textMuted}`}>No time logs</td></tr>
                        ) : (
                            filteredTimeLogs.map(log => (
                                <tr key={log.logId} className={styles.hover}>
                                    <td className={`px-4 py-3 ${styles.textMuted}`}>{log.date}</td>
                                    <td className={`px-4 py-3 ${styles.text}`}>{getConsultantName(log.consultantId)}</td>
                                    <td className={`px-4 py-3 ${styles.text}`}>{getProjectName(log.projectId)}</td>
                                    <td className={`px-4 py-3 font-medium ${styles.text}`}>{log.hours}h</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${log.approvalStatus === "approved" ? "bg-emerald-500/20 text-emerald-500" : log.approvalStatus === "denied" ? "bg-red-500/20 text-red-500" : "bg-amber-500/20 text-amber-500"}`}>
                                            {log.approvalStatus || "pending"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => handleApproveTimeLog(log.logId)} className={`p-2 rounded-lg ${log.approvalStatus === "approved" ? "bg-emerald-500/20" : styles.hover}`}>
                                                <CheckCircle className={`w-4 h-4 ${log.approvalStatus === "approved" ? "text-emerald-500" : styles.textMuted}`} />
                                            </button>
                                            <button onClick={() => handleDenyTimeLog(log.logId)} className={`p-2 rounded-lg ${log.approvalStatus === "denied" ? "bg-red-500/20" : styles.hover}`}>
                                                <XCircle className={`w-4 h-4 ${log.approvalStatus === "denied" ? "text-red-500" : styles.textMuted}`} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // emails view
    const renderEmails = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className={`text-xl font-semibold ${styles.text}`}>Email System</h2>
                <div className="flex gap-2">
                    <button onClick={() => exportToCSV(emails, "emails", showToast, (msg) => showToast(msg, "error"))} className={`flex items-center gap-2 px-3 py-2 ${styles.card} border rounded-lg text-sm ${styles.hover}`}>
                        <Download className="w-4 h-4" /> Export
                    </button>
                    <button onClick={() => setShowComposeEmailModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                        <Send className="w-4 h-4" /> Compose
                    </button>
                    <button onClick={fetchEmails} className={`flex items-center gap-2 px-3 py-2 ${styles.card} border rounded-lg text-sm ${styles.hover}`}>
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={`lg:col-span-1 ${styles.card} border rounded-xl overflow-hidden`}>
                    <div className={`p-3 border-b ${styles.border}`}>
                        <p className={`text-sm font-medium ${styles.text}`}>Sent ({emails.length})</p>
                    </div>
                    <div className={`divide-y ${styles.divider} max-h-[500px] overflow-y-auto`}>
                        {emails.length === 0 ? (
                            <div className={`p-4 text-center ${styles.textMuted} text-sm`}>No emails yet</div>
                        ) : (
                            emails.map(email => (
                                <div key={email.emailId} onClick={() => setSelectedEmail(email)} className={`p-3 cursor-pointer ${styles.hover} ${selectedEmail?.emailId === email.emailId ? styles.selected : ""}`}>
                                    <p className={`text-sm font-medium truncate ${styles.text}`}>{email.to}</p>
                                    <p className={`text-sm truncate ${styles.textMuted}`}>{email.subject}</p>
                                    <p className={`text-xs ${styles.textMuted} mt-1`}>{formatDate(email.createdAt)}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className={`lg:col-span-2 ${styles.card} border rounded-xl`}>
                    {selectedEmail ? (
                        <div className="p-5">
                            <div className={`mb-4 pb-4 border-b ${styles.border}`}>
                                <h3 className={`text-lg font-semibold mb-2 ${styles.text}`}>{selectedEmail.subject}</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><span className={styles.textMuted}>To:</span><span className={`ml-2 ${styles.text}`}>{selectedEmail.to}</span></div>
                                    <div><span className={styles.textMuted}>From:</span><span className={`ml-2 ${styles.text}`}>{selectedEmail.from}</span></div>
                                    <div><span className={styles.textMuted}>Date:</span><span className={`ml-2 ${styles.text}`}>{formatDate(selectedEmail.createdAt)}</span></div>
                                    <div><span className={styles.textMuted}>Status:</span><span className="text-emerald-500 ml-2">{selectedEmail.status}</span></div>
                                </div>
                            </div>
                            <div className={`${styles.cardInner} rounded-lg p-4`}>
                                <pre className={`text-sm whitespace-pre-wrap font-sans ${styles.text}`}>{selectedEmail.body}</pre>
                            </div>
                        </div>
                    ) : (
                        <div className={`flex flex-col items-center justify-center h-64 ${styles.textMuted}`}>
                            <Mail className="w-12 h-12 mb-2 opacity-50" />
                            <p className="text-sm">Select an email to view</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // alerts management view
    const renderAlerts = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className={`text-xl font-semibold ${styles.text}`}>Alerts Management</h2>
                <button onClick={() => { setEditingAlert(null); setNewAlertMessage(""); setNewAlertType("info"); setNewAlertExpiry(""); setShowAlertModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                    <Plus className="w-4 h-4" /> Create Alert
                </button>
            </div>

            {alerts.length === 0 ? (
                <div className={`${styles.card} border rounded-xl p-8 text-center`}>
                    <Check className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <p className={styles.text}>No alerts</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {alerts.map(alert => (
                        <div key={alert.id} className={`flex items-start gap-4 p-4 rounded-xl border ${alert.type === "error" ? "bg-red-500/10 border-red-500/30" : alert.type === "warning" ? "bg-amber-500/10 border-amber-500/30" : "bg-blue-500/10 border-blue-500/30"}`}>
                            <AlertTriangle className={`w-5 h-5 mt-0.5 ${alert.type === "error" ? "text-red-500" : alert.type === "warning" ? "text-amber-500" : "text-blue-500"}`} />
                            <div className="flex-1">
                                <p className={styles.text}>{alert.message}</p>
                                <div className={`flex items-center gap-4 mt-1 ${styles.textMuted}`}>
                                    <p className="text-xs">{formatDate(alert.timestamp)}</p>
                                    {alert.expiresAt && <p className="text-xs flex items-center gap-1"><Timer className="w-3 h-3" /> Expires: {formatDate(alert.expiresAt)}</p>}
                                    {alert.isCustom && <span className={`text-xs px-1.5 py-0.5 rounded ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>Custom</span>}
                                </div>
                            </div>
                            {alert.isCustom && (
                                <div className="flex items-center gap-1">
                                    <button onClick={() => { setEditingAlert(alert); setNewAlertMessage(alert.message); setNewAlertType(alert.type); setNewAlertExpiry(alert.expiresAt || ""); setShowAlertModal(true); }} className={`p-2 rounded-lg ${styles.hover}`}>
                                        <Edit2 className={`w-4 h-4 ${styles.textMuted}`} />
                                    </button>
                                    <button onClick={() => handleDeleteAlert(alert.id)} className={`p-2 rounded-lg ${styles.hover}`}>
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            {toast && (
                <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"} text-white`}>
                    {toast.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    <span className="text-sm">{toast.message}</span>
                </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className={`text-2xl font-bold ${styles.text}`}>Admin Dashboard</h1>
                    <p className={styles.textMuted}>{adminEmail}</p>
                </div>
                <button onClick={refreshAllData} disabled={isLoading} className={`flex items-center gap-2 px-4 py-2 ${styles.card} border rounded-lg text-sm ${styles.hover} disabled:opacity-50`}>
                    <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh All
                </button>
            </div>

            <div className="flex gap-1 overflow-x-auto pb-2">
                {navigationTabs.map(tab => (
                    <button key={tab.id} onClick={() => setCurrentView(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${currentView === tab.id ? "bg-blue-600 text-white" : `${styles.textMuted} ${styles.hover}`}`}>
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {tab.badge ? <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{tab.badge}</span> : null}
                    </button>
                ))}
            </div>

            {currentView === "dashboard" && renderDashboard()}
            {currentView === "users" && renderUsers()}
            {currentView === "consultants" && renderConsultants()}
            {currentView === "projects" && renderProjects()}
            {currentView === "timelogs" && renderTimeLogs()}
            {currentView === "documents" && <AdminDocumentRequests adminEmail={adminEmail} adminName={adminName} onNavigate={onNavigate} />}
            {currentView === "messages" && <AdminMessages adminEmail={adminEmail} adminName={adminName} onNavigate={onNavigate} />}
            {currentView === "emails" && renderEmails()}
            {currentView === "alerts" && renderAlerts()}

            {showResetPasswordModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`${styles.card} border rounded-xl p-6 w-full max-w-md`}>
                        <h3 className={`text-lg font-semibold mb-4 ${styles.text}`}>Reset Password</h3>
                        <p className={`text-sm ${styles.textMuted} mb-4`}>For {selectedUser.email}</p>
                        <div className="flex gap-2 mb-4">
                            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" className={`flex-1 px-3 py-2 ${styles.input} border rounded-lg text-sm`} />
                            <button onClick={() => setNewPassword(generateRandomPassword())} className={`px-3 py-2 ${styles.card} border rounded-lg text-sm ${styles.hover}`}>Generate</button>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setShowResetPasswordModal(false); setSelectedUser(null); setNewPassword(""); }} className={`px-4 py-2 ${styles.textMuted} text-sm`}>Cancel</button>
                            <button onClick={handleResetPassword} disabled={!newPassword} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50">Reset</button>
                        </div>
                    </div>
                </div>
            )}

            {showChangeRoleModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`${styles.card} border rounded-xl p-6 w-full max-w-md`}>
                        <h3 className={`text-lg font-semibold mb-4 ${styles.text}`}>Change Role</h3>
                        <select value={newRole} onChange={e => setNewRole(e.target.value)} className={`w-full px-3 py-2 ${styles.input} border rounded-lg text-sm mb-4`}>
                            <option value="client">Client</option>
                            <option value="consultant">Consultant</option>
                            <option value="admin">Admin</option>
                        </select>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setShowChangeRoleModal(false); setSelectedUser(null); }} className={`px-4 py-2 ${styles.textMuted} text-sm`}>Cancel</button>
                            <button onClick={handleChangeRole} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {showComposeEmailModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`${styles.card} border rounded-xl p-6 w-full max-w-lg`}>
                        <h3 className={`text-lg font-semibold mb-4 ${styles.text}`}>Compose Email</h3>
                        <div className="space-y-3">
                            <div className="relative">
                                <label className={`text-sm ${styles.textMuted} block mb-1`}>To</label>
                                <input type="text" value={composeTo} onChange={e => handleEmailInput(e.target.value)} onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 200)} placeholder="Type name or email..." className={`w-full px-3 py-2 ${styles.input} border rounded-lg text-sm`} />
                                {showEmailSuggestions && emailSuggestions.length > 0 && (
                                    <div className={`absolute z-10 w-full mt-1 ${styles.card} border rounded-lg overflow-hidden shadow-lg`}>
                                        {emailSuggestions.map((suggestion, i) => (
                                            <div key={i} onMouseDown={() => { setComposeTo(suggestion.email); setShowEmailSuggestions(false); }} className={`px-3 py-2 cursor-pointer ${styles.hover}`}>
                                                <p className={`text-sm ${styles.text}`}>{suggestion.name}</p>
                                                <p className={`text-xs ${styles.textMuted}`}>{suggestion.email}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className={`text-sm ${styles.textMuted} block mb-1`}>Subject</label>
                                <input type="text" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} className={`w-full px-3 py-2 ${styles.input} border rounded-lg text-sm`} />
                            </div>
                            <div>
                                <label className={`text-sm ${styles.textMuted} block mb-1`}>Body</label>
                                <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} rows={6} className={`w-full px-3 py-2 ${styles.input} border rounded-lg text-sm resize-none`} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => { setShowComposeEmailModal(false); setComposeTo(""); setComposeSubject(""); setComposeBody(""); }} className={`px-4 py-2 ${styles.textMuted} text-sm`}>Cancel</button>
                            <button onClick={handleSendEmail} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"><Send className="w-4 h-4" /> Send</button>
                        </div>
                    </div>
                </div>
            )}

            {showAnnouncementModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`${styles.card} border rounded-xl p-6 w-full max-w-lg`}>
                        <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${styles.text}`}><Megaphone className="w-5 h-5" /> Send Announcement</h3>
                        <div className="space-y-3">
                            <div>
                                <label className={`text-sm ${styles.textMuted} block mb-1`}>Send To</label>
                                <select value={announcementTarget} onChange={e => setAnnouncementTarget(e.target.value as any)} className={`w-full px-3 py-2 ${styles.input} border rounded-lg text-sm`}>
                                    <option value="all">All ({users.length + consultants.length})</option>
                                    <option value="clients">Clients ({users.length})</option>
                                    <option value="consultants">Consultants ({consultants.length})</option>
                                </select>
                            </div>
                            <div>
                                <label className={`text-sm ${styles.textMuted} block mb-1`}>Subject</label>
                                <input type="text" value={announcementSubject} onChange={e => setAnnouncementSubject(e.target.value)} className={`w-full px-3 py-2 ${styles.input} border rounded-lg text-sm`} />
                            </div>
                            <div>
                                <label className={`text-sm ${styles.textMuted} block mb-1`}>Message</label>
                                <textarea value={announcementBody} onChange={e => setAnnouncementBody(e.target.value)} rows={6} className={`w-full px-3 py-2 ${styles.input} border rounded-lg text-sm resize-none`} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => { setShowAnnouncementModal(false); setAnnouncementSubject(""); setAnnouncementBody(""); }} className={`px-4 py-2 ${styles.textMuted} text-sm`}>Cancel</button>
                            <button onClick={handleSendAnnouncement} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"><Megaphone className="w-4 h-4" /> Send</button>
                        </div>
                    </div>
                </div>
            )}

            {showAlertModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`${styles.card} border rounded-xl p-6 w-full max-w-md`}>
                        <h3 className={`text-lg font-semibold mb-4 ${styles.text}`}>{editingAlert ? "Edit Alert" : "Create Alert"}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className={`text-sm ${styles.textMuted} block mb-1`}>Type</label>
                                <select value={newAlertType} onChange={e => setNewAlertType(e.target.value as AlertType)} className={`w-full px-3 py-2 ${styles.input} border rounded-lg text-sm`}>
                                    <option value="info">Info</option>
                                    <option value="warning">Warning</option>
                                    <option value="error">Error</option>
                                </select>
                            </div>
                            <div>
                                <label className={`text-sm ${styles.textMuted} block mb-1`}>Message</label>
                                <input type="text" value={newAlertMessage} onChange={e => setNewAlertMessage(e.target.value)} className={`w-full px-3 py-2 ${styles.input} border rounded-lg text-sm`} />
                            </div>
                            <div>
                                <label className={`text-sm ${styles.textMuted} block mb-1`}>Expires (optional)</label>
                                <input type="datetime-local" value={newAlertExpiry} onChange={e => setNewAlertExpiry(e.target.value)} className={`w-full px-3 py-2 ${styles.input} border rounded-lg text-sm`} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => { setShowAlertModal(false); setEditingAlert(null); setNewAlertMessage(""); setNewAlertExpiry(""); }} className={`px-4 py-2 ${styles.textMuted} text-sm`}>Cancel</button>
                            <button onClick={editingAlert ? handleUpdateAlert : handleCreateAlert} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">{editingAlert ? "Update" : "Create"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTab;