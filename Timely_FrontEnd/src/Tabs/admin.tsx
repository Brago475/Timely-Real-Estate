// src/Tabs/admin.tsx
import React, { useEffect, useState, useMemo } from "react";
import { Users, Briefcase, FolderOpen, Mail, Shield, Clock, AlertTriangle, RefreshCw, Search, Key, UserCheck, BarChart3, PieChart, Send, Check, X, Download, Megaphone, Ban, CheckCircle, XCircle, Plus, Edit2, Trash2, Timer, FileText, MessageCircle, Info } from "lucide-react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import AdminDocumentRequests from "./AdminDocumentRequests";
import Messages from "./Messages";

const API_BASE = "";
type UserRole = "admin" | "consultant" | "client";
type UserStatus = "active" | "inactive" | "suspended";
type ApprovalStatus = "pending" | "approved" | "denied";
type AlertType = "warning" | "error" | "info";
type AdminView = "dashboard" | "users" | "consultants" | "projects" | "timelogs" | "alerts" | "documents" | "messages";

interface User { customerId: string; clientCode: string; firstName: string; middleName: string; lastName: string; email: string; tempPassword: string; status?: UserStatus; role?: string; }
interface Consultant { consultantId: string; consultantCode: string; firstName: string; lastName: string; email: string; role: string; status?: UserStatus; }
interface Project { projectId: string; projectCode: string; projectName: string; clientName: string; status: string; }
interface HoursLog { logId: string; projectId: string; consultantId: string; date: string; hours: number; description: string; createdAt: string; approvalStatus?: ApprovalStatus; }
interface Alert { id: string; type: AlertType; message: string; timestamp: string; expiresAt?: string; isCustom?: boolean; }
interface AdminTabProps { onNavigate?: (page: string) => void; }
interface Toast { id: string; message: string; type: "success" | "error" | "info"; }

