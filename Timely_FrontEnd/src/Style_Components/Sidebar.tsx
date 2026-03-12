// src/Style_Components/Sidebar.tsx
import React, { useState, useEffect } from "react";
import {
    Home, FolderOpen, Users, UserCheck, BarChart3, Clock,
    Settings, LogOut, ChevronLeft, ChevronRight, ArrowLeft,
    Shield, UserPlus, MessageCircle,
} from "lucide-react";
import { useTheme } from "../Views_Layouts/ThemeContext";

type Props = {
    sidebarToggle: boolean;
    setSidebarToggle?: (value: boolean) => void;
    onNavigate: (page: string) => void;
    onBack?: () => void;
    isAdmin: boolean;
    activePage?: string;
    userName?: string;
    userEmail?: string;
    userRole?: string;
};

const Sidebar: React.FC<Props> = ({
    sidebarToggle,
    setSidebarToggle,
    onNavigate,
    onBack,
    isAdmin,
    activePage = "dashboard",
    userName = "User",
    userEmail = "",
    userRole = "client",
}) => {
    const { isDark } = useTheme();
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const isConsultant = userRole === "consultant";

    const s = {
        sidebar: isDark
            ? "bg-slate-900 border-slate-800"
            : "bg-white border-gray-200",
        text: isDark ? "text-white" : "text-gray-900",
        muted: isDark ? "text-slate-400" : "text-gray-500",
        subtle: isDark ? "text-slate-500" : "text-gray-400",
        active: isDark
            ? "bg-blue-500/10 border-blue-500/20"
            : "bg-blue-50 border-blue-200",
        activeText: isDark ? "text-blue-400" : "text-blue-600",
        activeIcon: "bg-blue-600 text-white shadow-lg shadow-blue-600/20",
        hover: isDark ? "hover:bg-slate-800" : "hover:bg-gray-50",
        icon: isDark ? "bg-slate-800 text-slate-400" : "bg-gray-100 text-gray-500",
        divider: isDark ? "border-slate-800" : "border-gray-100",
        card: isDark ? "bg-slate-800/60 border-slate-700/50" : "bg-gray-50 border-gray-200",
    };

    const getInitials = (name: string) => {
        const parts = name.trim().split(" ");
        return parts.length >= 2
            ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
            : name.slice(0, 2).toUpperCase();
    };

    const menuItems = [
        { id: "dashboard", label: "Dashboard", icon: Home },
        { id: "projects", label: "Projects", icon: FolderOpen },
        { id: "client", label: "Clients", icon: Users },
        { id: "consultants", label: "Consultants", icon: UserCheck },
        { id: "reports", label: "Reports", icon: BarChart3 },
        { id: "hours", label: "Hours", icon: Clock },
        ...(isConsultant
            ? [{ id: "messages", label: "Messages", icon: MessageCircle }]
            : []),
    ];

    const adminItems = [
        { id: "admin", label: "Admin Panel", icon: Shield },
        { id: "EmailGenerator", label: "Create Account", icon: UserPlus },
    ];

    const NavItem = ({
        id,
        label,
        icon: Icon,
        isActive,
        isLogout = false,
    }: {
        id: string;
        label: string;
        icon: React.ComponentType<{ className?: string }>;
        isActive: boolean;
        isLogout?: boolean;
    }) => {
        const hovered = hoveredItem === id;

        return (
            <li
                className={`relative mb-0.5 rounded-xl cursor-pointer select-none transition-all duration-200 border
                    ${isActive ? s.active
                        : isLogout ? "hover:bg-red-500/10 border-transparent"
                        : `${s.hover} border-transparent`}`}
                onClick={() => onNavigate(id)}
                onMouseEnter={() => setHoveredItem(id)}
                onMouseLeave={() => setHoveredItem(null)}
            >
                {/* Active indicator bar */}
                {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />
                )}

                <div className={`px-3 py-2.5 flex items-center gap-3 transition-colors duration-200
                    ${isActive ? s.activeText
                        : isLogout ? "text-red-400"
                        : s.muted}
                    ${hovered && !isActive && !isLogout ? s.text : ""}`}
                >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
                        ${isActive ? s.activeIcon
                            : isLogout ? "bg-red-500/10 text-red-400"
                            : s.icon}
                        ${hovered && !isActive && !isLogout ? "scale-105" : ""}`}
                    >
                        <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-sm font-medium ${isActive ? s.text : ""}`}>
                        {label}
                    </span>
                </div>
            </li>
        );
    };

    // Timely house logo SVG inline
    const TimelyLogo = () => (
        <svg className="w-8 h-8" viewBox="0 0 120 112" fill="none">
            <polygon
                points="60,12 10,52 20,52 20,100 100,100 100,52 110,52"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="5"
                strokeLinejoin="round"
            />
            <rect x="47" y="65" width="26" height="35" rx="2" fill="#3b82f6" />
            <circle cx="60" cy="48" r="14" fill="none" stroke="#c9a84c" strokeWidth="2.5" />
            <line x1="60" y1="48" x2="60" y2="38" stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="60" y1="48" x2="68" y2="48" stroke="#c9a84c" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="60" cy="48" r="2" fill="#c9a84c" />
        </svg>
    );

    return (
        <aside
            className={`${sidebarToggle ? "w-0 -translate-x-full" : "w-72 translate-x-0"}
                ${s.sidebar} fixed top-0 left-0 h-full border-r
                transition-all duration-300 ease-in-out z-40 overflow-hidden`}
        >
            <div className="h-full flex flex-col px-4 py-5">

                {/* Logo */}
                <div className="mb-8 px-2">
                    <div className="flex items-center gap-3">
                        {onBack && activePage !== "dashboard" ? (
                            <button
                                onClick={onBack}
                                className={`w-9 h-9 ${isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-400" : "bg-gray-100 hover:bg-gray-200 text-gray-500"} rounded-xl flex items-center justify-center transition-colors`}
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        ) : (
                            <TimelyLogo />
                        )}
                        <div>
                            <h1 className={`text-lg font-semibold tracking-tight ${s.text}`}>
                                Timely
                            </h1>
                            <p className={`text-[10px] tracking-[0.2em] uppercase ${s.subtle}`}>
                                Real Estate
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Navigation */}
                <div className="flex-1 overflow-y-auto">
                    <div className="mb-6">
                        <p className={`px-3 mb-2 text-[10px] font-semibold ${s.subtle} uppercase tracking-[0.15em]`}>
                            Menu
                        </p>
                        <ul>
                            {menuItems.map((item) => (
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

                    {/* Admin Section */}
                    {isAdmin && (
                        <div className="mb-6">
                            <p className={`px-3 mb-2 text-[10px] font-semibold ${isDark ? "text-amber-500/70" : "text-amber-600"} uppercase tracking-[0.15em]`}>
                                Administration
                            </p>
                            <ul>
                                {adminItems.map((item) => (
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

                {/* Bottom Section */}
                <div className="mt-auto">
                    <div className={`h-px ${s.divider} border-t mb-3`} />

                    <ul>
                        <NavItem
                            id="settings"
                            label="Settings"
                            icon={Settings}
                            isActive={activePage === "settings"}
                        />
                        <NavItem
                            id="logout"
                            label="Logout"
                            icon={LogOut}
                            isActive={false}
                            isLogout={true}
                        />
                    </ul>

                    {/* User Card */}
                    <div className={`mt-3 p-3 ${s.card} rounded-xl border transition-colors`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold
                                ${userRole === "admin"
                                    ? "bg-gradient-to-br from-amber-500 to-orange-500"
                                    : userRole === "consultant"
                                        ? "bg-gradient-to-br from-purple-500 to-pink-500"
                                        : "bg-gradient-to-br from-blue-500 to-blue-600"}`}
                            >
                                {getInitials(userName)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${s.text} truncate`}>{userName}</p>
                                <p className={`text-[11px] ${s.subtle} truncate`}>
                                    {userRole === "admin" ? "Administrator"
                                        : userRole === "consultant" ? "Consultant"
                                        : "Client"}
                                </p>
                            </div>
                            <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
                        </div>
                    </div>
                </div>

                {/* Collapse toggle */}
                {setSidebarToggle && (
                    <button
                        onClick={() => setSidebarToggle(!sidebarToggle)}
                        className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12
                            ${isDark ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white" : "bg-white border-gray-200 text-gray-400 hover:text-gray-700"}
                            border rounded-r-lg flex items-center justify-center transition-colors`}
                    >
                        {sidebarToggle ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                    </button>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;