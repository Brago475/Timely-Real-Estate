// src/Style_Components/Navbar.tsx
// top navigation bar with search, notifications, project selector, and user menu
// adapts visibility and features based on user role (admin, consultant, client)

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    Menu,
    Search,
    Bell,
    ChevronRight,
    Settings,
    LogOut,
    User,
    FolderOpen,
    Home,
    X,
    Plus,
    Clock,
    CheckCircle,
    AlertTriangle,
    MessageCircle,
    Mail
} from "lucide-react";
import { useTheme } from "../Views_Layouts/ThemeContext";

// TASK: move to environment config
const API_BASE = "http://localhost:4000";

type Project = {
    projectId: string;
    projectCode: string;
    projectName: string;
    status: string;
};

type UserRole = "admin" | "consultant" | "client";

type Notification = {
    id: string | number;
    type: "success" | "warning" | "info" | "message";
    message: string;
    time: string;
    read: boolean;
    onClick?: () => void;
};

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

// pages each role can access - used for search filtering and navigation guards
const ROLE_ALLOWED_PAGES: Record<UserRole, string[]> = {
    admin: ["dashboard", "projects", "client", "consultants", "reports", "hours", "settings", "profile", "EmailGenerator", "admin"],
    consultant: ["dashboard", "projects", "client", "consultants", "reports", "hours", "settings", "profile", "messages"],
    client: ["dashboard", "projects", "settings", "profile"],
};

// page metadata for breadcrumbs and search results
const PAGE_INFO: Record<string, { title: string; icon: React.ReactNode; subtitle: string }> = {
    dashboard: { title: "Dashboard", icon: <Home className="w-4 h-4" />, subtitle: "Home page" },
    projects: { title: "Projects", icon: <FolderOpen className="w-4 h-4" />, subtitle: "Manage projects" },
    client: { title: "Clients", icon: <User className="w-4 h-4" />, subtitle: "Manage clients" },
    consultants: { title: "Consultants", icon: <User className="w-4 h-4" />, subtitle: "Manage consultants" },
    reports: { title: "Reports", icon: <FolderOpen className="w-4 h-4" />, subtitle: "View reports" },
    admin: { title: "Admin Panel", icon: <Settings className="w-4 h-4" />, subtitle: "System administration" },
    hours: { title: "Hours", icon: <Clock className="w-4 h-4" />, subtitle: "Time tracking" },
    settings: { title: "Settings", icon: <Settings className="w-4 h-4" />, subtitle: "App settings" },
    profile: { title: "Profile", icon: <User className="w-4 h-4" />, subtitle: "Your profile" },
    EmailGenerator: { title: "Create Account", icon: <User className="w-4 h-4" />, subtitle: "Generate invites" },
    messages: { title: "Messages", icon: <MessageCircle className="w-4 h-4" />, subtitle: "Your messages" },
};

