// src/App.tsx
// main application entry point
// handles authentication, routing, and layout based on user role

import React, { useState, useEffect } from "react";
import { ThemeProvider, useTheme } from "./Views_Layouts/ThemeContext";
import SidebarLayout from "./Style_Components/Sidebar";
import Navbar from "./Style_Components/Navbar";
import Dashboard from "./Style_Components/Dashboard";
import ClientPortal from "./ClientPortal_views/ClientPortal";
import Login from "./Style_Components/Login";
import AdminTab from "./Tabs/admin";
import ReportsTab from "./Tabs/reports";
import EmailGenerator from "./Views_Layouts/EmailGenerator";
import ProfilePage from "./Views_Layouts/profile";
import RealEstateProjects from "./Tabs/projects";
import ClientsPage from "./Tabs/clients";
import ConsultantsPage from "./Tabs/consultants";
import HoursPage from "./Tabs/hours";
import SettingsPage from "./Tabs/settings";
import ConsultantMessages from "./Tabs/ConsultantMessages";

type UserRole = "admin" | "consultant" | "client";

type UserInfo = {
    customerId: string;
    consultantId?: string;
    email: string;
    name: string;
    role?: UserRole;
};

const normalizeRole = (role?: string): UserRole => {
    const r = (role || "").toLowerCase();
    if (r === "admin") return "admin";
    if (r === "consultant") return "consultant";
    return "client";
};

