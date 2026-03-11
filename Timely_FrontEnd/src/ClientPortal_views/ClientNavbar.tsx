// src/ClientPortal_views/ClientNavbar.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    Menu,
    Search,
    Bell,
    ChevronRight,
    Settings,
    LogOut,
    User,
    Home,
    X,
    FolderOpen,
    History,
    FileText,
    MessageCircle,
    HelpCircle,
    CheckCircle,
    AlertTriangle,
    Info,
    Sun,
    Moon,
    Clock,
    Trash2,
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

interface Project {
    projectId: string;
    projectCode: string;
    projectName: string;
    status: string;
}

interface Notification {
    id: string;
    type: "success" | "warning" | "info";
    message: string;
    time: string;
    read: boolean;
}

interface SearchResult {
    type: string;
    id: string;
    name: string;
    subtitle: string;
}

const ClientNavbar: React.FC<ClientNavbarProps> = ({
    sidebarToggle,
    setSidebarToggle,
    activePage,
    onNavigate,
    onLogout,
    userName = "Client",
    userEmail = "",
    customerId = "",
}) => {
    const { isDark, toggleTheme } = useTheme();

    const s = {
        header: isDark ? "bg-slate-900/95 backdrop-blur-sm border-slate-800" : "bg-white/95 backdrop-blur-sm border-gray-200",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-600",
        textSubtle: isDark ? "text-slate-500" : "text-gray-400",
        button: isDark ? "text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 active:scale-[0.97]" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200 active:scale-[0.97]",
        buttonActive: isDark ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-900",
        dropdown: isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200",
        dropdownHover: isDark ? "hover:bg-slate-800 active:bg-slate-700" : "hover:bg-gray-50 active:bg-gray-100",
        input: isDark ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500" : "bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-400",
        divider: isDark ? "border-slate-700" : "border-gray-200",
        accent: isDark ? "text-blue-400" : "text-blue-600",
        accentBg: isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600",
        // Interactive states
        clickable: "cursor-pointer active:scale-[0.97] transition-all duration-150",
        hoverLift: "hover:-translate-y-0.5 transition-transform duration-200",
    };

    // State
    const [showSearch, setShowSearch] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [globalSearchQuery, setGlobalSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    // Refs
    const searchRef = useRef<HTMLInputElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const notificationRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    // Page info mapping
    const pageInfo: { [key: string]: { title: string; icon: React.ReactNode } } = {
        dashboard: { title: "Dashboard", icon: <Home className="w-4 h-4" /> },
        projects: { title: "Projects", icon: <FolderOpen className="w-4 h-4" /> },
        history: { title: "History", icon: <History className="w-4 h-4" /> },
        documents: { title: "Documents", icon: <FileText className="w-4 h-4" /> },
        messages: { title: "Messages", icon: <MessageCircle className="w-4 h-4" /> },
        settings: { title: "Settings", icon: <Settings className="w-4 h-4" /> },
        profile: { title: "Profile", icon: <User className="w-4 h-4" /> },
        help: { title: "Help & Support", icon: <HelpCircle className="w-4 h-4" /> },
    };

    const currentPage = pageInfo[activePage] || { title: "Dashboard", icon: <Home className="w-4 h-4" /> };

    // Load client's projects
    useEffect(() => {
        const loadProjects = async () => {
            try {
                const projectClients = JSON.parse(localStorage.getItem("timely_project_clients") || "[]");
                const clientProjectIds = projectClients
                    .filter((pc: any) => String(pc.clientId) === String(customerId))
                    .map((pc: any) => String(pc.projectId));

                const response = await fetch("http://localhost:4000/api/projects");
                const data = await response.json();
                if (data.data) {
                    const clientProjects = data.data.filter((p: Project) =>
                        clientProjectIds.includes(String(p.projectId))
                    );
                    setProjects(clientProjects);
                }
            } catch {
                console.log("Could not load projects");
            }
        };
        if (customerId) loadProjects();
    }, [customerId]);

    // Load notifications
    useEffect(() => {
        const stored = localStorage.getItem("timely_client_notifications");
        if (stored) {
            setNotifications(JSON.parse(stored));
        } else {
            const defaultNotifs: Notification[] = [
                { id: "1", type: "info", message: "Welcome to Timely Client Portal!", time: "Just now", read: false },
                { id: "2", type: "success", message: "Your consultant has been assigned", time: "1h ago", read: false },
            ];
            setNotifications(defaultNotifs);
            localStorage.setItem("timely_client_notifications", JSON.stringify(defaultNotifs));
        }
    }, []);

    // Click outside handlers
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setShowSearch(false);
                setGlobalSearchQuery("");
                setSearchResults([]);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setShowSearch(true);
            }
            if (e.key === "Escape") {
                setShowSearch(false);
                setGlobalSearchQuery("");
                setSearchResults([]);
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Focus search input when opened
    useEffect(() => {
        if (showSearch && searchRef.current) {
            searchRef.current.focus();
        }
    }, [showSearch]);

    // Global search
    useEffect(() => {
        if (!globalSearchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const query = globalSearchQuery.toLowerCase();
        const results: SearchResult[] = [];

        // Search projects
        projects.forEach((p) => {
            if (p.projectName.toLowerCase().includes(query) || (p.projectCode || "").toLowerCase().includes(query)) {
                results.push({
                    type: "project",
                    id: p.projectId,
                    name: p.projectName,
                    subtitle: p.projectCode || "Project",
                });
            }
        });

        // Search pages
        const pages = [
            { name: "Dashboard", id: "dashboard", subtitle: "Home overview" },
            { name: "Projects", id: "projects", subtitle: "View your projects" },
            { name: "History", id: "history", subtitle: "Activity log" },
            { name: "Documents", id: "documents", subtitle: "Your files" },
            { name: "Messages", id: "messages", subtitle: "Communication" },
            { name: "Settings", id: "settings", subtitle: "Preferences" },
            { name: "Profile", id: "profile", subtitle: "Your profile" },
            { name: "Help & Support", id: "help", subtitle: "Get assistance" },
        ];

        pages.forEach((page) => {
            if (page.name.toLowerCase().includes(query) || page.subtitle.toLowerCase().includes(query)) {
                results.push({
                    type: "page",
                    id: page.id,
                    name: page.name,
                    subtitle: page.subtitle,
                });
            }
        });

        setSearchResults(results.slice(0, 8));
    }, [globalSearchQuery, projects]);

    // Handle search result click
    const handleSearchResultClick = (result: SearchResult) => {
        if (result.type === "page") {
            onNavigate(result.id);
        } else if (result.type === "project") {
            onNavigate("projects");
        }
        setShowSearch(false);
        setGlobalSearchQuery("");
        setSearchResults([]);
    };

    // Get search result icon
    const getSearchResultIcon = (type: string) => {
        switch (type) {
            case "project":
                return <FolderOpen className="w-4 h-4 text-amber-500" />;
            case "page":
                return <Home className="w-4 h-4 text-blue-500" />;
            default:
                return <FileText className={`w-4 h-4 ${s.textMuted}`} />;
        }
    };

    // Get notification icon
    const getNotificationIcon = (type: string) => {
        switch (type) {
            case "success":
                return <CheckCircle className="w-5 h-5 text-emerald-500" />;
            case "warning":
                return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            default:
                return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    // Unread notification count
    const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

    // Mark notification as read
    const markAsRead = (id: string) => {
        const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
        setNotifications(updated);
        localStorage.setItem("timely_client_notifications", JSON.stringify(updated));
    };

    // Mark all notifications as read
    const markAllAsRead = () => {
        const updated = notifications.map((n) => ({ ...n, read: true }));
        setNotifications(updated);
        localStorage.setItem("timely_client_notifications", JSON.stringify(updated));
    };

    // Delete notification
    const deleteNotification = (id: string) => {
        const updated = notifications.filter((n) => n.id !== id);
        setNotifications(updated);
        localStorage.setItem("timely_client_notifications", JSON.stringify(updated));
    };

    // Clear all notifications
    const clearAllNotifications = () => {
        setNotifications([]);
        localStorage.setItem("timely_client_notifications", JSON.stringify([]));
    };

    // Get user initials
    const getUserInitials = (name: string) => {
        return (name || "C")
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <header
            className={`fixed top-0 right-0 z-30 h-16 ${s.header} border-b transition-all duration-300 ${sidebarToggle ? "left-20" : "left-64"
                }`}
        >
            <nav className="flex items-center justify-between px-6 h-full">
                {/* Left Section */}
                <div className="flex items-center gap-4">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-sm">
                        <button
                            onClick={() => onNavigate("dashboard")}
                            className={`${s.textMuted} hover:${s.accent} transition-colors`}
                        >
                            <Home className="w-4 h-4" />
                        </button>
                        <ChevronRight className={`w-3 h-3 ${s.textSubtle}`} />
                        <span className={`${s.text} font-medium flex items-center gap-2`}>
                            <span className={s.accent}>{currentPage.icon}</span>
                            {currentPage.title}
                        </span>
                    </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-1">
                    {/* Search Button / Input */}
                    <div className="relative" ref={searchContainerRef}>
                        {showSearch ? (
                            <div className="relative">
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${s.input}`}>
                                    <Search className={`w-4 h-4 ${s.textMuted}`} />
                                    <input
                                        ref={searchRef}
                                        type="text"
                                        placeholder="Search projects, pages..."
                                        value={globalSearchQuery}
                                        onChange={(e) => setGlobalSearchQuery(e.target.value)}
                                        className="w-64 bg-transparent text-sm focus:outline-none"
                                    />
                                    <kbd className={`hidden sm:inline-flex px-1.5 py-0.5 text-xs rounded ${isDark ? "bg-slate-700 text-slate-400" : "bg-gray-200 text-gray-500"}`}>
                                        ESC
                                    </kbd>
                                </div>

                                {/* Search Results Dropdown */}
                                {searchResults.length > 0 && (
                                    <div className={`absolute top-full left-0 right-0 mt-2 ${s.dropdown} border rounded-xl shadow-xl overflow-hidden z-50`}>
                                        <div className="max-h-80 overflow-y-auto">
                                            {searchResults.map((result, i) => (
                                                <button
                                                    key={`${result.type}_${result.id}_${i}`}
                                                    onClick={() => handleSearchResultClick(result)}
                                                    className={`w-full px-4 py-3 flex items-center gap-3 ${s.dropdownHover} transition-colors text-left`}
                                                >
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? "bg-slate-800" : "bg-gray-100"}`}>
                                                        {getSearchResultIcon(result.type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`${s.text} text-sm font-medium truncate`}>{result.name}</p>
                                                        <p className={`${s.textMuted} text-xs`}>{result.subtitle}</p>
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded-lg ${isDark ? "bg-slate-800 text-slate-400" : "bg-gray-100 text-gray-500"}`}>
                                                        {result.type}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* No Results */}
                                {globalSearchQuery.trim() && searchResults.length === 0 && (
                                    <div className={`absolute top-full left-0 right-0 mt-2 ${s.dropdown} border rounded-xl shadow-xl overflow-hidden z-50`}>
                                        <div className={`p-6 text-center`}>
                                            <Search className={`w-8 h-8 ${s.textSubtle} mx-auto mb-2`} />
                                            <p className={`${s.textMuted} text-sm`}>No results for "{globalSearchQuery}"</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowSearch(true)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl ${s.button} transition-all duration-200 hover:shadow-md`}
                            >
                                <Search className="w-5 h-5" />
                                <span className={`hidden md:inline text-sm ${s.textMuted}`}>Search</span>
                                <kbd className={`hidden md:inline-flex px-1.5 py-0.5 text-xs rounded ${isDark ? "bg-slate-800 text-slate-500" : "bg-gray-100 text-gray-400"}`}>
                                    ⌘K
                                </kbd>
                            </button>
                        )}
                    </div>

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className={`p-2.5 rounded-xl ${s.button} transition-all duration-200 hover:shadow-md hover:rotate-12`}
                        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>

                    {/* Notifications */}
                    <div className="relative" ref={notificationRef}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className={`relative p-2.5 rounded-xl transition-all duration-200 hover:shadow-md ${showNotifications ? s.buttonActive : s.button}`}
                        >
                            <Bell className={`w-5 h-5 transition-transform ${showNotifications ? "scale-110" : "hover:scale-105"}`} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold animate-pulse">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className={`absolute right-0 top-full mt-2 w-96 ${s.dropdown} border rounded-xl shadow-xl overflow-hidden z-50`}>
                                <div className={`px-4 py-3 border-b ${s.divider} flex items-center justify-between`}>
                                    <div className="flex items-center gap-2">
                                        <Bell className={`w-5 h-5 ${s.accent}`} />
                                        <h3 className={`${s.text} font-semibold`}>Notifications</h3>
                                        {unreadCount > 0 && (
                                            <span className={`px-2 py-0.5 text-xs rounded-full ${s.accentBg} font-medium`}>
                                                {unreadCount} new
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {unreadCount > 0 && (
                                            <button onClick={markAllAsRead} className={`text-xs ${s.accent} hover:underline`}>
                                                Mark all read
                                            </button>
                                        )}
                                        {notifications.length > 0 && (
                                            <button onClick={clearAllNotifications} className="text-xs text-red-500 hover:underline">
                                                Clear all
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="max-h-96 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <Bell className={`w-10 h-10 ${s.textSubtle} mx-auto mb-3`} />
                                            <p className={`${s.textMuted} text-sm`}>No notifications yet</p>
                                        </div>
                                    ) : (
                                        notifications.map((notification) => (
                                            <div
                                                key={notification.id}
                                                onClick={() => markAsRead(notification.id)}
                                                className={`px-4 py-3 flex items-start gap-3 ${s.dropdownHover} transition-colors cursor-pointer border-l-2 ${notification.read
                                                        ? "border-transparent"
                                                        : `border-blue-500 ${isDark ? "bg-blue-500/5" : "bg-blue-50/50"}`
                                                    }`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-slate-800" : "bg-gray-100"}`}>
                                                    {getNotificationIcon(notification.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm ${notification.read ? s.textMuted : s.text}`}>
                                                        {notification.message}
                                                    </p>
                                                    <p className={`text-xs ${s.textSubtle} mt-1 flex items-center gap-1`}>
                                                        <Clock className="w-3 h-3" />
                                                        {notification.time}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteNotification(notification.id);
                                                    }}
                                                    className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all`}
                                                >
                                                    <X className="w-4 h-4 text-red-500" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className={`w-px h-8 mx-2 ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />

                    {/* User Menu */}
                    <div className="relative" ref={userMenuRef}>
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className={`flex items-center gap-3 px-2 py-1.5 rounded-xl transition-colors ${showUserMenu ? s.buttonActive : s.dropdownHover}`}
                        >
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-semibold text-sm shadow-lg shadow-purple-500/20">
                                {getUserInitials(userName)}
                            </div>
                            <div className="hidden md:block text-left">
                                <p className={`${s.text} text-sm font-medium`}>{userName}</p>
                                <p className={`${s.textMuted} text-xs`}>Client</p>
                            </div>
                        </button>

                        {showUserMenu && (
                            <div className={`absolute right-0 top-full mt-2 w-64 ${s.dropdown} border rounded-xl shadow-xl overflow-hidden z-50`}>
                                {/* User Info Header */}
                                <div className={`px-4 py-4 border-b ${s.divider} ${isDark ? "bg-slate-800/50" : "bg-gray-50"}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/20">
                                            {getUserInitials(userName)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`${s.text} font-semibold truncate`}>{userName}</p>
                                            <p className={`${s.textMuted} text-sm truncate`}>{userEmail}</p>
                                        </div>
                                    </div>
                                    <span className={`inline-block mt-3 text-xs px-2.5 py-1 rounded-lg font-medium ${isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-600"}`}>
                                        Client Account
                                    </span>
                                </div>

                                {/* Menu Items */}
                                <div className="py-2">
                                    <button
                                        onClick={() => { setShowUserMenu(false); onNavigate("profile"); }}
                                        className={`w-full px-4 py-2.5 flex items-center gap-3 ${s.dropdownHover} transition-colors`}
                                    >
                                        <User className={`w-5 h-5 ${s.textMuted}`} />
                                        <span className={`text-sm ${s.text}`}>Profile</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowUserMenu(false); onNavigate("settings"); }}
                                        className={`w-full px-4 py-2.5 flex items-center gap-3 ${s.dropdownHover} transition-colors`}
                                    >
                                        <Settings className={`w-5 h-5 ${s.textMuted}`} />
                                        <span className={`text-sm ${s.text}`}>Settings</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowUserMenu(false); onNavigate("help"); }}
                                        className={`w-full px-4 py-2.5 flex items-center gap-3 ${s.dropdownHover} transition-colors`}
                                    >
                                        <HelpCircle className={`w-5 h-5 ${s.textMuted}`} />
                                        <span className={`text-sm ${s.text}`}>Help & Support</span>
                                    </button>
                                </div>

                                {/* Logout */}
                                <div className={`py-2 border-t ${s.divider}`}>
                                    <button
                                        onClick={() => { setShowUserMenu(false); if (onLogout) onLogout(); }}
                                        className={`w-full px-4 py-2.5 flex items-center gap-3 text-red-500 ${isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"} transition-colors`}
                                    >
                                        <LogOut className="w-5 h-5" />
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