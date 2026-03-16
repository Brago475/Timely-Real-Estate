// src/ClientPortal_views/ClientSettings.tsx
import React, { useState, useEffect } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    Bell, Shield, Eye, Lock, Calendar, Palette,
    Settings, User, FileText, MessageCircle, FolderOpen, Mail,
    CheckCircle, AlertCircle, Info, X, Save, RotateCcw,
    Moon, Sun, Trash2,
} from "lucide-react";

type ClientSettingsProps = { userName?: string; userEmail?: string; customerId?: string; };
type SectionId = "appearance" | "notifications" | "privacy" | "preferences" | "account" | "danger";

interface SettingsState {
    emailNotifications: boolean;
    projectUpdates: boolean;
    messageAlerts: boolean;
    documentAlerts: boolean;
    weeklyDigest: boolean;
    showActivityStatus: boolean;
    allowConsultantContact: boolean;
    dateFormat: string;
}

interface Toast { id: string; message: string; type: "success" | "error" | "info"; }

const STORAGE_KEY = "timely_client_settings";
const DEFAULTS: SettingsState = {
    emailNotifications: true, projectUpdates: true,
    messageAlerts: true, documentAlerts: true, weeklyDigest: false,
    showActivityStatus: true, allowConsultantContact: true,
    dateFormat: "MM/DD/YYYY",
};

