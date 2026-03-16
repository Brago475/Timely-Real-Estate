// src/ClientPortal_views/ClientProfile.tsx
import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    User, Mail, Phone, Building, Camera, X, Save, Edit3,
    CheckCircle, AlertCircle, Info, RefreshCw, Shield,
    Calendar, FolderOpen, Briefcase, Hash,
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
    email: string; phone: string;
    company: string; bio: string;
    avatar: string | null;
}

interface Toast { id: string; message: string; type: "success" | "error" | "info"; }
interface Stats { projects: number; memberSince: string; }

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
        btnPrimary: "bg-blue-600 hover:bg-blue-500 text-white",
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
    const [stats,         setStats]         = useState<Stats>({ projects: 0, memberSince: "" });
    const [saving,        setSaving]        = useState(false);
    const [loading,       setLoading]       = useState(true);
    const [toasts,        setToasts]        = useState<Toast[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => { loadProfile(); loadStats(); }, [customerId]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY}_${customerId}`);
            let base = { ...DEFAULTS };
            if (saved) {
                const parsed = JSON.parse(saved);
                base = { ...DEFAULTS, ...parsed };
                if (parsed.avatar) setAvatarPreview(parsed.avatar);
            }
            if (customerId) {
                const r = await fetch(`${API_BASE}/clients/${customerId}`);
                if (r.ok) {
                    const d = await r.json();
                    if (d.data) base = {
                        ...base,
                        firstName: d.data.firstName   || base.firstName,
                        lastName:  d.data.lastName    || base.lastName,
                        email:     d.data.email       || base.email,
                        phone:     d.data.phone       || base.phone,
                        company:   d.data.companyName || base.company,
                    };
                }
            }
            setProfile(base); setEdited(base);
        } catch {}
        finally { setLoading(false); }
    };

    const loadStats = async () => {
        try {
            // Projects
            let ids: string[] = [];
            const pcRes = await fetch(`${API_BASE}/project-clients`);
            if (pcRes.ok) {
                const d = await pcRes.json();
                ids = (d.data || [])
                    .filter((x: any) => String(x.clientId) === String(customerId))
                    .map((x: any) => String(x.projectId));
            } else {
                ids = JSON.parse(localStorage.getItem("timely_project_clients") || "[]")
                    .filter((x: any) => String(x.clientId) === String(customerId))
                    .map((x: any) => String(x.projectId));
            }
            // Member since — from account creation date
            let memberSince = "";
            if (customerId) {
                const cr = await fetch(`${API_BASE}/clients/${customerId}`);
                if (cr.ok) {
                    const cd = await cr.json();
                    memberSince = cd.data?.createdAt || cd.data?.dateAdded || "";
                }
            }
            setStats({ projects: ids.length, memberSince });
        } catch {}
    };

    const showToast = (message: string, type: Toast["type"] = "success") => {
        const id = `t_${Date.now()}`;
        setToasts(p => [...p, { id, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const initials = (f: string, l: string) =>
        `${f[0] || ""}${l[0] || ""}`.toUpperCase() || "?";

    const fmtDate = (d: string) => {
        if (!d) return "N/A";
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? "N/A" : dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    };

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
            localStorage.setItem(`${STORAGE_KEY}_${customerId}`, JSON.stringify(edited));
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

    const Field: React.FC<{
        label: string; field: keyof ProfileData; type?: string;
        placeholder?: string; icon?: React.ComponentType<{ className?: string }>; disabled?: boolean;
    }> = ({ label, field, type = "text", placeholder, icon: Icon, disabled }) => (
        <div>
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

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <RefreshCw className={`w-7 h-7 ${n.label} animate-spin`} />
        </div>
    );

    const fullName = `${profile.firstName} ${profile.lastName}`.trim() || "Your Name";

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

            {/* ── Hero ── */}
            <div className={`${n.card} rounded-2xl overflow-hidden`}>
                {/* Banner */}
                <div className="h-36 relative overflow-hidden" style={{
                    background: isDark
                        ? "linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0c2340 100%)"
                        : "linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #1e40af 100%)",
                }}>
                    <svg className="absolute inset-0 w-full h-full opacity-[0.07]" viewBox="0 0 600 140" preserveAspectRatio="xMidYMid slice">
                        <circle cx="500" cy="-20" r="160" fill="white" />
                        <circle cx="80"  cy="160" r="120" fill="white" />
                        <circle cx="300" cy="70"  r="180" fill="white" opacity="0.3" />
                    </svg>

                    {/* Name + email displayed ON the banner */}
                    <div className="absolute bottom-5 left-36 right-6 flex items-end justify-between">
                        <div>
                            <p className="text-white font-bold text-xl leading-tight drop-shadow-sm">{fullName}</p>
                            <p className="text-white/60 text-sm mt-0.5">{profile.email}</p>
                        </div>
                        {/* Edit button on banner */}
                        <div className="flex items-center gap-2">
                            {!editMode ? (
                                <button onClick={() => setEditMode(true)}
                                    className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm rounded-xl text-sm flex items-center gap-1.5 transition-all">
                                    <Edit3 className="w-3.5 h-3.5" />Edit Profile
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => { setEdited(profile); setAvatarPreview(profile.avatar); setEditMode(false); }}
                                        className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-sm rounded-xl text-sm flex items-center gap-1.5 transition-all">
                                        <X className="w-3.5 h-3.5" />Cancel
                                    </button>
                                    <button onClick={handleSave} disabled={saving}
                                        className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all disabled:opacity-70">
                                        {saving ? <div className="w-3.5 h-3.5 border-2 border-blue-700/30 border-t-blue-700 rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        {saving ? "Saving…" : "Save"}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Avatar row */}
                <div className="px-6 pt-0 pb-5">
                    <div className="flex items-end gap-4 -mt-10">
                        {/* Avatar */}
                        <div className="relative group flex-shrink-0">
                            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                            <div onClick={() => editMode && fileRef.current?.click()}
                                className={`w-20 h-20 rounded-2xl border-4 ${isDark ? "border-[#111111]" : "border-white"} overflow-hidden shadow-xl ${editMode ? "cursor-pointer" : ""}`}>
                                {avatarPreview
                                    ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xl font-bold">
                                        {initials(edited.firstName, edited.lastName)}
                                    </div>
                                }
                                {editMode && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                                        <Camera className="w-5 h-5 text-white" />
                                    </div>
                                )}
                            </div>
                            {editMode && avatarPreview && (
                                <button onClick={() => { setAvatarPreview(null); setEdited(p => ({ ...p, avatar: null })); }}
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 shadow">
                                    <X className="w-2.5 h-2.5 text-white" />
                                </button>
                            )}
                        </div>

                        {/* Badges below avatar */}
                        <div className="pb-1 flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-semibold flex items-center gap-1">
                                <User className="w-3 h-3" />Client
                            </span>
                            {profile.company && (
                                <span className={`text-[11px] px-2.5 py-1 rounded-lg ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"} flex items-center gap-1`}>
                                    <Building className="w-3 h-3" />{profile.company}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Personal Information ── */}
            <div className={`${n.card} rounded-2xl p-5`}>
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-white" />
                    </div>
                    <h3 className={`font-semibold ${n.strong}`}>Personal Information</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="First Name" field="firstName" placeholder="First name"    icon={User} />
                    <Field label="Last Name"  field="lastName"  placeholder="Last name"     icon={User} />
                    <Field label="Email"      field="email"     type="email" placeholder="Email address" icon={Mail} disabled />
                    <Field label="Phone"      field="phone"     type="tel"   placeholder="Phone number"  icon={Phone} />
                    <div className="md:col-span-2">
                        <Field label="Company" field="company" placeholder="Company name" icon={Building} />
                    </div>
                    <div className="md:col-span-2">
                        <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>Bio</label>
                        <textarea value={edited.bio}
                            onChange={e => setEdited(p => ({ ...p, bio: e.target.value }))}
                            placeholder="A short bio about yourself…"
                            disabled={!editMode} rows={3}
                            className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                        />
                    </div>
                </div>
                <div className={`mt-5 pt-4 border-t ${n.divider}`}>
                    <div className={`${n.inset} p-3 rounded-xl flex items-start gap-2`}>
                        <Info className={`w-4 h-4 ${n.label} flex-shrink-0 mt-0.5`} />
                        <p className={`text-xs ${n.secondary}`}>Email address cannot be changed here. Contact your consultant or support to update it.</p>
                    </div>
                </div>
            </div>

            {/* ── Account Info + Activity side by side ── */}
            <div className="grid md:grid-cols-2 gap-5">

                {/* Account Information */}
                <div className={`${n.card} rounded-2xl p-5`}>
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-9 h-9 bg-gray-600 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <h3 className={`font-semibold ${n.strong}`}>Account Information</h3>
                    </div>

                    <div className={`divide-y ${n.divider}`}>
                        {/* Customer ID */}
                        <div className="flex items-center gap-3 py-3 first:pt-0">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Hash className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="min-w-0">
                                <p className={`text-[10px] uppercase tracking-wider ${n.tertiary}`}>Customer ID</p>
                                <p className={`text-sm font-semibold font-mono ${n.text} mt-0.5`}>{customerId || "N/A"}</p>
                            </div>
                        </div>

                        {/* Member Since — account creation date */}
                        <div className="flex items-center gap-3 py-3">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Calendar className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div>
                                <p className={`text-[10px] uppercase tracking-wider ${n.tertiary}`}>Member Since</p>
                                <p className={`text-sm font-semibold ${n.text} mt-0.5`}>{fmtDate(stats.memberSince)}</p>
                            </div>
                        </div>

                        {/* Account Type */}
                        <div className="flex items-center gap-3 py-3 last:pb-0">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Briefcase className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div>
                                <p className={`text-[10px] uppercase tracking-wider ${n.tertiary}`}>Account Type</p>
                                <span className="mt-0.5 text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-semibold inline-flex items-center gap-1">
                                    <User className="w-3 h-3" />Client
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className={`mt-4 pt-4 border-t ${n.divider}`}>
                        <div className={`${n.inset} p-3 rounded-xl flex items-start gap-2`}>
                            <Info className={`w-3.5 h-3.5 ${n.label} flex-shrink-0 mt-0.5`} />
                            <p className={`text-xs ${n.secondary}`}>To change your email or account type, contact your consultant or support.</p>
                        </div>
                    </div>
                </div>

                {/* Activity Summary — clients don't log hours, just projects */}
                <div className={`${n.card} rounded-2xl p-5`}>
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                            <FolderOpen className="w-4 h-4 text-white" />
                        </div>
                        <h3 className={`font-semibold ${n.strong}`}>Activity Summary</h3>
                    </div>

                    {/* Single large stat */}
                    <div className={`${n.inset} rounded-2xl p-6 flex items-center gap-5`}>
                        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <FolderOpen className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <p className={`text-4xl font-bold ${n.strong} tabular-nums leading-none`}>{stats.projects}</p>
                            <p className={`text-sm ${n.secondary} mt-1`}>
                                {stats.projects === 1 ? "Active Project" : "Active Projects"}
                            </p>
                        </div>
                    </div>

                    <div className={`mt-4 ${n.flat} rounded-xl px-4 py-3 flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                            <Calendar className={`w-3.5 h-3.5 ${n.tertiary}`} />
                            <span className={`text-xs ${n.secondary}`}>Account created</span>
                        </div>
                        <span className={`text-xs font-medium ${n.text}`}>{fmtDate(stats.memberSince)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientProfile;