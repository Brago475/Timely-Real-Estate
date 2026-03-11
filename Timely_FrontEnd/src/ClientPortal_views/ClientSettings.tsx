// src/ClientPortal_views/ClientSettings.tsx
import React, { useState, useEffect } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    Sun,
    Moon,
    Bell,
    BellOff,
    Mail,
    Shield,
    Eye,
    EyeOff,
    Globe,
    Clock,
    CheckCircle,
    AlertCircle,
    Info,
    X,
    Save,
    RotateCcw,
    Settings,
    User,
    Calendar,
    Palette,
    Lock,
    FileText,
    MessageCircle,
    FolderOpen,
} from "lucide-react";

type ClientSettingsProps = {
    userName?: string;
    userEmail?: string;
    customerId?: string;
};

interface SettingsState {
    // Notifications
    emailNotifications: boolean;
    projectUpdates: boolean;
    messageAlerts: boolean;
    documentAlerts: boolean;
    weeklyDigest: boolean;

    // Privacy
    showActivityStatus: boolean;
    allowConsultantContact: boolean;

    // Preferences
    dateFormat: string;
}

interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info";
}

const STORAGE_KEY = "timely_client_settings";

const ClientSettings: React.FC<ClientSettingsProps> = ({
    userName = "Client",
    userEmail = "",
    customerId = "",
}) => {
    const { isDark, toggleTheme } = useTheme();

    const s = {
        bg: isDark ? "bg-slate-950" : "bg-gray-50",
        card: isDark ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200",
        cardHover: isDark ? "hover:bg-slate-800/80" : "hover:bg-gray-50",
        cardInner: isDark ? "bg-slate-800" : "bg-gray-100",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-600",
        textSubtle: isDark ? "text-slate-500" : "text-gray-400",
        divider: isDark ? "border-slate-800" : "border-gray-200",
        button: isDark ? "bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white" : "bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800",
        buttonPrimary: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white",
        input: isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900",
        toggle: isDark ? "bg-slate-700" : "bg-gray-300",
        toggleActive: "bg-blue-600",
    };

    // Default settings
    const defaultSettings: SettingsState = {
        emailNotifications: true,
        projectUpdates: true,
        messageAlerts: true,
        documentAlerts: true,
        weeklyDigest: false,
        showActivityStatus: true,
        allowConsultantContact: true,
        dateFormat: "MM/DD/YYYY",
    };

    const [settings, setSettings] = useState<SettingsState>(defaultSettings);
    const [hasChanges, setHasChanges] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [saving, setSaving] = useState(false);

    // Load settings from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                setSettings({ ...defaultSettings, ...parsed });
            }
        } catch (e) {
            console.error("Error loading settings:", e);
        }
    }, []);

    // Toast notification
    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        const id = `toast_${Date.now()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };

    // Update setting
    const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    // Save settings
    const saveSettings = () => {
        setSaving(true);
        setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
                setHasChanges(false);
                showToast("Settings saved successfully", "success");
            } catch (e) {
                showToast("Failed to save settings", "error");
            }
            setSaving(false);
        }, 500);
    };

    // Reset to defaults
    const resetSettings = () => {
        setSettings(defaultSettings);
        setHasChanges(true);
        showToast("Settings reset to defaults", "info");
    };

    // Toggle component with animation
    const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
        <button
            onClick={() => onChange(!enabled)}
            className={`relative w-12 h-7 rounded-full transition-all duration-300 ${enabled ? s.toggleActive + " shadow-lg shadow-blue-500/30" : s.toggle} active:scale-95`}
        >
            <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-md ${enabled ? "left-6 scale-110" : "left-1"
                    }`}
            />
        </button>
    );

    // Setting row component with hover effects
    const SettingRow = ({
        icon: Icon,
        title,
        description,
        children,
        gradient,
    }: {
        icon: React.ElementType;
        title: string;
        description: string;
        children: React.ReactNode;
        gradient?: string;
    }) => (
        <div className={`flex items-center justify-between py-4 border-b ${s.divider} last:border-0 group transition-all duration-200 hover:px-2 rounded-xl`}>
            <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl ${gradient ? `bg-gradient-to-br ${gradient}` : s.cardInner} flex items-center justify-center shadow-lg ${gradient ? "" : ""} group-hover:scale-105 transition-transform duration-200`}>
                    <Icon className={`w-5 h-5 ${gradient ? "text-white" : s.textMuted}`} />
                </div>
                <div>
                    <p className={`font-semibold ${s.text}`}>{title}</p>
                    <p className={`text-sm ${s.textMuted}`}>{description}</p>
                </div>
            </div>
            {children}
        </div>
    );

    // Section header component
    const SectionHeader = ({ icon: Icon, title, gradient }: { icon: React.ElementType; title: string; gradient: string }) => (
        <div className="flex items-center gap-3 mb-5">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <h2 className={`text-lg font-bold ${s.text}`}>{title}</h2>
        </div>
    );

    return (
        <div className={`${s.bg} min-h-full`}>
            {/* Toast Notifications */}
            <div className="fixed top-20 right-4 z-[10000] space-y-2">
                {toasts.map((toast, index) => (
                    <div
                        key={toast.id}
                        style={{ animationDelay: `${index * 50}ms` }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border ${s.card} animate-in slide-in-from-right duration-300`}
                    >
                        {toast.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                        {toast.type === "error" && <AlertCircle className="w-5 h-5 text-red-500" />}
                        {toast.type === "info" && <Info className="w-5 h-5 text-blue-500" />}
                        <span className={s.text}>{toast.message}</span>
                        <button
                            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                            className={`ml-2 ${s.textMuted} hover:${s.text} transition-colors`}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className={`text-2xl font-bold ${s.text}`}>Settings</h1>
                        <p className={`text-sm ${s.textMuted} mt-1`}>Manage your preferences and account settings</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {hasChanges && (
                            <>
                                <button
                                    onClick={resetSettings}
                                    className={`px-4 py-2.5 rounded-xl flex items-center gap-2 ${s.button} transition-all duration-200 hover:shadow-md active:scale-95`}
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Reset
                                </button>
                                <button
                                    onClick={saveSettings}
                                    disabled={saving}
                                    className={`px-5 py-2.5 rounded-xl flex items-center gap-2 ${s.buttonPrimary} shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70`}
                                >
                                    {saving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Appearance */}
                <section className={`${s.card} border rounded-2xl p-6 transition-all duration-300 hover:shadow-lg`}>
                    <SectionHeader icon={Palette} title="Appearance" gradient="from-purple-500 to-purple-600" />
                    <SettingRow
                        icon={isDark ? Moon : Sun}
                        title="Dark Mode"
                        description="Toggle between light and dark theme"
                        gradient={isDark ? "from-indigo-500 to-indigo-600" : "from-amber-400 to-amber-500"}
                    >
                        <Toggle enabled={isDark} onChange={toggleTheme} />
                    </SettingRow>
                </section>

                {/* Notifications */}
                <section className={`${s.card} border rounded-2xl p-6 transition-all duration-300 hover:shadow-lg`}>
                    <SectionHeader icon={Bell} title="Notifications" gradient="from-blue-500 to-blue-600" />

                    <SettingRow
                        icon={Mail}
                        title="Email Notifications"
                        description="Receive notifications via email"
                        gradient="from-rose-500 to-rose-600"
                    >
                        <Toggle
                            enabled={settings.emailNotifications}
                            onChange={(v) => updateSetting("emailNotifications", v)}
                        />
                    </SettingRow>

                    <SettingRow
                        icon={FolderOpen}
                        title="Project Updates"
                        description="Get notified when your projects are updated"
                        gradient="from-emerald-500 to-emerald-600"
                    >
                        <Toggle
                            enabled={settings.projectUpdates}
                            onChange={(v) => updateSetting("projectUpdates", v)}
                        />
                    </SettingRow>

                    <SettingRow
                        icon={MessageCircle}
                        title="Message Alerts"
                        description="Get notified when you receive new messages"
                        gradient="from-pink-500 to-pink-600"
                    >
                        <Toggle
                            enabled={settings.messageAlerts}
                            onChange={(v) => updateSetting("messageAlerts", v)}
                        />
                    </SettingRow>

                    <SettingRow
                        icon={FileText}
                        title="Document Alerts"
                        description="Get notified when documents are uploaded"
                        gradient="from-cyan-500 to-cyan-600"
                    >
                        <Toggle
                            enabled={settings.documentAlerts}
                            onChange={(v) => updateSetting("documentAlerts", v)}
                        />
                    </SettingRow>

                    <SettingRow
                        icon={Mail}
                        title="Weekly Digest"
                        description="Receive a weekly summary of activity"
                        gradient="from-violet-500 to-violet-600"
                    >
                        <Toggle
                            enabled={settings.weeklyDigest}
                            onChange={(v) => updateSetting("weeklyDigest", v)}
                        />
                    </SettingRow>
                </section>

                {/* Privacy */}
                <section className={`${s.card} border rounded-2xl p-6 transition-all duration-300 hover:shadow-lg`}>
                    <SectionHeader icon={Shield} title="Privacy" gradient="from-emerald-500 to-emerald-600" />

                    <SettingRow
                        icon={Eye}
                        title="Show Activity Status"
                        description="Let consultants see when you're online"
                        gradient="from-blue-500 to-blue-600"
                    >
                        <Toggle
                            enabled={settings.showActivityStatus}
                            onChange={(v) => updateSetting("showActivityStatus", v)}
                        />
                    </SettingRow>

                    <SettingRow
                        icon={Lock}
                        title="Allow Consultant Contact"
                        description="Allow assigned consultants to contact you directly"
                        gradient="from-amber-500 to-amber-600"
                    >
                        <Toggle
                            enabled={settings.allowConsultantContact}
                            onChange={(v) => updateSetting("allowConsultantContact", v)}
                        />
                    </SettingRow>
                </section>

                {/* Preferences */}
                <section className={`${s.card} border rounded-2xl p-6 transition-all duration-300 hover:shadow-lg`}>
                    <SectionHeader icon={Settings} title="Preferences" gradient="from-amber-500 to-amber-600" />

                    <div className="space-y-4">
                        {/* Date Format */}
                        <div className="flex items-center justify-between group transition-all duration-200 hover:px-2 rounded-xl">
                            <div className="flex items-start gap-3">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200">
                                    <Calendar className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className={`font-semibold ${s.text}`}>Date Format</p>
                                    <p className={`text-sm ${s.textMuted}`}>Choose how dates are displayed</p>
                                </div>
                            </div>
                            <select
                                value={settings.dateFormat}
                                onChange={(e) => updateSetting("dateFormat", e.target.value)}
                                className={`px-4 py-2.5 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 cursor-pointer`}
                            >
                                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Account Info (Read-only) */}
                <section className={`${s.card} border rounded-2xl p-6 transition-all duration-300 hover:shadow-lg`}>
                    <SectionHeader icon={User} title="Account Information" gradient="from-slate-500 to-slate-600" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`p-4 ${s.cardInner} rounded-xl transition-all duration-200 hover:shadow-md group`}>
                            <p className={`text-xs font-medium ${s.textSubtle} mb-1 uppercase tracking-wider`}>Name</p>
                            <p className={`font-semibold ${s.text} group-hover:text-blue-500 transition-colors`}>{userName}</p>
                        </div>
                        <div className={`p-4 ${s.cardInner} rounded-xl transition-all duration-200 hover:shadow-md group`}>
                            <p className={`text-xs font-medium ${s.textSubtle} mb-1 uppercase tracking-wider`}>Email</p>
                            <p className={`font-semibold ${s.text} group-hover:text-blue-500 transition-colors truncate`}>{userEmail}</p>
                        </div>
                        <div className={`p-4 ${s.cardInner} rounded-xl transition-all duration-200 hover:shadow-md group`}>
                            <p className={`text-xs font-medium ${s.textSubtle} mb-1 uppercase tracking-wider`}>Customer ID</p>
                            <p className={`font-mono ${s.text} group-hover:text-blue-500 transition-colors`}>{customerId || "N/A"}</p>
                        </div>
                        <div className={`p-4 ${s.cardInner} rounded-xl transition-all duration-200 hover:shadow-md`}>
                            <p className={`text-xs font-medium ${s.textSubtle} mb-1 uppercase tracking-wider`}>Account Type</p>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-purple-500/20 to-purple-600/20 text-purple-400 text-sm font-semibold">
                                <User className="w-3.5 h-3.5" />
                                Client
                            </span>
                        </div>
                    </div>

                    <p className={`text-xs ${s.textMuted} mt-5 p-3 ${s.cardInner} rounded-xl flex items-center gap-2`}>
                        <Info className="w-4 h-4 text-blue-500 shrink-0" />
                        To update your account information, please contact your consultant or support.
                    </p>
                </section>

                {/* Danger Zone */}
                <section className={`${s.card} border border-red-500/30 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/5`}>
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                            <AlertCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className={`text-lg font-bold text-red-500`}>Danger Zone</h2>
                            <p className={`text-sm ${s.textMuted}`}>Irreversible actions</p>
                        </div>
                    </div>

                    <div className={`p-4 rounded-xl border border-red-500/20 ${isDark ? "bg-red-500/5" : "bg-red-50"}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={`font-semibold ${s.text}`}>Delete Account</p>
                                <p className={`text-sm ${s.textMuted}`}>Permanently delete your account and all data</p>
                            </div>
                            <button className="px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-red-500/20 active:scale-95">
                                Delete Account
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ClientSettings;