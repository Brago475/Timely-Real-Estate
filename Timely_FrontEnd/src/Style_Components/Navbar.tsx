// src/Style_Components/Navbar.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Menu, Search, Bell, ChevronRight, Settings, LogOut, User, FolderOpen, Home, X, Clock, CheckCircle, AlertTriangle, MessageCircle, Sun, Moon } from "lucide-react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import { useNotifications } from "./Notifications";

type UserRole = "admin" | "consultant" | "client";
type SearchResult = { type: "project" | "consultant" | "client" | "page"; id: string; name: string; subtitle: string; };

interface NavbarProps { sidebarToggle: boolean; setSidebarToggle: (v: boolean) => void; activePage?: string; onNavigate?: (page: string) => void; onLogout?: () => void; userName?: string; userEmail?: string; userRole?: UserRole; }

// 30 gradient options
const GRADIENTS = [
    "from-blue-500 to-cyan-400", "from-purple-500 to-pink-400", "from-emerald-500 to-teal-400",
    "from-orange-500 to-amber-400", "from-rose-500 to-pink-400", "from-indigo-500 to-blue-400",
    "from-violet-500 to-purple-400", "from-cyan-500 to-blue-400", "from-teal-500 to-emerald-400",
    "from-fuchsia-500 to-pink-400", "from-sky-500 to-indigo-400", "from-amber-500 to-yellow-400",
    "from-lime-500 to-green-400", "from-red-500 to-orange-400", "from-pink-500 to-rose-400",
    "from-blue-600 to-violet-500", "from-emerald-600 to-cyan-500", "from-purple-600 to-indigo-500",
    "from-orange-600 to-red-500", "from-teal-600 to-blue-500", "from-rose-600 to-purple-500",
    "from-indigo-600 to-cyan-500", "from-violet-600 to-fuchsia-500", "from-cyan-600 to-teal-500",
    "from-amber-600 to-orange-500", "from-sky-600 to-blue-500", "from-fuchsia-600 to-violet-500",
    "from-green-500 to-emerald-400", "from-blue-500 to-purple-500", "from-pink-600 to-orange-400",
];

const getGradient = (name: string, email: string): string => {
    const str = (email || name || "user").toLowerCase();
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); hash = hash & hash; }
    return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
};

const PAGE_INFO: Record<string, { title: string; icon: React.ReactNode }> = {
    dashboard: { title: "Dashboard", icon: <Home className="w-4 h-4" /> }, projects: { title: "Projects", icon: <FolderOpen className="w-4 h-4" /> },
    client: { title: "Clients", icon: <User className="w-4 h-4" /> }, consultants: { title: "Consultants", icon: <User className="w-4 h-4" /> },
    reports: { title: "Reports", icon: <FolderOpen className="w-4 h-4" /> }, admin: { title: "Admin Panel", icon: <Settings className="w-4 h-4" /> },
    hours: { title: "Hours", icon: <Clock className="w-4 h-4" /> }, settings: { title: "Settings", icon: <Settings className="w-4 h-4" /> },
    profile: { title: "Profile", icon: <User className="w-4 h-4" /> }, InviteMembers: { title: "Invite Members", icon: <User className="w-4 h-4" /> },
    messages: { title: "Messages", icon: <MessageCircle className="w-4 h-4" /> },
};

const ROLE_PAGES: Record<UserRole, string[]> = {
    admin: ["dashboard", "projects", "client", "consultants", "reports", "hours", "settings", "profile", "InviteMembers", "admin"],
    consultant: ["dashboard", "projects", "client", "consultants", "reports", "hours", "settings", "profile", "messages"],
    client: ["dashboard", "projects", "settings", "profile"],
};

