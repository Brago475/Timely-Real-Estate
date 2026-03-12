// src/Style_Components/Navbar.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    Menu, Search, Bell, ChevronRight, Settings, LogOut,
    User, FolderOpen, Home, X, Clock, CheckCircle,
    AlertTriangle, Mail, MessageCircle,
} from "lucide-react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import { useNotifications } from "./Notifications";

type UserRole = "admin" | "consultant" | "client";

type SearchResult = {
    type: "project" | "consultant" | "client" | "page";
    id: string;
    name: string;
    subtitle: string;
};

interface NavbarProps {
    sidebarToggle: boolean;
    setSidebarToggle: (v: boolean) => void;
    activePage?: string;
    onNavigate?: (page: string) => void;
    onLogout?: () => void;
    userName?: string;
    userEmail?: string;
    userRole?: UserRole;
}

const PAGE_INFO: Record<string, { title: string; icon: React.ReactNode }> = {
    dashboard: { title: "Dashboard", icon: <Home className="w-4 h-4" /> },
    projects: { title: "Projects", icon: <FolderOpen className="w-4 h-4" /> },
    client: { title: "Clients", icon: <User className="w-4 h-4" /> },
    consultants: { title: "Consultants", icon: <User className="w-4 h-4" /> },
    reports: { title: "Reports", icon: <FolderOpen className="w-4 h-4" /> },
    admin: { title: "Admin Panel", icon: <Settings className="w-4 h-4" /> },
    hours: { title: "Hours", icon: <Clock className="w-4 h-4" /> },
    settings: { title: "Settings", icon: <Settings className="w-4 h-4" /> },
    profile: { title: "Profile", icon: <User className="w-4 h-4" /> },
    EmailGenerator: { title: "Create Account", icon: <User className="w-4 h-4" /> },
    messages: { title: "Messages", icon: <MessageCircle className="w-4 h-4" /> },
};

const ROLE_PAGES: Record<UserRole, string[]> = {
    admin: ["dashboard", "projects", "client", "consultants", "reports", "hours", "settings", "profile", "EmailGenerator", "admin"],
    consultant: ["dashboard", "projects", "client", "consultants", "reports", "hours", "settings", "profile", "messages"],
    client: ["dashboard", "projects", "settings", "profile"],
};

