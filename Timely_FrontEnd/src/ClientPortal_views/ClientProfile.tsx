// src/ClientPortal_views/ClientProfile.tsx
import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    User, Mail, Phone, Building, Camera, Trash2,
    CheckCircle, AlertCircle, Info, X, Save, Edit3,
    Shield, Bell, Key, Lock, RefreshCw, ChevronRight,
    FolderOpen, MessageCircle, FileText, Eye, EyeOff,
    Moon, Sun,
} from "lucide-react";

const API_BASE = "/api";
const STORAGE_KEY = "timely_client_profile";

type ClientProfileProps = {
    userName?: string;
    userEmail?: string;
    customerId?: string;
    onProfileUpdate?: (data: ProfileData) => void;
};

interface ProfileData {
    firstName: string; lastName: string;
    email: string; phone: string; company: string;
    bio: string; avatar: string | null;
}

interface NotifPrefs {
    projectUpdates: boolean;
    messages: boolean;
    fileUploads: boolean;
}

interface Toast { id: string; message: string; type: "success" | "error" | "info"; }

type ActiveTab = "personal" | "security" | "notifications";

const ClientProfile: React.FC<ClientProfileProps> = ({
    userName = "", userEmail = "", customerId = "", onProfileUpdate,
}) => {
    const { isDark } = useTheme();

    const n = {
        card:      isDark ? "neu-dark"        : "neu-light",
        flat:      isDark ? "neu-dark-flat"   : "neu-light-flat",
        inset:     isDark ? "neu-dark-inset"  : "neu-light-inset",
        text:      isDark ? "text-white"      : "text-gray-900",
        secondary: isDark ? "text-gray-300"   : "text-gray-600",
        tertiary:  isDark ? "text-gray-500"   : "text-gray-400",
        strong:    isDark ? "text-white"      : "text-black",
        label:     isDark ? "text-blue-400"   : "text-blue-600",
        divider:   isDark ? "border-gray-800" : "border-gray-200",
        input:     isDark
            ? "bg-transparent border-gray-700 text-white placeholder-gray-600"
            : "bg-transparent border-gray-300 text-gray-900 placeholder-gray-400",
        btnPrimary:   "bg-blue-600 hover:bg-blue-500 text-white",
        btnSecondary: isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        rowHover:  isDark ? "hover:bg-gray-800/40" : "hover:bg-gray-50",
        tabActive: isDark ? "bg-blue-600/10 text-blue-400 border-blue-500" : "bg-blue-50 text-blue-600 border-blue-500",
        tabIdle:   isDark ? "text-gray-400 hover:bg-gray-800/50 border-transparent" : "text-gray-500 hover:bg-gray-50 border-transparent",
    };

    const nameParts = userName.split(" ");
    const DEFAULTS: ProfileData = {
        firstName: nameParts[0] || "",
        lastName:  nameParts.slice(1).join(" ") || "",
        email: userEmail, phone: "", company: "", bio: "", avatar: null,
    };

    const [profile,       setProfile]       = useState<ProfileData>(DEFAULTS);
    const [edited,        setEdited]        = useState<ProfileData>(DEFAULTS);
    const [editMode,      setEditMode]      = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [saving,        setSaving]        = useState(false);
    const [loading,       setLoading]       = useState(true);
    const [toasts,        setToasts]        = useState<Toast[]>([]);
    const [activeTab,     setActiveTab]     = useState<ActiveTab>("personal");

    // Security
    const [showPwForm,  setShowPwForm]  = useState(false);
    const [currentPw,   setCurrentPw]   = useState("");
    const [newPw,       setNewPw]       = useState("");
    const [confirmPw,   setConfirmPw]   = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew,     setShowNew]     = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [pwSaving,    setPwSaving]    = useState(false);

    // Notifications
    const [notifs, setNotifs] = useState<NotifPrefs>({
        projectUpdates: true, messages: true, fileUploads: true,
    });
    const [notifChanged, setNotifChanged] = useState(false);

    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => { loadProfile(); }, [customerId]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY}_${customerId}`);
            let base = { ...DEFAULTS };
            if (saved) {
                const parsed = JSON.parse(saved);
                base = { ...DEFAULTS, ...parsed };
                if (parsed.avatar) setAvatarPreview(parsed.avatar);
                if (parsed.notifs) setNotifs(parsed.notifs);
            }
            if (customerId) {
                const r = await fetch(`${API_BASE}/clients/${customerId}`);
                if (r.ok) {
                    const d = await r.json();
                    if (d.data) {
                        base = {
                            ...base,
                            firstName: d.data.firstName || base.firstName,
                            lastName:  d.data.lastName  || base.lastName,
                            email:     d.data.email     || base.email,
                            phone:     d.data.phone     || base.phone,
                            company:   d.data.companyName || base.company,
                        };
                    }
                }
            }
            setProfile(base); setEdited(base);
        } catch {}
        finally { setLoading(false); }
    };

    const showToast = (message: string, type: Toast["type"] = "success") => {
        const id = `t_${Date.now()}`;
        setToasts(p => [...p, { id, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const initials = (f: string, l: string) =>
        `${f[0] || ""}${l[0] || ""}`.toUpperCase() || "?";

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showToast("Image must be under 5MB", "error"); return; }
        const reader = new FileReader();
        reader.onloadend = () => {
            const b64 = reader.result as string;
            setAvatarPreview(b64);
            setEdited(p => ({ ...p, avatar: b64 }));
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const toSave = { ...edited, notifs };
            localStorage.setItem(`${STORAGE_KEY}_${customerId}`, JSON.stringify(toSave));
            if (customerId) {
                await fetch(`${API_BASE}/clients/${customerId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        firstName: edited.firstName, lastName: edited.lastName,
                        phone: edited.phone, companyName: edited.company,
                    }),
                }).catch(() => {});
            }
            setProfile(edited); setEditMode(false);
            showToast("Profile saved");
            onProfileUpdate?.(edited);
        } catch { showToast("Failed to save", "error"); }
        finally { setSaving(false); }
    };

    const handleSaveNotifs = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_${customerId}`) || "{}");
            localStorage.setItem(`${STORAGE_KEY}_${customerId}`, JSON.stringify({ ...saved, notifs }));
            setNotifChanged(false);
            showToast("Notification preferences saved");
        } catch { showToast("Failed to save", "error"); }
    };

    const handleChangePassword = () => {
        if (!currentPw || !newPw || !confirmPw) { showToast("Please fill all fields", "error"); return; }
        if (newPw !== confirmPw)  { showToast("Passwords don't match", "error"); return; }
        if (newPw.length < 8)    { showToast("Password must be at least 8 characters", "error"); return; }
        if (newPw === currentPw) { showToast("New password must differ from current", "error"); return; }
        setPwSaving(true);
        setTimeout(() => {
            showToast("Password updated successfully");
            setCurrentPw(""); setNewPw(""); setConfirmPw("");
            setShowPwForm(false); setPwSaving(false);
        }, 600);
    };

    // ── Sub-components ────────────────────────────────────────────────────────

    const Toggle: React.FC<{ enabled: boolean; onChange: (v: boolean) => void }> = ({ enabled, onChange }) => (
        <button type="button" onClick={() => onChange(!enabled)}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 flex-shrink-0 focus:outline-none ${enabled ? "bg-blue-600" : isDark ? "bg-gray-700" : "bg-gray-200"}`}>
            <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 ${enabled ? "left-7" : "left-0.5"}`} />
        </button>
    );

    const Row: React.FC<{ title: string; desc?: string; last?: boolean; tag?: string; children: React.ReactNode }> = ({ title, desc, last, tag, children }) => (
        <div className={`flex items-center justify-between py-4 ${!last ? `border-b ${n.divider}` : ""}`}>
            <div className="min-w-0 flex-1 pr-8">
                <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${n.text}`}>{title}</p>
                    {tag && <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"}`}>{tag}</span>}
                </div>
                {desc && <p className={`text-xs ${n.tertiary} mt-0.5`}>{desc}</p>}
            </div>
            <div className="flex-shrink-0">{children}</div>
        </div>
    );

    const PwInput: React.FC<{
        label: string; value: string; onChange: (v: string) => void;
        show: boolean; onToggleShow: () => void; placeholder?: string;
    }> = ({ label, value, onChange, show, onToggleShow, placeholder }) => (
        <div>
            <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>{label}</label>
            <div className="relative">
                <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full pl-3 pr-10 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors`} />
                <button type="button" onClick={onToggleShow} className={`absolute right-3 top-1/2 -translate-y-1/2 ${n.tertiary} hover:${n.secondary} transition-colors`}>
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );

    const Field: React.FC<{
        label: string; field: keyof ProfileData; type?: string;
        placeholder?: string; icon?: React.ComponentType<{ className?: string }>; disabled?: boolean;
        span2?: boolean;
    }> = ({ label, field, type = "text", placeholder, icon: Icon, disabled, span2 }) => (
        <div className={span2 ? "md:col-span-2" : ""}>
            <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>{label}</label>
            <div className="relative">
                {Icon && <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${n.tertiary}`} />}
                <input type={type} value={edited[field] as string}
                    onChange={e => setEdited(p => ({ ...p, [field]: e.target.value }))}
                    placeholder={placeholder} disabled={!editMode || disabled}
                    className={`w-full ${Icon ? "pl-9" : "pl-3"} pr-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                />
            </div>
        </div>
    );

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const TABS: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
        { id: "personal",      label: "Personal Info",  icon: User },
        { id: "security",      label: "Security",       icon: Shield },
        { id: "notifications", label: "Notifications",  icon: Bell },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <RefreshCw className={`w-7 h-7 ${n.label} animate-spin`} />
        </div>
    );

    return (
        <div className="space-y-6">

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

            {/* ── Hero card ── */}
            <div className={`${n.card} rounded-2xl overflow-hidden`}>
                {/* Banner — geometric accent */}
                <div className="h-32 relative overflow-hidden" style={{
                    background: isDark
                        ? "linear-gradient(135deg, #0f1f3d 0%, #1a3a6c 50%, #0d2d56 100%)"
                        : "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #1e40af 100%)",
                }}>
                    {/* Geometric overlay */}
                    <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 400 130" preserveAspectRatio="xMidYMid slice">
                        <circle cx="320" cy="20"  r="80"  fill="white" />
                        <circle cx="60"  cy="110" r="60"  fill="white" />
                        <circle cx="200" cy="65"  r="100" fill="white" opacity="0.4" />
                    </svg>
                    {/* Name overlay bottom-left */}
                    <div className="absolute bottom-4 left-36 right-4">
                        <p className="text-white/90 font-bold text-lg leading-tight drop-shadow">
                            {profile.firstName || profile.lastName
                                ? `${profile.firstName} ${profile.lastName}`.trim()
                                : "Your Name"}
                        </p>
                        <p className="text-white/60 text-xs mt-0.5">{profile.email}</p>
                    </div>
                </div>

                {/* Avatar + actions row */}
                <div className="px-6 pb-5">
                    <div className="flex items-end justify-between -mt-10">
                        {/* Avatar */}
                        <div className="relative group flex-shrink-0">
                            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                            <div
                                onClick={() => editMode && fileRef.current?.click()}
                                className={`w-20 h-20 rounded-2xl border-[3px] ${isDark ? "border-[#111111]" : "border-white"} overflow-hidden shadow-xl ${editMode ? "cursor-pointer" : ""}`}
                            >
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xl font-bold">
                                        {initials(edited.firstName, edited.lastName)}
                                    </div>
                                )}
                                {editMode && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                                        <Camera className="w-5 h-5 text-white" />
                                    </div>
                                )}
                            </div>
                            {editMode && avatarPreview && (
                                <button onClick={() => { setAvatarPreview(null); setEdited(p => ({ ...p, avatar: null })); }}
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow">
                                    <X className="w-2.5 h-2.5" />
                                </button>
                            )}
                        </div>

                        {/* Edit / Save actions */}
                        <div className="flex items-center gap-2 pb-1">
                            {activeTab === "personal" && (
                                !editMode ? (
                                    <button onClick={() => setEditMode(true)}
                                        className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-1.5`}>
                                        <Edit3 className="w-3.5 h-3.5" />Edit Profile
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={() => { setEdited(profile); setAvatarPreview(profile.avatar); setEditMode(false); }}
                                            className={`px-3 py-2 ${n.flat} rounded-xl text-sm ${n.secondary} flex items-center gap-1.5`}>
                                            <X className="w-3.5 h-3.5" />Cancel
                                        </button>
                                        <button onClick={handleSave} disabled={saving}
                                            className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-1.5 disabled:opacity-70`}>
                                            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            {saving ? "Saving…" : "Save"}
                                        </button>
                                    </>
                                )
                            )}
                            {activeTab === "notifications" && notifChanged && (
                                <button onClick={handleSaveNotifs}
                                    className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-1.5`}>
                                    <Save className="w-3.5 h-3.5" />Save Preferences
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Role badge */}
                    <div className="mt-3">
                        <span className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-semibold">Client</span>
                    </div>
                </div>
            </div>

            {/* ── Tab bar ── */}
            <div className={`${n.card} rounded-2xl p-1.5 flex gap-1`}>
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border-b-2
                            ${activeTab === tab.id ? n.tabActive : n.tabIdle}`}>
                        <tab.icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* ── Personal Info ── */}
            {activeTab === "personal" && (
                <div className={`${n.card} rounded-2xl p-5`}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="First Name" field="firstName" placeholder="First name"    icon={User} />
                        <Field label="Last Name"  field="lastName"  placeholder="Last name"     icon={User} />
                        <Field label="Email"      field="email"     type="email" placeholder="Email address" icon={Mail} disabled />
                        <Field label="Phone"      field="phone"     type="tel"   placeholder="Phone number"  icon={Phone} />
                        <Field label="Company"    field="company"   placeholder="Company name"  icon={Building} />
                        <div />
                        <div className="md:col-span-2">
                            <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>Bio</label>
                            <textarea value={edited.bio}
                                onChange={e => setEdited(p => ({ ...p, bio: e.target.value }))}
                                placeholder="Tell us a little about yourself…"
                                disabled={!editMode} rows={3}
                                className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                            />
                        </div>
                    </div>
                    {!editMode && (
                        <div className={`mt-5 pt-4 border-t ${n.divider}`}>
                            <div className={`${n.inset} p-3 rounded-xl flex items-start gap-2`}>
                                <Info className={`w-4 h-4 ${n.label} flex-shrink-0 mt-0.5`} />
                                <p className={`text-xs ${n.secondary}`}>Email address cannot be changed here. Contact your consultant or support to update it.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Security ── */}
            {activeTab === "security" && (
                <div className="space-y-4">

                    {/* Change password */}
                    <div className={`${n.card} rounded-2xl overflow-hidden`}>
                        <button type="button" onClick={() => setShowPwForm(!showPwForm)}
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
                            <ChevronRight className={`w-4 h-4 ${n.tertiary} transition-transform ${showPwForm ? "rotate-90" : ""}`} />
                        </button>

                        {showPwForm && (
                            <div className={`px-5 pb-5 pt-4 border-t ${n.divider} space-y-3`}>
                                <PwInput label="Current Password" value={currentPw} onChange={setCurrentPw}
                                    show={showCurrent} onToggleShow={() => setShowCurrent(!showCurrent)} placeholder="Enter current password" />
                                <PwInput label="New Password"     value={newPw}     onChange={setNewPw}
                                    show={showNew}     onToggleShow={() => setShowNew(!showNew)}         placeholder="Min. 8 characters" />
                                <PwInput label="Confirm Password" value={confirmPw} onChange={setConfirmPw}
                                    show={showConfirm} onToggleShow={() => setShowConfirm(!showConfirm)} placeholder="Repeat new password" />

                                {/* Strength indicator */}
                                {newPw.length > 0 && (
                                    <div>
                                        <div className="flex gap-1 mt-1">
                                            {[1,2,3,4].map(i => (
                                                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                                                    newPw.length >= i * 3
                                                        ? i <= 1 ? "bg-red-500" : i === 2 ? "bg-amber-500" : i === 3 ? "bg-blue-500" : "bg-emerald-500"
                                                        : isDark ? "bg-gray-700" : "bg-gray-200"
                                                }`} />
                                            ))}
                                        </div>
                                        <p className={`text-[10px] ${n.tertiary} mt-1`}>
                                            {newPw.length < 4 ? "Weak" : newPw.length < 7 ? "Fair" : newPw.length < 10 ? "Good" : "Strong"}
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => { setShowPwForm(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}
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
                            <div className={`relative w-14 h-7 rounded-full flex-shrink-0 opacity-40 ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
                                <span className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow" />
                            </div>
                        </Row>
                    </div>

                    {/* Email verification */}
                    <div className={`${n.card} rounded-2xl px-5`}>
                        <Row title="Email Verification" desc={userEmail ? `Verified as ${userEmail}` : "No email on file"} last>
                            {userEmail
                                ? <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" />Verified</span>
                                : <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3" />Not set</span>
                            }
                        </Row>
                    </div>
                </div>
            )}

            {/* ── Notifications ── */}
            {activeTab === "notifications" && (
                <div className={`${n.card} rounded-2xl overflow-hidden`}>
                    <div className={`px-5 py-4 border-b ${n.divider}`}>
                        <p className={`font-semibold ${n.strong} text-sm`}>Notification Preferences</p>
                        <p className={`text-xs ${n.tertiary} mt-0.5`}>Choose what you get notified about</p>
                    </div>
                    <div className="px-5">
                        <Row title="Project Updates" desc="Status changes, progress updates, and milestones.">
                            <Toggle enabled={notifs.projectUpdates} onChange={v => { setNotifs(p => ({ ...p, projectUpdates: v })); setNotifChanged(true); }} />
                        </Row>
                        <Row title="Messages" desc="When your consultant sends you a message.">
                            <Toggle enabled={notifs.messages} onChange={v => { setNotifs(p => ({ ...p, messages: v })); setNotifChanged(true); }} />
                        </Row>
                        <Row title="File Uploads" desc="When documents are uploaded or requested." last>
                            <Toggle enabled={notifs.fileUploads} onChange={v => { setNotifs(p => ({ ...p, fileUploads: v })); setNotifChanged(true); }} />
                        </Row>
                    </div>
                    {notifChanged && (
                        <div className={`px-5 py-4 border-t ${n.divider} flex justify-end`}>
                            <button onClick={handleSaveNotifs} className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-1.5`}>
                                <Save className="w-3.5 h-3.5" />Save Preferences
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClientProfile;