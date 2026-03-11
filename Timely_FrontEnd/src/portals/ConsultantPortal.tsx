// src/portal/ConsultantPortal.tsx
import React, { useState, useEffect } from "react";
import Navbar from "../Style_Components/Navbar";
import Sidebar from "../Style_Components/Sidebar";
import Dashboard from "../Style_Components/Dashboard";
import Clients from "../Tabs/clients";
import Consultants from "../Tabs/consultants";
import Projects from "../Tabs/projects";
import Reports from "../Tabs/reports";
import Hours from "../Tabs/hours";
import Settings from "../Tabs/settings";
import ConsultantMessages from "../Tabs/ConsultantMessages";

const ConsultantPortal = ({ user }: { user: any }) => {
    const [activePage, setActivePage] = useState("dashboard");
    const [sidebarToggle, setSidebarToggle] = useState(false);

    // Get consultant info for messaging
    const [consultantId, setConsultantId] = useState("");

    useEffect(() => {
        const fetchConsultantId = async () => {
            try {
                if (user?.consultantId) {
                    setConsultantId(user.consultantId);
                    return;
                }

                const res = await fetch(`http://localhost:4000/api/consultants`);
                if (res.ok) {
                    const data = await res.json();
                    const consultant = (data.data || []).find(
                        (c: any) => c.email === user?.email
                    );
                    if (consultant) {
                        setConsultantId(consultant.consultantId);
                    }
                }
            } catch (e) {
                console.error("Error fetching consultant ID:", e);
            }
        };

        fetchConsultantId();
    }, [user]);

    const renderPage = () => {
        switch (activePage) {
            case "dashboard":
                return <Dashboard sidebarToggle={false} onNavigate={setActivePage} />;
            case "client":
                return <Clients />;
            case "consultants":
                return <Consultants />;
            case "projects":
                return <Projects />;
            case "reports":
                return <Reports />;
            case "hours":
                return <Hours />;
            case "messages":
                return (
                    <ConsultantMessages
                        consultantId={consultantId}
                        consultantEmail={user?.email || ""}
                        consultantName={user?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Consultant"}
                    />
                );
            case "settings":
                return <Settings />;
            default:
                return <Dashboard sidebarToggle={false} onNavigate={setActivePage} />;
        }
    };

    return (
        <>
            <Sidebar
                sidebarToggle={sidebarToggle}
                setSidebarToggle={setSidebarToggle}
                onNavigate={setActivePage}
                isAdmin={false}
                activePage={activePage}
                userName={user?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim()}
                userEmail={user?.email}
                userRole={user?.role || "consultant"}
            />
            <Navbar
                onNavigate={setActivePage}
                activePage={activePage}
                sidebarToggle={sidebarToggle}
                setSidebarToggle={setSidebarToggle}
            />

            <main className={`p-6 transition-all duration-300 ${sidebarToggle ? "ml-0" : "ml-72"}`}>
                {renderPage()}
            </main>
        </>
    );
};

export default ConsultantPortal;