const Navbar: React.FC<NavbarProps> = ({
    sidebarToggle,
    setSidebarToggle,
    activePage = "dashboard",
    onNavigate,
    onLogout,
    userName = "Admin User",
    userEmail = "admin@timely.com",
    userRole,
}) => {
    const { isDark } = useTheme();
    const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

    const s = {
        header: isDark ? "bg-slate-900/95 border-slate-800 backdrop-blur-md" : "bg-white/95 border-gray-200 backdrop-blur-md",
        text: isDark ? "text-white" : "text-gray-900",
        muted: isDark ? "text-slate-400" : "text-gray-500",
        subtle: isDark ? "text-slate-500" : "text-gray-400",
        btn: isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
        dropdown: isDark ? "bg-slate-800 border-slate-700 shadow-2xl shadow-black/40" : "bg-white border-gray-200 shadow-xl shadow-black/10",
        dropHover: isDark ? "hover:bg-slate-700" : "hover:bg-gray-50",
        divider: isDark ? "border-slate-700" : "border-gray-100",
        accent: isDark ? "text-blue-400" : "text-blue-600",
    };

    const safeRole: UserRole = userRole === "admin" || userRole === "consultant" || userRole === "client" ? userRole : "admin";
    const allowedPages = useMemo(() => new Set(ROLE_PAGES[safeRole]), [safeRole]);
    const pageInfo = PAGE_INFO[activePage] || { title: activePage, icon: <Home className="w-4 h-4" /> };

    const [showSearch, setShowSearch] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [consultants, setConsultants] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);

    const searchRef = useRef<HTMLInputElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const userRef = useRef<HTMLDivElement>(null);

    const initials = (userName || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    const roleLabel = safeRole === "admin" ? "Admin" : safeRole === "consultant" ? "Consultant" : "Client";

    // Load search data
    useEffect(() => {
        const load = async () => {
            try {
                const [pRes, cRes, clRes] = await Promise.all([
                    fetch("/api/projects").then(r => r.ok ? r.json() : { data: [] }),
                    fetch("/api/consultants").then(r => r.ok ? r.json() : { data: [] }),
                    fetch("/api/users-report").then(r => r.ok ? r.json() : { data: [] }),
                ]);
                setProjects(pRes.data || []);
                setConsultants(cRes.data || []);
                setClients(clRes.data || []);
            } catch { }
        };
        load();
    }, []);

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (notifRef.current && !notifRef.current.contains(t)) setShowNotifications(false);
            if (userRef.current && !userRef.current.contains(t)) setShowUserMenu(false);
            if (searchContainerRef.current && !searchContainerRef.current.contains(t)) {
                setShowSearch(false);
                setSearchQuery("");
                setSearchResults([]);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        if (showSearch && searchRef.current) searchRef.current.focus();
    }, [showSearch]);

    // Search logic
    useEffect(() => {
        if (!searchQuery.trim()) { setSearchResults([]); return; }
        const q = searchQuery.toLowerCase();
        const results: SearchResult[] = [];

        projects.forEach(p => {
            if (p.projectName?.toLowerCase().includes(q) || p.projectCode?.toLowerCase().includes(q))
                results.push({ type: "project", id: p.projectId, name: p.projectName, subtitle: p.projectCode || "Project" });
        });

        if (safeRole !== "client") {
            consultants.forEach(c => {
                const name = `${c.firstName} ${c.lastName}`.toLowerCase();
                if (name.includes(q) || c.email?.toLowerCase().includes(q))
                    results.push({ type: "consultant", id: c.consultantId, name: `${c.firstName} ${c.lastName}`, subtitle: c.email });
            });
        }

        if (safeRole === "admin") {
            clients.forEach(c => {
                const name = `${c.firstName} ${c.lastName}`.toLowerCase();
                if (name.includes(q) || c.email?.toLowerCase().includes(q))
                    results.push({ type: "client", id: c.customerId, name: `${c.firstName} ${c.lastName}`, subtitle: c.email });
            });
        }

        Object.entries(PAGE_INFO).forEach(([id, info]) => {
            if (allowedPages.has(id) && info.title.toLowerCase().includes(q))
                results.push({ type: "page", id, name: info.title, subtitle: "Page" });
        });

        setSearchResults(results.slice(0, 8));
    }, [searchQuery, projects, consultants, clients, allowedPages, safeRole]);

    const handleResultClick = (r: SearchResult) => {
        setShowSearch(false);
        setSearchQuery("");
        if (r.type === "page") onNavigate?.(r.id);
        else if (r.type === "project") onNavigate?.("projects");
        else if (r.type === "consultant") onNavigate?.("consultants");
        else if (r.type === "client") onNavigate?.("client");
    };

    const resultIcon = (type: string) => {
        if (type === "project") return <FolderOpen className="w-3.5 h-3.5 text-amber-500" />;
        if (type === "consultant") return <User className="w-3.5 h-3.5 text-blue-500" />;
        if (type === "client") return <User className="w-3.5 h-3.5 text-emerald-500" />;
        return <Home className="w-3.5 h-3.5 text-purple-500" />;
    };

    const notifIcon = (type: string) => {
        if (type === "success") return <CheckCircle className="w-4 h-4 text-emerald-500" />;
        if (type === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
        if (type === "error") return <AlertTriangle className="w-4 h-4 text-red-500" />;
        return <Bell className="w-4 h-4 text-blue-500" />;
    };

    return (
        <header className={`fixed top-0 right-0 z-30 h-14 ${s.header} border-b transition-all duration-300 ${sidebarToggle ? "left-0" : "left-72"}`}>
            <nav className="flex items-center justify-between px-4 h-full">

                {/* Left: Menu + Breadcrumb */}
                <div className="flex items-center gap-3">
                    <button onClick={() => setSidebarToggle(!sidebarToggle)} className={`p-2 ${s.btn} rounded-lg transition-colors`}>
                        <Menu className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1.5 text-sm">
                        <button onClick={() => onNavigate?.("dashboard")} className={`${s.muted} hover:${s.accent} transition-colors`}>
                            <Home className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className={`w-3 h-3 ${s.subtle}`} />
                        <span className={`${s.text} font-medium text-sm flex items-center gap-1.5`}>
                            <span className={s.accent}>{pageInfo.icon}</span>
                            {pageInfo.title}
                        </span>
                    </div>
                </div>

                {/* Right: Search + Notifications + User */}
                <div className="flex items-center gap-1.5">

                    {/* Search */}
                    <div className="relative" ref={searchContainerRef}>
                        {showSearch ? (
                            <div>
                                <div className={`flex items-center gap-2 ${s.dropdown} rounded-xl border px-3 py-2`}>
                                    <Search className={`w-4 h-4 ${s.accent}`} />
                                    <input
                                        ref={searchRef}
                                        type="text"
                                        placeholder="Search..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className={`w-56 bg-transparent ${s.text} text-sm focus:outline-none`}
                                    />
                                    <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className={s.muted}>
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {searchResults.length > 0 && (
                                    <div className={`absolute top-full left-0 right-0 mt-2 ${s.dropdown} border rounded-xl overflow-hidden z-50`}>
                                        {searchResults.map((r, i) => (
                                            <button
                                                key={`${r.type}_${r.id}_${i}`}
                                                onClick={() => handleResultClick(r)}
                                                className={`w-full px-3.5 py-2.5 flex items-center gap-3 ${s.dropHover} transition-colors text-left`}
                                            >
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? "bg-slate-700" : "bg-gray-100"}`}>
                                                    {resultIcon(r.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`${s.text} text-sm truncate`}>{r.name}</p>
                                                    <p className={`${s.subtle} text-xs`}>{r.subtitle}</p>
                                                </div>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-slate-700 text-slate-400" : "bg-gray-100 text-gray-500"}`}>
                                                    {r.type}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {searchQuery.trim() && searchResults.length === 0 && (
                                    <div className={`absolute top-full left-0 right-0 mt-2 ${s.dropdown} border rounded-xl z-50`}>
                                        <p className={`p-4 text-center text-sm ${s.muted}`}>No results</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button onClick={() => setShowSearch(true)} className={`p-2 ${s.btn} rounded-lg transition-colors`}>
                                <Search className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Notifications */}
                    <div className="relative" ref={notifRef}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className={`relative p-2 ${s.btn} rounded-lg transition-colors`}
                        >
                            <Bell className="w-4 h-4" />
                            {unreadCount > 0 && (
                                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-semibold">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className={`absolute right-0 top-full mt-2 w-80 ${s.dropdown} border rounded-xl overflow-hidden z-50 animate-fadeIn`}>
                                <div className={`px-4 py-3 border-b ${s.divider} flex items-center justify-between`}>
                                    <h3 className={`${s.text} text-sm font-semibold`}>Notifications</h3>
                                    {unreadCount > 0 && (
                                        <button onClick={markAllRead} className={`text-xs font-medium ${s.accent}`}>
                                            Mark all read
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className={`p-8 text-center ${s.muted}`}>
                                            <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
                                            <p className="text-xs">No notifications yet</p>
                                        </div>
                                    ) : (
                                        notifications.map(n => (
                                            <div
                                                key={n.id}
                                                onClick={() => markRead(n.id)}
                                                className={`px-4 py-3 flex items-start gap-3 ${s.dropHover} transition-colors border-l-2 cursor-pointer
                                                    ${n.read ? "border-transparent" : `border-blue-500 ${isDark ? "bg-blue-500/5" : "bg-blue-50/50"}`}`}
                                            >
                                                <div className="mt-0.5">{notifIcon(n.type)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[11px] font-medium ${n.read ? s.muted : s.text}`}>{n.title}</p>
                                                    <p className={`text-xs ${s.muted} mt-0.5 truncate`}>{n.message}</p>
                                                    <p className={`text-[10px] ${s.subtle} mt-0.5`}>{n.time}</p>
                                                </div>
                                                {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className={`w-px h-6 mx-1 ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />

                    {/* User Menu */}
                    <div className="relative" ref={userRef}>
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className={`flex items-center gap-2.5 px-2 py-1.5 ${s.dropHover} rounded-xl transition-colors`}
                        >
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-semibold">
                                {initials}
                            </div>
                            <div className="hidden md:block text-left">
                                <p className={`${s.text} text-xs font-medium`}>{userName}</p>
                                <p className={`${s.subtle} text-[10px]`}>{roleLabel}</p>
                            </div>
                        </button>

                        {showUserMenu && (
                            <div className={`absolute right-0 top-full mt-2 w-52 ${s.dropdown} border rounded-xl overflow-hidden z-50 animate-fadeIn`}>
                                <div className={`px-4 py-3 border-b ${s.divider}`}>
                                    <p className={`${s.text} text-sm font-medium`}>{userName}</p>
                                    <p className={`${s.muted} text-xs mt-0.5`}>{userEmail}</p>
                                    <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                                        {roleLabel}
                                    </span>
                                </div>
                                <div className="py-1.5">
                                    <button
                                        onClick={() => { setShowUserMenu(false); onNavigate?.("profile"); }}
                                        className={`w-full px-4 py-2 flex items-center gap-2.5 ${s.dropHover} ${s.muted} transition-colors text-sm`}
                                    >
                                        <User className="w-4 h-4" /> Profile
                                    </button>
                                    <button
                                        onClick={() => { setShowUserMenu(false); onNavigate?.("settings"); }}
                                        className={`w-full px-4 py-2 flex items-center gap-2.5 ${s.dropHover} ${s.muted} transition-colors text-sm`}
                                    >
                                        <Settings className="w-4 h-4" /> Settings
                                    </button>
                                </div>
                                <div className={`py-1.5 border-t ${s.divider}`}>
                                    <button
                                        onClick={() => { setShowUserMenu(false); onLogout ? onLogout() : onNavigate?.("logout"); }}
                                        className={`w-full px-4 py-2 flex items-center gap-2.5 text-red-400 ${isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"} transition-colors text-sm`}
                                    >
                                        <LogOut className="w-4 h-4" /> Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>
        </header>
    );
};

export default Navbar;