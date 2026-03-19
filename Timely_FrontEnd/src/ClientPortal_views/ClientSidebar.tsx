// src/ClientPortal_views/ClientSidebar.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    Home, FolderOpen, History, FileText, MessageCircle,
    Settings, User, LogOut, ChevronLeft, ChevronRight,
} from "lucide-react";
import timelyLogo from "../assets/Timely_logo.png";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientSidebarProps = {
    sidebarToggle: boolean;
    setSidebarToggle: (v: boolean) => void;
    activePage: string;
    onNavigate: (page: string) => void;
    onLogout?: () => void;
    userName?: string;
    userEmail?: string;
};

// ─── Last-seen helpers ────────────────────────────────────────────────────────

const LS_KEY = "timely_client_sidebar_last_seen";

const getLastSeen = (): Record<string, number> => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
    catch { return {}; }
};

const markSeen = (sectionId: string) => {
    const current = getLastSeen();
    current[sectionId] = Date.now();
    localStorage.setItem(LS_KEY, JSON.stringify(current));
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safeFetch = async (url: string) => {
    try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); }
    catch { return null; }
};

const toEpoch = (v: any): number => {
    if (!v) return 0;
    if (typeof v === "number") return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

// ─── Component ────────────────────────────────────────────────────────────────

const ClientSidebar: React.FC<ClientSidebarProps> = ({
    sidebarToggle, setSidebarToggle,
    activePage, onNavigate, onLogout,
    userName = "Client", userEmail = "",
}) => {
    const { isDark } = useTheme();
    const collapsed = sidebarToggle;

    const n = {
        sidebar:    isDark ? "bg-[#0a0a0a] border-gray-800" : "bg-white border-gray-200",
        text:       isDark ? "text-white"       : "text-gray-900",
        secondary:  isDark ? "text-gray-200"    : "text-gray-700",
        tertiary:   isDark ? "text-gray-400"    : "text-gray-500",
        label:      isDark ? "text-blue-400"    : "text-blue-600",
        flat:       isDark ? "neu-dark-flat"    : "neu-light-flat",
        inset:      isDark ? "neu-dark-inset"   : "neu-light-inset",
        pressed:    isDark ? "neu-dark-pressed" : "neu-light-pressed",
        card:       isDark ? "neu-dark"         : "neu-light",
        divider:    isDark ? "border-gray-800"  : "border-gray-200",
        activeBar:  "bg-blue-500",
        activeIcon: "bg-blue-600 text-white",
        hover:      isDark ? "hover:bg-blue-500/10" : "hover:bg-blue-50",
        gb:         isDark ? "group-hover:text-blue-400" : "group-hover:text-blue-600",
    };

    // ── Notification badges ───────────────────────────────────────────────────
    const [badges, setBadges] = useState<Record<string, number>>({});
    const mountedRef = useRef(true);
    const activePageRef = useRef(activePage);
    activePageRef.current = activePage;

    const loadBadges = useCallback(async () => {
        const lastSeen = getLastSeen();
        const counts: Record<string, number> = {};

        try {
            // ── Projects: new or updated since last seen ──────────────────
            const pRes = await safeFetch("/api/projects");
            if (pRes?.data) {
                const seenAt = lastSeen.projects || 0;
                const newCount = pRes.data.filter((p: any) => {
                    const created = toEpoch(p.createdAt);
                    const updated = toEpoch(p.updatedAt || p.lastModified);
                    return Math.max(created, updated) > seenAt;
                }).length;
                if (newCount > 0) counts.projects = newCount;
            }

            // ── Messages: unread count ────────────────────────────────────
            const threads = JSON.parse(localStorage.getItem("timely_message_threads") || "[]");
            const currentEmail = JSON.parse(localStorage.getItem("timely_user") || "{}").email || userEmail;
            let unread = 0;
            threads.forEach((t: any) => {
                (t.messages || []).forEach((m: any) => {
                    if (!m.read && m.from?.email !== currentEmail) unread++;
                });
            });
            if (unread > 0) counts.messages = unread;

            // ── Documents: new since last seen ────────────────────────────
            const dRes = await safeFetch("/api/documents");
            if (dRes?.data) {
                const docSeen = lastSeen.documents || 0;
                const newDocs = dRes.data.filter((d: any) => {
                    const created = toEpoch(d.createdAt || d.uploadedAt);
                    return created > docSeen;
                }).length;
                if (newDocs > 0) counts.documents = newDocs;
            }

            // ── History: new entries since last seen ──────────────────────
            const hRes = await safeFetch("/api/activity");
            if (hRes?.data) {
                const historySeen = lastSeen.history || 0;
                const newActivity = hRes.data.filter((a: any) => {
                    const created = toEpoch(a.createdAt || a.timestamp);
                    return created > historySeen;
                }).length;
                if (newActivity > 0) counts.history = newActivity;
            }
        } catch {
            // Badges are non-critical
        }

        // Never show a badge for the page the user is currently on
        delete counts[activePageRef.current];

        if (mountedRef.current) setBadges(counts);
    }, [userEmail]);

    // Initial load + polling
    useEffect(() => {
        mountedRef.current = true;
        loadBadges();
        const interval = setInterval(loadBadges, 15000);
        return () => { mountedRef.current = false; clearInterval(interval); };
    }, [loadBadges]);

    // Listen for in-app data changes
    useEffect(() => {
        const refresh = () => loadBadges();
        const events = [
            "project-change", "message-change", "document-change",
            "activity-change", "storage",
        ];
        events.forEach(e => window.addEventListener(e, refresh));
        return () => events.forEach(e => window.removeEventListener(e, refresh));
    }, [loadBadges]);

    // When active page changes, mark it seen and clear its badge
    useEffect(() => {
        markSeen(activePage);
        setBadges(prev => {
            if (!prev[activePage]) return prev;
            const next = { ...prev };
            delete next[activePage];
            return next;
        });
    }, [activePage]);

    // ── Navigation handler ────────────────────────────────────────────────────
    const handleNavigate = (id: string) => {
        markSeen(id);
        setBadges(prev => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });
        onNavigate(id);
    };

    // ── Derived values ────────────────────────────────────────────────────────
    const initials = (userName || "C")
        .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

    const navItems = [
        { id: "dashboard", label: "Dashboard", icon: Home },
        { id: "projects",  label: "Projects",  icon: FolderOpen },
        { id: "documents", label: "Documents", icon: FileText },
        { id: "messages",  label: "Messages",  icon: MessageCircle },
        { id: "history",   label: "History",   icon: History },
    ];

    const bottomItems = [
        { id: "settings", label: "Settings", icon: Settings },
        { id: "profile",  label: "Profile",  icon: User },
    ];

    // ── Nav item renderer ─────────────────────────────────────────────────────
    const NavItem: React.FC<{
        id: string; label: string;
        icon: React.ComponentType<{ className?: string }>; isLogout?: boolean;
        badge?: number;
    }> = ({ id, label, icon: Icon, isLogout = false, badge = 0 }) => {
        const isActive = activePage === id;
        return (
            <li
                className={`relative mb-0.5 rounded-xl cursor-pointer select-none transition-all duration-200 group
                    ${collapsed ? "flex justify-center" : ""}
                    ${isActive ? n.pressed : isLogout ? "hover:bg-red-500/10" : n.hover}`}
                onClick={() => isLogout ? onLogout?.() : handleNavigate(id)}
                title={collapsed ? label : undefined}
            >
                {isActive && !collapsed && (
                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 ${n.activeBar} rounded-r-full`} />
                )}
                <div className={`${collapsed ? "p-2.5" : "px-3 py-2.5"} flex items-center gap-3 transition-colors duration-200
                    ${isActive ? n.label : isLogout ? "text-red-500" : isDark ? "text-gray-300" : "text-gray-800"}`}>

                    {/* Icon container */}
                    <div className={`relative ${collapsed ? "w-9 h-9" : "w-8 h-8"} rounded-lg flex items-center justify-center transition-all duration-200
                        ${isActive ? n.activeIcon : isLogout ? "bg-red-500/10 text-red-500" : n.inset}
                        ${!isActive && !isLogout ? "group-hover:scale-105" : ""}`}>
                        <Icon className="w-4 h-4" />
                        {/* Notification dot on icon */}
                        {badge > 0 && !isActive && (
                            <span
                                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${id === "messages" ? "bg-red-500" : "bg-blue-500"}`}
                                style={{ boxShadow: `0 0 0 2px ${isDark ? '#0a0a0a' : '#ffffff'}` }}
                            />
                        )}
                    </div>

                    {/* Label + badge */}
                    {!collapsed && (
                        <>
                            <span className={`text-sm font-medium flex-1 ${isActive ? n.text : ""} ${!isActive && !isLogout ? n.gb : ""} transition-colors`}>
                                {label}
                            </span>
                            {badge > 0 && !isActive && (
                                <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold
                                    flex items-center justify-center
                                    ${id === "messages"
                                        ? "bg-red-500 text-white"
                                        : isDark
                                            ? "bg-blue-500/20 text-blue-300"
                                            : "bg-blue-100 text-blue-700"
                                    }`}>
                                    {badge > 99 ? "99+" : badge}
                                </span>
                            )}
                        </>
                    )}

                    {/* Collapsed badge — just the dot on the icon handles it */}
                </div>
            </li>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <aside className={`fixed top-0 left-0 h-full border-r z-50 flex flex-col transition-all duration-300
            ${n.sidebar} ${collapsed ? "w-20" : "w-64"}`}>
            <div className="h-full flex flex-col px-3 py-5">

                {/* Logo */}
                <div className="mb-6 px-1">
                    <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                            ${isDark ? "bg-white/20 border border-white/10" : "bg-black/10 border border-black/5"}`}>
                            <img src={timelyLogo} alt="Timely" className="w-8 h-8 object-contain" />
                        </div>
                        {!collapsed && (
                            <div>
                                <h1 className={`text-lg font-semibold tracking-tight ${n.text}`}>Timely</h1>
                                <p className={`text-[10px] tracking-[0.2em] uppercase ${n.tertiary}`}>Client Portal</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Nav */}
                <div className="flex-1 overflow-y-auto">
                    <div className="mb-6">
                        {!collapsed && (
                            <p className={`px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] ${n.label}`}>Menu</p>
                        )}
                        <ul>
                            {navItems.map(item => (
                                <NavItem
                                    key={item.id}
                                    {...item}
                                    badge={badges[item.id] || 0}
                                />
                            ))}
                        </ul>
                    </div>

                    <div className="mb-6">
                        {!collapsed && (
                            <p className={`px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] ${n.tertiary}`}>Account</p>
                        )}
                        <ul>
                            {bottomItems.map(item => <NavItem key={item.id} {...item} />)}
                        </ul>
                    </div>
                </div>

                {/* Bottom */}
                <div className="mt-auto">
                    <div className={`h-px ${n.divider} border-t mb-3`} />
                    <ul>
                        {onLogout && <NavItem id="logout" label="Logout" icon={LogOut} isLogout />}
                    </ul>

                    {/* User card */}
                    <div
                        onClick={() => handleNavigate("profile")}
                        className={`mt-3 ${collapsed ? "p-2 flex justify-center" : "p-3"} ${n.card} ${n.hover} group rounded-xl transition-all duration-200 cursor-pointer`}
                    >
                        {collapsed ? (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white">
                                {initials}
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-sm">
                                    {initials}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${n.text} ${n.gb} truncate transition-colors`}>{userName}</p>
                                    <p className={`text-[11px] ${n.tertiary} truncate`}>{userEmail}</p>
                                </div>
                                <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Collapse toggle */}
            <button
                onClick={() => setSidebarToggle(!collapsed)}
                className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 border rounded-r-lg flex items-center justify-center transition-colors
                    ${isDark ? "bg-[#111111] border-gray-800 text-gray-500 hover:text-white" : "bg-white border-gray-200 text-gray-400 hover:text-gray-900"}`}
            >
                {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
            </button>
        </aside>
    );
};

export default ClientSidebar;