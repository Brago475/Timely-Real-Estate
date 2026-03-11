// src/Style_Components/Sidebar.tsx
import React, { useState, useEffect } from "react";
import {
    FaHome,
    FaUserCog,
    FaRegSun,
    FaClock,
    FaUsers,
    FaUserTie,
    FaChartBar,
    FaSignOutAlt,
    FaChevronLeft,
    FaChevronRight,
    FaEnvelope,
    FaArrowLeft,
    FaComments,
} from "react-icons/fa";
import { FaRegFolder } from "react-icons/fa6";
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

// Helper to get unread message count for consultants
const getConsultantUnreadCount = (consultantId: string): number => {
    try {
        const messages = JSON.parse(localStorage.getItem(`timely_consultant_messages_${consultantId}`) || "[]");
        return messages.filter((m: any) => !m.read && !m.archived && !m.deleted).length;
    } catch {
        return 0;
    }
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
    const [showProfileDetails, setShowProfileDetails] = useState(false);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [consultantId, setConsultantId] = useState("");

    // Fetch consultant ID and unread count (only for consultants)
    useEffect(() => {
        const fetchConsultantId = async () => {
            // Only fetch for consultants, not admins
            if (userRole === "consultant" && userEmail) {
                try {
                    const res = await fetch(`http://localhost:4000/api/consultants`);
                    if (res.ok) {
                        const data = await res.json();
                        const consultant = (data.data || []).find(
                            (c: any) => c.email === userEmail
                        );
                        if (consultant) {
                            setConsultantId(consultant.consultantId);
                            setUnreadMessages(getConsultantUnreadCount(consultant.consultantId));
                        }
                    }
                } catch (e) {
                    console.error("Error fetching consultant ID:", e);
                }
            }
        };

        fetchConsultantId();

        // Refresh unread count periodically (only for consultants)
        const interval = setInterval(() => {
            if (consultantId && userRole === "consultant") {
                setUnreadMessages(getConsultantUnreadCount(consultantId));
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [userEmail, userRole, consultantId]);

    const styles = {
        sidebar: isDark
            ? "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-slate-800/50 shadow-black/20"
            : "bg-white border-gray-200 shadow-gray-200/50",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-500",
        textSubtle: isDark ? "text-slate-500" : "text-gray-400",
        menuActive: isDark
            ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/30"
            : "bg-blue-50 border-blue-200",
        menuHover: isDark
            ? "hover:bg-slate-700/50 hover:border-slate-600/50"
            : "hover:bg-gray-100 hover:border-gray-200",
        menuActiveText: isDark ? "text-cyan-400" : "text-blue-600",
        menuActiveIcon: isDark
            ? "bg-gradient-to-br from-cyan-500 to-blue-500 shadow-cyan-500/25"
            : "bg-blue-500",
        menuIcon: isDark ? "bg-slate-700/50 text-slate-400" : "bg-gray-100 text-gray-500",
        menuIconHover: isDark ? "bg-slate-600 text-white" : "bg-gray-200 text-gray-700",
        card: isDark
            ? "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/70"
            : "bg-gray-50 border-gray-200 hover:bg-gray-100",
        divider: isDark
            ? "bg-gradient-to-r from-transparent via-slate-700 to-transparent"
            : "bg-gray-200",
        button: isDark
            ? "bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700"
            : "bg-white hover:bg-gray-100 text-gray-500 border-gray-200",
        activeBar: isDark
            ? "bg-gradient-to-b from-cyan-400 to-blue-500"
            : "bg-blue-500",
    };

    const getInitials = (name: string) => {
        const parts = name.trim().split(" ");
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    // Base menu items (for both admin and consultant)
    const baseMenuItems = [
        { id: "dashboard", label: "Dashboard", icon: FaHome },
        { id: "projects", label: "Projects", icon: FaRegFolder },
        { id: "client", label: "Clients", icon: FaUsers },
        { id: "consultants", label: "Consultants", icon: FaUserTie },
        { id: "reports", label: "Reports", icon: FaChartBar },
        { id: "hours", label: "Hours", icon: FaClock },
    ];

    // Messages item - only for consultants (admins access Messages via Admin Panel)
    const messagesItem = {
        id: "messages",
        label: "Messages",
        icon: FaComments,
        badge: unreadMessages > 0 ? unreadMessages : undefined
    };

    // Build menu items based on role
    const menuItems = isAdmin
        ? baseMenuItems  // Admin: no messages in sidebar (they use Admin Panel > Messages)
        : [...baseMenuItems, messagesItem];  // Consultant: include messages

    // Admin-only section
    const adminItems = [
        { id: "admin", label: "Admin Panel", icon: FaUserCog },
        { id: "EmailGenerator", label: "Create Account", icon: FaEnvelope },
    ];

    const bottomItems = [{ id: "settings", label: "Settings", icon: FaRegSun }];

    const NavItem = ({
        id,
        label,
        icon: Icon,
        isActive,
        isLogout = false,
        badge,
    }: {
        id: string;
        label: string;
        icon: React.ComponentType<{ className?: string }>;
        isActive: boolean;
        isLogout?: boolean;
        badge?: number;
    }) => {
        const isHovered = hoveredItem === id;

        return (
            <li
                className={`
          relative mb-1 rounded-xl cursor-pointer select-none
          transition-all duration-200 ease-out border
          ${isActive
                        ? styles.menuActive
                        : isLogout
                            ? "hover:bg-red-500/10 border-transparent hover:border-red-500/30"
                            : `${styles.menuHover} border-transparent`
                    }
        `}
                onClick={() => onNavigate(id)}
                onMouseEnter={() => setHoveredItem(id)}
                onMouseLeave={() => setHoveredItem(null)}
            >
                {isActive && (
                    <div
                        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 ${styles.activeBar} rounded-r-full`}
                    />
                )}

                <div
                    className={`
            px-4 py-3 flex items-center gap-3 transition-colors duration-200
            ${isActive
                            ? styles.menuActiveText
                            : isLogout
                                ? "text-red-400"
                                : styles.textMuted
                        }
            ${isHovered && !isActive && !isLogout ? styles.text : ""}
          `}
                >
                    <div
                        className={`
              w-9 h-9 rounded-lg flex items-center justify-center
              transition-all duration-200 relative
              ${isActive
                                ? `${styles.menuActiveIcon} text-white shadow-lg`
                                : isLogout
                                    ? "bg-red-500/10 text-red-400"
                                    : styles.menuIcon
                            }
              ${isHovered && !isActive && !isLogout
                                ? `${styles.menuIconHover} scale-105`
                                : ""
                            }
            `}
                    >
                        <Icon className="w-4 h-4" />
                        {/* Badge for unread count */}
                        {badge && badge > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                                {badge > 9 ? "9+" : badge}
                            </span>
                        )}
                    </div>
                    <span className={`font-medium text-sm ${isActive ? styles.text : ""}`}>
                        {label}
                    </span>

                    {isHovered && !isActive && (
                        <FaChevronRight
                            className={`
                w-3 h-3 ml-auto animate-pulse
                ${isLogout ? "text-red-400" : styles.textSubtle}
              `}
                        />
                    )}
                </div>
            </li>
        );
    };

    return (
        <aside
            className={`
        ${sidebarToggle ? "w-0 -translate-x-full" : "w-72 translate-x-0"}
        ${styles.sidebar}
        fixed top-0 left-0 h-full
        border-r transition-all duration-300 ease-in-out
        z-40 overflow-hidden shadow-2xl
      `}
        >
            {isDark && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
                </div>
            )}

            <div className="relative h-full flex flex-col px-4 py-6">
                {/* Top: back button + logo */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 px-2">
                        {onBack && activePage !== "dashboard" && (
                            <button
                                onClick={onBack}
                                className={`w-10 h-10 ${styles.button} border rounded-xl flex items-center justify-center hover:text-white transition-all`}
                                title="Go back"
                            >
                                <FaArrowLeft className="w-4 h-4" />
                            </button>
                        )}

                        {(!onBack || activePage === "dashboard") && (
                            <div
                                className={`w-10 h-10 ${isDark
                                        ? "bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25"
                                        : "bg-blue-600"
                                    } rounded-xl flex items-center justify-center`}
                            >
                                <span className="text-white font-bold text-lg">T</span>
                            </div>
                        )}

                        <div>
                            <h1 className={`text-xl ${styles.text} font-bold tracking-tight`}>
                                Timely
                            </h1>
                            <p className={`text-xs ${styles.textSubtle}`}>Management Portal</p>
                        </div>
                    </div>
                </div>

                {/* MAIN NAVIGATION */}
                <div className="flex-1 overflow-y-auto">
                    {/* Main Menu */}
                    <div className="mb-6">
                        <p
                            className={`px-4 mb-3 text-xs font-semibold ${styles.textSubtle} uppercase tracking-wider`}
                        >
                            Main Menu
                        </p>
                        <ul>
                            {menuItems.map((item) => (
                                <NavItem
                                    key={item.id}
                                    id={item.id}
                                    label={item.label}
                                    icon={item.icon}
                                    isActive={activePage === item.id}
                                    badge={(item as any).badge}
                                />
                            ))}
                        </ul>
                    </div>

                    {/* Admin Section (admin only) */}
                    {isAdmin && (
                        <div className="mb-6">
                            <p
                                className={`px-4 mb-3 text-xs font-semibold ${isDark ? "text-amber-500/80" : "text-amber-600"
                                    } uppercase tracking-wider`}
                            >
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

                {/* Bottom: Settings + Logout + User Card */}
                <div className="mt-auto">
                    <div className={`h-px ${styles.divider} mb-4`} />

                    <ul>
                        {bottomItems.map((item) => (
                            <NavItem
                                key={item.id}
                                id={item.id}
                                label={item.label}
                                icon={item.icon}
                                isActive={activePage === item.id}
                            />
                        ))}
                        <NavItem
                            id="logout"
                            label="Logout"
                            icon={FaSignOutAlt}
                            isActive={false}
                            isLogout={true}
                        />
                    </ul>

                    {/* User card */}
                    <div
                        className={`mt-4 p-3 ${styles.card} rounded-xl border cursor-pointer transition-all`}
                        onClick={() => setShowProfileDetails(!showProfileDetails)}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${userRole === "admin"
                                        ? "bg-gradient-to-br from-amber-500 to-orange-500"
                                        : userRole === "consultant"
                                            ? "bg-gradient-to-br from-purple-500 to-pink-500"
                                            : "bg-gradient-to-br from-cyan-500 to-blue-500"
                                    }`}
                            >
                                {getInitials(userName)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${styles.text}`}>
                                    {userRole === "admin"
                                        ? "Admin"
                                        : userRole === "consultant"
                                            ? "Consultant"
                                            : "Client"}
                                </p>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                    <span className={`text-xs ${styles.textSubtle}`}>Online</span>
                                </div>
                            </div>
                            <FaChevronRight
                                className={`w-3 h-3 ${styles.textSubtle} transition-transform duration-200 ${showProfileDetails ? "rotate-90" : ""
                                    }`}
                            />
                        </div>

                        {showProfileDetails && (
                            <div
                                className={`mt-3 pt-3 border-t ${isDark ? "border-slate-700/50" : "border-gray-200"
                                    } space-y-2`}
                            >
                                <div>
                                    <p className={`text-xs ${styles.textSubtle}`}>Name</p>
                                    <p className={`text-sm ${styles.text} truncate`}>{userName}</p>
                                </div>
                                <div>
                                    <p className={`text-xs ${styles.textSubtle}`}>Email</p>
                                    <p className={`text-sm ${styles.textMuted} truncate`}>
                                        {userEmail || "No email"}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {setSidebarToggle && (
                    <button
                        onClick={() => setSidebarToggle(!sidebarToggle)}
                        className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 ${styles.button} border rounded-r-lg flex items-center justify-center hover:text-white transition-all`}
                    >
                        {sidebarToggle ? (
                            <FaChevronRight className="w-3 h-3" />
                        ) : (
                            <FaChevronLeft className="w-3 h-3" />
                        )}
                    </button>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;