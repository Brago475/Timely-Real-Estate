// src/ClientPortal_views/ClientSettings.tsx
import React, { useState, useEffect } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    Sun, Moon, Bell, Mail, Shield, Eye, Lock, Globe,
    Calendar, Palette, Settings, User, FileText, MessageCircle,
    FolderOpen, CheckCircle, AlertCircle, Info, X, Save, RotateCcw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientSettingsProps = { userName?: string; userEmail?: string; customerId?: string; };

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
    emailNotifications: true,
    projectUpdates: true,
    messageAlerts: true,
    documentAlerts: true,
    weeklyDigest: false,
    showActivityStatus: true,
    allowConsultantContact: true,
    dateFormat: "MM/DD/YYYY",
};

// ─── Component ────────────────────────────────────────────────────────────────

const ClientSettings: React.FC<ClientSettingsProps> = ({
    userName = "Client", userEmail = "", customerId = "",
}) => {
    const { isDark, toggleTheme } = useTheme();

    const n = {
        bg:           isDark ? "neu-bg-dark"       : "neu-bg-light",
        card:         isDark ? "neu-dark"           : "neu-light",
        flat:         isDark ? "neu-dark-flat"      : "neu-light-flat",
        inset:        isDark ? "neu-dark-inset"     : "neu-light-inset",
        text:         isDark ? "text-white"         : "text-gray-900",
        secondary:    isDark ? "text-gray-300"      : "text-gray-600",
        tertiary:     isDark ? "text-gray-500"      : "text-gray-400",
        strong:       isDark ? "text-white"         : "text-black",
        label:        isDark ? "text-blue-400"      : "text-blue-600",
        divider:      isDark ? "border-gray-800"    : "border-gray-200",
        input:        isDark ? "bg-transparent border-gray-700 text-white" : "bg-transparent border-gray-300 text-gray-900",
        btnPrimary:   "bg-blue-600 hover:bg-blue-500 text-white",
        btnSecondary: isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        btnDanger:    "bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white",
    };

    const [settings, setSettings]   = useState<SettingsState>(DEFAULTS);
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving]       = useState(false);
    const [toasts, setToasts]       = useState<Toast[]>([]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setSettings({ ...DEFAULTS, ...JSON.parse(saved) });
        } catch {}
    }, []);

    const showToast = (message: string, type: Toast["type"] = "success") => {
        const id = `t_${Date.now()}`;
        setToasts(p => [...p, { id, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
        setSettings(p => ({ ...p, [key]: value }));
        setHasChanges(true);
    };

    const save = () => {
        setSaving(true);
        setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
                setHasChanges(false);
                showToast("Settings saved", "success");
            } catch { showToast("Failed to save", "error"); }
            setSaving(false);
        }, 400);
    };

    const reset = () => { setSettings(DEFAULTS); setHasChanges(true); showToast("Reset to defaults", "info"); };

    // ── Shared sub-components ────────────────────────────────────────────────

    const Toggle: React.FC<{ enabled: boolean; onChange: (v: boolean) => void }> = ({ enabled, onChange }) => (
        <button onClick={() => onChange(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-emerald-500" : (isDark ? "bg-gray-700" : "bg-gray-300")}`}>
            <div className={`absolute w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-0.5"}`} />
        </button>
    );

    const SettingRow: React.FC<{
        icon: React.ComponentType<{ className?: string }>;
        title: string;
        description: string;
        children: React.ReactNode;
        color?: string;
    }> = ({ icon: Icon, title, description, children, color = "bg-blue-600" }) => (
        <div className={`flex items-center justify-between py-4 border-b ${n.divider} last:border-0`}>
            <div className="flex items-center gap-3">
                <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                    <p className={`text-sm font-medium ${n.text}`}>{title}</p>
                    <p className={`text-xs ${n.tertiary} mt-0.5`}>{description}</p>
                </div>
            </div>
            {children}
        </div>
    );

    const Section: React.FC<{
        icon: React.ComponentType<{ className?: string }>;
        title: string;
        color: string;
        children: React.ReactNode;
    }> = ({ icon: Icon, title, color, children }) => (
        <section className={`${n.card} rounded-2xl p-5`}>
            <div className="flex items-center gap-3 mb-4">
                <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                </div>
                <h2 className={`font-semibold ${n.strong}`}>{title}</h2>
            </div>
            {children}
        </section>
    );

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">
                {toasts.map(t => (
                    <div key={t.id} className={`${n.card} flex items-center gap-3 px-4 py-3 rounded-xl text-sm`}>
                        {t.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === "error" ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}
                        <span className={n.text}>{t.message}</span>
                        <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}><X className="w-3.5 h-3.5" /></button>
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className={`text-xl font-semibold ${n.strong}`}>Settings</h1>
                    <p className={`text-sm ${n.secondary} mt-0.5`}>Manage your preferences</p>
                </div>
                {hasChanges && (
                    <div className="flex items-center gap-2">
                        <button onClick={reset} className={`px-3 py-2 ${n.flat} rounded-xl text-sm ${n.secondary} flex items-center gap-1.5`}>
                            <RotateCcw className="w-3.5 h-3.5" />Reset
                        </button>
                        <button onClick={save} disabled={saving} className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-1.5 disabled:opacity-70`}>
                            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {saving ? "Saving…" : "Save Changes"}
                        </button>
                    </div>
                )}
            </div>

            {/* Appearance */}
            <Section icon={Palette} title="Appearance" color="bg-blue-600">
                <SettingRow icon={isDark ? Moon : Sun} title="Dark Mode" description="Toggle between light and dark theme" color={isDark ? "bg-indigo-600" : "bg-amber-500"}>
                    <Toggle enabled={isDark} onChange={toggleTheme} />
                </SettingRow>
            </Section>

            {/* Notifications */}
            <Section icon={Bell} title="Notifications" color="bg-blue-600">
                <SettingRow icon={Mail}          title="Email Notifications" description="Receive notifications via email"               color="bg-rose-600">
                    <Toggle enabled={settings.emailNotifications} onChange={v => update("emailNotifications", v)} />
                </SettingRow>
                <SettingRow icon={FolderOpen}    title="Project Updates"    description="Get notified when your projects are updated"   color="bg-emerald-600">
                    <Toggle enabled={settings.projectUpdates}    onChange={v => update("projectUpdates", v)} />
                </SettingRow>
                <SettingRow icon={MessageCircle} title="Message Alerts"     description="Get notified when you receive new messages"    color="bg-pink-600">
                    <Toggle enabled={settings.messageAlerts}     onChange={v => update("messageAlerts", v)} />
                </SettingRow>
                <SettingRow icon={FileText}      title="Document Alerts"    description="Get notified when documents are uploaded"      color="bg-cyan-600">
                    <Toggle enabled={settings.documentAlerts}    onChange={v => update("documentAlerts", v)} />
                </SettingRow>
                <SettingRow icon={Mail}          title="Weekly Digest"      description="Receive a weekly summary of activity"          color="bg-violet-600">
                    <Toggle enabled={settings.weeklyDigest}      onChange={v => update("weeklyDigest", v)} />
                </SettingRow>
            </Section>

            {/* Privacy */}
            <Section icon={Shield} title="Privacy" color="bg-emerald-600">
                <SettingRow icon={Eye}  title="Show Activity Status"     description="Let consultants see when you're online"                color="bg-blue-600">
                    <Toggle enabled={settings.showActivityStatus}     onChange={v => update("showActivityStatus", v)} />
                </SettingRow>
                <SettingRow icon={Lock} title="Allow Consultant Contact" description="Allow assigned consultants to contact you directly"   color="bg-amber-600">
                    <Toggle enabled={settings.allowConsultantContact} onChange={v => update("allowConsultantContact", v)} />
                </SettingRow>
            </Section>

            {/* Preferences */}
            <Section icon={Settings} title="Preferences" color="bg-amber-600">
                <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className={`text-sm font-medium ${n.text}`}>Date Format</p>
                            <p className={`text-xs ${n.tertiary} mt-0.5`}>Choose how dates are displayed</p>
                        </div>
                    </div>
                    <select value={settings.dateFormat} onChange={e => update("dateFormat", e.target.value)}
                        className={`px-3 py-2 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500`}>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                </div>
            </Section>

            {/* Account Info */}
            <Section icon={User} title="Account Information" color="bg-gray-600">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {[
                        { label: "Name",        value: userName,   mono: false },
                        { label: "Email",       value: userEmail,  mono: false },
                        { label: "Customer ID", value: customerId || "N/A", mono: true },
                    ].map(item => (
                        <div key={item.label} className={`${n.flat} p-4 rounded-xl`}>
                            <p className={`text-[10px] uppercase tracking-wider ${n.tertiary} mb-1`}>{item.label}</p>
                            <p className={`text-sm font-medium ${n.text} ${item.mono ? "font-mono" : ""} truncate`}>{item.value}</p>
                        </div>
                    ))}
                    <div className={`${n.flat} p-4 rounded-xl`}>
                        <p className={`text-[10px] uppercase tracking-wider ${n.tertiary} mb-1`}>Account Type</p>
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-semibold">Client</span>
                    </div>
                </div>
                <div className={`${n.inset} p-3 rounded-xl flex items-start gap-2`}>
                    <Info className={`w-4 h-4 ${n.label} flex-shrink-0 mt-0.5`} />
                    <p className={`text-xs ${n.secondary}`}>To update your account information, please contact your consultant or support.</p>
                </div>
            </Section>

            {/* Danger Zone */}
            <section className={`${n.card} rounded-2xl p-5 border border-red-500/20`}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-red-400">Danger Zone</h2>
                        <p className={`text-xs ${n.tertiary}`}>Irreversible actions</p>
                    </div>
                </div>
                <div className={`${n.inset} p-4 rounded-xl flex items-center justify-between`}>
                    <div>
                        <p className={`text-sm font-medium ${n.text}`}>Delete Account</p>
                        <p className={`text-xs ${n.tertiary} mt-0.5`}>Permanently delete your account and all data</p>
                    </div>
                    <button className={`px-4 py-2 ${n.btnDanger} rounded-xl text-sm font-medium transition-all`}>
                        Delete Account
                    </button>
                </div>
            </section>
        </div>
    );
};

export default ClientSettings;