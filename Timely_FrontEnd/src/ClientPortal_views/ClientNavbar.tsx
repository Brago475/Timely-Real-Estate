// src/ClientPortal_views/ClientNavbar.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    Search, Bell, ChevronRight, Settings, LogOut, User,
    Home, X, FolderOpen, History, FileText, MessageCircle,
    HelpCircle, CheckCircle, AlertTriangle, Info, Moon, Sun,
    Clock,
} from "lucide-react";

type ClientNavbarProps = {
    sidebarToggle: boolean;
    setSidebarToggle: (v: boolean) => void;
    activePage: string;
    onNavigate: (page: string) => void;
    onLogout?: () => void;
    userName?: string;
    userEmail?: string;
    customerId?: string;
};

interface Project      { projectId: string; projectCode: string; projectName: string; status: string; }
interface Notification { id: string; type: "success" | "warning" | "info"; message: string; time: string; read: boolean; }
interface SearchResult { type: string; id: string; name: string; subtitle: string; }

const ClientNavbar: React.FC<ClientNavbarProps> = ({
    sidebarToggle,
    activePage, onNavigate, onLogout,
    userName = "Client", userEmail = "", customerId = "",
}) => {
    const { isDark, toggleTheme } = useTheme();

    const n = {
        navbar:    isDark ? "bg-[#0a0a0a] border-gray-800" : "bg-white border-gray-200",
        dropdown:  isDark ? "bg-[#111111] border-gray-800" : "bg-white border-gray-200",
        flat:      isDark ? "neu-dark-flat"  : "neu-light-flat",
        inset:     isDark ? "neu-dark-inset" : "neu-light-inset",
        text:      isDark ? "text-white"      : "text-gray-900",
        secondary: isDark ? "text-gray-300"   : "text-gray-600",
        tertiary:  isDark ? "text-gray-500"   : "text-gray-400",
        strong:    isDark ? "text-white"      : "text-black",
        label:     isDark ? "text-blue-400"   : "text-blue-600",
        divider:   isDark ? "border-gray-800" : "border-gray-200",
        btnHover:  isDark ? "hover:bg-gray-800" : "hover:bg-gray-100",
        rowHover:  isDark ? "hover:bg-gray-800" : "hover:bg-gray-50",
    };

    const [showSearch,        setShowSearch]        = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu,      setShowUserMenu]      = useState(false);
    const [searchQuery,       setSearchQuery]       = useState("");
    const [searchResults,     setSearchResults]     = useState<SearchResult[]>([]);
    const [notifications,     setNotifications]     = useState<Notification[]>([]);
    const [projects,          setProjects]          = useState<Project[]>([]);

    const searchRef          = useRef<HTMLInputElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const notifRef           = useRef<HTMLDivElement>(null);
    const userMenuRef        = useRef<HTMLDivElement>(null);

    const pageInfo: Record<string, { title: string; icon: React.ReactNode }> = {
        dashboard: { title: "Dashboard",      icon: <Home          className="w-4 h-4" /> },
        projects:  { title: "Projects",       icon: <FolderOpen    className="w-4 h-4" /> },
        history:   { title: "History",        icon: <History       className="w-4 h-4" /> },
        documents: { title: "Documents",      icon: <FileText      className="w-4 h-4" /> },
        messages:  { title: "Messages",       icon: <MessageCircle className="w-4 h-4" /> },
        settings:  { title: "Settings",       icon: <Settings      className="w-4 h-4" /> },
        profile:   { title: "Profile",        icon: <User          className="w-4 h-4" /> },
        help:      { title: "Help & Support", icon: <HelpCircle    className="w-4 h-4" /> },
    };
    const currentPage = pageInfo[activePage] || pageInfo.dashboard;

    useEffect(() => {
        if (!customerId) return;
        (async () => {
            try {
                const pc  = JSON.parse(localStorage.getItem("timely_project_clients") || "[]");
                const ids = pc.filter((x: any) => String(x.clientId) === String(customerId)).map((x: any) => String(x.projectId));
                const r   = await fetch("/api/projects");
                const d   = await r.json();
                if (d?.data) setProjects(d.data.filter((p: Project) => ids.includes(String(p.projectId))));
            } catch {}
        })();
    }, [customerId]);

    useEffect(() => {
        const stored = localStorage.getItem("timely_client_notifications");
        if (stored) { setNotifications(JSON.parse(stored)); return; }
        const defaults: Notification[] = [
            { id: "1", type: "info",    message: "Welcome to Timely Client Portal!", time: "Just now", read: false },
            { id: "2", type: "success", message: "Your consultant has been assigned",  time: "1h ago",  read: false },
        ];
        setNotifications(defaults);
        localStorage.setItem("timely_client_notifications", JSON.stringify(defaults));
    }, []);

    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (notifRef.current           && !notifRef.current.contains(e.target as Node))           setShowNotifications(false);
            if (userMenuRef.current        && !userMenuRef.current.contains(e.target as Node))        setShowUserMenu(false);
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
                setShowSearch(false); setSearchQuery(""); setSearchResults([]);
            }
        };
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, []);

    useEffect(() => {
        const handle = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowSearch(true); }
            if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }
        };
        document.addEventListener("keydown", handle);
        return () => document.removeEventListener("keydown", handle);
    }, []);

    useEffect(() => { if (showSearch) searchRef.current?.focus(); }, [showSearch]);

    useEffect(() => {
        if (!searchQuery.trim()) { setSearchResults([]); return; }
        const q = searchQuery.toLowerCase();
        const results: SearchResult[] = [];
        projects.forEach(p => {
            if (p.projectName.toLowerCase().includes(q) || (p.projectCode || "").toLowerCase().includes(q))
                results.push({ type: "project", id: p.projectId, name: p.projectName, subtitle: p.projectCode || "Project" });
        });
        [
            { name: "Dashboard", id: "dashboard", subtitle: "Home overview" },
            { name: "Projects",  id: "projects",  subtitle: "View your projects" },
            { name: "History",   id: "history",   subtitle: "Activity log" },
            { name: "Documents", id: "documents", subtitle: "Your files" },
            { name: "Messages",  id: "messages",  subtitle: "Communication" },
            { name: "Settings",  id: "settings",  subtitle: "Preferences" },
            { name: "Profile",   id: "profile",   subtitle: "Your profile" },
            { name: "Help",      id: "help",      subtitle: "Get assistance" },
        ].forEach(p => {
            if (p.name.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q))
                results.push({ type: "page", id: p.id, name: p.name, subtitle: p.subtitle });
        });
        setSearchResults(results.slice(0, 8));
    }, [searchQuery, projects]);

    const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
    const saveNotifs  = (u: Notification[]) => { setNotifications(u); localStorage.setItem("timely_client_notifications", JSON.stringify(u)); };
    const markRead    = (id: string) => saveNotifs(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    const markAllRead = ()            => saveNotifs(notifications.map(n => ({ ...n, read: true })));
    const deleteNotif = (id: string) => saveNotifs(notifications.filter(n => n.id !== id));
    const clearAll    = ()            => saveNotifs([]);
    const initials    = (name: string) => (name || "C").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

    const NotifIcon: React.FC<{ type: string }> = ({ type }) => {
        if (type === "success") return <CheckCircle   className="w-4 h-4 text-emerald-400" />;
        if (type === "warning") return <AlertTriangle className="w-4 h-4 text-amber-400" />;
        return <Info className="w-4 h-4 text-blue-400" />;
    };

    return (
        <header className={`fixed top-0 right-0 z-30 h-16 border-b transition-all duration-300 ${n.navbar} ${sidebarToggle ? "left-20" : "left-64"}`}>
            <nav className="flex items-center justify-between px-6 h-full">

                {/* Left — breadcrumb */}
                <div className="flex items-center gap-2 text-sm">
                    <button onClick={() => onNavigate("dashboard")} className={`${n.tertiary} ${n.btnHover} p-1.5 rounded-lg transition-colors`}>
                        <Home className="w-4 h-4" />
                    </button>
                    <ChevronRight className={`w-3 h-3 ${n.tertiary}`} />
                    <span className={`${n.text} font-medium flex items-center gap-1.5`}>
                        <span className={n.label}>{currentPage.icon}</span>
                        {currentPage.title}
                    </span>
                </div>

                {/* Right */}
                <div className="flex items-center gap-1">

                    {/* Search */}
                    <div className="relative" ref={searchContainerRef}>
                        {showSearch ? (
                            <div className="relative">
                                <div className={`flex items-center gap-2 px-3 py-2 ${n.inset} rounded-xl`}>
                                    <Search className={`w-4 h-4 ${n.tertiary} flex-shrink-0`} />
                                    <input ref={searchRef} type="text" placeholder="Search projects, pages…"
                                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                        className={`w-56 bg-transparent ${n.text} text-sm focus:outline-none`} />
                                    <kbd className={`hidden sm:inline-flex px-1.5 py-0.5 text-[10px] rounded ${isDark ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-400"}`}>ESC</kbd>
                                </div>
                                {searchResults.length > 0 && (
                                    <div className={`absolute top-full right-0 mt-2 w-72 ${n.dropdown} border rounded-2xl shadow-xl overflow-hidden z-50`}>
                                        {searchResults.map((r, i) => (
                                            <button key={`${r.type}_${r.id}_${i}`}
                                                onClick={() => { onNavigate(r.type === "project" ? "projects" : r.id); setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}
                                                className={`w-full px-4 py-3 flex items-center gap-3 ${n.rowHover} transition-colors text-left`}>
                                                <div className={`w-8 h-8 ${n.flat} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                                    {r.type === "project" ? <FolderOpen className="w-3.5 h-3.5 text-amber-400" /> : <Home className="w-3.5 h-3.5 text-blue-400" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`${n.text} text-sm font-medium truncate`}>{r.name}</p>
                                                    <p className={`${n.tertiary} text-xs`}>{r.subtitle}</p>
                                                </div>
                                                <span className={`text-[10px] px-2 py-0.5 ${n.flat} rounded-lg ${n.tertiary}`}>{r.type}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {searchQuery.trim() && searchResults.length === 0 && (
                                    <div className={`absolute top-full right-0 mt-2 w-72 ${n.dropdown} border rounded-2xl shadow-xl z-50 p-6 text-center`}>
                                        <Search className={`w-7 h-7 ${n.tertiary} mx-auto mb-2`} />
                                        <p className={`${n.secondary} text-sm`}>No results for "{searchQuery}"</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button onClick={() => setShowSearch(true)} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${n.btnHover} ${n.secondary} transition-all`}>
                                <Search className="w-4 h-4" />
                                <span className={`hidden md:inline text-sm ${n.tertiary}`}>Search</span>
                                <kbd className={`hidden md:inline-flex px-1.5 py-0.5 text-[10px] rounded ${isDark ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-400"}`}>⌘K</kbd>
                            </button>
                        )}
                    </div>

                    {/* ── Theme toggle: Sun in light mode, Moon in dark mode ── */}
                    <button
                        type="button"
                        onClick={() => toggleTheme()}
                        className={`w-9 h-9 rounded-xl ${n.flat} flex items-center justify-center transition-all`}
                        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        {isDark
                            ? <Moon className={`w-4 h-4 ${n.secondary}`} />
                            : <Sun  className={`w-4 h-4 ${n.secondary}`} />
                        }
                    </button>

                    {/* Notifications */}
                    <div className="relative" ref={notifRef}>
                        <button onClick={() => setShowNotifications(!showNotifications)}
                            className={`relative w-9 h-9 rounded-xl ${showNotifications ? n.inset : n.flat} flex items-center justify-center ${n.secondary} transition-all`}>
                            <Bell className="w-4 h-4" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className={`absolute right-0 top-full mt-2 ${n.dropdown} border rounded-2xl shadow-xl overflow-hidden z-50`} style={{ width: 340 }}>
                                <div className={`px-4 py-3 border-b ${n.divider} flex items-center justify-between`}>
                                    <div className="flex items-center gap-2">
                                        <Bell className={`w-4 h-4 ${n.label}`} />
                                        <span className={`${n.text} font-semibold text-sm`}>Notifications</span>
                                        {unreadCount > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-600 text-white font-bold">{unreadCount} new</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {unreadCount > 0 && <button onClick={markAllRead} className={`text-xs ${n.label}`}>Mark all read</button>}
                                        {notifications.length > 0 && <button onClick={clearAll} className="text-xs text-red-400">Clear all</button>}
                                    </div>
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <Bell className={`w-9 h-9 ${n.tertiary} mx-auto mb-2`} strokeWidth={1.5} />
                                            <p className={`${n.secondary} text-sm`}>No notifications</p>
                                        </div>
                                    ) : notifications.map(notif => (
                                        <div key={notif.id} onClick={() => markRead(notif.id)}
                                            className={`px-4 py-3 flex items-start gap-3 ${n.rowHover} cursor-pointer transition-colors border-l-2 ${notif.read ? "border-transparent" : "border-blue-500"}`}>
                                            <div className={`w-8 h-8 ${n.flat} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                                <NotifIcon type={notif.type} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm ${notif.read ? n.secondary : n.text}`}>{notif.message}</p>
                                                <p className={`text-xs ${n.tertiary} mt-0.5 flex items-center gap-1`}>
                                                    <Clock className="w-3 h-3" />{notif.time}
                                                </p>
                                            </div>
                                            <button onClick={e => { e.stopPropagation(); deleteNotif(notif.id); }} className="p-1 hover:bg-red-500/20 rounded-lg">
                                                <X className="w-3.5 h-3.5 text-red-400" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Separator */}
                    <div className={`w-px h-6 mx-1 ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />

                    {/* User menu */}
                    <div className="relative" ref={userMenuRef}>
                        <button onClick={() => setShowUserMenu(!showUserMenu)}
                            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-xl ${n.rowHover} transition-colors`}>
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold">
                                {initials(userName)}
                            </div>
                            <div className="hidden md:block text-left">
                                <p className={`${n.text} text-sm font-medium leading-tight`}>{userName}</p>
                                <p className={`${n.tertiary} text-[11px]`}>Client</p>
                            </div>
                        </button>

                        {showUserMenu && (
                            <div className={`absolute right-0 top-full mt-2 w-64 ${n.dropdown} border rounded-2xl shadow-xl overflow-hidden z-50`}>
                                <div className={`px-4 py-4 border-b ${n.divider}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm">
                                            {initials(userName)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`${n.strong} font-semibold text-sm truncate`}>{userName}</p>
                                            <p className={`${n.tertiary} text-xs truncate`}>{userEmail}</p>
                                        </div>
                                    </div>
                                    <span className="inline-block mt-2.5 text-[10px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-semibold uppercase tracking-wider">
                                        Client Account
                                    </span>
                                </div>
                                <div className="py-1.5">
                                    {[
                                        { label: "Profile",        page: "profile",  icon: User },
                                        { label: "Settings",       page: "settings", icon: Settings },
                                        { label: "Help & Support", page: "help",     icon: HelpCircle },
                                    ].map(item => (
                                        <button key={item.page} onClick={() => { setShowUserMenu(false); onNavigate(item.page); }}
                                            className={`w-full px-4 py-2.5 flex items-center gap-3 ${n.rowHover} transition-colors`}>
                                            <item.icon className={`w-4 h-4 ${n.tertiary}`} />
                                            <span className={`text-sm ${n.secondary}`}>{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className={`py-1.5 border-t ${n.divider}`}>
                                    <button onClick={() => { setShowUserMenu(false); onLogout?.(); }}
                                        className={`w-full px-4 py-2.5 flex items-center gap-3 text-red-400 ${isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"} transition-colors`}>
                                        <LogOut className="w-4 h-4" />
                                        <span className="text-sm font-medium">Logout</span>
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

export default ClientNavbar;