const Navbar: React.FC<NavbarProps> = ({ sidebarToggle, setSidebarToggle, activePage = "dashboard", onNavigate, onLogout, userName = "Admin User", userEmail = "admin@timely.com", userRole }) => {
    const { isDark, toggleTheme } = useTheme();
    const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

    const hover = isDark ? "hover:bg-blue-500/10" : "hover:bg-blue-50";

    const n = {
        header: isDark ? "bg-[#0a0a0a]/95 border-gray-800 backdrop-blur-md" : "bg-white/95 border-gray-200 backdrop-blur-md",
        text: isDark ? "text-white" : "text-gray-900",
        secondary: isDark ? "text-gray-300" : "text-gray-600",
        tertiary: isDark ? "text-gray-400" : "text-gray-500",
        label: isDark ? "text-blue-400" : "text-blue-600",
        btn: isDark ? "text-gray-400 hover:text-white hover:bg-blue-500/10" : "text-gray-500 hover:text-gray-900 hover:bg-blue-50",
        dropdown: isDark ? "bg-[#111111] border-gray-800 shadow-2xl shadow-black/40" : "bg-white border-gray-200 shadow-xl shadow-black/15",
        dropHover: isDark ? "hover:bg-blue-500/10" : "hover:bg-blue-50",
        divider: isDark ? "border-gray-800" : "border-gray-200",
        flat: isDark ? "neu-dark-flat" : "neu-light-flat",
        inset: isDark ? "neu-dark-inset" : "neu-light-inset",
    };

    const safeRole: UserRole = userRole === "admin" || userRole === "consultant" || userRole === "client" ? userRole : "admin";
    const allowedPages = useMemo(() => new Set(ROLE_PAGES[safeRole]), [safeRole]);
    const pageInfo = PAGE_INFO[activePage] || { title: activePage, icon: <Home className="w-4 h-4" /> };
    const gradient = useMemo(() => getGradient(userName, userEmail), [userName, userEmail]);

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

    const initials = (userName || "U").split(" ").map(x => x[0]).join("").toUpperCase().slice(0, 2);
    const roleLabel = safeRole === "admin" ? "Admin" : safeRole === "consultant" ? "Consultant" : "Client";

    useEffect(() => { const load = async () => { try { const [p, c, cl] = await Promise.all([fetch("/api/projects").then(r => r.ok ? r.json() : { data: [] }), fetch("/api/consultants").then(r => r.ok ? r.json() : { data: [] }), fetch("/api/users-report").then(r => r.ok ? r.json() : { data: [] })]); setProjects(p.data || []); setConsultants(c.data || []); setClients(cl.data || []); } catch {} }; load(); }, []);

    useEffect(() => { const handler = (e: MouseEvent) => { const t = e.target as Node; if (notifRef.current && !notifRef.current.contains(t)) setShowNotifications(false); if (userRef.current && !userRef.current.contains(t)) setShowUserMenu(false); if (searchContainerRef.current && !searchContainerRef.current.contains(t)) { setShowSearch(false); setSearchQuery(""); setSearchResults([]); } }; document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler); }, []);

    useEffect(() => { if (showSearch && searchRef.current) searchRef.current.focus(); }, [showSearch]);

    useEffect(() => {
        if (!searchQuery.trim()) { setSearchResults([]); return; }
        const q = searchQuery.toLowerCase(); const results: SearchResult[] = [];
        projects.forEach(p => { if (p.projectName?.toLowerCase().includes(q) || p.projectCode?.toLowerCase().includes(q)) results.push({ type: "project", id: p.projectId, name: p.projectName, subtitle: p.projectCode || "Project" }); });
        if (safeRole !== "client") consultants.forEach(c => { const nm = `${c.firstName} ${c.lastName}`.toLowerCase(); if (nm.includes(q) || c.email?.toLowerCase().includes(q)) results.push({ type: "consultant", id: c.consultantId, name: `${c.firstName} ${c.lastName}`, subtitle: c.email }); });
        if (safeRole === "admin") clients.forEach(c => { const nm = `${c.firstName} ${c.lastName}`.toLowerCase(); if (nm.includes(q) || c.email?.toLowerCase().includes(q)) results.push({ type: "client", id: c.customerId, name: `${c.firstName} ${c.lastName}`, subtitle: c.email }); });
        Object.entries(PAGE_INFO).forEach(([id, info]) => { if (allowedPages.has(id) && info.title.toLowerCase().includes(q)) results.push({ type: "page", id, name: info.title, subtitle: "Page" }); });
        setSearchResults(results.slice(0, 8));
    }, [searchQuery, projects, consultants, clients, allowedPages, safeRole]);

    const handleResult = (r: SearchResult) => { setShowSearch(false); setSearchQuery(""); if (r.type === "page") onNavigate?.(r.id); else if (r.type === "project") onNavigate?.("projects"); else if (r.type === "consultant") onNavigate?.("consultants"); else if (r.type === "client") onNavigate?.("client"); };
    const resultIcon = (t: string) => t === "project" ? <FolderOpen className="w-3.5 h-3.5 text-amber-400" /> : t === "consultant" ? <User className="w-3.5 h-3.5 text-blue-400" /> : t === "client" ? <User className="w-3.5 h-3.5 text-emerald-400" /> : <Home className="w-3.5 h-3.5 text-purple-400" />;
    const notifIcon = (t: string) => t === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t === "warning" ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : t === "error" ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <Bell className="w-4 h-4 text-blue-400" />;

    return (
        <header className={`fixed top-0 right-0 z-30 h-14 ${n.header} border-b transition-all duration-300 ${sidebarToggle ? "left-0" : "left-72"}`}>
            <nav className="flex items-center justify-between px-4 h-full">
                {/* Left */}
                <div className="flex items-center gap-3">
                    <button onClick={() => setSidebarToggle(!sidebarToggle)} className={`p-2 ${n.btn} rounded-lg transition-colors`}><Menu className="w-4 h-4" /></button>
                    <div className="flex items-center gap-1.5 text-sm">
                        <button onClick={() => onNavigate?.("dashboard")} className={`${n.tertiary} hover:${n.label} transition-colors`}><Home className="w-3.5 h-3.5" /></button>
                        <ChevronRight className={`w-3 h-3 ${n.tertiary}`} />
                        <span className={`${n.text} font-medium text-sm flex items-center gap-1.5`}><span className={n.label}>{pageInfo.icon}</span>{pageInfo.title}</span>
                    </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-1.5">
                    {/* Search */}
                    <div className="relative" ref={searchContainerRef}>
                        {showSearch ? (
                            <div>
                                <div className={`flex items-center gap-2 ${n.dropdown} rounded-xl border px-3 py-2`}>
                                    <Search className={`w-4 h-4 ${n.label}`} />
                                    <input ref={searchRef} type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={`w-56 bg-transparent ${n.text} text-sm focus:outline-none`} />
                                    <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className={n.tertiary}><X className="w-3.5 h-3.5" /></button>
                                </div>
                                {searchResults.length > 0 && (
                                    <div className={`absolute top-full left-0 right-0 mt-2 ${n.dropdown} border rounded-xl overflow-hidden z-50`}>
                                        {searchResults.map((r, i) => (
                                            <button key={`${r.type}_${r.id}_${i}`} onClick={() => handleResult(r)} className={`w-full px-3.5 py-2.5 flex items-center gap-3 ${n.dropHover} transition-colors text-left group`}>
                                                <div className={`w-7 h-7 ${n.inset} rounded-lg flex items-center justify-center`}>{resultIcon(r.type)}</div>
                                                <div className="flex-1 min-w-0"><p className={`${n.text} text-sm truncate ${isDark ? "group-hover:text-blue-400" : "group-hover:text-blue-600"} transition-colors`}>{r.name}</p><p className={`${n.tertiary} text-xs`}>{r.subtitle}</p></div>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700"}`}>{r.type}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {searchQuery.trim() && searchResults.length === 0 && (<div className={`absolute top-full left-0 right-0 mt-2 ${n.dropdown} border rounded-xl z-50`}><p className={`p-4 text-center text-sm ${n.tertiary}`}>No results</p></div>)}
                            </div>
                        ) : (
                            <button onClick={() => setShowSearch(true)} className={`p-2 ${n.btn} rounded-lg transition-colors`}><Search className="w-4 h-4" /></button>
                        )}
                    </div>

                    {/* Theme Toggle */}
                    <button onClick={toggleTheme} className={`relative w-14 h-7 rounded-full transition-all duration-300 flex items-center ${isDark ? "bg-gray-800" : "bg-blue-100"}`}>
                        <div className={`absolute w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${isDark ? "left-1 bg-gray-600" : "left-8 bg-white"}`}>
                            {isDark ? <Moon className="w-3 h-3 text-blue-300" /> : <Sun className="w-3 h-3 text-amber-500" />}
                        </div>
                        <div className={`absolute transition-opacity duration-300 ${isDark ? "right-2 opacity-100" : "right-2 opacity-0"}`}>
                            <Moon className="w-3 h-3 text-gray-500" />
                        </div>
                        <div className={`absolute transition-opacity duration-300 ${isDark ? "left-2 opacity-0" : "left-2 opacity-100"}`}>
                            <Sun className="w-3 h-3 text-amber-400" />
                        </div>
                    </button>

                    {/* Notifications */}
                    <div className="relative" ref={notifRef}>
                        <button onClick={() => setShowNotifications(!showNotifications)} className={`relative p-2 ${n.btn} rounded-lg transition-colors`}>
                            <Bell className="w-4 h-4" />
                            {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-semibold">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                        </button>
                        {showNotifications && (
                            <div className={`absolute right-0 top-full mt-2 w-80 ${n.dropdown} border rounded-xl overflow-hidden z-50 animate-fadeIn`}>
                                <div className={`px-4 py-3 border-b ${n.divider} flex items-center justify-between`}>
                                    <h3 className={`${n.text} text-sm font-semibold`}>Notifications</h3>
                                    {unreadCount > 0 && <button onClick={markAllRead} className={`text-xs font-medium ${n.label}`}>Mark all read</button>}
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className={`p-8 text-center ${n.tertiary}`}><Bell className="w-6 h-6 mx-auto mb-2 opacity-30" /><p className="text-xs">No notifications</p></div>
                                    ) : notifications.map(notif => (
                                        <div key={notif.id} onClick={() => markRead(notif.id)} className={`px-4 py-3 flex items-start gap-3 ${n.dropHover} transition-colors border-l-2 cursor-pointer ${notif.read ? "border-transparent" : `border-blue-500 ${isDark ? "bg-blue-500/5" : "bg-blue-50/50"}`}`}>
                                            <div className="mt-0.5">{notifIcon(notif.type)}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[11px] font-medium ${notif.read ? n.tertiary : n.text}`}>{notif.title}</p>
                                                <p className={`text-xs ${n.tertiary} mt-0.5 truncate`}>{notif.message}</p>
                                                <p className={`text-[10px] ${n.tertiary} mt-0.5`}>{notif.time}</p>
                                            </div>
                                            {!notif.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className={`w-px h-6 mx-1 ${isDark ? "bg-gray-800" : "bg-gray-200"}`} />

                    {/* User Menu */}
                    <div className="relative" ref={userRef}>
                        <button onClick={() => setShowUserMenu(!showUserMenu)} className={`flex items-center gap-2.5 px-2 py-1.5 ${n.dropHover} rounded-xl transition-colors group`}>
                            <div className={`w-8 h-8 bg-gradient-to-br ${gradient} rounded-lg flex items-center justify-center text-xs font-semibold text-white shadow-sm`}>{initials}</div>
                            <div className="hidden md:block text-left">
                                <p className={`${n.text} text-xs font-medium ${isDark ? "group-hover:text-blue-400" : "group-hover:text-blue-600"} transition-colors`}>{userName}</p>
                                <p className={`${n.tertiary} text-[10px]`}>{roleLabel}</p>
                            </div>
                        </button>
                        {showUserMenu && (
                            <div className={`absolute right-0 top-full mt-2 w-52 ${n.dropdown} border rounded-xl overflow-hidden z-50 animate-fadeIn`}>
                                <div className={`px-4 py-3 border-b ${n.divider}`}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-lg flex items-center justify-center text-sm font-semibold text-white shadow-sm`}>{initials}</div>
                                        <div>
                                            <p className={`${n.text} text-sm font-medium`}>{userName}</p>
                                            <p className={`${n.tertiary} text-xs`}>{userEmail}</p>
                                        </div>
                                    </div>
                                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700"}`}>{roleLabel}</span>
                                </div>
                                <div className="py-1.5">
                                    <button onClick={() => { setShowUserMenu(false); onNavigate?.("profile"); }} className={`w-full px-4 py-2 flex items-center gap-2.5 ${n.dropHover} ${n.secondary} transition-colors text-sm group`}>
                                        <User className="w-4 h-4" /><span className={`${isDark ? "group-hover:text-blue-400" : "group-hover:text-blue-600"} transition-colors`}>Profile</span>
                                    </button>
                                    <button onClick={() => { setShowUserMenu(false); onNavigate?.("settings"); }} className={`w-full px-4 py-2 flex items-center gap-2.5 ${n.dropHover} ${n.secondary} transition-colors text-sm group`}>
                                        <Settings className="w-4 h-4" /><span className={`${isDark ? "group-hover:text-blue-400" : "group-hover:text-blue-600"} transition-colors`}>Settings</span>
                                    </button>
                                </div>
                                <div className={`py-1.5 border-t ${n.divider}`}>
                                    <button onClick={() => { setShowUserMenu(false); onLogout ? onLogout() : onNavigate?.("logout"); }} className={`w-full px-4 py-2 flex items-center gap-2.5 text-red-400 ${isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"} transition-colors text-sm`}><LogOut className="w-4 h-4" />Logout</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>
        </header>
    );
};

// Export gradient helper so other components can use it
export { getGradient, GRADIENTS };
export default Navbar;