function AppContent() {
    const { isDark } = useTheme();

    const [sidebarToggle, setSidebarToggle] = useState(false);
    const [isAuthed, setIsAuthed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activePage, setActivePage] = useState("dashboard");
    const [pageHistory, setPageHistory] = useState<string[]>(["dashboard"]);
    const [userData, setUserData] = useState<UserInfo | null>(null);
    const [consultantId, setConsultantId] = useState("");

    const currentRole: UserRole | undefined = userData?.role;
    const isAdmin = currentRole === "admin";
    const isConsultant = currentRole === "consultant";
    const isClient = currentRole === "client";
    const isStaff = isAdmin || isConsultant;

    // restore auth from localStorage on mount
    useEffect(() => {
        const storedUser = localStorage.getItem("timely_user");
        const authenticated = localStorage.getItem("timely_authenticated");

        if (storedUser && authenticated === "true") {
            try {
                const parsed = JSON.parse(storedUser) as {
                    customerId: string;
                    consultantId?: string;
                    email: string;
                    name: string;
                    role?: string;
                };

                const normalizedUser: UserInfo = {
                    customerId: parsed.customerId,
                    consultantId: parsed.consultantId,
                    email: parsed.email,
                    name: parsed.name,
                    role: normalizeRole(parsed.role),
                };

                setUserData(normalizedUser);
                setIsAuthed(true);
            } catch (err) {
                console.error("Error parsing stored user:", err);
            }
        }

        setIsLoading(false);
    }, []);

    // Fetch consultant ID when user is a consultant
    useEffect(() => {
        const fetchConsultantId = async () => {
            if (userData?.role === "consultant" && userData?.email) {
                // Check if already have consultantId
                if (userData.consultantId) {
                    setConsultantId(userData.consultantId);
                    return;
                }

                try {
                    const res = await fetch(`http://localhost:4000/api/consultants`);
                    if (res.ok) {
                        const data = await res.json();
                        const consultant = (data.data || []).find(
                            (c: any) => c.email === userData.email
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
    }, [userData]);

    // called by Login.tsx after successful login
    const handleLoginSuccess = (user: {
        customerId: string;
        consultantId?: string;
        email: string;
        name: string;
        role?: string;
    }) => {
        const normalizedUser: UserInfo = {
            customerId: user.customerId,
            consultantId: user.consultantId,
            email: user.email,
            name: user.name,
            role: normalizeRole(user.role),
        };

        setUserData(normalizedUser);
        setIsAuthed(true);
        localStorage.setItem("timely_user", JSON.stringify(normalizedUser));
        localStorage.setItem("timely_authenticated", "true");

        // clients go to their dedicated portal, staff go to dashboard
        if (normalizedUser.role === "client") {
            setActivePage("client_home");
            setPageHistory(["client_home"]);
        } else {
            setActivePage("dashboard");
            setPageHistory(["dashboard"]);
        }
    };

    const handleLogout = () => {
        setIsAuthed(false);
        setUserData(null);
        setConsultantId("");
        setActivePage("dashboard");
        setPageHistory(["dashboard"]);
        localStorage.removeItem("timely_user");
        localStorage.removeItem("timely_authenticated");
    };

    // guarded navigation - enforces role-based access control
    const handleNavigation = (page: string) => {
        if (page === "logout") {
            handleLogout();
            return;
        }

        // admin-only pages
        const adminOnlyPages = new Set(["admin", "EmailGenerator"]);
        if (adminOnlyPages.has(page) && !isAdmin) {
            return;
        }

        // staff-only pages (admin and consultant)
        const staffOnlyPages = new Set([
            "dashboard",
            "projects",
            "client",
            "consultants",
            "reports",
            "hours",
            "settings",
            "profile",
            "messages",  // Added messages for consultants
        ]);

        if (staffOnlyPages.has(page) && !isStaff) {
            return;
        }

        // client-only page
        if (page === "client_home" && !isClient) {
            return;
        }

        setActivePage(page);
        setPageHistory((prev) => [...prev, page]);
    };

    // back button navigation
    const handleBack = () => {
        setPageHistory((prev) => {
            if (prev.length <= 1) return prev;
            const newHistory = [...prev];
            newHistory.pop();
            const previousPage = newHistory[newHistory.length - 1] || "dashboard";
            setActivePage(previousPage);
            return newHistory;
        });
    };

    // show login when not authenticated
    if (!isAuthed) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-slate-950" : "bg-slate-100"}`}>
                <Login onLoginSuccess={handleLoginSuccess} />
            </div>
        );
    }

    // clients get their own dedicated portal without the staff sidebar/navbar
    if (isClient) {
        return (
            <ClientPortal
                userName={userData?.name || "Client"}
                userEmail={userData?.email || ""}
                customerId={userData?.customerId || ""}
                onLogout={handleLogout}
            />
        );
    }

    // render page content based on active page
    const renderActivePage = () => {
        switch (activePage) {
            case "dashboard":
                return (
                    <Dashboard
                        sidebarToggle={sidebarToggle}
                        setSidebarToggle={setSidebarToggle}
                        userName={userData?.name}
                        userEmail={userData?.email}
                        userRole={currentRole}
                        onNavigate={handleNavigation}
                    />
                );
            case "projects":
                return <RealEstateProjects />;
            case "client":
                return <ClientsPage />;
            case "consultants":
                return <ConsultantsPage userRole={currentRole} />;
            case "reports":
                return <ReportsTab />;
            case "hours":
                return <HoursPage />;
            case "messages":
                // Only consultants see this (admins use Admin Panel > Messages tab)
                return (
                    <ConsultantMessages
                        consultantId={consultantId}
                        consultantEmail={userData?.email || ""}
                        consultantName={userData?.name || "Consultant"}
                    />
                );
            case "admin":
                return <AdminTab onNavigate={handleNavigation} />;
            case "EmailGenerator":
                return <EmailGenerator />;
            case "settings":
                return <SettingsPage />;
            case "profile":
                return <ProfilePage />;
            default:
                return (
                    <Dashboard
                        sidebarToggle={sidebarToggle}
                        setSidebarToggle={setSidebarToggle}
                        userName={userData?.name}
                        userEmail={userData?.email}
                        userRole={currentRole}
                        onNavigate={handleNavigation}
                    />
                );
        }
    };

    // sidebarToggle: true = hidden, false = visible
    const sidebarVisible = !sidebarToggle;

    return (
        <div className={`min-h-screen ${isDark ? "bg-slate-950 text-white" : "bg-slate-100 text-gray-900"}`}>
            <SidebarLayout
                sidebarToggle={sidebarToggle}
                setSidebarToggle={setSidebarToggle}
                onNavigate={handleNavigation}
                onBack={pageHistory.length > 1 ? handleBack : undefined}
                isAdmin={isAdmin}
                activePage={activePage}
                userName={userData?.name}
                userEmail={userData?.email}
                userRole={currentRole}
            />

            <div className={`min-h-screen transition-all duration-300 ${sidebarVisible ? "ml-72" : "ml-0"}`}>
                <Navbar
                    sidebarToggle={sidebarToggle}
                    setSidebarToggle={setSidebarToggle}
                    onNavigate={handleNavigation}
                    activePage={activePage}
                    onLogout={handleLogout}
                    userRole={currentRole}
                    userName={userData?.name}
                    userEmail={userData?.email}
                />

                <main className="pt-16 px-4 md:px-6 pb-6">
                    {renderActivePage()}
                </main>
            </div>
        </div>
    );
}

const App: React.FC = () => (
    <ThemeProvider>
        <AppContent />
    </ThemeProvider>
);

export default App;