const fmtStatus = (s: string): string => s ? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "";
const fmtDate = (iso: string): string => iso ? new Date(iso).toLocaleString() : "";
const genPassword = (): string => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@$%"; let p = ""; for (let i = 0; i < 12; i++) p += c[Math.floor(Math.random() * c.length)]; return p; };
const exportCSV = (data: any[], filename: string, onOk: (m: string) => void, onErr: (m: string) => void) => { if (!data.length) { onErr("No data"); return; } const h = Object.keys(data[0]); const csv = [h.join(","), ...data.map(r => h.map(k => { const v = r[k] ?? ""; return typeof v === "string" && (v.includes(",") || v.includes('"')) ? `"${v.replace(/"/g, '""')}"` : v; }).join(","))].join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`; a.click(); onOk(`Exported ${data.length} records`); };
const getPendingDocs = (): number => { try { return JSON.parse(localStorage.getItem("timely_document_requests") || "[]").filter((r: any) => r.status === "uploaded").length; } catch { return 0; } };
const getUnreadMsgs = (): number => { try { return JSON.parse(localStorage.getItem("timely_global_messages") || "[]").filter((m: any) => !m.read && m.from?.role === "client").length; } catch { return 0; } };

const AdminTab: React.FC<AdminTabProps> = ({ onNavigate }) => {
    const { isDark } = useTheme();

    const n = {
        bg: isDark ? "neu-bg-dark" : "neu-bg-light", card: isDark ? "neu-dark" : "neu-light",
        flat: isDark ? "neu-dark-flat" : "neu-light-flat", inset: isDark ? "neu-dark-inset" : "neu-light-inset",
        pressed: isDark ? "neu-dark-pressed" : "neu-light-pressed",
        text: isDark ? "text-white" : "text-gray-900", secondary: isDark ? "text-gray-300" : "text-gray-600",
        tertiary: isDark ? "text-gray-500" : "text-gray-500", strong: isDark ? "text-white" : "text-black",
        label: isDark ? "text-blue-400" : "text-blue-600", link: isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-500",
        badge: isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700",
        input: isDark ? "bg-transparent border-gray-700 text-white" : "bg-transparent border-gray-300 text-gray-900",
        modal: isDark ? "bg-[#111111] border-gray-800" : "bg-white border-gray-200",
        modalHead: isDark ? "bg-[#111111]" : "bg-white",
        btnPrimary: "bg-blue-600 hover:bg-blue-500 text-white", btnSecondary: isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-800",
        btnDanger: "bg-red-600 hover:bg-red-500 text-white", divider: isDark ? "border-gray-800" : "border-gray-200",
        edgeHover: isDark
            ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]"
            : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),0_4px_12px_rgba(0,0,0,0.08)]",
        edgeHoverFlat: isDark
            ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),4px_4px_10px_rgba(0,0,0,0.6),-4px_-4px_10px_rgba(40,40,40,0.1)]"
            : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_2px_8px_rgba(0,0,0,0.06)]",
        barBg: isDark ? "bg-gray-800" : "bg-gray-200",
        actionHover: isDark ? "hover:bg-gray-800" : "hover:bg-blue-50",
    };

    const [currentView, setCurrentView] = useState<AdminView>("dashboard");
    const [adminEmail, setAdminEmail] = useState("admin@timely.com");
    const [adminName, setAdminName] = useState("Admin");
    const [users, setUsers] = useState<User[]>([]);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [hoursLogs, setHoursLogs] = useState<HoursLog[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [pendingDocRequests, setPendingDocRequests] = useState(0);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [userStatusFilter, setUserStatusFilter] = useState<"all" | UserStatus>("all");
    const [timelogStatusFilter, setTimelogStatusFilter] = useState<"all" | ApprovalStatus>("all");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [showResetPwModal, setShowResetPwModal] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [showAnnounceModal, setShowAnnounceModal] = useState(false);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [newRole, setNewRole] = useState("");
    const [announceSubject, setAnnounceSubject] = useState("");
    const [announceBody, setAnnounceBody] = useState("");
    const [announceTarget, setAnnounceTarget] = useState<"all" | "clients" | "consultants">("all");
    const [alertMsg, setAlertMsg] = useState("");
    const [alertType, setAlertType] = useState<AlertType>("info");
    const [alertExpiry, setAlertExpiry] = useState("");

    const [toasts, setToasts] = useState<Toast[]>([]);
    const showToast = (msg: string, type: "success" | "error" | "info" = "success") => { const id = `t_${Date.now()}`; setToasts(p => [...p, { id, message: msg, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000); };

    const safeFetch = async (url: string) => { try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); } catch { return null; } };
    const fetchUsers = async () => { const d = await safeFetch(`${API_BASE}/api/orgs/me`); if (d?.data?.members) setUsers(d.data.members.map((m: any) => { const u = m.user || m; return { customerId: String(m.userId || u.id || ''), clientCode: u.code || '', firstName: u.firstName || m.firstName || '', middleName: u.middleName || '', lastName: u.lastName || m.lastName || '', email: u.email || m.email || '', tempPassword: '', status: (m.status || 'active') as UserStatus, role: m.role || 'client' }; })); };
    const fetchConsultants = async () => { const d = await safeFetch(`${API_BASE}/api/consultants`); if (d?.data) setConsultants(d.data.map((c: Consultant) => ({ ...c, status: c.status || "active" }))); };
    const fetchProjects = async () => { const d = await safeFetch(`${API_BASE}/api/projects`); if (d?.data) setProjects(d.data); };
    const fetchHours = async () => { const d = await safeFetch(`${API_BASE}/api/hours-logs`); if (d?.data) setHoursLogs(d.data); };

    const genAlerts = () => {
        const sys: Alert[] = [];
        const susp = users.filter(u => u.status === "suspended").length;
        const pend = hoursLogs.filter(l => l.approvalStatus === "pending").length;
        if (susp > 0) sys.push({ id: "sys-s", type: "warning", message: `${susp} user(s) suspended`, timestamp: new Date().toISOString() });
        if (pend > 0) sys.push({ id: "sys-p", type: "warning", message: `${pend} time log(s) pending`, timestamp: new Date().toISOString() });
        const custom = alerts.filter(a => a.isCustom && (!a.expiresAt || new Date(a.expiresAt) > new Date()));
        setAlerts([...sys, ...custom]);
    };

    const refreshAll = async () => { setIsLoading(true); await Promise.all([fetchUsers(), fetchConsultants(), fetchProjects(), fetchHours()]); setPendingDocRequests(getPendingDocs()); setUnreadMessages(getUnreadMsgs()); setIsLoading(false); };

    useEffect(() => { try { const s = sessionStorage.getItem("timely_user") || localStorage.getItem("timely_user"); if (s) { const u = JSON.parse(s); if (u?.email) setAdminEmail(u.email); if (u?.firstName) setAdminName(`${u.firstName} ${u.lastName || ""}`); } const sa = localStorage.getItem("timely_custom_alerts"); if (sa) setAlerts(JSON.parse(sa).filter((a: Alert) => a.isCustom)); } catch {} refreshAll(); }, []);
    useEffect(() => { genAlerts(); }, [users, projects, hoursLogs]);
    useEffect(() => { localStorage.setItem("timely_custom_alerts", JSON.stringify(alerts.filter(a => a.isCustom))); }, [alerts]);
    useEffect(() => { if (currentView === "documents") setPendingDocRequests(getPendingDocs()); if (currentView === "messages") setUnreadMessages(getUnreadMsgs()); }, [currentView]);

    const stats = useMemo(() => ({ activeUsers: users.filter(u => u.status === "active").length, inactiveUsers: users.filter(u => u.status === "inactive").length, suspendedUsers: users.filter(u => u.status === "suspended").length, totalHours: hoursLogs.reduce((s, l) => s + (Number(l.hours) || 0), 0), pendingLogs: hoursLogs.filter(l => l.approvalStatus === "pending").length, approvedLogs: hoursLogs.filter(l => l.approvalStatus === "approved").length, deniedLogs: hoursLogs.filter(l => l.approvalStatus === "denied").length }), [users, hoursLogs]);

    const filteredUsers = useMemo(() => users.filter(u => { const ms = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(searchTerm.toLowerCase()); const mf = userStatusFilter === "all" || u.status === userStatusFilter; return ms && mf; }), [users, searchTerm, userStatusFilter]);
    const filteredLogs = useMemo(() => hoursLogs.filter(l => timelogStatusFilter === "all" || l.approvalStatus === timelogStatusFilter), [hoursLogs, timelogStatusFilter]);

    const getConName = (cid: string) => { const c = consultants.find(c => c.consultantId === cid); return c ? `${c.firstName} ${c.lastName}` : `#${cid}`; };
    const getProjName = (pid: string) => projects.find(p => p.projectId === pid)?.projectName || `#${pid}`;
    const getConHours = (cid: string) => hoursLogs.filter(l => l.consultantId === cid).reduce((s, l) => s + (Number(l.hours) || 0), 0);
    const getProjHours = (pid: string) => hoursLogs.filter(l => l.projectId === pid).reduce((s, l) => s + (Number(l.hours) || 0), 0);

    const handleResetPw = () => { if (!selectedUser || !newPassword) return; showToast(`Password reset for ${selectedUser.email}`); setShowResetPwModal(false); setNewPassword(""); setSelectedUser(null); };
    const handleChangeRole = () => { if (!selectedUser || !newRole) return; setUsers(p => p.map(u => u.customerId === selectedUser.customerId ? { ...u, role: newRole } : u)); showToast(`Role → ${newRole}`); setShowRoleModal(false); setNewRole(""); setSelectedUser(null); };
    const toggleUserSusp = (u: User) => { const ns: UserStatus = u.status === "suspended" ? "active" : "suspended"; setUsers(p => p.map(x => x.customerId === u.customerId ? { ...x, status: ns } : x)); showToast(`${u.firstName} ${ns === "suspended" ? "suspended" : "activated"}`); };
    const toggleConSusp = (c: Consultant) => { const ns: UserStatus = c.status === "suspended" ? "active" : "suspended"; setConsultants(p => p.map(x => x.consultantId === c.consultantId ? { ...x, status: ns } : x)); showToast(`${c.firstName} ${ns === "suspended" ? "suspended" : "activated"}`); };
    const approveLog = (id: string) => { setHoursLogs(p => p.map(l => l.logId === id ? { ...l, approvalStatus: "approved" as const } : l)); showToast("Approved"); };
    const denyLog = (id: string) => { setHoursLogs(p => p.map(l => l.logId === id ? { ...l, approvalStatus: "denied" as const } : l)); showToast("Denied"); };

    const sendAnnounce = async () => { if (!announceSubject || !announceBody) { showToast("Subject and body required", "error"); return; } let recip: string[] = []; if (announceTarget === "all" || announceTarget === "clients") recip.push(...users.map(u => u.email)); if (announceTarget === "all" || announceTarget === "consultants") recip.push(...consultants.map(c => c.email)); let sent = 0; for (const email of recip) { try { const r = await fetch(`${API_BASE}/api/emails/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: email, from: "noreply@timely.com", subject: `[Announcement] ${announceSubject}`, body: announceBody }) }); if (r.ok) sent++; } catch {} } showToast(`Sent to ${sent} recipients`); setShowAnnounceModal(false); setAnnounceSubject(""); setAnnounceBody(""); };

    const createAlert = () => { if (!alertMsg) { showToast("Message required", "error"); return; } setAlerts(p => [...p, { id: `c-${Date.now()}`, type: alertType, message: alertMsg, timestamp: new Date().toISOString(), expiresAt: alertExpiry || undefined, isCustom: true }]); setAlertMsg(""); setAlertExpiry(""); setShowAlertModal(false); showToast("Alert created"); };
    const updateAlert = () => { if (!editingAlert || !alertMsg) return; setAlerts(p => p.map(a => a.id === editingAlert.id ? { ...a, message: alertMsg, type: alertType, expiresAt: alertExpiry || undefined } : a)); setEditingAlert(null); setAlertMsg(""); setAlertExpiry(""); setShowAlertModal(false); showToast("Updated"); };
    const deleteAlert = (id: string) => { setAlerts(p => p.filter(a => a.id !== id)); showToast("Deleted"); };

    const statusBadge = (s: string) => s === "active" ? (isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700") : s === "suspended" ? (isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700") : (isDark ? "bg-gray-500/20 text-gray-400" : "bg-gray-100 text-gray-600");
    const approvalBadge = (s: string) => s === "approved" ? (isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700") : s === "denied" ? (isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700") : (isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700");

    const tabs: { id: AdminView; label: string; icon: any; badge?: number }[] = [
        { id: "dashboard", label: "Overview", icon: BarChart3 },
        { id: "users", label: "Clients", icon: Users },
        { id: "consultants", label: "Consultants", icon: Briefcase },
        { id: "projects", label: "Projects", icon: FolderOpen },
        { id: "timelogs", label: "Time Logs", icon: Clock, badge: stats.pendingLogs || undefined },
        { id: "documents", label: "Documents", icon: FileText, badge: pendingDocRequests || undefined },
        { id: "messages", label: "Messages", icon: MessageCircle, badge: unreadMessages || undefined },
        { id: "alerts", label: "Alerts", icon: AlertTriangle, badge: alerts.length || undefined },
    ];

    const Modal: React.FC<{ show: boolean; onClose: () => void; title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ show, onClose, title, icon, children }) => {
        if (!show) return null;
        return (<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"><div className={`${n.modal} border rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto`}><div className={`p-5 border-b ${n.divider} flex items-center justify-between sticky top-0 ${n.modalHead}`}><h2 className={`text-lg font-semibold ${n.text} flex items-center gap-2`}>{icon}{title}</h2><button onClick={onClose} className={`p-2 rounded-lg ${n.actionHover}`}><X className={`w-4 h-4 ${n.tertiary}`} /></button></div><div className="p-5 space-y-4">{children}</div></div></div>);
    };

    return (
        <div className={`${n.bg} min-h-screen ${n.text}`}>
            <div className="fixed top-4 right-4 z-[10000] space-y-2">{toasts.map(t => (<div key={t.id} className={`${n.card} flex items-center gap-3 px-4 py-3 rounded-xl text-sm animate-fadeIn`}>{t.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === "error" ? <XCircle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}<span>{t.message}</span><button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className={n.tertiary}><X className="w-3.5 h-3.5" /></button></div>))}</div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex items-start justify-between mb-6">
                    <div><h1 className={`text-2xl font-semibold tracking-tight ${n.strong} mb-1`}>Admin</h1><p className={`text-sm ${n.secondary}`}>{adminEmail}</p></div>
                    <button onClick={refreshAll} disabled={isLoading} className={`w-9 h-9 ${n.flat} flex items-center justify-center ${isLoading ? "animate-spin" : ""}`}><RefreshCw className={`w-4 h-4 ${n.secondary}`} /></button>
                </div>

                <div className={`${n.card} p-0.5 flex rounded-xl mb-8 overflow-x-auto`}>
                    {tabs.map(t => (<button key={t.id} onClick={() => setCurrentView(t.id)} className={`px-4 py-2.5 text-sm rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${currentView === t.id ? n.btnPrimary : isDark ? n.secondary : "text-gray-700 hover:text-blue-600"}`}><t.icon className="w-3.5 h-3.5" />{t.label}{t.badge ? <span className="w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{t.badge}</span> : null}</button>))}
                </div>

                <div key={currentView} className="animate-fadeIn">

                {/* ═══ DASHBOARD ═══ */}
                {currentView === "dashboard" && (<div className="space-y-8">
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setShowAnnounceModal(true)} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><Megaphone className="w-3.5 h-3.5" />Announce</button>
                        <button onClick={() => onNavigate?.("InviteMembers")} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><Plus className="w-3.5 h-3.5" />Invite Member</button>
                        <button onClick={() => onNavigate?.("projects")} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><FolderOpen className="w-3.5 h-3.5" />Projects</button>
                        <button onClick={() => onNavigate?.("hours")} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><Clock className="w-3.5 h-3.5" />Hours</button>
                        <button onClick={() => setCurrentView("documents")} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><FileText className="w-3.5 h-3.5" />Documents</button>
                        <button onClick={() => setCurrentView("messages")} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><MessageCircle className="w-3.5 h-3.5" />Messages{unreadMessages > 0 && <span className="w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{unreadMessages}</span>}</button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {[{ l: "Clients", v: users.filter(u => u.role === "client").length, c: "" }, { l: "Active", v: stats.activeUsers, c: "" }, { l: "Suspended", v: stats.suspendedUsers, c: stats.suspendedUsers > 0 ? (isDark ? "text-red-400" : "text-red-600") : "" }, { l: "Consultants", v: consultants.length, c: "" }, { l: "Projects", v: projects.length, c: "" }, { l: "Hours", v: stats.totalHours.toFixed(1), c: "" }].map((s, i) => (
                            <div key={i} className={`${n.card} ${n.edgeHover} p-4 transition-all duration-200`}><span className={`${n.label} text-[11px] uppercase tracking-wider`}>{s.l}</span><p className={`text-2xl font-semibold ${s.c || n.strong} mt-1`}>{s.v}</p></div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className={`${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                            <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${n.text}`}><PieChart className={`w-4 h-4 ${n.label}`} />User Status</h3>
                            <div className="flex items-center justify-center"><div className="relative w-28 h-28"><svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">{users.length > 0 ? (<><circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#10b981" strokeWidth="3" strokeDasharray={`${(stats.activeUsers / users.length) * 100} 100`} /><circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#6b7280" strokeWidth="3" strokeDasharray={`${(stats.inactiveUsers / users.length) * 100} 100`} strokeDashoffset={`-${(stats.activeUsers / users.length) * 100}`} /><circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#ef4444" strokeWidth="3" strokeDasharray={`${(stats.suspendedUsers / users.length) * 100} 100`} strokeDashoffset={`-${((stats.activeUsers + stats.inactiveUsers) / users.length) * 100}`} /></>) : <circle cx="18" cy="18" r="15.9" fill="transparent" stroke={isDark ? "#1f2937" : "#e5e7eb"} strokeWidth="3" />}</svg><div className="absolute inset-0 flex items-center justify-center"><span className={`text-lg font-bold ${n.strong}`}>{users.length}</span></div></div></div>
                            <div className="flex justify-center gap-4 mt-4 text-xs">{[{ c: "bg-emerald-500", l: "Active" }, { c: "bg-gray-500", l: "Inactive" }, { c: "bg-red-500", l: "Suspended" }].map((x, i) => <div key={i} className="flex items-center gap-1"><div className={`w-2.5 h-2.5 rounded-full ${x.c}`} /><span className={n.tertiary}>{x.l}</span></div>)}</div>
                        </div>
                        <div className={`${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                            <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${n.text}`}><BarChart3 className={`w-4 h-4 ${n.label}`} />Time Log Status</h3>
                            <div className="space-y-3">{[{ l: "Pending", v: stats.pendingLogs, c: "bg-amber-500", t: isDark ? "text-amber-400" : "text-amber-600" }, { l: "Approved", v: stats.approvedLogs, c: "bg-emerald-500", t: isDark ? "text-emerald-400" : "text-emerald-600" }, { l: "Denied", v: stats.deniedLogs, c: "bg-red-500", t: isDark ? "text-red-400" : "text-red-600" }].map((x, i) => (<div key={i}><div className={`flex justify-between text-xs mb-1 ${n.tertiary}`}><span>{x.l}</span><span className={x.t}>{x.v}</span></div><div className={`h-2 ${n.barBg} rounded-full overflow-hidden`}><div className={`h-full ${x.c} rounded-full`} style={{ width: `${hoursLogs.length ? (x.v / hoursLogs.length) * 100 : 0}%` }} /></div></div>))}</div>
                        </div>
                        <div className={`${n.card} ${n.edgeHover} p-5 transition-all duration-200`}>
                            <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${n.text}`}><Clock className={`w-4 h-4 ${n.label}`} />Hours by Consultant</h3>
                            <div className="space-y-2 max-h-44 overflow-y-auto">{consultants.length === 0 ? <p className={`${n.tertiary} text-sm text-center py-4`}>No consultants</p> : consultants.slice(0, 6).map(c => { const h = getConHours(c.consultantId); const mx = Math.max(...consultants.map(x => getConHours(x.consultantId)), 1); return (<div key={c.consultantId}><div className={`flex justify-between text-xs mb-1 ${n.tertiary}`}><span className="truncate">{c.firstName} {c.lastName}</span><span className={n.label}>{h}h</span></div><div className={`h-1.5 ${n.barBg} rounded-full overflow-hidden`}><div className="h-full bg-blue-500 rounded-full" style={{ width: `${(h / mx) * 100}%` }} /></div></div>); })}</div>
                        </div>
                    </div>

                    {alerts.length > 0 && <div className={`${n.card} p-5`}><h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${n.text}`}><AlertTriangle className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-amber-600"}`} />Alerts</h3><div className="space-y-1.5">{alerts.slice(0, 3).map(a => (<div key={a.id} className={`${n.flat} p-2.5 flex items-center gap-2 text-xs`}><AlertTriangle className={`w-3 h-3 ${a.type === "error" ? (isDark ? "text-red-400" : "text-red-600") : a.type === "warning" ? (isDark ? "text-amber-400" : "text-amber-600") : n.label}`} /><span className={n.text}>{a.message}</span></div>))}</div></div>}
                </div>)}

                {/* ═══ CLIENTS ═══ */}
                {currentView === "users" && (<div className="space-y-6">
                    <div className="flex items-center justify-between"><h2 className={`text-lg font-semibold ${n.strong}`}>Client Management</h2><div className="flex gap-2"><button onClick={() => exportCSV(users, "clients", showToast, m => showToast(m, "error"))} className={`w-9 h-9 ${n.flat} flex items-center justify-center`}><Download className={`w-4 h-4 ${n.secondary}`} /></button><button onClick={fetchUsers} className={`w-9 h-9 ${n.flat} flex items-center justify-center`}><RefreshCw className={`w-4 h-4 ${n.secondary}`} /></button></div></div>
                    <div className="flex gap-3"><div className={`flex-1 ${n.flat} flex items-center gap-2 px-4 py-2.5`}><Search className={`w-4 h-4 ${n.tertiary}`} /><input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} /></div><select value={userStatusFilter} onChange={e => setUserStatusFilter(e.target.value as any)} className={`px-3 py-2 ${n.input} border rounded-xl text-sm`}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className={`lg:col-span-2 ${n.card} p-1.5 space-y-1.5`}>
                            <div className={`${n.flat} grid grid-cols-12 gap-4 px-4 py-3`}><div className={`col-span-3 text-xs ${n.label}`}>Member</div><div className={`col-span-3 text-xs ${n.label}`}>Email</div><div className={`col-span-2 text-xs ${n.label}`}>Role</div><div className={`col-span-2 text-xs ${n.label}`}>Status</div><div className={`col-span-2 text-xs ${n.label} text-right`}>Actions</div></div>
                            {filteredUsers.length === 0 ? <div className={`${n.flat} text-center py-12`}><Users className={`w-8 h-8 ${n.tertiary} mx-auto mb-2`} /><p className={`text-sm ${n.secondary}`}>No members</p></div> : filteredUsers.map(u => (
                                <div key={u.customerId} onClick={() => setSelectedUser(u)} className={`${n.flat} ${n.edgeHoverFlat} grid grid-cols-12 gap-4 px-4 py-3 cursor-pointer transition-all duration-200 ${selectedUser?.customerId === u.customerId ? "ring-1 ring-blue-500/30" : ""}`}>
                                    <div className="col-span-3 flex items-center gap-3"><div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{(u.firstName || '?')[0]}{(u.lastName || '?')[0]}</div><div><p className={`${n.text} text-sm font-medium`}>{u.firstName} {u.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{u.clientCode}</p></div></div>
                                    <div className="col-span-3 flex items-center"><span className={`${n.secondary} text-sm truncate`}>{u.email}</span></div>
                                    <div className="col-span-2 flex items-center"><span className={`text-[10px] px-2 py-0.5 rounded-lg ${n.badge} capitalize`}>{u.role || "client"}</span></div>
                                    <div className="col-span-2 flex items-center"><span className={`text-[10px] px-2 py-0.5 rounded-lg ${statusBadge(u.status || "active")}`}>{fmtStatus(u.status || "active")}</span></div>
                                    <div className="col-span-2 flex items-center justify-end gap-1"><button onClick={e => { e.stopPropagation(); setSelectedUser(u); setShowResetPwModal(true); }} className={`p-1.5 ${n.actionHover} rounded-lg`}><Key className={`w-3.5 h-3.5 ${n.tertiary}`} /></button><button onClick={e => { e.stopPropagation(); toggleUserSusp(u); }} className={`p-1.5 ${n.actionHover} rounded-lg`}><Ban className={`w-3.5 h-3.5 ${u.status === "suspended" ? "text-red-400" : n.tertiary}`} /></button></div>
                                </div>
                            ))}
                        </div>
                        <div className={`${n.card} p-5`}>{selectedUser ? (<div className="space-y-4"><div className="flex items-center gap-3"><div className={`w-12 h-12 ${n.inset} rounded-full flex items-center justify-center text-sm font-semibold ${n.secondary}`}>{(selectedUser.firstName || '?')[0]}{(selectedUser.lastName || '?')[0]}</div><div><h3 className={`font-semibold ${n.text}`}>{selectedUser.firstName} {selectedUser.lastName}</h3><p className={`${n.tertiary} text-xs`}>{selectedUser.clientCode}</p></div></div><div className={`space-y-2.5 pt-3 border-t ${n.divider}`}><div className="flex items-center gap-3"><Mail className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`text-sm ${n.text}`}>{selectedUser.email}</span></div><div className="flex items-center gap-3"><Shield className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`text-sm capitalize ${n.text}`}>{selectedUser.role}</span></div><div className="flex items-center gap-3"><UserCheck className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`text-sm capitalize ${selectedUser.status === "active" ? (isDark ? "text-emerald-400" : "text-emerald-600") : selectedUser.status === "suspended" ? (isDark ? "text-red-400" : "text-red-600") : n.secondary}`}>{selectedUser.status}</span></div></div><div className={`flex gap-2 pt-3 border-t ${n.divider}`}><button onClick={() => { setNewRole(selectedUser.role || "client"); setShowRoleModal(true); }} className={`flex-1 px-3 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Role</button><button onClick={() => setShowResetPwModal(true)} className={`flex-1 px-3 py-2.5 ${n.btnPrimary} rounded-xl text-sm`}>Reset PW</button></div></div>) : (<div className={`flex flex-col items-center justify-center h-64 ${n.tertiary}`}><Users className="w-10 h-10 mb-2 opacity-30" /><p className="text-sm">Select a member</p></div>)}</div>
                    </div>
                </div>)}

                {/* ═══ CONSULTANTS ═══ */}
                {currentView === "consultants" && (<div className="space-y-6">
                    <div className="flex items-center justify-between"><h2 className={`text-lg font-semibold ${n.strong}`}>Consultant Management</h2><div className="flex gap-2"><button onClick={() => exportCSV(consultants, "consultants", showToast, m => showToast(m, "error"))} className={`w-9 h-9 ${n.flat} flex items-center justify-center`}><Download className={`w-4 h-4 ${n.secondary}`} /></button><button onClick={fetchConsultants} className={`w-9 h-9 ${n.flat} flex items-center justify-center`}><RefreshCw className={`w-4 h-4 ${n.secondary}`} /></button></div></div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className={`lg:col-span-2 ${n.card} p-1.5 space-y-1.5`}>
                            <div className={`${n.flat} grid grid-cols-12 gap-4 px-4 py-3`}><div className={`col-span-4 text-xs ${n.label}`}>Consultant</div><div className={`col-span-2 text-xs ${n.label}`}>Role</div><div className={`col-span-2 text-xs ${n.label}`}>Hours</div><div className={`col-span-2 text-xs ${n.label}`}>Status</div><div className={`col-span-2 text-xs ${n.label} text-right`}>→</div></div>
                            {consultants.length === 0 ? <div className={`${n.flat} text-center py-12`}><Briefcase className={`w-8 h-8 ${n.tertiary} mx-auto mb-2`} /><p className={`text-sm ${n.secondary}`}>No consultants</p></div> : consultants.map(c => (
                                <div key={c.consultantId} onClick={() => setSelectedConsultant(c)} className={`${n.flat} ${n.edgeHoverFlat} grid grid-cols-12 gap-4 px-4 py-3 cursor-pointer transition-all duration-200 ${selectedConsultant?.consultantId === c.consultantId ? "ring-1 ring-blue-500/30" : ""}`}>
                                    <div className="col-span-4 flex items-center gap-3"><div className={`w-8 h-8 ${n.inset} rounded-full flex items-center justify-center text-[10px] font-semibold ${n.secondary}`}>{c.firstName[0]}{c.lastName[0]}</div><div><p className={`${n.text} text-sm font-medium`}>{c.firstName} {c.lastName}</p><p className={`${n.tertiary} text-[11px]`}>{c.consultantCode}</p></div></div>
                                    <div className="col-span-2 flex items-center"><span className={`text-[10px] px-2 py-0.5 rounded-lg ${n.badge}`}>{c.role || "Consultant"}</span></div>
                                    <div className="col-span-2 flex items-center"><span className={`${n.secondary} text-sm`}>{getConHours(c.consultantId)}h</span></div>
                                    <div className="col-span-2 flex items-center"><span className={`text-[10px] px-2 py-0.5 rounded-lg ${statusBadge(c.status || "active")}`}>{fmtStatus(c.status || "active")}</span></div>
                                    <div className="col-span-2 flex items-center justify-end"><button onClick={e => { e.stopPropagation(); toggleConSusp(c); }} className={`p-1.5 ${n.actionHover} rounded-lg`}><Ban className={`w-3.5 h-3.5 ${c.status === "suspended" ? "text-red-400" : n.tertiary}`} /></button></div>
                                </div>
                            ))}
                        </div>
                        <div className={`${n.card} p-5`}>{selectedConsultant ? (<div className="space-y-4"><div className="flex items-center gap-3"><div className={`w-12 h-12 ${n.inset} rounded-full flex items-center justify-center text-sm font-semibold ${n.secondary}`}>{selectedConsultant.firstName[0]}{selectedConsultant.lastName[0]}</div><div><h3 className={`font-semibold ${n.text}`}>{selectedConsultant.firstName} {selectedConsultant.lastName}</h3><p className={`${n.tertiary} text-xs`}>{selectedConsultant.consultantCode}</p></div></div><div className={`space-y-2.5 pt-3 border-t ${n.divider}`}><div className="flex items-center gap-3"><Mail className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`text-sm ${n.text}`}>{selectedConsultant.email}</span></div><div className="flex items-center gap-3"><Briefcase className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`text-sm ${n.text}`}>{selectedConsultant.role || "Consultant"}</span></div><div className="flex items-center gap-3"><Clock className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`text-sm ${n.text}`}>{getConHours(selectedConsultant.consultantId)}h logged</span></div></div></div>) : (<div className={`flex flex-col items-center justify-center h-64 ${n.tertiary}`}><Briefcase className="w-10 h-10 mb-2 opacity-30" /><p className="text-sm">Select a consultant</p></div>)}</div>
                    </div>
                </div>)}

                {/* ═══ PROJECTS ═══ */}
                {currentView === "projects" && (<div className="space-y-6">
                    <div className="flex items-center justify-between"><h2 className={`text-lg font-semibold ${n.strong}`}>Project Management</h2><div className="flex gap-2"><button onClick={() => exportCSV(projects, "projects", showToast, m => showToast(m, "error"))} className={`w-9 h-9 ${n.flat} flex items-center justify-center`}><Download className={`w-4 h-4 ${n.secondary}`} /></button><button onClick={fetchProjects} className={`w-9 h-9 ${n.flat} flex items-center justify-center`}><RefreshCw className={`w-4 h-4 ${n.secondary}`} /></button></div></div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className={`lg:col-span-2 ${n.card} p-1.5 space-y-1.5`}>
                            <div className={`${n.flat} grid grid-cols-12 gap-4 px-4 py-3`}><div className={`col-span-4 text-xs ${n.label}`}>Project</div><div className={`col-span-3 text-xs ${n.label}`}>Client</div><div className={`col-span-3 text-xs ${n.label}`}>Status</div><div className={`col-span-2 text-xs ${n.label}`}>Hours</div></div>
                            {projects.length === 0 ? <div className={`${n.flat} text-center py-12`}><FolderOpen className={`w-8 h-8 ${n.tertiary} mx-auto mb-2`} /><p className={`text-sm ${n.secondary}`}>No projects</p></div> : projects.map(p => (
                                <div key={p.projectId} onClick={() => setSelectedProject(p)} className={`${n.flat} ${n.edgeHoverFlat} grid grid-cols-12 gap-4 px-4 py-3 cursor-pointer transition-all duration-200 ${selectedProject?.projectId === p.projectId ? "ring-1 ring-blue-500/30" : ""}`}>
                                    <div className="col-span-4"><p className={`${n.text} text-sm font-medium`}>{p.projectName}</p><p className={`${n.tertiary} text-[11px]`}>{p.projectCode}</p></div>
                                    <div className="col-span-3 flex items-center"><span className={`${n.secondary} text-sm`}>{p.clientName || "—"}</span></div>
                                    <div className="col-span-3 flex items-center"><span className={`text-[10px] px-2 py-0.5 rounded-lg ${n.badge}`}>{fmtStatus(p.status || "pending")}</span></div>
                                    <div className="col-span-2 flex items-center"><span className={`${n.secondary} text-sm`}>{getProjHours(p.projectId)}h</span></div>
                                </div>
                            ))}
                        </div>
                        <div className={`${n.card} p-5`}>{selectedProject ? (<div className="space-y-4"><h3 className={`font-semibold ${n.text}`}>{selectedProject.projectName}</h3><p className={`${n.tertiary} text-xs`}>{selectedProject.projectCode}</p><div className={`space-y-2.5 pt-3 border-t ${n.divider}`}><div className="flex items-center gap-3"><Users className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`text-sm ${n.text}`}>{selectedProject.clientName || "Unassigned"}</span></div><div className="flex items-center gap-3"><FolderOpen className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`text-sm ${n.text}`}>{fmtStatus(selectedProject.status || "pending")}</span></div><div className="flex items-center gap-3"><Clock className={`w-3.5 h-3.5 ${n.tertiary}`} /><span className={`text-sm ${n.text}`}>{getProjHours(selectedProject.projectId)}h logged</span></div></div></div>) : (<div className={`flex flex-col items-center justify-center h-64 ${n.tertiary}`}><FolderOpen className="w-10 h-10 mb-2 opacity-30" /><p className="text-sm">Select a project</p></div>)}</div>
                    </div>
                </div>)}

                {/* ═══ TIME LOGS ═══ */}
                {currentView === "timelogs" && (<div className="space-y-6">
                    <div className="flex items-center justify-between"><h2 className={`text-lg font-semibold ${n.strong}`}>Time Log Approvals</h2><div className="flex gap-2"><button onClick={() => exportCSV(hoursLogs.map(l => ({ ...l, consultant: getConName(l.consultantId), project: getProjName(l.projectId) })), "timelogs", showToast, m => showToast(m, "error"))} className={`w-9 h-9 ${n.flat} flex items-center justify-center`}><Download className={`w-4 h-4 ${n.secondary}`} /></button><button onClick={fetchHours} className={`w-9 h-9 ${n.flat} flex items-center justify-center`}><RefreshCw className={`w-4 h-4 ${n.secondary}`} /></button></div></div>
                    <select value={timelogStatusFilter} onChange={e => setTimelogStatusFilter(e.target.value as any)} className={`px-3 py-2 ${n.input} border rounded-xl text-sm`}><option value="all">All ({hoursLogs.length})</option><option value="pending">Pending ({stats.pendingLogs})</option><option value="approved">Approved ({stats.approvedLogs})</option><option value="denied">Denied ({stats.deniedLogs})</option></select>
                    <div className={`${n.card} p-1.5 space-y-1.5`}>
                        <div className={`${n.flat} grid grid-cols-12 gap-4 px-4 py-3`}><div className={`col-span-2 text-xs ${n.label}`}>Date</div><div className={`col-span-3 text-xs ${n.label}`}>Consultant</div><div className={`col-span-3 text-xs ${n.label}`}>Project</div><div className={`col-span-1 text-xs ${n.label}`}>Hours</div><div className={`col-span-1 text-xs ${n.label}`}>Status</div><div className={`col-span-2 text-xs ${n.label} text-right`}>Actions</div></div>
                        {filteredLogs.length === 0 ? <div className={`${n.flat} text-center py-12`}><Clock className={`w-8 h-8 ${n.tertiary} mx-auto mb-2`} /><p className={`text-sm ${n.secondary}`}>No logs</p></div> : filteredLogs.map(l => (
                            <div key={l.logId} className={`${n.flat} ${n.edgeHoverFlat} grid grid-cols-12 gap-4 px-4 py-3 transition-all duration-200`}>
                                <div className="col-span-2"><span className={`${n.secondary} text-sm`}>{l.date}</span></div>
                                <div className="col-span-3"><span className={`${n.text} text-sm`}>{getConName(l.consultantId)}</span></div>
                                <div className="col-span-3"><span className={`${n.text} text-sm truncate`}>{getProjName(l.projectId)}</span></div>
                                <div className="col-span-1"><span className={`${n.label} text-sm font-semibold`}>{l.hours}h</span></div>
                                <div className="col-span-1"><span className={`text-[10px] px-2 py-0.5 rounded-lg ${approvalBadge(l.approvalStatus || "pending")}`}>{fmtStatus(l.approvalStatus || "pending")}</span></div>
                                <div className="col-span-2 flex items-center justify-end gap-1">
                                    <button onClick={() => approveLog(l.logId)} className={`p-1.5 rounded-lg ${l.approvalStatus === "approved" ? (isDark ? "bg-emerald-500/20" : "bg-emerald-100") : n.actionHover}`}><CheckCircle className={`w-3.5 h-3.5 ${l.approvalStatus === "approved" ? (isDark ? "text-emerald-400" : "text-emerald-600") : n.tertiary}`} /></button>
                                    <button onClick={() => denyLog(l.logId)} className={`p-1.5 rounded-lg ${l.approvalStatus === "denied" ? (isDark ? "bg-red-500/20" : "bg-red-100") : n.actionHover}`}><XCircle className={`w-3.5 h-3.5 ${l.approvalStatus === "denied" ? (isDark ? "text-red-400" : "text-red-600") : n.tertiary}`} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>)}

                {/* ═══ ALERTS ═══ */}
                {currentView === "alerts" && (<div className="space-y-6">
                    <div className="flex items-center justify-between"><h2 className={`text-lg font-semibold ${n.strong}`}>Alerts</h2><button onClick={() => { setEditingAlert(null); setAlertMsg(""); setAlertType("info"); setAlertExpiry(""); setShowAlertModal(true); }} className={`${n.btnPrimary} px-4 py-2.5 rounded-xl text-sm flex items-center gap-2`}><Plus className="w-3.5 h-3.5" />Create</button></div>
                    {alerts.length === 0 ? <div className={`${n.card} p-8 text-center`}><Check className={`w-10 h-10 ${isDark ? "text-emerald-400" : "text-emerald-600"} mx-auto mb-3`} /><p className={n.text}>No alerts</p></div> : <div className="space-y-1.5">{alerts.map(a => (
                        <div key={a.id} className={`${n.card} ${n.edgeHover} p-4 flex items-start gap-3 transition-all duration-200`}>
                            <AlertTriangle className={`w-4 h-4 mt-0.5 ${a.type === "error" ? (isDark ? "text-red-400" : "text-red-600") : a.type === "warning" ? (isDark ? "text-amber-400" : "text-amber-600") : n.label}`} />
                            <div className="flex-1"><p className={`${n.text} text-sm`}>{a.message}</p><div className={`flex items-center gap-4 mt-1`}><p className={`text-[10px] ${n.tertiary}`}>{fmtDate(a.timestamp)}</p>{a.expiresAt && <p className={`text-[10px] ${n.tertiary} flex items-center gap-1`}><Timer className="w-3 h-3" />Expires: {fmtDate(a.expiresAt)}</p>}{a.isCustom && <span className={`text-[10px] px-1.5 py-0.5 rounded ${n.badge}`}>Custom</span>}</div></div>
                            {a.isCustom && <div className="flex items-center gap-1"><button onClick={() => { setEditingAlert(a); setAlertMsg(a.message); setAlertType(a.type); setAlertExpiry(a.expiresAt || ""); setShowAlertModal(true); }} className={`p-1.5 ${n.actionHover} rounded-lg`}><Edit2 className={`w-3.5 h-3.5 ${n.tertiary}`} /></button><button onClick={() => deleteAlert(a.id)} className="p-1.5 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button></div>}
                        </div>
                    ))}</div>}
                </div>)}

                {currentView === "documents" && <AdminDocumentRequests adminEmail={adminEmail} adminName={adminName} onNavigate={onNavigate} />}
                {currentView === "messages" && <Messages userRole="admin" />}

                </div>
            </div>

            <Modal show={showResetPwModal && !!selectedUser} onClose={() => { setShowResetPwModal(false); setNewPassword(""); }} title="Reset Password" icon={<Key className={`w-5 h-5 ${n.label}`} />}>
                <p className={`text-sm ${n.secondary}`}>For {selectedUser?.email}</p>
                <div className="flex gap-2"><input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" className={`flex-1 px-3 py-2.5 ${n.input} border rounded-xl text-sm font-mono`} /><button onClick={() => setNewPassword(genPassword())} className={`px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Generate</button></div>
                <div className="flex gap-3"><button onClick={() => { setShowResetPwModal(false); setNewPassword(""); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button><button onClick={handleResetPw} disabled={!newPassword} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm disabled:opacity-50`}>Reset</button></div>
            </Modal>

            <Modal show={showRoleModal && !!selectedUser} onClose={() => { setShowRoleModal(false); setSelectedUser(null); }} title="Change Role">
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="client">Client</option><option value="consultant">Consultant</option><option value="admin">Admin</option></select>
                <div className="flex gap-3"><button onClick={() => { setShowRoleModal(false); setSelectedUser(null); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button><button onClick={handleChangeRole} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm`}>Save</button></div>
            </Modal>

            <Modal show={showAnnounceModal} onClose={() => { setShowAnnounceModal(false); setAnnounceSubject(""); setAnnounceBody(""); }} title="Announcement" icon={<Megaphone className={`w-5 h-5 ${n.label}`} />}>
                <div><label className={`${n.label} text-[11px] block mb-1`}>Send To</label><select value={announceTarget} onChange={e => setAnnounceTarget(e.target.value as any)} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="all">All ({users.length + consultants.length})</option><option value="clients">Clients ({users.filter(u => u.role === "client").length})</option><option value="consultants">Consultants ({consultants.length})</option></select></div>
                <div><label className={`${n.label} text-[11px] block mb-1`}>Subject</label><input type="text" value={announceSubject} onChange={e => setAnnounceSubject(e.target.value)} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                <div><label className={`${n.label} text-[11px] block mb-1`}>Message</label><textarea value={announceBody} onChange={e => setAnnounceBody(e.target.value)} rows={6} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none`} /></div>
                <div className="flex gap-3"><button onClick={() => { setShowAnnounceModal(false); setAnnounceSubject(""); setAnnounceBody(""); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button><button onClick={sendAnnounce} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center justify-center gap-2`}><Megaphone className="w-3.5 h-3.5" />Send</button></div>
            </Modal>

            <Modal show={showAlertModal} onClose={() => { setShowAlertModal(false); setEditingAlert(null); setAlertMsg(""); setAlertExpiry(""); }} title={editingAlert ? "Edit Alert" : "Create Alert"} icon={<AlertTriangle className={`w-5 h-5 ${n.label}`} />}>
                <div><label className={`${n.label} text-[11px] block mb-1`}>Type</label><select value={alertType} onChange={e => setAlertType(e.target.value as AlertType)} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="info">Info</option><option value="warning">Warning</option><option value="error">Error</option></select></div>
                <div><label className={`${n.label} text-[11px] block mb-1`}>Message</label><input type="text" value={alertMsg} onChange={e => setAlertMsg(e.target.value)} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                <div><label className={`${n.label} text-[11px] block mb-1`}>Expires (optional)</label><input type="datetime-local" value={alertExpiry} onChange={e => setAlertExpiry(e.target.value)} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} /></div>
                <div className="flex gap-3"><button onClick={() => { setShowAlertModal(false); setEditingAlert(null); setAlertMsg(""); setAlertExpiry(""); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button><button onClick={editingAlert ? updateAlert : createAlert} className={`flex-1 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm`}>{editingAlert ? "Update" : "Create"}</button></div>
            </Modal>
        </div>
    );
};

export default AdminTab;