const ClientSettings: React.FC<ClientSettingsProps> = ({
    userName = "Client", userEmail = "", customerId = "",
}) => {
    const { isDark, toggleTheme } = useTheme();

    const n = {
        card:          isDark ? "neu-dark"        : "neu-light",
        flat:          isDark ? "neu-dark-flat"   : "neu-light-flat",
        inset:         isDark ? "neu-dark-inset"  : "neu-light-inset",
        text:          isDark ? "text-white"      : "text-gray-900",
        secondary:     isDark ? "text-gray-300"   : "text-gray-600",
        tertiary:      isDark ? "text-gray-500"   : "text-gray-400",
        strong:        isDark ? "text-white"      : "text-black",
        label:         isDark ? "text-blue-400"   : "text-blue-600",
        divider:       isDark ? "border-gray-800" : "border-gray-200",
        input:         isDark ? "bg-transparent border-gray-700 text-white" : "bg-transparent border-gray-300 text-gray-900",
        btnPrimary:    "bg-blue-600 hover:bg-blue-500 text-white",
        sidebarActive: isDark ? "bg-blue-600/10 text-blue-400 border-blue-500" : "bg-blue-50 text-blue-600 border-blue-500",
        sidebarIdle:   isDark ? "text-gray-400 hover:bg-gray-800/50 border-transparent" : "text-gray-500 hover:bg-gray-50 border-transparent",
    };

    const [settings,       setSettings]       = useState<SettingsState>(DEFAULTS);
    const [hasChanges,     setHasChanges]     = useState(false);
    const [saving,         setSaving]         = useState(false);
    const [toasts,         setToasts]         = useState<Toast[]>([]);
    const [activeSection,  setActiveSection]  = useState<SectionId>("appearance");

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setSettings({ ...DEFAULTS, ...JSON.parse(saved) });
        } catch {}
    }, []);

    const showToast = (msg: string, type: Toast["type"] = "success") => {
        const id = `t_${Date.now()}`;
        setToasts(p => [...p, { id, message: msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
        setSettings(p => ({ ...p, [key]: value }));
        setHasChanges(true);
    };

    const save = () => {
        setSaving(true);
        setTimeout(() => {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); setHasChanges(false); showToast("Settings saved"); }
            catch { showToast("Failed to save", "error"); }
            setSaving(false);
        }, 400);
    };

    // ── Toggle — matches navbar pill ──────────────────────────────────────────
    const Toggle: React.FC<{ enabled: boolean; onChange: (v: boolean) => void }> = ({ enabled, onChange }) => (
        <button type="button" onClick={() => onChange(!enabled)}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 flex-shrink-0 focus:outline-none ${enabled ? "bg-blue-600" : isDark ? "bg-gray-700" : "bg-gray-200"}`}>
            <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 ${enabled ? "left-7" : "left-0.5"}`} />
        </button>
    );

    // ── Row ───────────────────────────────────────────────────────────────────
    const Row: React.FC<{ title: string; desc: string; last?: boolean; children: React.ReactNode }> = ({ title, desc, last, children }) => (
        <div className={`flex items-center justify-between py-4 ${!last ? `border-b ${n.divider}` : ""}`}>
            <div className="min-w-0 flex-1 pr-8">
                <p className={`text-sm font-medium ${n.text}`}>{title}</p>
                {desc && <p className={`text-xs ${n.tertiary} mt-0.5`}>{desc}</p>}
            </div>
            <div className="flex-shrink-0">{children}</div>
        </div>
    );

    // ── Sidebar nav ───────────────────────────────────────────────────────────
    const NAV: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }>; danger?: boolean }[] = [
        { id: "appearance",    label: "Appearance",    icon: Palette },
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "privacy",       label: "Privacy",       icon: Shield },
        { id: "preferences",   label: "Preferences",  icon: Settings },
        { id: "account",       label: "Account Info",  icon: User },
        { id: "danger",        label: "Danger Zone",  icon: Trash2, danger: true },
    ];

    // ── Section content ───────────────────────────────────────────────────────
    const renderSection = () => {
        switch (activeSection) {
            case "appearance": return (
                <SectionWrap title="Appearance" desc="Customize how Timely looks on your device.">
                    <div className={`${n.card} rounded-2xl px-5`}>
                        <Row title="Dark Mode" desc="Switch between light and dark interface theme." last>
                            <button type="button" onClick={toggleTheme}
                                className={`relative w-14 h-7 rounded-full transition-colors duration-300 flex-shrink-0 focus:outline-none ${isDark ? "bg-blue-600" : "bg-gray-200"}`}>
                                <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 flex items-center justify-center ${isDark ? "left-7" : "left-0.5"}`}>
                                    {isDark ? <Moon className="w-3 h-3 text-blue-600" /> : <Sun className="w-3 h-3 text-amber-500" />}
                                </span>
                            </button>
                        </Row>
                    </div>
                </SectionWrap>
            );

            case "notifications": return (
                <SectionWrap title="Notifications" desc="Control which notifications you receive.">
                    <div className={`${n.card} rounded-2xl px-5`}>
                        <Row title="Email Notifications"  desc="Receive updates and alerts via email."><Toggle enabled={settings.emailNotifications} onChange={v => update("emailNotifications", v)} /></Row>
                        <Row title="Project Updates"      desc="Get notified when your projects change status."><Toggle enabled={settings.projectUpdates} onChange={v => update("projectUpdates", v)} /></Row>
                        <Row title="Message Alerts"       desc="Get notified when you receive new messages."><Toggle enabled={settings.messageAlerts} onChange={v => update("messageAlerts", v)} /></Row>
                        <Row title="Document Alerts"      desc="Get notified when documents are uploaded."><Toggle enabled={settings.documentAlerts} onChange={v => update("documentAlerts", v)} /></Row>
                        <Row title="Weekly Digest"        desc="A summary of your activity delivered weekly." last><Toggle enabled={settings.weeklyDigest} onChange={v => update("weeklyDigest", v)} /></Row>
                    </div>
                </SectionWrap>
            );

            case "privacy": return (
                <SectionWrap title="Privacy" desc="Manage who can see your information and contact you.">
                    <div className={`${n.card} rounded-2xl px-5`}>
                        <Row title="Show Activity Status"    desc="Let consultants see when you're active in the portal."><Toggle enabled={settings.showActivityStatus} onChange={v => update("showActivityStatus", v)} /></Row>
                        <Row title="Allow Consultant Contact" desc="Allow your assigned consultant to initiate contact." last><Toggle enabled={settings.allowConsultantContact} onChange={v => update("allowConsultantContact", v)} /></Row>
                    </div>
                </SectionWrap>
            );

            case "preferences": return (
                <SectionWrap title="Preferences" desc="Customize how information is displayed.">
                    <div className={`${n.card} rounded-2xl px-5`}>
                        <Row title="Date Format" desc="Choose how dates appear throughout the portal." last>
                            <select value={settings.dateFormat} onChange={e => update("dateFormat", e.target.value)}
                                className={`px-3 py-2 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`}>
                                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                            </select>
                        </Row>
                    </div>
                </SectionWrap>
            );

            case "account": return (
                <SectionWrap title="Account Information" desc="Your account details — contact support to make changes.">
                    <div className={`${n.card} rounded-2xl px-5 mb-4`}>
                        <Row title="Full Name"    desc=""><span className={`text-sm ${n.secondary}`}>{userName}</span></Row>
                        <Row title="Email"        desc=""><span className={`text-sm ${n.secondary} truncate max-w-48`}>{userEmail}</span></Row>
                        <Row title="Customer ID"  desc=""><span className={`text-sm font-mono ${n.secondary}`}>{customerId || "N/A"}</span></Row>
                        <Row title="Account Type" desc="" last><span className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-semibold">Client</span></Row>
                    </div>
                    <div className={`${n.inset} p-4 rounded-2xl flex items-start gap-3`}>
                        <Info className={`w-4 h-4 ${n.label} flex-shrink-0 mt-0.5`} />
                        <p className={`text-xs ${n.secondary} leading-relaxed`}>To update your email or account type, please reach out to your consultant or contact support.</p>
                    </div>
                </SectionWrap>
            );

            case "danger": return (
                <SectionWrap title="Danger Zone" desc="These actions are permanent and cannot be undone." danger>
                    <div className={`${n.card} rounded-2xl border border-red-500/20`}>
                        <div className="px-5 py-5 flex items-center justify-between gap-6">
                            <div>
                                <p className={`text-sm font-semibold ${n.text}`}>Delete Account</p>
                                <p className={`text-xs ${n.tertiary} mt-0.5`}>Permanently removes your account and all associated data.</p>
                            </div>
                            <button className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all flex-shrink-0">
                                Delete Account
                            </button>
                        </div>
                    </div>
                </SectionWrap>
            );

            default: return null;
        }
    };

    // ── Section wrapper ───────────────────────────────────────────────────────
    const SectionWrap: React.FC<{ title: string; desc: string; danger?: boolean; children: React.ReactNode }> = ({ title, desc, danger, children }) => (
        <div>
            <h2 className={`text-base font-semibold mb-1 ${danger ? "text-red-400" : n.strong}`}>{title}</h2>
            <p className={`text-xs ${n.tertiary} mb-5 leading-relaxed`}>{desc}</p>
            {children}
        </div>
    );

    return (
        <div className="space-y-5">

            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`${n.card} pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl text-sm shadow-lg`}>
                        {t.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : t.type === "error" ? <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /> : <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                        <span className={n.text}>{t.message}</span>
                        <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}><X className={`w-3.5 h-3.5 ${n.tertiary}`} /></button>
                    </div>
                ))}
            </div>

            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={`text-xl font-semibold ${n.strong}`}>Settings</h1>
                    <p className={`text-sm ${n.secondary} mt-0.5`}>Manage your account preferences</p>
                </div>
                {hasChanges && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => { setSettings(DEFAULTS); setHasChanges(true); showToast("Reset to defaults", "info"); }}
                            className={`px-3 py-2 ${n.flat} rounded-xl text-sm ${n.secondary} flex items-center gap-1.5`}>
                            <RotateCcw className="w-3.5 h-3.5" />Reset
                        </button>
                        <button onClick={save} disabled={saving} className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-1.5 disabled:opacity-70`}>
                            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {saving ? "Saving…" : "Save Changes"}
                        </button>
                    </div>
                )}
            </div>

            {/* Two-column layout */}
            <div className="flex gap-5 items-start">

                {/* Sidebar nav */}
                <nav className={`${n.card} rounded-2xl p-2 w-48 flex-shrink-0 sticky top-20`}>
                    {NAV.map(item => (
                        <button key={item.id} onClick={() => setActiveSection(item.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all border-l-2 mb-0.5 last:mb-0 font-medium
                                ${item.danger
                                    ? `border-transparent ${activeSection === item.id ? "bg-red-500/10 text-red-400 border-red-400" : "text-red-400 hover:bg-red-500/10"} mt-1`
                                    : activeSection === item.id ? n.sidebarActive : n.sidebarIdle
                                }`}>
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Section content */}
                <div className="flex-1 min-w-0">
                    {renderSection()}
                </div>
            </div>
        </div>
    );
};

export default ClientSettings;