// src/Style_Components/Sidebar.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Home, FolderOpen, Globe, Users, UserCheck, BarChart3, Clock,
    Settings, LogOut, ChevronLeft, ChevronRight, ArrowLeft, Shield,
    UserPlus, MessageCircle,
} from "lucide-react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import { getGradient } from "./Navbar";
import timelyLogo from "../assets/Timely_logo.png";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
    sidebarToggle: boolean;
    setSidebarToggle?: (v: boolean) => void;
    onNavigate: (page: string) => void;
    onBack?: () => void;
    isAdmin: boolean;
    activePage?: string;
    userName?: string;
    userEmail?: string;
    userRole?: string;
};

// ─── Last-seen helpers ────────────────────────────────────────────────────────

const LS_KEY = "timely_sidebar_last_seen";

const getLastSeen = (): Record<string, number> => {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    } catch {
        return {};
    }
};

const markSeen = (sectionId: string) => {
    const current = getLastSeen();
    current[sectionId] = Date.now();
    localStorage.setItem(LS_KEY, JSON.stringify(current));
};

// ─── API helper ───────────────────────────────────────────────────────────────

const safeFetch = async (url: string) => {
    try {
        const r = await fetch(url);
        if (!r.ok) return null;
        return await r.json();
    } catch {
        return null;
    }
};

// ─── Timestamp extractor (works with ISO strings and epoch ms) ────────────────

