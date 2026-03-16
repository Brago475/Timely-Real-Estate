// src/ClientPortal_views/ClientSettings.tsx
import React, { useState, useEffect } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    Bell, Shield, Eye, Lock, Calendar, Palette, Settings, User,
    FileText, MessageCircle, FolderOpen, Mail, CheckCircle, AlertCircle,
    Info, X, Save, RotateCcw, Moon, Sun, Trash2, Key, Smartphone,
    Monitor, LogOut, Download, ExternalLink, HelpCircle, AlertTriangle,
    Video, Image, Globe, Phone, LayoutGrid, List, SortAsc, EyeOff,
    Zap, Flag, RefreshCw, ChevronRight, Clock,
} from "lucide-react";

type ClientSettingsProps = { userName?: string; userEmail?: string; customerId?: string; };

type SectionId =
    | "appearance" | "security" | "notifications"
    | "projects" | "documents" | "communication"
    | "privacy" | "support";

// ─── Settings State ───────────────────────────────────────────────────────────

interface SettingsState {
    // Appearance
    darkMode: boolean;
    // Notifications — Project
    notif_statusChanges: boolean;
    notif_filesUploaded: boolean;
    notif_comments: boolean;
    notif_milestones: boolean;
    // Notifications — Communication
    notif_consultantMessages: boolean;
    notif_documentRequests: boolean;
    notif_appointmentReminders: boolean;
    // Notifications — Delivery
    notif_email: boolean;
    notif_inApp: boolean;
    // Project Preferences
    proj_defaultView: "cards" | "list";
    proj_sortOrder: "date" | "name" | "status";
    proj_hideCompleted: boolean;
    proj_autoPlayVideos: boolean;
    // Documents & Media
    doc_allowImageUploads: boolean;
    doc_allowVideoUploads: boolean;
    doc_fileVisibility: "consultants" | "all";
    doc_allowDownloads: boolean;
    // Communication
    comm_allowMessaging: boolean;
    comm_emailForMessages: boolean;
    comm_allowMeetingScheduling: boolean;
    comm_meetingPlatform: "zoom" | "google_meet" | "phone";
    // Date format
    dateFormat: string;
}

interface Toast { id: string; message: string; type: "success" | "error" | "info"; }

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "timely_client_settings_v2";

const DEFAULTS: SettingsState = {
    darkMode: false,
    notif_statusChanges: true, notif_filesUploaded: true,
    notif_comments: true, notif_milestones: true,
    notif_consultantMessages: true, notif_documentRequests: true,
    notif_appointmentReminders: false,
    notif_email: true, notif_inApp: true,
    proj_defaultView: "cards", proj_sortOrder: "date",
    proj_hideCompleted: false, proj_autoPlayVideos: false,
    doc_allowImageUploads: true, doc_allowVideoUploads: false,
    doc_fileVisibility: "consultants", doc_allowDownloads: true,
    comm_allowMessaging: true, comm_emailForMessages: true,
    comm_allowMeetingScheduling: true, comm_meetingPlatform: "zoom",
    dateFormat: "MM/DD/YYYY",
};

// ─── Sidebar nav config ───────────────────────────────────────────────────────

const NAV: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }>; danger?: boolean }[] = [
    { id: "appearance",    label: "Appearance",     icon: Palette },
    { id: "security",      label: "Security",        icon: Shield },
    { id: "notifications", label: "Notifications",   icon: Bell },
    { id: "projects",      label: "My Projects",     icon: FolderOpen },
    { id: "documents",     label: "Documents",       icon: FileText },
    { id: "communication", label: "Communication",   icon: MessageCircle },
    { id: "privacy",       label: "Privacy & Data",  icon: Eye, danger: true },
    { id: "support",       label: "Support",         icon: HelpCircle },
];

