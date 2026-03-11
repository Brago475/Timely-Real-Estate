import React, { useState } from "react";
import Navbar from "../Style_Components/Navbar";
import Sidebar from "../Style_Components/Sidebar";
import Dashboard from "../Style_Components/Dashboard";

import Clients from "../Tabs/clients";
import Consultants from "../Tabs/consultants";
import Projects from "../Tabs/projects";
import Reports from "../Tabs/reports";
import Hours from "../Tabs/hours";
import Settings from "../Tabs/settings";
import AdminPanel from "../Tabs/admin";

import EmailGenerator from "../Views_Layouts/EmailGenerator";


const [activePage, setActivePage] = useState("dashboard");
const [sidebarToggle, setSidebarToggle] = useState(true);

const AdminPortal = ({ user }: { user: any }) => {
  const [activePage, setActivePage] = useState("dashboard");

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return (
          <Dashboard
            sidebarToggle={sidebarToggle}
            onNavigate={setActivePage}
          />
        );
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
      case "settings":
        return <Settings />;
      case "admin":
        return <AdminPanel />;
      case "EmailGenerator":
        return <EmailGenerator />;
      default:
        return (
          <Dashboard
            sidebarToggle={sidebarToggle}
            onNavigate={setActivePage}
          />
        );
    }
  };

  return (
    <>
      {/* TODO: Load all tab data from database:
          - Dashboard metrics
          - Clients, Consultants, Projects, Hours, Reports
          Ensure all tab content relies on dynamic data from DB */}
      <Sidebar
        sidebarToggle={false}
        onNavigate={setActivePage}
        isAdmin={true}
        activePage={activePage}
        userName={user.name}
        userEmail={user.email}
        userRole={user.role}
      />
      <div className="ml-72">
        <Navbar
          onNavigate={setActivePage}
          activePage={activePage}
          userName={user.name}
          userEmail={user.email}
          userRole={user.role} sidebarToggle={false} setSidebarToggle={function (v: boolean): void {
            throw new Error("Function not implemented.");
          } }/>

        <main className="p-6">{renderPage()}</main>
      </div>
    </>
  );
};

export default AdminPortal;