// Helper to get unread messages for different roles
const getUnreadMessages = (userRole: UserRole, userEmail: string, consultantId?: string): any[] => {
    const unreadMessages: any[] = [];

    try {
        if (userRole === "admin") {
            // Admin gets messages from timely_global_messages and timely_admin_messages
            const globalMsgs = JSON.parse(localStorage.getItem("timely_global_messages") || "[]");
            const adminMsgs = JSON.parse(localStorage.getItem("timely_admin_messages") || "[]");

            // Combine and deduplicate
            const allMsgs = [...globalMsgs, ...adminMsgs];
            const seen = new Set<string>();

            allMsgs.forEach((msg: any) => {
                if (!seen.has(msg.id) && !msg.read && !msg.archived && !msg.deleted) {
                    // Only show messages FROM clients or consultants (not from admin)
                    if (msg.from?.role === "client" || msg.from?.role === "consultant") {
                        seen.add(msg.id);
                        unreadMessages.push(msg);
                    }
                }
            });
        } else if (userRole === "consultant" && consultantId) {
            // Consultant gets messages from their specific inbox
            const consultantMsgs = JSON.parse(localStorage.getItem(`timely_consultant_messages_${consultantId}`) || "[]");
            consultantMsgs.forEach((msg: any) => {
                if (!msg.read && !msg.archived && !msg.deleted && msg.from?.role !== "system") {
                    unreadMessages.push(msg);
                }
            });
        } else if (userRole === "client") {
            // Client gets messages from their inbox (need customerId)
            // For now, we'll search all client message keys
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith("timely_client_messages_")) {
                    const clientMsgs = JSON.parse(localStorage.getItem(key) || "[]");
                    clientMsgs.forEach((msg: any) => {
                        if (!msg.read && !msg.archived && !msg.deleted && msg.to?.email === userEmail) {
                            unreadMessages.push(msg);
                        }
                    });
                }
            }
        }
    } catch (e) {
        console.error("Error loading unread messages:", e);
    }

    return unreadMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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

    const styles = {
        header: isDark ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-600",
        textSubtle: isDark ? "text-slate-500" : "text-gray-400",
        button: isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-gray-600 hover:text-blue-600 hover:bg-gray-100",
        dropdown: isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200 shadow-lg",
        dropdownHover: isDark ? "hover:bg-slate-700" : "hover:bg-gray-50",
        input: isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900",
        divider: isDark ? "border-slate-700" : "border-gray-200",
        accent: isDark ? "text-blue-400" : "text-blue-600",
        accentBg: isDark ? "bg-blue-500/10 hover:bg-blue-500/20" : "bg-blue-50 hover:bg-blue-100",
    };

    // dropdown visibility state
    const [showSearch, setShowSearch] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showProjectSelector, setShowProjectSelector] = useState(false);

    // search state
    const [projectSearchQuery, setProjectSearchQuery] = useState("");
    const [globalSearchQuery, setGlobalSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

    // data state
    const [projects, setProjects] = useState<Project[]>([]);
    const [consultants, setConsultants] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [consultantId, setConsultantId] = useState<string>("");

    // refs for click-outside detection
    const searchRef = useRef<HTMLInputElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const notificationRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const projectSelectorRef = useRef<HTMLDivElement>(null);

    // normalize role to ensure type safety
    const safeRole: UserRole = (userRole === "admin" || userRole === "consultant" || userRole === "client")
        ? userRole
        : "admin";

    const allowedPages = useMemo(() => new Set(ROLE_ALLOWED_PAGES[safeRole]), [safeRole]);

    const pageInfo = PAGE_INFO[activePage] || { title: activePage, icon: <Home className="w-4 h-4" />, subtitle: "" };
    const unreadCount = notifications.filter(n => !n.read).length;

    // formats audit log action into human-readable notification message
    const formatAuditMessage = (log: any): string => {
        const actionMessages: Record<string, string> = {
            CREATE_PROJECT: `New project created: ${log.details || log.entityId}`,
            DELETE_PROJECT: `Project deleted: ${log.details || log.entityId}`,
            CREATE_CLIENT: `New client added: ${log.details || log.entityId}`,
            CREATE_CONSULTANT: `New consultant added: ${log.details || log.entityId}`,
            LOG_HOURS: `Hours logged: ${log.details || "Time entry added"}`,
            ASSIGN_PROJECT: `Project assigned: ${log.details || log.entityId}`,
            ASSIGN_CONSULTANT: `Consultant assigned: ${log.details || log.entityId}`,
        };
        return actionMessages[log.actionType] || log.details || "Activity recorded";
    };

    // converts timestamp to relative time string (e.g., "5m ago", "2h ago")
    const formatRelativeTime = (timestamp: string): string => {
        if (!timestamp) return "Just now";

        const diffMs = Date.now() - new Date(timestamp).getTime();
        const minutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMs / 3600000);
        const days = Math.floor(diffMs / 86400000);

        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    const getUserInitials = (name: string): string => {
        return name
            .split(" ")
            .map(n => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const getRoleLabel = (role: UserRole): string => {
        const labels: Record<UserRole, string> = {
            admin: "Admin",
            consultant: "Consultant",
            client: "Client",
        };
        return labels[role] || role;
    };

    const getNotificationIcon = (type: string) => {
        if (type === "success") return <CheckCircle className="w-4 h-4 text-emerald-500" />;
        if (type === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
        if (type === "message") return <Mail className="w-4 h-4 text-blue-500" />;
        return <Bell className={`w-4 h-4 ${styles.accent}`} />;
    };

    const getSearchResultIcon = (type: string) => {
        const icons: Record<string, React.ReactNode> = {
            project: <FolderOpen className="w-4 h-4 text-amber-500" />,
            consultant: <User className="w-4 h-4 text-blue-500" />,
            client: <User className="w-4 h-4 text-emerald-500" />,
            page: <Home className="w-4 h-4 text-purple-500" />,
        };
        return icons[type] || <Search className="w-4 h-4" />;
    };

    // Fetch consultant ID for consultants
    useEffect(() => {
        const fetchConsultantId = async () => {
            if (safeRole === "consultant" && userEmail) {
                try {
                    const res = await fetch(`${API_BASE}/api/consultants`);
                    if (res.ok) {
                        const data = await res.json();
                        const consultant = (data.data || []).find(
                            (c: any) => c.email === userEmail
                        );
                        if (consultant) {
                            setConsultantId(consultant.consultantId);
                        }
                    }
                } catch (e) {
                    console.error("Error fetching consultant ID:", e);
                }
            }
        };

        fetchConsultantId();
    }, [safeRole, userEmail]);

    // Load notifications including unread messages
    useEffect(() => {
        const loadNotifications = async () => {
            const stored = localStorage.getItem("timely_notifications_list");
            let notifs: Notification[] = stored ? JSON.parse(stored) : [];

            // Load unread messages as notifications
            const unreadMsgs = getUnreadMessages(safeRole, userEmail, consultantId);

            // Convert messages to notifications
            const messageNotifs: Notification[] = unreadMsgs.slice(0, 5).map((msg: any) => ({
                id: `msg_${msg.id}`,
                type: "message" as const,
                message: `${msg.from?.name || "Someone"}: ${msg.subject || msg.body?.substring(0, 50) || "New message"}`,
                time: formatRelativeTime(msg.timestamp),
                read: false,
                onClick: () => {
                    // Navigate to messages
                    if (safeRole === "admin") {
                        onNavigate?.("admin"); // Admin goes to admin panel messages tab
                    } else if (safeRole === "consultant") {
                        onNavigate?.("messages");
                    }
                }
            }));

            // Add message notifications at the top
            const combinedNotifs = [...messageNotifs];

            try {
                const response = await fetch(`${API_BASE}/api/audit-logs/latest?limit=5`);
                const data = await response.json();

                if (data.data?.length > 0) {
                    const auditNotifs = data.data.map((log: any, i: number) => ({
                        id: `audit_${log.timestamp}_${i}`,
                        type: log.actionType?.includes("DELETE") ? "warning" : "success",
                        message: formatAuditMessage(log),
                        time: formatRelativeTime(log.timestamp),
                        read: false,
                    }));

                    // merge without duplicates
                    auditNotifs.forEach((an: Notification) => {
                        if (!combinedNotifs.find(n => n.id === an.id)) {
                            combinedNotifs.push(an);
                        }
                    });
                }
            } catch {
                console.log("Could not fetch audit logs for notifications");
            }

            // Add stored notifications that aren't duplicates
            notifs.forEach((n: Notification) => {
                if (!combinedNotifs.find(cn => cn.id === n.id)) {
                    combinedNotifs.push(n);
                }
            });

            // default notifications for empty state
            if (combinedNotifs.length === 0) {
                combinedNotifs.push(
                    { id: "welcome_1", type: "info", message: "Welcome to Timely!", time: "Just now", read: false },
                    { id: "welcome_2", type: "info", message: "Create your first project to get started", time: "1m ago", read: false },
                );
            }

            setNotifications(combinedNotifs.slice(0, 10));
        };

        loadNotifications();

        // Refresh notifications every 10 seconds
        const interval = setInterval(loadNotifications, 10000);
        return () => clearInterval(interval);
    }, [safeRole, userEmail, consultantId, onNavigate]);

    // TASK: these api calls should use a shared data fetching hook
    // duplicated across multiple components - consider using react-query or swr
    useEffect(() => {
        const loadProjects = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/projects`);
                const data = await response.json();
                const localProjects = JSON.parse(localStorage.getItem("timely_projects") || "[]");

                if (data.data) {
                    // merge api and local projects, avoiding duplicates
                    const merged = [...data.data];
                    localProjects.forEach((lp: Project) => {
                        if (!merged.find((p: Project) => p.projectId === lp.projectId)) {
                            merged.push(lp);
                        }
                    });
                    setProjects(merged);
                } else {
                    setProjects(localProjects);
                }
            } catch {
                const stored = localStorage.getItem("timely_projects");
                if (stored) setProjects(JSON.parse(stored));
            }
        };

        const loadConsultants = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/consultants`);
                const data = await response.json();
                if (data.data) setConsultants(data.data);
            } catch {
                console.log("Could not load consultants");
            }
        };

        const loadClients = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/users-report`);
                const data = await response.json();
                if (data.data) setClients(data.data);
            } catch {
                console.log("Could not load clients");
            }
        };

        loadProjects();
        loadConsultants();
        loadClients();
    }, []);

    // close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            if (notificationRef.current && !notificationRef.current.contains(target)) {
                setShowNotifications(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(target)) {
                setShowUserMenu(false);
            }
            if (projectSelectorRef.current && !projectSelectorRef.current.contains(target)) {
                setShowProjectSelector(false);
            }
            if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
                setShowSearch(false);
                setGlobalSearchQuery("");
                setSearchResults([]);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // auto-focus search input when opened
    useEffect(() => {
        if (showSearch && searchRef.current) {
            searchRef.current.focus();
        }
    }, [showSearch]);

    // global search - filters results based on user role
    useEffect(() => {
        if (!globalSearchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const query = globalSearchQuery.toLowerCase();
        const results: SearchResult[] = [];

        // search projects - all roles can see
        projects.forEach(p => {
            if (
                p.projectName.toLowerCase().includes(query) ||
                (p.projectCode || "").toLowerCase().includes(query)
            ) {
                results.push({
                    type: "project",
                    id: p.projectId,
                    name: p.projectName,
                    subtitle: p.projectCode || "Project",
                });
            }
        });

        // search consultants - admin and consultant only
        if (safeRole !== "client") {
            consultants.forEach(c => {
                const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
                if (
                    fullName.includes(query) ||
                    (c.email || "").toLowerCase().includes(query) ||
                    (c.consultantCode || "").toLowerCase().includes(query)
                ) {
                    results.push({
                        type: "consultant",
                        id: c.consultantId,
                        name: `${c.firstName} ${c.lastName}`,
                        subtitle: c.email || c.consultantCode || "Consultant",
                    });
                }
            });
        }

        // search clients - admin only
        if (safeRole === "admin") {
            clients.forEach(c => {
                const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
                if (
                    fullName.includes(query) ||
                    (c.email || "").toLowerCase().includes(query) ||
                    (c.clientCode || "").toLowerCase().includes(query)
                ) {
                    results.push({
                        type: "client",
                        id: c.customerId,
                        name: `${c.firstName} ${c.lastName}`,
                        subtitle: c.email || c.clientCode || "Client",
                    });
                }
            });
        }

        // search pages - filtered by role permissions
        Object.entries(PAGE_INFO).forEach(([pageId, info]) => {
            if (!allowedPages.has(pageId)) return;
            if (info.title.toLowerCase().includes(query)) {
                results.push({
                    type: "page",
                    id: pageId,
                    name: info.title,
                    subtitle: info.subtitle,
                });
            }
        });

        setSearchResults(results.slice(0, 10));
    }, [globalSearchQuery, projects, consultants, clients, allowedPages, safeRole]);

    const handleSearchResultClick = (result: SearchResult) => {
        setShowSearch(false);
        setGlobalSearchQuery("");
        setSearchResults([]);

        // navigate to appropriate page based on result type
        if (result.type === "page") {
            onNavigate?.(result.id);
        } else if (result.type === "project") {
            onNavigate?.("projects");
        } else if (result.type === "consultant") {
            onNavigate?.("consultants");
        } else if (result.type === "client") {
            onNavigate?.("client");
        }
    };

    const markAllNotificationsAsRead = () => {
        const updated = notifications.map(n => ({ ...n, read: true }));
        setNotifications(updated);
        // Only save non-message notifications to localStorage
        const nonMessageNotifs = updated.filter(n => !String(n.id).startsWith("msg_"));
        localStorage.setItem("timely_notifications_list", JSON.stringify(nonMessageNotifs));
    };

    const handleNotificationClick = (notification: Notification) => {
        // Mark as read
        const updated = notifications.map(n =>
            n.id === notification.id ? { ...n, read: true } : n
        );
        setNotifications(updated);

        // If it's a message notification, navigate to messages
        if (notification.type === "message") {
            setShowNotifications(false);
            if (safeRole === "admin") {
                onNavigate?.("admin"); // Admin goes to admin panel
            } else if (safeRole === "consultant") {
                onNavigate?.("messages");
            }
        }

        // Execute custom onClick if provided
        if (notification.onClick) {
            notification.onClick();
        }
    };

    const handleLogout = () => {
        setShowUserMenu(false);
        if (onLogout) {
            onLogout();
        } else {
            onNavigate?.("logout");
        }
    };

    const filteredProjects = projects.filter(p =>
        p.projectName.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
        p.projectCode?.toLowerCase().includes(projectSearchQuery.toLowerCase())
    );

    // Count unread messages separately for badge
    const unreadMessageCount = notifications.filter(n => n.type === "message" && !n.read).length;

    return (
        <header
            className={`fixed top-0 right-0 z-30 h-16 ${styles.header} border-b transition-all duration-300 ${sidebarToggle ? "left-0" : "left-72"}`}
        >
            <nav className="flex items-center justify-between px-6 py-3 h-full">
                {/* left section - hamburger menu and breadcrumb */}
                <div className="flex items-center gap-4">
                    <button
                        className={`p-2 ${styles.button} rounded-lg transition-colors`}
                        onClick={() => setSidebarToggle(!sidebarToggle)}
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    {/* breadcrumb navigation */}
                    <div className="flex items-center gap-2 text-sm">
                        <button
                            onClick={() => onNavigate?.("dashboard")}
                            className={`${styles.textMuted} hover:text-blue-500 transition-colors`}
                        >
                            <Home className="w-4 h-4" />
                        </button>
                        <ChevronRight className={`w-3 h-3 ${styles.textSubtle}`} />
                        <span className={`${styles.text} font-medium flex items-center gap-2`}>
                            <span className={styles.accent}>{pageInfo.icon}</span>
                            {pageInfo.title}
                        </span>

                        {/* project selector - shown on projects page for admin/consultant */}
                        {(activePage === "projects" || selectedProject) && safeRole !== "client" && (
                            <>
                                <ChevronRight className={`w-3 h-3 ${styles.textSubtle}`} />
                                <div className="relative" ref={projectSelectorRef}>
                                    <button
                                        onClick={() => setShowProjectSelector(!showProjectSelector)}
                                        className={`flex items-center gap-2 px-3 py-1.5 ${styles.button} rounded-lg transition-colors border ${styles.divider}`}
                                    >
                                        <FolderOpen className={`w-3 h-3 ${styles.accent}`} />
                                        <span className="max-w-32 truncate">
                                            {selectedProject?.projectName || "Select Project"}
                                        </span>
                                        <ChevronRight className={`w-3 h-3 transition-transform ${showProjectSelector ? "rotate-90" : ""}`} />
                                    </button>

                                    {showProjectSelector && (
                                        <div className={`absolute top-full left-0 mt-2 w-72 ${styles.dropdown} border rounded-xl overflow-hidden z-50`}>
                                            <div className={`p-3 border-b ${styles.divider}`}>
                                                <div className="relative">
                                                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${styles.textMuted} w-4 h-4`} />
                                                    <input
                                                        type="text"
                                                        placeholder="Search projects..."
                                                        value={projectSearchQuery}
                                                        onChange={e => setProjectSearchQuery(e.target.value)}
                                                        className={`w-full pl-10 pr-4 py-2 ${styles.input} border rounded-lg text-sm focus:outline-none focus:border-blue-500`}
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                {filteredProjects.length === 0 ? (
                                                    <div className={`p-4 text-center ${styles.textMuted} text-sm`}>
                                                        No projects found
                                                    </div>
                                                ) : (
                                                    filteredProjects.map(project => (
                                                        <button
                                                            key={project.projectId}
                                                            onClick={() => {
                                                                setSelectedProject(project);
                                                                setShowProjectSelector(false);
                                                            }}
                                                            className={`w-full px-4 py-3 flex items-center gap-3 ${styles.dropdownHover} transition-colors text-left ${selectedProject?.projectId === project.projectId
                                                                ? isDark
                                                                    ? "bg-slate-700 border-l-2 border-blue-500"
                                                                    : "bg-blue-50 border-l-2 border-blue-500"
                                                                : ""
                                                                }`}
                                                        >
                                                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                                                <FolderOpen className="w-4 h-4 text-white" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`${styles.text} text-sm font-medium truncate`}>
                                                                    {project.projectName}
                                                                </p>
                                                                <p className={`${styles.textMuted} text-xs`}>
                                                                    {project.projectCode}
                                                                </p>
                                                            </div>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                            {safeRole === "admin" && (
                                                <div className={`p-2 border-t ${styles.divider}`}>
                                                    <button
                                                        onClick={() => {
                                                            setShowProjectSelector(false);
                                                            onNavigate?.("projects");
                                                        }}
                                                        className={`w-full px-4 py-2 flex items-center gap-2 ${styles.accent} ${styles.accentBg} rounded-lg transition-colors text-sm font-medium`}
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        Create New Project
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* right section - search, notifications, user menu */}
                <div className="flex items-center gap-2">
                    {/* global search */}
                    <div className="relative" ref={searchContainerRef}>
                        {showSearch ? (
                            <div className="relative">
                                <div className={`flex items-center gap-2 ${styles.dropdown} rounded-lg border px-3 py-2`}>
                                    <Search className={`${styles.accent} w-4 h-4`} />
                                    <input
                                        ref={searchRef}
                                        type="text"
                                        placeholder="Search projects, people, pages..."
                                        value={globalSearchQuery}
                                        onChange={e => setGlobalSearchQuery(e.target.value)}
                                        className={`w-64 bg-transparent ${styles.text} text-sm focus:outline-none`}
                                    />
                                    <button
                                        onClick={() => {
                                            setShowSearch(false);
                                            setGlobalSearchQuery("");
                                            setSearchResults([]);
                                        }}
                                        className={`${styles.textMuted} hover:${styles.text} transition-colors`}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* search results dropdown */}
                                {searchResults.length > 0 && (
                                    <div className={`absolute top-full left-0 right-0 mt-2 ${styles.dropdown} border rounded-xl overflow-hidden z-50`}>
                                        <div className="max-h-80 overflow-y-auto">
                                            {searchResults.map((result, i) => (
                                                <button
                                                    key={`${result.type}_${result.id}_${i}`}
                                                    onClick={() => handleSearchResultClick(result)}
                                                    className={`w-full px-4 py-3 flex items-center gap-3 ${styles.dropdownHover} transition-colors text-left`}
                                                >
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? "bg-slate-700" : "bg-gray-100"}`}>
                                                        {getSearchResultIcon(result.type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`${styles.text} text-sm font-medium truncate`}>
                                                            {result.name}
                                                        </p>
                                                        <p className={`${styles.textMuted} text-xs`}>
                                                            {result.subtitle}
                                                        </p>
                                                    </div>
                                                    <span className={`text-xs px-2 py-0.5 rounded ${isDark ? "bg-slate-700 text-slate-400" : "bg-gray-100 text-gray-500"}`}>
                                                        {result.type}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* no results message */}
                                {globalSearchQuery.trim() && searchResults.length === 0 && (
                                    <div className={`absolute top-full left-0 right-0 mt-2 ${styles.dropdown} border rounded-xl overflow-hidden z-50`}>
                                        <div className={`p-4 text-center ${styles.textMuted} text-sm`}>
                                            No results found for "{globalSearchQuery}"
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowSearch(true)}
                                className={`p-2.5 ${styles.button} rounded-lg transition-colors`}
                            >
                                <Search className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* notifications */}
                    <div className="relative" ref={notificationRef}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className={`relative p-2.5 ${styles.button} rounded-lg transition-colors`}
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-medium">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className={`absolute right-0 top-full mt-2 w-96 ${styles.dropdown} border rounded-xl overflow-hidden z-50`}>
                                <div className={`px-4 py-3 border-b ${styles.divider} flex items-center justify-between`}>
                                    <div className="flex items-center gap-2">
                                        <h3 className={`${styles.text} font-semibold`}>Notifications</h3>
                                        {unreadMessageCount > 0 && (
                                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500 text-white">
                                                {unreadMessageCount} new message{unreadMessageCount > 1 ? "s" : ""}
                                            </span>
                                        )}
                                    </div>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllNotificationsAsRead}
                                            className={`${styles.accent} text-sm font-medium`}
                                        >
                                            Mark all as read
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-96 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className={`p-6 text-center ${styles.textMuted}`}>
                                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No notifications</p>
                                        </div>
                                    ) : (
                                        notifications.map(notification => (
                                            <div
                                                key={notification.id}
                                                onClick={() => handleNotificationClick(notification)}
                                                className={`px-4 py-3 flex items-start gap-3 ${styles.dropdownHover} transition-colors border-l-2 cursor-pointer ${notification.read
                                                    ? "border-transparent"
                                                    : notification.type === "message"
                                                        ? `border-blue-500 ${isDark ? "bg-blue-500/10" : "bg-blue-50"}`
                                                        : `border-blue-500 ${isDark ? "bg-blue-500/5" : "bg-blue-50"}`
                                                    }`}
                                            >
                                                <div className="mt-0.5">
                                                    {getNotificationIcon(notification.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm ${notification.read ? styles.textMuted : styles.text} ${notification.type === "message" && !notification.read ? "font-medium" : ""}`}>
                                                        {notification.message}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className={`text-xs ${styles.textSubtle}`}>
                                                            {notification.time}
                                                        </p>
                                                        {notification.type === "message" && (
                                                            <span className={`text-xs px-1.5 py-0.5 rounded ${isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"}`}>
                                                                Message
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {notification.type === "message" && !notification.read && (
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                                {/* View all messages link */}
                                {unreadMessageCount > 0 && (
                                    <div className={`p-2 border-t ${styles.divider}`}>
                                        <button
                                            onClick={() => {
                                                setShowNotifications(false);
                                                if (safeRole === "admin") {
                                                    onNavigate?.("admin");
                                                } else if (safeRole === "consultant") {
                                                    onNavigate?.("messages");
                                                }
                                            }}
                                            className={`w-full px-4 py-2 flex items-center justify-center gap-2 ${styles.accent} ${styles.accentBg} rounded-lg transition-colors text-sm font-medium`}
                                        >
                                            <Mail className="w-4 h-4" />
                                            View All Messages
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* divider */}
                    <div
                        className="w-px h-8 mx-2"
                        style={{ backgroundColor: isDark ? "#334155" : "#e5e7eb" }}
                    />

                    {/* user menu */}
                    <div className="relative" ref={userMenuRef}>
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className={`flex items-center gap-3 px-3 py-2 ${styles.dropdownHover} rounded-lg transition-colors`}
                        >
                            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                                {getUserInitials(userName)}
                            </div>
                            <div className="hidden md:block text-left">
                                <p className={`${styles.text} text-sm font-medium`}>{userName}</p>
                                <p className={`${styles.textMuted} text-xs`}>{getRoleLabel(safeRole)}</p>
                            </div>
                        </button>

                        {showUserMenu && (
                            <div className={`absolute right-0 top-full mt-2 w-56 ${styles.dropdown} border rounded-xl overflow-hidden z-50`}>
                                <div className={`px-4 py-3 border-b ${styles.divider}`}>
                                    <p className={`${styles.text} font-medium`}>{userName}</p>
                                    <p className={`${styles.textMuted} text-sm`}>{userEmail}</p>
                                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"}`}>
                                        {getRoleLabel(safeRole)}
                                    </span>
                                </div>
                                <div className="py-2">
                                    <button
                                        onClick={() => {
                                            setShowUserMenu(false);
                                            onNavigate?.("profile");
                                        }}
                                        className={`w-full px-4 py-2.5 flex items-center gap-3 ${styles.dropdownHover} ${styles.textMuted} transition-colors`}
                                    >
                                        <User className="w-4 h-4" />
                                        <span className="text-sm">Profile</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowUserMenu(false);
                                            onNavigate?.("settings");
                                        }}
                                        className={`w-full px-4 py-2.5 flex items-center gap-3 ${styles.dropdownHover} ${styles.textMuted} transition-colors`}
                                    >
                                        <Settings className="w-4 h-4" />
                                        <span className="text-sm">Settings</span>
                                    </button>
                                </div>
                                <div className={`py-2 border-t ${styles.divider}`}>
                                    <button
                                        onClick={handleLogout}
                                        className={`w-full px-4 py-2.5 flex items-center gap-3 text-red-500 ${isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"} transition-colors`}
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span className="text-sm">Logout</span>
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