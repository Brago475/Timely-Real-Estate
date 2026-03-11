// src/ClientPortal_views/ClientSidebar.tsx
import React from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    Home,
    FolderOpen,
    History,
    FileText,
    MessageCircle,
    Settings,
    User,
    LogOut,
    ChevronLeft,
    ChevronRight,
    HelpCircle,
    Bell,
} from "lucide-react";

type ClientSidebarProps = {
    sidebarToggle: boolean;
    setSidebarToggle: (v: boolean) => void;
    activePage: string;
    onNavigate: (page: string) => void;
    onLogout?: () => void;
    userName?: string;
    userEmail?: string;
};

const ClientSidebar: React.FC<ClientSidebarProps> = ({
    sidebarToggle,
    setSidebarToggle,
    activePage,
    onNavigate,
    onLogout,
    userName = "Client",
    userEmail = "",
}) => {
    const { isDark } = useTheme();
    const isCollapsed = sidebarToggle;

    const s = {
        bg: isDark ? "bg-slate-900" : "bg-white",
        border: isDark ? "border-slate-800" : "border-gray-200",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-600",
        textSubtle: isDark ? "text-slate-500" : "text-gray-500",
        hover: isDark ? "hover:bg-slate-800" : "hover:bg-gray-100",
        active: isDark ? "bg-blue-600/20 text-blue-400 border-blue-500" : "bg-blue-50 text-blue-600 border-blue-500",
        inactive: isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        // New interactive states
        clickable: "cursor-pointer active:scale-[0.98] transition-all duration-150",
        hoverLift: "hover:translate-y-[-2px] hover:shadow-lg",
        hoverGlow: isDark ? "hover:shadow-blue-500/20" : "hover:shadow-blue-500/10",
    };

    const initials = (userName || "C")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    // Main navigation items
    const navItems = [
        { id: "dashboard", label: "Dashboard", icon: Home },
        { id: "projects", label: "Projects", icon: FolderOpen },
        { id: "documents", label: "Documents", icon: FileText },
        { id: "messages", label: "Messages", icon: MessageCircle, badge: 0 },
        { id: "history", label: "History", icon: History },
    ];

    // Bottom navigation items
    const bottomItems = [
        { id: "settings", label: "Settings", icon: Settings },
        { id: "profile", label: "Profile", icon: User },
        { id: "help", label: "Help & Support", icon: HelpCircle },
    ];

    return (
        <aside
            className={`fixed top-0 left-0 h-full ${s.bg} border-r ${s.border} z-50 flex flex-col transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"
                }`}
        >
            {/* Header / Logo */}
            <div className={`p-4 border-b ${s.border}`}>
                <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
                    {!isCollapsed && (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                                T
                            </div>
                            <div>
                                <p className={`font-bold ${s.text}`}>Timely</p>
                                <p className={`text-xs ${s.textMuted}`}>Client Portal</p>
                            </div>
                        </div>
                    )}
                    {isCollapsed && (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                            T
                        </div>
                    )}
                </div>
            </div>

            {/* User Profile Card */}
            {!isCollapsed && (
                <div className={`p-4 border-b ${s.border}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-semibold shadow-lg shadow-purple-500/20">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`font-semibold ${s.text} truncate`}>{userName}</p>
                            <p className={`text-xs ${s.textMuted} truncate`}>{userEmail}</p>
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                            Client
                        </span>
                    </div>
                </div>
            )}

            {/* Collapsed User Avatar */}
            {isCollapsed && (
                <div className={`p-4 border-b ${s.border} flex justify-center`}>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-semibold text-sm shadow-lg shadow-purple-500/20">
                        {initials}
                    </div>
                </div>
            )}

            {/* Main Navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {!isCollapsed && (
                    <p className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${s.textSubtle}`}>
                        Menu
                    </p>
                )}
                {navItems.map((item) => {
                    const isActive = activePage === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            title={isCollapsed ? item.label : undefined}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.97] ${isCollapsed ? "justify-center" : ""
                                } ${isActive
                                    ? `${s.active} border-l-4 shadow-md ${isDark ? "shadow-blue-500/10" : "shadow-blue-500/20"}`
                                    : `${s.inactive} border-l-4 border-transparent hover:border-l-4 ${isDark ? "hover:border-slate-600" : "hover:border-gray-300"}`
                                }`}
                        >
                            <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-105"}`} />
                            {!isCollapsed && (
                                <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                            )}
                            {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500 text-white animate-pulse">
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Bottom Section */}
            <div className={`p-3 border-t ${s.border} space-y-1`}>
                {!isCollapsed && (
                    <p className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${s.textSubtle}`}>
                        Account
                    </p>
                )}
                {bottomItems.map((item) => {
                    const isActive = activePage === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            title={isCollapsed ? item.label : undefined}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.97] ${isCollapsed ? "justify-center" : ""
                                } ${isActive
                                    ? `${s.active} border-l-4 shadow-md ${isDark ? "shadow-blue-500/10" : "shadow-blue-500/20"}`
                                    : `${s.inactive} border-l-4 border-transparent hover:border-l-4 ${isDark ? "hover:border-slate-600" : "hover:border-gray-300"}`
                                }`}
                        >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            {!isCollapsed && (
                                <span className="text-sm font-medium">{item.label}</span>
                            )}
                        </button>
                    );
                })}

                {/* Logout */}
                {onLogout && (
                    <button
                        onClick={onLogout}
                        title={isCollapsed ? "Logout" : undefined}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-500/10 active:bg-red-500/20 active:scale-[0.97] transition-all duration-200 mt-2 ${isCollapsed ? "justify-center" : ""
                            }`}
                    >
                        <LogOut className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
                    </button>
                )}

                {/* Collapse Toggle */}
                <button
                    onClick={() => setSidebarToggle(!isCollapsed)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${s.inactive} active:scale-[0.97] transition-all duration-200 mt-2 ${isCollapsed ? "justify-center" : ""
                        }`}
                >
                    {isCollapsed ? (
                        <ChevronRight className="w-5 h-5 transition-transform hover:translate-x-1" />
                    ) : (
                        <>
                            <ChevronLeft className="w-5 h-5 transition-transform hover:-translate-x-1" />
                            <span className="text-sm font-medium">Collapse</span>
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
};

export default ClientSidebar;