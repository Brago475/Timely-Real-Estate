// src/Style_Components/Sidebar.tsx
import React, { useState } from "react";
import { Home, FolderOpen, Users, UserCheck, BarChart3, Clock, Settings, LogOut, ChevronLeft, ChevronRight, ArrowLeft, Shield, UserPlus, MessageCircle } from "lucide-react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import timelyLogo from "../assets/Timely_logo.png";

type Props = { sidebarToggle: boolean; setSidebarToggle?: (v: boolean) => void; onNavigate: (page: string) => void; onBack?: () => void; isAdmin: boolean; activePage?: string; userName?: string; userEmail?: string; userRole?: string; };

const Sidebar: React.FC<Props> = ({ sidebarToggle, setSidebarToggle, onNavigate, onBack, isAdmin, activePage = "dashboard", userName = "User", userEmail = "", userRole = "client" }) => {
    const { isDark } = useTheme();
    const [hovered, setHovered] = useState<string | null>(null);
    const isConsultant = userRole === "consultant";

    const n = {
        sidebar: isDark ? "bg-[#0a0a0a] border-gray-800" : "bg-[#e4e4e4] border-gray-200",
        text: isDark ? "text-white" : "text-gray-900",
        secondary: isDark ? "text-gray-300" : "text-gray-600",
        tertiary: isDark ? "text-gray-500" : "text-gray-400",
        label: isDark ? "text-blue-400" : "text-blue-600",
        flat: isDark ? "neu-dark-flat" : "neu-light-flat",
        inset: isDark ? "neu-dark-inset" : "neu-light-inset",
        pressed: isDark ? "neu-dark-pressed" : "neu-light-pressed",
        card: isDark ? "neu-dark" : "neu-light",
        divider: isDark ? "border-gray-800" : "border-gray-200",
        activeBar: "bg-blue-500",
        activeIcon: "bg-blue-600 text-white",
        hoverBg: isDark ? "hover:bg-gray-900/50" : "hover:bg-gray-300/30",
    };

    const initials = (userName || "U").split(" ").map(x => x[0]).join("").toUpperCase().slice(0, 2);
    const roleLabel = userRole === "admin" ? "Administrator" : userRole === "consultant" ? "Consultant" : "Client";

    const menuItems = [
        { id: "dashboard", label: "Dashboard", icon: Home },
        { id: "projects", label: "Projects", icon: FolderOpen },
        { id: "client", label: "Clients", icon: Users },
        { id: "consultants", label: "Consultants", icon: UserCheck },
        { id: "reports", label: "Reports", icon: BarChart3 },
        { id: "hours", label: "Hours", icon: Clock },
        ...(isConsultant ? [{ id: "messages", label: "Messages", icon: MessageCircle }] : []),
    ];

    const adminItems = [
        { id: "admin", label: "Admin Panel", icon: Shield },
        { id: "EmailGenerator", label: "Create Account", icon: UserPlus },
    ];

    const NavItem = ({ id, label, icon: Icon, isActive, isLogout = false }: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; isActive: boolean; isLogout?: boolean }) => {
        const isHovered = hovered === id;
        return (
            <li className={`relative mb-0.5 rounded-xl cursor-pointer select-none transition-all duration-200 ${isActive ? n.pressed : isLogout ? "hover:bg-red-500/10" : n.hoverBg}`}
                onClick={() => onNavigate(id)} onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)}>
                {isActive && <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 ${n.activeBar} rounded-r-full`} />}
                <div className={`px-3 py-2.5 flex items-center gap-3 transition-colors duration-200 ${isActive ? n.label : isLogout ? "text-red-400" : n.tertiary} ${isHovered && !isActive && !isLogout ? n.text : ""}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive ? n.activeIcon : isLogout ? "bg-red-500/10 text-red-400" : n.inset} ${isHovered && !isActive && !isLogout ? "scale-105" : ""}`}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-sm font-medium ${isActive ? n.text : ""}`}>{label}</span>
                </div>
            </li>
        );
    };

    return (
        <aside className={`${sidebarToggle ? "w-0 -translate-x-full" : "w-72 translate-x-0"} ${n.sidebar} fixed top-0 left-0 h-full border-r transition-all duration-300 ease-in-out z-40 overflow-hidden`}>
            <div className="h-full flex flex-col px-4 py-5">
                {/* Logo */}
                <div className="mb-8 px-2">
                    <div className="flex items-center gap-3">
                        {onBack && activePage !== "dashboard" ? (
                            <button onClick={onBack} className={`w-9 h-9 ${n.inset} rounded-xl flex items-center justify-center ${n.tertiary} transition-colors`}><ArrowLeft className="w-4 h-4" /></button>
                        ) : <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-black/5'}`}><img src={timelyLogo} alt="Timely" className="w-7 h-7 object-contain" /></div>
                        <div><h1 className={`text-lg font-semibold tracking-tight ${n.text}`}>Timely</h1><p className={`text-[10px] tracking-[0.2em] uppercase ${n.tertiary}`}>Real Estate</p></div>
                    </div>
                </div>

                {/* Main Nav */}
                <div className="flex-1 overflow-y-auto">
                    <div className="mb-6">
                        <p className={`px-3 mb-2 text-[10px] font-semibold ${n.tertiary} uppercase tracking-[0.15em]`}>Menu</p>
                        <ul>{menuItems.map(item => <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} isActive={activePage === item.id} />)}</ul>
                    </div>

                    {isAdmin && (
                        <div className="mb-6">
                            <p className={`px-3 mb-2 text-[10px] font-semibold ${isDark ? "text-amber-500/70" : "text-amber-600"} uppercase tracking-[0.15em]`}>Administration</p>
                            <ul>{adminItems.map(item => <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} isActive={activePage === item.id} />)}</ul>
                        </div>
                    )}
                </div>

                {/* Bottom */}
                <div className="mt-auto">
                    <div className={`h-px ${n.divider} border-t mb-3`} />
                    <ul>
                        <NavItem id="settings" label="Settings" icon={Settings} isActive={activePage === "settings"} />
                        <NavItem id="logout" label="Logout" icon={LogOut} isActive={false} isLogout />
                    </ul>

                    {/* User Card */}
                    <div className={`mt-3 p-3 ${n.card} rounded-xl transition-colors`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 ${n.inset} rounded-full flex items-center justify-center text-xs font-semibold ${n.secondary}`}>{initials}</div>
                            <div className="flex-1 min-w-0"><p className={`text-sm font-medium ${n.text} truncate`}>{userName}</p><p className={`text-[11px] ${n.tertiary} truncate`}>{roleLabel}</p></div>
                            <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
                        </div>
                    </div>
                </div>

                {/* Collapse toggle */}
                {setSidebarToggle && (
                    <button onClick={() => setSidebarToggle(!sidebarToggle)} className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 ${isDark ? "bg-[#111111] border-gray-800 text-gray-500 hover:text-white" : "bg-[#e8e8e8] border-gray-200 text-gray-400 hover:text-gray-700"} border rounded-r-lg flex items-center justify-center transition-colors`}>
                        {sidebarToggle ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                    </button>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;