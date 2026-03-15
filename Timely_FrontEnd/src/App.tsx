import React, { useState, useEffect } from "react";
import { ThemeProvider, useTheme } from "./Views_Layouts/ThemeContext";
import { useAuth } from "./context/AuthContext";
import { apiGet } from "./services/api";
import SidebarLayout from "./Style_Components/Sidebar";
import Navbar from "./Style_Components/Navbar";
import Dashboard from "./Style_Components/Dashboard";
import ClientPortal from "./ClientPortal_views/ClientPortal";
import Login from "./Style_Components/Login";
import AdminTab from "./Tabs/admin";
import ReportsTab from "./Tabs/reports";
import InviteMembers from "./Views_Layouts/InviteMembers";
import ProfilePage from "./Views_Layouts/Profile";
import RealEstateProjects from "./Tabs/projects";
import ClientsPage from "./Tabs/clients";
import ConsultantsPage from "./Tabs/consultants";
import HoursPage from "./Tabs/hours";
import SettingsPage from "./Tabs/settings";
import ConsultantMessages from "./Tabs/ConsultantMessages";
import timelyLogo from "./assets/Timely_logo.png";

type UserRole = "admin" | "consultant" | "client";
type UserInfo = { customerId: string; consultantId?: string; email: string; name: string; role?: UserRole; };

const normalizeRole = (role?: string): UserRole => { const r = (role || "").toLowerCase(); if (r === "admin") return "admin"; if (r === "consultant") return "consultant"; return "client"; };

function AppContent() {
    const { isDark } = useTheme();
    const { user: authUser, isLoggedIn, login, logout: authLogout } = useAuth();

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

    useEffect(() => {
        if (isLoggedIn && authUser) {
            setUserData({ customerId: authUser.customerId, email: authUser.email, name: authUser.name, role: normalizeRole(authUser.role) });
            setIsAuthed(true);
        } else {
            const storedUser = localStorage.getItem("timely_user");
            const authenticated = localStorage.getItem("timely_authenticated");
            if (storedUser && authenticated === "true") {
                try { const p = JSON.parse(storedUser); setUserData({ customerId: p.customerId, consultantId: p.consultantId, email: p.email, name: p.name, role: normalizeRole(p.role) }); setIsAuthed(true); } catch {}
            }
        }
        setIsLoading(false);
    }, [isLoggedIn, authUser]);

    useEffect(() => {
        const fetchConsultantId = async () => {
            if (userData?.role === "consultant" && userData?.email) {
                if (userData.consultantId) { setConsultantId(userData.consultantId); return; }
                try { const data = await apiGet("/consultants"); const c = (data.data || []).find((c: any) => c.email === userData.email); if (c) setConsultantId(c.consultantId); } catch {}
            }
        };
        fetchConsultantId();
    }, [userData]);

    const handleLoginSuccess = (user: { customerId: string; consultantId?: string; email: string; name: string; role?: string }) => {
        const u: UserInfo = { customerId: user.customerId, consultantId: user.consultantId, email: user.email, name: user.name, role: normalizeRole(user.role) };
        setUserData(u); setIsAuthed(true);
        localStorage.setItem("timely_user", JSON.stringify(u)); localStorage.setItem("timely_authenticated", "true");
        if (u.role === "client") { setActivePage("client_home"); setPageHistory(["client_home"]); } else { setActivePage("dashboard"); setPageHistory(["dashboard"]); }
    };

    const handleLogout = () => { setIsAuthed(false); setUserData(null); setConsultantId(""); setActivePage("dashboard"); setPageHistory(["dashboard"]); localStorage.removeItem("timely_user"); localStorage.removeItem("timely_authenticated"); authLogout(); };

    const handleNavigation = (page: string) => {
        if (page === "logout") { handleLogout(); return; }
        if (new Set(["admin", "InviteMembers"]).has(page) && !isAdmin) return;
        if (new Set(["dashboard", "projects", "client", "consultants", "reports", "hours", "settings", "profile", "messages"]).has(page) && !isStaff) return;
        if (page === "client_home" && !isClient) return;
        setActivePage(page); setPageHistory(p => [...p, page]);
    };

    const handleBack = () => { setPageHistory(p => { if (p.length <= 1) return p; const h = [...p]; h.pop(); setActivePage(h[h.length - 1] || "dashboard"); return h; }); };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center">
                <div className="bg-white/10 rounded-3xl p-6 backdrop-blur-sm">
                    <img src={timelyLogo} alt="Timely" className="w-16 h-16 animate-pulse" />
                </div>
                <p className="text-white/40 text-sm mt-4 tracking-wide">Loading...</p>
            </div>
        );
    }

    if (!isAuthed) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    if (isClient) {
        return <ClientPortal userName={userData?.name || "Client"} userEmail={userData?.email || ""} customerId={userData?.customerId || ""} onLogout={handleLogout} />;
    }

    const renderActivePage = () => {
        switch (activePage) {
            case "dashboard": return <Dashboard sidebarToggle={sidebarToggle} setSidebarToggle={setSidebarToggle} userName={userData?.name} userEmail={userData?.email} userRole={currentRole} onNavigate={handleNavigation} />;
            case "projects": return <RealEstateProjects />;
            case "client": return <ClientsPage />;
            case "consultants": return <ConsultantsPage userRole={currentRole} />;
            case "reports": return <ReportsTab />;
            case "hours": return <HoursPage />;
            case "messages": return <ConsultantMessages consultantId={consultantId} consultantEmail={userData?.email || ""} consultantName={userData?.name || "Consultant"} />;
            case "admin": return <AdminTab onNavigate={handleNavigation} />;
            case "InviteMembers": return <InviteMembers />;
            case "settings": return <SettingsPage />;
            case "profile": return <ProfilePage />;
            default: return <Dashboard sidebarToggle={sidebarToggle} setSidebarToggle={setSidebarToggle} userName={userData?.name} userEmail={userData?.email} userRole={currentRole} onNavigate={handleNavigation} />;
        }
    };

    return (
        <div className={`min-h-screen ${isDark ? "bg-[#0a0a0a] text-white" : "bg-white text-gray-900"}`}>
            <SidebarLayout sidebarToggle={sidebarToggle} setSidebarToggle={setSidebarToggle} onNavigate={handleNavigation} onBack={pageHistory.length > 1 ? handleBack : undefined} isAdmin={isAdmin} activePage={activePage} userName={userData?.name} userEmail={userData?.email} userRole={currentRole} />
            <div className={`min-h-screen transition-all duration-300 ${!sidebarToggle ? "ml-72" : "ml-0"}`}>
                <Navbar sidebarToggle={sidebarToggle} setSidebarToggle={setSidebarToggle} onNavigate={handleNavigation} activePage={activePage} onLogout={handleLogout} userRole={currentRole} userName={userData?.name} userEmail={userData?.email} />
                <main className="pt-16 px-4 md:px-6 pb-6" key={activePage}><div className="animate-fadeIn">{renderActivePage()}</div></main>
            </div>
        </div>
    );
}

const App: React.FC = () => (<ThemeProvider><AppContent /></ThemeProvider>);
export default App;