const toEpoch = (v: any): number => {
    if (!v) return 0;
    if (typeof v === "number") return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

// ─── Component ────────────────────────────────────────────────────────────────

const Sidebar: React.FC<Props> = ({
    sidebarToggle, setSidebarToggle, onNavigate, onBack, isAdmin,
    activePage = "dashboard", userName = "User", userEmail = "", userRole = "client",
}) => {
    const { isDark } = useTheme();
    const isConsultant = userRole === "consultant";

    const hover = isDark ? "hover:bg-blue-500/10" : "hover:bg-blue-50";
    const gb    = isDark ? "group-hover:text-blue-400" : "group-hover:text-blue-600";

    const n = {
        sidebar:    isDark ? "bg-[#0a0a0a] border-gray-800" : "bg-white border-gray-200",
        text:       isDark ? "text-white"       : "text-gray-900",
        secondary:  isDark ? "text-gray-200"    : "text-gray-700",
        tertiary:   isDark ? "text-gray-400"    : "text-gray-500",
        label:      isDark ? "text-blue-400"    : "text-blue-600",
        flat:       isDark ? "neu-dark-flat"     : "neu-light-flat",
        inset:      isDark ? "neu-dark-inset"    : "neu-light-inset",
        pressed:    isDark ? "neu-dark-pressed"  : "neu-light-pressed",
        card:       isDark ? "neu-dark"          : "neu-light",
        divider:    isDark ? "border-gray-800"   : "border-gray-200",
        activeBar:  "bg-blue-500",
        activeIcon: "bg-blue-600 text-white",
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
            // ── Projects: count created or updated since last seen ─────────
            const pRes = await safeFetch("/api/projects");
            if (pRes?.data) {
                const seenAt = lastSeen.projects || 0;
                const newProjects = pRes.data.filter((p: any) => {
                    const created = toEpoch(p.createdAt);
                    const updated = toEpoch(p.updatedAt || p.lastModified);
                    return Math.max(created, updated) > seenAt;
                }).length;
                if (newProjects > 0) counts.projects = newProjects;

                // ── Listings: count published or updated since last seen ──
                const listingSeen = lastSeen.listings || 0;
                const newListings = pRes.data.filter((p: any) => {
                    if (!p.isPublished) return false;
                    const published = toEpoch(p.publishedAt);
                    const updated   = toEpoch(p.updatedAt || p.lastModified);
                    return Math.max(published, updated) > listingSeen;
                }).length;
                if (newListings > 0) counts.listings = newListings;
            }

            // ── Messages: unread count ────────────────────────────────────
            const threads = JSON.parse(localStorage.getItem("timely_message_threads") || "[]");
            const currentUserEmail = JSON.parse(localStorage.getItem("timely_user") || "{}").email || userEmail;
            let unread = 0;
            threads.forEach((t: any) => {
                (t.messages || []).forEach((m: any) => {
                    if (!m.read && m.from?.email !== currentUserEmail) unread++;
                });
            });
            if (unread > 0) counts.messages = unread;

            // ── Hours: new entries since last seen ────────────────────────
            const hRes = await safeFetch("/api/hours-logs");
            if (hRes?.data) {
                const hoursSeen = lastSeen.hours || 0;
                const newEntries = hRes.data.filter((h: any) => {
                    const created = toEpoch(h.createdAt || h.date);
                    return created > hoursSeen;
                }).length;
                if (newEntries > 0) counts.hours = newEntries;
            }

            // ── Clients: new since last seen ──────────────────────────────
            const cRes = await safeFetch("/api/orgs/me");
            if (cRes?.data?.members) {
                const clientSeen = lastSeen.client || 0;
                const newClients = cRes.data.members.filter((m: any) => {
                    if (m.role !== "client") return false;
                    const joined = toEpoch(m.createdAt || m.joinedAt);
                    return joined > clientSeen;
                }).length;
                if (newClients > 0) counts.client = newClients;
            }

            // ── Consultants: new since last seen ──────────────────────────
            const coRes = await safeFetch("/api/consultants");
            if (coRes?.data) {
                const consSeen = lastSeen.consultants || 0;
                const newCons = coRes.data.filter((c: any) => {
                    const created = toEpoch(c.createdAt || c.joinedAt);
                    return created > consSeen;
                }).length;
                if (newCons > 0) counts.consultants = newCons;
            }

            // ── Reports: check for new generated reports ──────────────────
            const rRes = await safeFetch("/api/reports");
            if (rRes?.data) {
                const reportSeen = lastSeen.reports || 0;
                const newReports = rRes.data.filter((r: any) => {
                    const created = toEpoch(r.createdAt || r.generatedAt);
                    return created > reportSeen;
                }).length;
                if (newReports > 0) counts.reports = newReports;
            }
        } catch {
            // Silently ignore — badges are non-critical
        }

        // Also check localStorage-only projects (offline-created)
        try {
            const localProjects = JSON.parse(localStorage.getItem("timely_projects") || "[]");
            const seenAt = lastSeen.projects || 0;
            const localNew = localProjects.filter((p: any) => {
                const created = toEpoch(p.createdAt);
                const updated = toEpoch(p.updatedAt || p.lastModified);
                return Math.max(created, updated) > seenAt;
            }).length;
            // Merge with API count (avoid double-counting by taking max)
            if (localNew > (counts.projects || 0)) {
                counts.projects = localNew;
            }
        } catch {}

        // Never show a badge for the page the user is currently on
        delete counts[activePageRef.current];

        if (mountedRef.current) setBadges(counts);
    }, [userEmail]);

    // Initial load + polling
    useEffect(() => {
        mountedRef.current = true;
        loadBadges();
        const interval = setInterval(loadBadges, 15000);
        return () => {
            mountedRef.current = false;
            clearInterval(interval);
        };
    }, [loadBadges]);

    // Listen for in-app data changes (projects, messages, hours, etc.)
    useEffect(() => {
        const refresh = () => loadBadges();
        const events = [
            "assignment-change", "project-change", "message-change",
            "hours-change", "listing-change", "storage",
        ];
        events.forEach(e => window.addEventListener(e, refresh));
        return () => events.forEach(e => window.removeEventListener(e, refresh));
    }, [loadBadges]);

    // When the active page changes, mark it seen and clear its badge immediately
    useEffect(() => {
        markSeen(activePage);
        setBadges(prev => {
            if (!prev[activePage]) return prev;
            const next = { ...prev };
            delete next[activePage];
            return next;
        });
    }, [activePage]);

    // ── Navigation handler — marks section as seen ────────────────────────────
    const handleNavigate = (id: string) => {
        markSeen(id);

        // Remove badge immediately for responsive feel
        setBadges(prev => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });

        onNavigate(id);
    };

    // ── Derived values ────────────────────────────────────────────────────────
    const initials  = (userName || "U").split(" ").map(x => x[0]).join("").toUpperCase().slice(0, 2);
    const roleLabel = userRole === "admin" ? "Administrator" : userRole === "consultant" ? "Consultant" : "Client";
    const gradient  = getGradient(userName, userEmail);

    // ── Menu structure ────────────────────────────────────────────────────────
    const menuItems = [
        { id: "dashboard",   label: "Dashboard",   icon: Home },
        { id: "projects",    label: "Projects",    icon: FolderOpen },
        ...(isAdmin || isConsultant ? [{ id: "listings", label: "Listings", icon: Globe }] : []),
        { id: "client",      label: "Clients",     icon: Users },
        { id: "consultants", label: "Consultants", icon: UserCheck },
        { id: "reports",     label: "Reports",     icon: BarChart3 },
        { id: "hours",       label: "Hours",       icon: Clock },
        ...(isConsultant ? [{ id: "messages", label: "Messages", icon: MessageCircle }] : []),
    ];

    const adminItems = [
        { id: "admin",         label: "Admin Panel",    icon: Shield },
        { id: "InviteMembers", label: "Invite Members", icon: UserPlus },
    ];

    // ── Nav item renderer ─────────────────────────────────────────────────────
    const NavItem = ({
        id, label, icon: Icon, isActive, isLogout = false, badge = 0,
    }: {
        id: string; label: string;
        icon: React.ComponentType<{ className?: string }>;
        isActive: boolean; isLogout?: boolean; badge?: number;
    }) => (
        <li
            className={`relative mb-0.5 rounded-xl cursor-pointer select-none transition-all duration-200 group
                ${isActive ? n.pressed : isLogout ? "hover:bg-red-500/10" : hover}`}
            onClick={() => isLogout ? onNavigate(id) : handleNavigate(id)}
        >
            {/* Active indicator bar */}
            {isActive && (
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 ${n.activeBar} rounded-r-full`} />
            )}

            <div className={`px-3 py-2.5 flex items-center gap-3 transition-colors duration-200
                ${isActive ? n.label : isLogout ? "text-red-500" : isDark ? "text-gray-300" : "text-gray-800"}`}>

                {/* Icon container */}
                <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
                    ${isActive ? n.activeIcon : isLogout ? "bg-red-500/10 text-red-500" : n.inset}
                    ${!isActive && !isLogout ? "group-hover:scale-105" : ""}`}>
                    <Icon className="w-4 h-4" />
                    {/* Dot indicator on icon for subtle hint */}
                    {badge > 0 && !isActive && (
                        <span
                            className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${id === "messages" ? "bg-red-500" : "bg-blue-500"}`}
                            style={{ boxShadow: `0 0 0 2px ${isDark ? '#0a0a0a' : '#ffffff'}` }}
                        />
                    )}
                </div>

                {/* Label */}
                <span className={`text-sm font-medium flex-1
                    ${isActive ? n.text : ""}
                    ${!isActive && !isLogout ? gb : ""} transition-colors`}>
                    {label}
                </span>

                {/* Badge pill */}
                {badge > 0 && !isActive && (
                    <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold
                        flex items-center justify-center animate-fadeIn
                        ${id === "messages"
                            ? "bg-red-500 text-white"
                            : isDark
                                ? "bg-blue-500/20 text-blue-300"
                                : "bg-blue-100 text-blue-700"
                        }`}>
                        {badge > 99 ? "99+" : badge}
                    </span>
                )}
            </div>
        </li>
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <aside className={`${sidebarToggle ? "w-0 -translate-x-full" : "w-72 translate-x-0"} ${n.sidebar} fixed top-0 left-0 h-full border-r transition-all duration-300 ease-in-out z-40 overflow-hidden`}>
            <div className="h-full flex flex-col px-4 py-5">

                {/* Logo */}
                <div className="mb-8 px-2">
                    <div className="flex items-center gap-3">
                        {onBack && activePage !== "dashboard" ? (
                            <button onClick={onBack} className={`w-9 h-9 ${n.inset} rounded-xl flex items-center justify-center ${n.tertiary} transition-colors`}>
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        ) : (
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-white/20 border border-white/10" : "bg-black/10 border border-black/5"}`}>
                                <img src={timelyLogo} alt="Timely" className="w-8 h-8 object-contain" />
                            </div>
                        )}
                        <div>
                            <h1 className={`text-lg font-semibold tracking-tight ${n.text}`}>Timely</h1>
                            <p className={`text-[10px] tracking-[0.2em] uppercase ${n.tertiary}`}>Real Estate</p>
                        </div>
                    </div>
                </div>

                {/* Main Nav */}
                <div className="flex-1 overflow-y-auto">
                    <div className="mb-6">
                        <p className={`px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] ${n.label}`}>Menu</p>
                        <ul>
                            {menuItems.map(item => (
                                <NavItem
                                    key={item.id}
                                    id={item.id}
                                    label={item.label}
                                    icon={item.icon}
                                    isActive={activePage === item.id}
                                    badge={badges[item.id] || 0}
                                />
                            ))}
                        </ul>
                    </div>

                    {isAdmin && (
                        <div className="mb-6">
                            <p className={`px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] ${isDark ? "text-amber-400" : "text-amber-700"}`}>Administration</p>
                            <ul>
                                {adminItems.map(item => (
                                    <NavItem
                                        key={item.id}
                                        id={item.id}
                                        label={item.label}
                                        icon={item.icon}
                                        isActive={activePage === item.id}
                                    />
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Bottom */}
                <div className="mt-auto">
                    <div className={`h-px ${n.divider} border-t mb-3`} />
                    <ul>
                        <NavItem id="settings" label="Settings" icon={Settings} isActive={activePage === "settings"} />
                        <NavItem id="logout"   label="Logout"   icon={LogOut}   isActive={false} isLogout />
                    </ul>

                    {/* User card */}
                    <div onClick={() => handleNavigate("profile")} className={`mt-3 p-3 ${n.card} ${hover} group rounded-xl transition-all duration-200 cursor-pointer`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-sm`}>{initials}</div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${n.text} ${gb} truncate transition-colors`}>{userName}</p>
                                <p className={`text-[11px] ${n.tertiary} ${gb} truncate transition-colors`}>{roleLabel}</p>
                            </div>
                            <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
                        </div>
                    </div>
                </div>

                {/* Collapse toggle */}
                {setSidebarToggle && (
                    <button
                        onClick={() => setSidebarToggle(!sidebarToggle)}
                        className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 ${
                            isDark
                                ? "bg-[#111111] border-gray-800 text-gray-500 hover:text-white"
                                : "bg-white border-gray-200 text-gray-400 hover:text-gray-900"
                        } border rounded-r-lg flex items-center justify-center transition-colors`}
                    >
                        {sidebarToggle ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                    </button>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;