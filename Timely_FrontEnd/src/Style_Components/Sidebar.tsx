// src/Style_Components/Sidebar.tsx
import React, { useState, useEffect } from "react";
import { Home, FolderOpen, Globe, Users, UserCheck, BarChart3, Clock, Settings, LogOut, ChevronLeft, ChevronRight, ArrowLeft, Shield, UserPlus, MessageCircle } from "lucide-react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import { getGradient } from "./Navbar";
import timelyLogo from "../assets/Timely_logo.png";

type Props = { sidebarToggle: boolean; setSidebarToggle?: (v: boolean) => void; onNavigate: (page: string) => void; onBack?: () => void; isAdmin: boolean; activePage?: string; userName?: string; userEmail?: string; userRole?: string; };

const safeFetch = async (url: string) => { try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); } catch { return null; } };

const Sidebar: React.FC<Props> = ({ sidebarToggle, setSidebarToggle, onNavigate, onBack, isAdmin, activePage = "dashboard", userName = "User", userEmail = "", userRole = "client" }) => {
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
        flat:       isDark ? "neu-dark-flat"    : "neu-light-flat",
        inset:      isDark ? "neu-dark-inset"   : "neu-light-inset",
        pressed:    isDark ? "neu-dark-pressed" : "neu-light-pressed",
        card:       isDark ? "neu-dark"         : "neu-light",
        divider:    isDark ? "border-gray-800"  : "border-gray-200",
        activeBar:  "bg-blue-500",
        activeIcon: "bg-blue-600 text-white",
    };

    // ── Badge counts ──────────────────────────────────────────────────────────
    const [badges, setBadges] = useState<Record<string, number>>({});

    useEffect(() => {
        const loadBadges = async () => {
            const counts: Record<string, number> = {};
            try {
                // Projects — count active
                const pRes = await safeFetch("/api/projects");
                if (pRes?.data) {
                    const active = pRes.data.filter((p: any) => {
                        const s = (p.status || "").toLowerCase();
                        return s === "active" || s === "in_progress" || s === "in progress";
                    }).length;
                    if (active > 0) counts.projects = active;

                    // Listings — count published
                    const published = pRes.data.filter((p: any) => p.isPublished).length;
                    if (published > 0) counts.listings = published;
                }

                // Unread messages from localStorage
                const threads = JSON.parse(localStorage.getItem("timely_message_threads") || "[]");
                const userEmail = JSON.parse(localStorage.getItem("timely_user") || "{}").email || "";
                let unread = 0;
                threads.forEach((t: any) => {
                    (t.messages || []).forEach((m: any) => {
                        if (!m.read && m.from?.email !== userEmail) unread++;
                    });
                });
                if (unread > 0) counts.messages = unread;

                // Hours — entries this week
                const hRes = await safeFetch("/api/hours-logs");
                if (hRes?.data) {
                    const ws = new Date(); ws.setDate(ws.getDate() - ws.getDay()); ws.setHours(0, 0, 0, 0);
                    const weekEntries = hRes.data.filter((h: any) => new Date(h.date) >= ws).length;
                    if (weekEntries > 0) counts.hours = weekEntries;
                }
            } catch {}
            setBadges(counts);
        };
        loadBadges();
        // Refresh badges every 30s
        const interval = setInterval(loadBadges, 30000);
        return () => clearInterval(interval);
    }, []);

    const initials   = (userName || "U").split(" ").map(x => x[0]).join("").toUpperCase().slice(0, 2);
    const roleLabel  = userRole === "admin" ? "Administrator" : userRole === "consultant" ? "Consultant" : "Client";
    const gradient   = getGradient(userName, userEmail);

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

    const NavItem = ({
        id, label, icon: Icon, isActive, isLogout = false, badge = 0,
    }: {
        id: string; label: string; icon: React.ComponentType<{ className?: string }>; isActive: boolean; isLogout?: boolean; badge?: number;
    }) => (
        <li
            className={`relative mb-0.5 rounded-xl cursor-pointer select-none transition-all duration-200 group ${isActive ? n.pressed : isLogout ? "hover:bg-red-500/10" : hover}`}
            onClick={() => onNavigate(id)}
        >
            {isActive && <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 ${n.activeBar} rounded-r-full`} />}
            <div className={`px-3 py-2.5 flex items-center gap-3 transition-colors duration-200 ${isActive ? n.label : isLogout ? "text-red-500" : isDark ? "text-gray-300" : "text-gray-800"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive ? n.activeIcon : isLogout ? "bg-red-500/10 text-red-500" : n.inset} ${!isActive && !isLogout ? "group-hover:scale-105" : ""}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <span className={`text-sm font-medium flex-1 ${isActive ? n.text : ""} ${!isActive && !isLogout ? gb : ""} transition-colors`}>{label}</span>
                {badge > 0 && (
                    <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        id === "messages" ? "bg-red-500 text-white" : isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700"
                    }`}>
                        {badge > 99 ? "99+" : badge}
                    </span>
                )}
            </div>
        </li>
    );

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
                                <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} isActive={activePage === item.id} badge={badges[item.id] || 0} />
                            ))}
                        </ul>
                    </div>

                    {isAdmin && (
                        <div className="mb-6">
                            <p className={`px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] ${isDark ? "text-amber-400" : "text-amber-700"}`}>Administration</p>
                            <ul>
                                {adminItems.map(item => (
                                    <NavItem key={item.id} id={item.id} label={item.label} icon={item.icon} isActive={activePage === item.id} />
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
                    <div onClick={() => onNavigate("profile")} className={`mt-3 p-3 ${n.card} ${hover} group rounded-xl transition-all duration-200 cursor-pointer`}>
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
                    <button onClick={() => setSidebarToggle(!sidebarToggle)} className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 ${isDark ? "bg-[#111111] border-gray-800 text-gray-500 hover:text-white" : "bg-white border-gray-200 text-gray-400 hover:text-gray-900"} border rounded-r-lg flex items-center justify-center transition-colors`}>
                        {sidebarToggle ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                    </button>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;