// ─── Component ────────────────────────────────────────────────────────────────

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
        rowHover:      isDark ? "hover:bg-gray-800/40" : "hover:bg-gray-50",
        sidebarActive: isDark ? "bg-blue-600/10 text-blue-400 border-blue-500" : "bg-blue-50 text-blue-600 border-blue-500",
        sidebarIdle:   isDark ? "text-gray-400 hover:bg-gray-800/50 border-transparent" : "text-gray-500 hover:bg-gray-50 border-transparent",
        tag:           isDark ? "bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-md font-medium" : "bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-md font-medium",
    };

    const [settings,      setSettings]      = useState<SettingsState>(DEFAULTS);
    const [hasChanges,    setHasChanges]    = useState(false);
    const [saving,        setSaving]        = useState(false);
    const [toasts,        setToasts]        = useState<Toast[]>([]);
    const [activeSection, setActiveSection] = useState<SectionId>("appearance");
    // Security state
    const [showChangePw,  setShowChangePw]  = useState(false);
    const [currentPw,     setCurrentPw]     = useState("");
    const [newPw,         setNewPw]         = useState("");
    const [confirmPw,     setConfirmPw]     = useState("");
    const [pwSaving,      setPwSaving]      = useState(false);

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

    const handleChangePassword = () => {
        if (!currentPw || !newPw || !confirmPw) { showToast("Fill all fields", "error"); return; }
        if (newPw !== confirmPw) { showToast("Passwords don't match", "error"); return; }
        if (newPw.length < 8) { showToast("Password must be at least 8 characters", "error"); return; }
        setPwSaving(true);
        setTimeout(() => {
            showToast("Password updated successfully");
            setCurrentPw(""); setNewPw(""); setConfirmPw("");
            setShowChangePw(false); setPwSaving(false);
        }, 600);
    };

    // ── Reusable sub-components ───────────────────────────────────────────────

    const Toggle: React.FC<{ enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ enabled, onChange, disabled }) => (
        <button type="button" onClick={() => !disabled && onChange(!enabled)} disabled={disabled}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 flex-shrink-0 focus:outline-none disabled:opacity-40
                ${enabled ? "bg-blue-600" : isDark ? "bg-gray-700" : "bg-gray-200"}`}>
            <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 ${enabled ? "left-7" : "left-0.5"}`} />
        </button>
    );

    const Row: React.FC<{ title: string; desc?: string; last?: boolean; tag?: string; children: React.ReactNode }> = ({ title, desc, last, tag, children }) => (
        <div className={`flex items-center justify-between py-4 ${!last ? `border-b ${n.divider}` : ""}`}>
            <div className="min-w-0 flex-1 pr-8">
                <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${n.text}`}>{title}</p>
                    {tag && <span className={n.tag}>{tag}</span>}
                </div>
                {desc && <p className={`text-xs ${n.tertiary} mt-0.5 leading-relaxed`}>{desc}</p>}
            </div>
            <div className="flex-shrink-0">{children}</div>
        </div>
    );

    const SectionWrap: React.FC<{ title: string; desc: string; danger?: boolean; children: React.ReactNode }> = ({ title, desc, danger, children }) => (
        <div>
            <h2 className={`text-base font-semibold mb-1 ${danger ? "text-red-400" : n.strong}`}>{title}</h2>
            <p className={`text-xs ${n.tertiary} mb-5 leading-relaxed`}>{desc}</p>
            {children}
        </div>
    );

    const GroupLabel: React.FC<{ label: string }> = ({ label }) => (
        <p className={`text-[10px] uppercase tracking-widest ${n.label} mb-0 mt-1 px-5 pt-4 pb-2`}>{label}</p>
    );

    const Input: React.FC<{ label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ label, type = "text", value, onChange, placeholder }) => (
        <div>
            <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors`} />
        </div>
    );

    const RadioGroup: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({ value, onChange, options }) => (
        <div className="flex gap-2 flex-wrap">
            {options.map(o => (
                <button key={o.value} type="button" onClick={() => onChange(o.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${value === o.value ? "bg-blue-600 text-white" : `${n.flat} ${n.secondary}`}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );

    // ── Mock session data ─────────────────────────────────────────────────────
    const sessions = [
        { device: "MacBook Pro", location: "Newark, NJ", time: "Active now", current: true, icon: Monitor },
        { device: "iPhone 15",   location: "Newark, NJ", time: "2 hours ago", current: false, icon: Smartphone },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    const renderSection = () => {
        switch (activeSection) {

            // ── Appearance ────────────────────────────────────────────────────
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

            // ── Security ──────────────────────────────────────────────────────
            case "security": return (
                <SectionWrap title="Account Security" desc="Manage your password, active sessions, and login activity.">
                    <div className="space-y-4">

                        {/* Change password */}
                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <button type="button" onClick={() => setShowChangePw(!showChangePw)}
                                className={`w-full px-5 py-4 flex items-center justify-between ${n.rowHover} transition-colors`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <Key className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="text-left">
                                        <p className={`text-sm font-medium ${n.text}`}>Change Password</p>
                                        <p className={`text-xs ${n.tertiary}`}>Update your account password</p>
                                    </div>
                                </div>
                                <ChevronRight className={`w-4 h-4 ${n.tertiary} transition-transform ${showChangePw ? "rotate-90" : ""}`} />
                            </button>

                            {showChangePw && (
                                <div className={`px-5 pb-5 border-t ${n.divider} pt-5 space-y-3`}>
                                    <Input label="Current Password" type="password" value={currentPw} onChange={setCurrentPw} placeholder="Enter current password" />
                                    <Input label="New Password"     type="password" value={newPw}     onChange={setNewPw}     placeholder="Min. 8 characters" />
                                    <Input label="Confirm Password" type="password" value={confirmPw} onChange={setConfirmPw} placeholder="Repeat new password" />
                                    <div className="flex gap-2 pt-1">
                                        <button onClick={() => { setShowChangePw(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}
                                            className={`px-4 py-2 ${n.flat} rounded-xl text-sm ${n.secondary}`}>Cancel</button>
                                        <button onClick={handleChangePassword} disabled={pwSaving}
                                            className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-1.5 disabled:opacity-70`}>
                                            {pwSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            {pwSaving ? "Saving…" : "Update Password"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2FA */}
                        <div className={`${n.card} rounded-2xl px-5`}>
                            <Row title="Two-Factor Authentication" desc="Add an extra layer of security to your account." tag="Coming Soon" last>
                                <Toggle enabled={false} onChange={() => {}} disabled />
                            </Row>
                        </div>

                        {/* Active sessions */}
                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <div className={`px-5 py-4 border-b ${n.divider} flex items-center gap-3`}>
                                <Monitor className={`w-4 h-4 ${n.label}`} />
                                <p className={`font-semibold ${n.text} text-sm`}>Active Sessions</p>
                            </div>
                            {sessions.map((s, i) => (
                                <div key={i} className={`px-5 py-4 flex items-center justify-between ${i < sessions.length - 1 ? `border-b ${n.divider}` : ""}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 ${n.flat} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                            <s.icon className={`w-4 h-4 ${n.secondary}`} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className={`text-sm font-medium ${n.text}`}>{s.device}</p>
                                                {s.current && <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-semibold">This device</span>}
                                            </div>
                                            <p className={`text-xs ${n.tertiary} flex items-center gap-1.5 mt-0.5`}>
                                                <Globe className="w-3 h-3" />{s.location} · <Clock className="w-3 h-3" />{s.time}
                                            </p>
                                        </div>
                                    </div>
                                    {!s.current && (
                                        <button className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                                            <LogOut className="w-3.5 h-3.5" />Sign out
                                        </button>
                                    )}
                                </div>
                            ))}
                            <div className={`px-5 py-3 border-t ${n.divider}`}>
                                <button className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors">
                                    <LogOut className="w-3.5 h-3.5" />Sign out all other sessions
                                </button>
                            </div>
                        </div>

                        {/* Email verification */}
                        <div className={`${n.card} rounded-2xl px-5`}>
                            <Row title="Email Verification" desc={`Verified as ${userEmail || "unknown"}`} last>
                                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-semibold flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />Verified
                                </span>
                            </Row>
                        </div>
                    </div>
                </SectionWrap>
            );

            // ── Notifications ─────────────────────────────────────────────────
            case "notifications": return (
                <SectionWrap title="Notification Preferences" desc="Control what you get notified about and how you receive it.">
                    <div className="space-y-4">

                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <GroupLabel label="Project Updates" />
                            <div className="px-5">
                                <Row title="Status Changes"    desc="When a project status is updated."><Toggle enabled={settings.notif_statusChanges} onChange={v => update("notif_statusChanges", v)} /></Row>
                                <Row title="Files Uploaded"    desc="When new files are added to your projects."><Toggle enabled={settings.notif_filesUploaded} onChange={v => update("notif_filesUploaded", v)} /></Row>
                                <Row title="New Comments"      desc="When someone comments on a project."><Toggle enabled={settings.notif_comments} onChange={v => update("notif_comments", v)} /></Row>
                                <Row title="Milestone Reached" desc="When a project milestone is completed." last><Toggle enabled={settings.notif_milestones} onChange={v => update("notif_milestones", v)} /></Row>
                            </div>
                        </div>

                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <GroupLabel label="Communication" />
                            <div className="px-5">
                                <Row title="Consultant Messages"  desc="When your consultant sends you a message."><Toggle enabled={settings.notif_consultantMessages} onChange={v => update("notif_consultantMessages", v)} /></Row>
                                <Row title="Document Requests"    desc="When documents are requested from you."><Toggle enabled={settings.notif_documentRequests} onChange={v => update("notif_documentRequests", v)} /></Row>
                                <Row title="Appointment Reminders" desc="Reminders for scheduled meetings." last><Toggle enabled={settings.notif_appointmentReminders} onChange={v => update("notif_appointmentReminders", v)} /></Row>
                            </div>
                        </div>

                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <GroupLabel label="Delivery Method" />
                            <div className="px-5">
                                <Row title="Email Notifications" desc="Receive notifications to your inbox."><Toggle enabled={settings.notif_email} onChange={v => update("notif_email", v)} /></Row>
                                <Row title="In-App Notifications" desc="Show notifications inside the portal." last><Toggle enabled={settings.notif_inApp} onChange={v => update("notif_inApp", v)} /></Row>
                            </div>
                        </div>
                    </div>
                </SectionWrap>
            );

            // ── Project Preferences ───────────────────────────────────────────
            case "projects": return (
                <SectionWrap title="My Projects Preferences" desc="Control how your projects are displayed and organized.">
                    <div className="space-y-4">
                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <GroupLabel label="Display" />
                            <div className="px-5">
                                <Row title="Default View" desc="How projects are shown by default.">
                                    <RadioGroup value={settings.proj_defaultView} onChange={v => update("proj_defaultView", v as any)}
                                        options={[{ value: "cards", label: "Cards" }, { value: "list", label: "List" }]} />
                                </Row>
                                <Row title="Sort Order" desc="Default order for your project list.">
                                    <RadioGroup value={settings.proj_sortOrder} onChange={v => update("proj_sortOrder", v as any)}
                                        options={[{ value: "date", label: "Date" }, { value: "name", label: "Name" }, { value: "status", label: "Status" }]} />
                                </Row>
                                <Row title="Hide Completed" desc="Don't show completed projects by default." last>
                                    <Toggle enabled={settings.proj_hideCompleted} onChange={v => update("proj_hideCompleted", v)} />
                                </Row>
                            </div>
                        </div>

                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <GroupLabel label="Media" />
                            <div className="px-5">
                                <Row title="Auto-Play Videos" desc="Automatically play videos in project details." last>
                                    <Toggle enabled={settings.proj_autoPlayVideos} onChange={v => update("proj_autoPlayVideos", v)} />
                                </Row>
                            </div>
                        </div>
                    </div>
                </SectionWrap>
            );

            // ── Documents & Media ─────────────────────────────────────────────
            case "documents": return (
                <SectionWrap title="Documents & Media" desc="Control uploads, visibility, and download permissions.">
                    <div className="space-y-4">
                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <GroupLabel label="Uploads" />
                            <div className="px-5">
                                <Row title="Allow Image Uploads" desc="Upload images to your projects and requests.">
                                    <Toggle enabled={settings.doc_allowImageUploads} onChange={v => update("doc_allowImageUploads", v)} />
                                </Row>
                                <Row title="Allow Video Uploads" desc="Upload video files (may affect storage)." last>
                                    <Toggle enabled={settings.doc_allowVideoUploads} onChange={v => update("doc_allowVideoUploads", v)} />
                                </Row>
                            </div>
                        </div>

                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <GroupLabel label="Privacy" />
                            <div className="px-5">
                                <Row title="File Visibility" desc="Who can view your uploaded files." last>
                                    <RadioGroup value={settings.doc_fileVisibility} onChange={v => update("doc_fileVisibility", v as any)}
                                        options={[{ value: "consultants", label: "Consultants only" }, { value: "all", label: "All members" }]} />
                                </Row>
                            </div>
                        </div>

                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <GroupLabel label="Download Settings" />
                            <div className="px-5">
                                <Row title="Allow Downloads" desc="Let files be downloaded from the portal." last>
                                    <Toggle enabled={settings.doc_allowDownloads} onChange={v => update("doc_allowDownloads", v)} />
                                </Row>
                            </div>
                        </div>
                    </div>
                </SectionWrap>
            );

            // ── Communication ─────────────────────────────────────────────────
            case "communication": return (
                <SectionWrap title="Communication Settings" desc="Control messaging and meeting preferences with your consultant.">
                    <div className="space-y-4">
                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <GroupLabel label="Messaging" />
                            <div className="px-5">
                                <Row title="Allow Consultant Messaging" desc="Let your consultant initiate conversations.">
                                    <Toggle enabled={settings.comm_allowMessaging} onChange={v => update("comm_allowMessaging", v)} />
                                </Row>
                                <Row title="Email for New Messages" desc="Get an email when you receive a new message." last>
                                    <Toggle enabled={settings.comm_emailForMessages} onChange={v => update("comm_emailForMessages", v)} />
                                </Row>
                            </div>
                        </div>

                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <GroupLabel label="Meetings" />
                            <div className="px-5">
                                <Row title="Allow Meeting Scheduling" desc="Let consultants schedule meetings with you.">
                                    <Toggle enabled={settings.comm_allowMeetingScheduling} onChange={v => update("comm_allowMeetingScheduling", v)} />
                                </Row>
                                <Row title="Preferred Platform" desc="Your preferred meeting platform." last>
                                    <RadioGroup value={settings.comm_meetingPlatform} onChange={v => update("comm_meetingPlatform", v as any)}
                                        options={[
                                            { value: "zoom",        label: "Zoom" },
                                            { value: "google_meet", label: "Google Meet" },
                                            { value: "phone",       label: "Phone" },
                                        ]} />
                                </Row>
                            </div>
                        </div>
                    </div>
                </SectionWrap>
            );

            // ── Privacy & Data ────────────────────────────────────────────────
            case "privacy": return (
                <SectionWrap title="Privacy & Data" desc="Control your data and understand how it's used." danger>
                    <div className="space-y-4">

                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <GroupLabel label="Your Data" />
                            <div className="px-5">
                                <Row title="Download My Data" desc="Export a copy of all your account data." last>
                                    <button className={`px-3 py-1.5 ${n.flat} rounded-xl text-xs ${n.secondary} flex items-center gap-1.5`}>
                                        <Download className="w-3.5 h-3.5" />Export
                                    </button>
                                </Row>
                            </div>
                        </div>

                        <div className={`${n.card} rounded-2xl overflow-hidden`}>
                            <GroupLabel label="Legal" />
                            <div className="px-5">
                                {[
                                    { label: "Privacy Policy",    href: "#" },
                                    { label: "Terms of Service",  href: "#" },
                                    { label: "Data Usage Policy", href: "#", last: true },
                                ].map((link, i, arr) => (
                                    <Row key={link.label} title={link.label} desc="" last={i === arr.length - 1}>
                                        <a href={link.href} className={`text-xs ${n.label} flex items-center gap-1`}>
                                            View <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </Row>
                                ))}
                            </div>
                        </div>

                        <div className={`${n.card} rounded-2xl border border-red-500/20`}>
                            <div className="px-5 py-5 flex items-center justify-between gap-6">
                                <div>
                                    <p className={`text-sm font-semibold ${n.text}`}>Request Account Deletion</p>
                                    <p className={`text-xs ${n.tertiary} mt-0.5`}>Permanently removes your account and all associated data.</p>
                                </div>
                                <button className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all flex-shrink-0">
                                    Delete Account
                                </button>
                            </div>
                        </div>
                    </div>
                </SectionWrap>
            );

            // ── Support ───────────────────────────────────────────────────────
            case "support": return (
                <SectionWrap title="Support" desc="Get help, report issues, or share feedback with our team.">
                    <div className={`${n.card} rounded-2xl overflow-hidden`}>
                        {[
                            { label: "Contact Support",   desc: "Reach out to our support team directly.",       icon: Mail,         action: "mailto:support@timely.com", external: true },
                            { label: "Report a Problem",  desc: "Something not working? Let us know.",            icon: Flag,         action: "#" },
                            { label: "Help Center",       desc: "Browse guides and FAQs.",                        icon: HelpCircle,   action: "#", external: true },
                            { label: "Feature Request",   desc: "Have an idea? We'd love to hear it.",            icon: Zap,          action: "#" },
                        ].map((item, i, arr) => (
                            <a key={item.label} href={item.action} target={item.external ? "_blank" : undefined} rel="noreferrer"
                                className={`flex items-center justify-between px-5 py-4 ${n.rowHover} transition-colors cursor-pointer ${i < arr.length - 1 ? `border-b ${n.divider}` : ""}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 ${n.flat} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                        <item.icon className={`w-4 h-4 ${n.secondary}`} />
                                    </div>
                                    <div>
                                        <p className={`text-sm font-medium ${n.text}`}>{item.label}</p>
                                        <p className={`text-xs ${n.tertiary}`}>{item.desc}</p>
                                    </div>
                                </div>
                                <ChevronRight className={`w-4 h-4 ${n.tertiary}`} />
                            </a>
                        ))}
                    </div>
                </SectionWrap>
            );

            default: return null;
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
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

            {/* Header */}
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

                {/* Sidebar */}
                <nav className={`${n.card} rounded-2xl p-2 w-52 flex-shrink-0 sticky top-20`}>
                    {NAV.map((item, i) => (
                        <button key={item.id} onClick={() => setActiveSection(item.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all border-l-2 mb-0.5 last:mb-0 font-medium
                                ${item.danger
                                    ? `${activeSection === item.id ? "bg-red-500/10 text-red-400 border-red-400" : "text-red-400 hover:bg-red-500/10 border-transparent"} mt-1`
                                    : activeSection === item.id ? n.sidebarActive : n.sidebarIdle
                                }`}>
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {renderSection()}
                </div>
            </div>
        </div>
    );
};

export default ClientSettings;