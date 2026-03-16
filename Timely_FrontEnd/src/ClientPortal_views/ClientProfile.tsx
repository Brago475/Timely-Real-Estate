// src/ClientPortal_views/ClientProfile.tsx
import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    User, Mail, Phone, MapPin, Building, Calendar, Edit3,
    Save, X, Camera, Trash2, CheckCircle, AlertCircle, Info,
    Shield, Clock, FolderOpen, Briefcase, RefreshCw,
} from "lucide-react";

const API_BASE = "/api";
const STORAGE_KEY = "timely_client_profile";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientProfileProps = {
    userName?: string;
    userEmail?: string;
    customerId?: string;
    onProfileUpdate?: (data: ProfileData) => void;
};

interface ProfileData {
    firstName: string; lastName: string; email: string; phone: string;
    company: string; address: string; city: string; state: string;
    zipCode: string; country: string; bio: string; avatar: string | null;
}

interface Toast { id: string; message: string; type: "success" | "error" | "info"; }
interface Stats  { projects: number; totalHours: number; memberSince: string; }

// ─── Component ────────────────────────────────────────────────────────────────

const ClientProfile: React.FC<ClientProfileProps> = ({
    userName = "", userEmail = "", customerId = "", onProfileUpdate,
}) => {
    const { isDark } = useTheme();

    const n = {
        bg:           isDark ? "neu-bg-dark"       : "neu-bg-light",
        card:         isDark ? "neu-dark"           : "neu-light",
        flat:         isDark ? "neu-dark-flat"      : "neu-light-flat",
        inset:        isDark ? "neu-dark-inset"     : "neu-light-inset",
        pressed:      isDark ? "neu-dark-pressed"   : "neu-light-pressed",
        text:         isDark ? "text-white"         : "text-gray-900",
        secondary:    isDark ? "text-gray-300"      : "text-gray-600",
        tertiary:     isDark ? "text-gray-500"      : "text-gray-400",
        strong:       isDark ? "text-white"         : "text-black",
        label:        isDark ? "text-blue-400"      : "text-blue-600",
        divider:      isDark ? "border-gray-800"    : "border-gray-200",
        input:        isDark ? "bg-transparent border-gray-700 text-white" : "bg-transparent border-gray-300 text-gray-900",
        btnPrimary:   "bg-blue-600 hover:bg-blue-500 text-white",
        btnSecondary: isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        edgeHover: isDark
            ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]"
            : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]",
    };

    const nameParts     = userName.split(" ");
    const defaultFirst  = nameParts[0] || "";
    const defaultLast   = nameParts.slice(1).join(" ") || "";

    const DEFAULTS: ProfileData = {
        firstName: defaultFirst, lastName: defaultLast,
        email: userEmail, phone: "", company: "",
        address: "", city: "", state: "", zipCode: "", country: "",
        bio: "", avatar: null,
    };

    const [profile, setProfile]           = useState<ProfileData>(DEFAULTS);
    const [editedProfile, setEditedProfile] = useState<ProfileData>(DEFAULTS);
    const [editMode, setEditMode]         = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [stats, setStats]               = useState<Stats>({ projects: 0, totalHours: 0, memberSince: "" });
    const [saving, setSaving]             = useState(false);
    const [loading, setLoading]           = useState(true);
    const [toasts, setToasts]             = useState<Toast[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { loadProfile(); loadStats(); }, [customerId]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY}_${customerId}`);
            let base    = { ...DEFAULTS };
            if (saved) {
                const parsed = JSON.parse(saved);
                base = { ...DEFAULTS, ...parsed };
                if (parsed.avatar) setAvatarPreview(parsed.avatar);
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
                            address:   d.data.address   || base.address,
                            city:      d.data.city      || base.city,
                            state:     d.data.state     || base.state,
                            zipCode:   d.data.zipCode   || base.zipCode,
                            country:   d.data.country   || base.country,
                        };
                    }
                }
            }
            setProfile(base); setEditedProfile(base);
        } catch {}
        finally { setLoading(false); }
    };

    const loadStats = async () => {
        try {
            let ids: string[] = [];
            const pcRes = await fetch(`${API_BASE}/project-clients`);
            if (pcRes.ok) {
                const d = await pcRes.json();
                ids = (d.data || []).filter((x: any) => String(x.clientId) === String(customerId)).map((x: any) => String(x.projectId));
            } else {
                const local = JSON.parse(localStorage.getItem("timely_project_clients") || "[]");
                ids = local.filter((x: any) => String(x.clientId) === String(customerId)).map((x: any) => String(x.projectId));
            }
            let totalHours = 0;
            const hRes = await fetch(`${API_BASE}/hours-logs`);
            if (hRes.ok) {
                const hd = await hRes.json();
                if (hd.data) totalHours = hd.data.filter((h: any) => ids.includes(String(h.projectId))).reduce((s: number, h: any) => s + (parseFloat(h.hours) || 0), 0);
            }
            let memberSince = "";
            if (customerId) {
                const cr = await fetch(`${API_BASE}/clients/${customerId}`);
                if (cr.ok) { const cd = await cr.json(); memberSince = cd.data?.createdAt || cd.data?.dateAdded || ""; }
            }
            setStats({ projects: ids.length, totalHours, memberSince });
        } catch {}
    };

    const showToast = (message: string, type: Toast["type"] = "success") => {
        const id = `t_${Date.now()}`;
        setToasts(p => [...p, { id, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };

    const initials = (f: string, l: string) => `${f[0] || ""}${l[0] || ""}`.toUpperCase() || "?";
    const fmtDate  = (d: string) => { if (!d) return "N/A"; const dt = new Date(d); return isNaN(dt.getTime()) ? "N/A" : dt.toLocaleDateString("en-US", { month: "long", year: "numeric" }); };
    const fmtHours = (h: number) => { const hr = Math.floor(h); const mn = Math.round((h - hr) * 60); return mn === 0 ? `${hr}h` : `${hr}h ${mn}m`; };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showToast("Image must be under 5MB", "error"); return; }
        const reader = new FileReader();
        reader.onloadend = () => {
            const b64 = reader.result as string;
            setAvatarPreview(b64);
            setEditedProfile(p => ({ ...p, avatar: b64 }));
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            localStorage.setItem(`${STORAGE_KEY}_${customerId}`, JSON.stringify(editedProfile));
            if (customerId) {
                await fetch(`${API_BASE}/clients/${customerId}`, {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ firstName: editedProfile.firstName, lastName: editedProfile.lastName, phone: editedProfile.phone, companyName: editedProfile.company, address: editedProfile.address, city: editedProfile.city, state: editedProfile.state, zipCode: editedProfile.zipCode, country: editedProfile.country }),
                }).catch(() => {});
            }
            setProfile(editedProfile); setEditMode(false);
            showToast("Profile saved", "success");
            onProfileUpdate?.(editedProfile);
        } catch { showToast("Failed to save", "error"); }
        finally { setSaving(false); }
    };

    const handleCancel = () => { setEditedProfile(profile); setAvatarPreview(profile.avatar); setEditMode(false); };

    // ── Input field ───────────────────────────────────────────────────────────
    const Field: React.FC<{
        label: string; field: keyof ProfileData; type?: string;
        placeholder?: string; icon?: React.ComponentType<{ className?: string }>; disabled?: boolean;
    }> = ({ label, field, type = "text", placeholder = "", icon: Icon, disabled = false }) => (
        <div>
            <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>{label}</label>
            <div className="relative">
                {Icon && <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${n.tertiary}`} />}
                <input type={type} value={editedProfile[field] as string}
                    onChange={e => setEditedProfile(p => ({ ...p, [field]: e.target.value }))}
                    placeholder={placeholder} disabled={!editMode || disabled}
                    className={`w-full ${Icon ? "pl-9" : "pl-3"} pr-3 py-2.5 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                />
            </div>
        </div>
    );

    // ── Section wrapper ───────────────────────────────────────────────────────
    const Section: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; color: string; children: React.ReactNode }> = ({ icon: Icon, title, color, children }) => (
        <div className={`${n.card} rounded-2xl p-5`}>
            <div className="flex items-center gap-3 mb-5">
                <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-4 h-4 text-white" />
                </div>
                <h3 className={`font-semibold ${n.strong}`}>{title}</h3>
            </div>
            {children}
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <div className="text-center">
                <RefreshCw className={`w-7 h-7 ${n.label} animate-spin mx-auto mb-3`} />
                <p className={`${n.secondary} text-sm`}>Loading profile…</p>
            </div>
        </div>
    );

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
                    <h1 className={`text-xl font-semibold ${n.strong}`}>Profile</h1>
                    <p className={`text-sm ${n.secondary} mt-0.5`}>Manage your personal information</p>
                </div>
                {!editMode ? (
                    <button onClick={() => setEditMode(true)} className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-2`}>
                        <Edit3 className="w-3.5 h-3.5" />Edit Profile
                    </button>
                ) : (
                    <div className="flex items-center gap-2">
                        <button onClick={handleCancel} className={`px-3 py-2 ${n.flat} rounded-xl text-sm ${n.secondary} flex items-center gap-1.5`}>
                            <X className="w-3.5 h-3.5" />Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving} className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-1.5 disabled:opacity-70`}>
                            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {saving ? "Saving…" : "Save Changes"}
                        </button>
                    </div>
                )}
            </div>

            {/* Profile hero card */}
            <div className={`${n.card} rounded-2xl overflow-hidden`}>
                {/* Banner */}
                <div className="h-28 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-900 relative">
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, white 1px, transparent 1px), radial-gradient(circle at 70% 80%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
                </div>

                <div className="px-6 pb-6">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">

                        {/* Avatar */}
                        <div className="relative group flex-shrink-0">
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                            <div
                                onClick={() => editMode && fileInputRef.current?.click()}
                                className={`w-24 h-24 rounded-2xl border-4 ${isDark ? "border-[#111111]" : "border-[#e4e4e4]"} overflow-hidden ${editMode ? "cursor-pointer" : ""} shadow-xl`}
                            >
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-2xl font-bold">
                                        {initials(editedProfile.firstName, editedProfile.lastName)}
                                    </div>
                                )}
                                {editMode && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                                        <Camera className="w-6 h-6 text-white" />
                                    </div>
                                )}
                            </div>
                            {editMode && avatarPreview && (
                                <button onClick={() => { setAvatarPreview(null); setEditedProfile(p => ({ ...p, avatar: null })); }} className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {/* Name + meta */}
                        <div className="flex-1 min-w-0 pb-1">
                            <h2 className={`text-xl font-bold ${n.strong}`}>
                                {profile.firstName || profile.lastName
                                    ? `${profile.firstName} ${profile.lastName}`.trim()
                                    : "No Name Set"}
                            </h2>
                            <p className={`text-sm ${n.secondary} mt-0.5`}>{profile.email || "No email"}</p>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-semibold flex items-center gap-1">
                                    <User className="w-3 h-3" />Client
                                </span>
                                {stats.memberSince && (
                                    <span className={`text-xs ${n.tertiary} flex items-center gap-1`}>
                                        <Calendar className="w-3 h-3" />Member since {fmtDate(stats.memberSince)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Mini stats */}
                        <div className="flex gap-6 pb-1">
                            <div className="text-center">
                                <p className={`text-2xl font-bold ${n.strong}`}>{stats.projects}</p>
                                <p className={`text-xs ${n.tertiary}`}>Projects</p>
                            </div>
                            <div className="text-center">
                                <p className={`text-2xl font-bold ${n.strong}`}>{fmtHours(stats.totalHours)}</p>
                                <p className={`text-xs ${n.tertiary}`}>Hours</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Personal Information */}
            <Section icon={User} title="Personal Information" color="bg-blue-600">
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="First Name"    field="firstName" placeholder="First name"    icon={User} />
                    <Field label="Last Name"     field="lastName"  placeholder="Last name"     icon={User} />
                    <Field label="Email"         field="email"     type="email" placeholder="Email address" icon={Mail} disabled />
                    <Field label="Phone"         field="phone"     type="tel"   placeholder="Phone number"  icon={Phone} />
                    <div className="md:col-span-2">
                        <label className={`text-[11px] uppercase tracking-wider ${n.label} block mb-1.5`}>Bio</label>
                        <textarea value={editedProfile.bio} onChange={e => setEditedProfile(p => ({ ...p, bio: e.target.value }))}
                            placeholder="Tell us a little about yourself…" disabled={!editMode} rows={3}
                            className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`} />
                    </div>
                </div>
            </Section>

            {/* Company & Address */}
            <Section icon={Building} title="Company & Address" color="bg-emerald-600">
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Company"          field="company"  placeholder="Company name"   icon={Building} />
                    <div />
                    <div className="md:col-span-2">
                        <Field label="Street Address" field="address"  placeholder="Street address" icon={MapPin} />
                    </div>
                    <Field label="City"             field="city"     placeholder="City" />
                    <Field label="State / Province" field="state"    placeholder="State" />
                    <Field label="ZIP / Postal Code"field="zipCode"  placeholder="ZIP code" />
                    <Field label="Country"          field="country"  placeholder="Country" />
                </div>
            </Section>

            {/* Account Information */}
            <Section icon={Shield} title="Account Information" color="bg-gray-600">
                <div className="grid gap-3 md:grid-cols-3 mb-4">
                    {[
                        { label: "Customer ID",  value: customerId || "N/A", mono: true,  color: "bg-blue-600",    icon: User },
                        { label: "Member Since", value: fmtDate(stats.memberSince),         mono: false, color: "bg-emerald-600", icon: Calendar },
                        { label: "Account Type", value: null,                               mono: false, color: "bg-blue-600",    icon: Shield },
                    ].map(item => (
                        <div key={item.label} className={`${n.flat} p-4 rounded-xl`}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-7 h-7 ${item.color} rounded-lg flex items-center justify-center`}>
                                    <item.icon className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider ${n.tertiary}`}>{item.label}</span>
                            </div>
                            {item.value !== null
                                ? <p className={`text-sm font-medium ${n.text} ${item.mono ? "font-mono" : ""}`}>{item.value}</p>
                                : <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-semibold inline-flex items-center gap-1"><Briefcase className="w-3 h-3" />Client</span>
                            }
                        </div>
                    ))}
                </div>
                <div className={`${n.inset} p-3 rounded-xl flex items-start gap-2`}>
                    <Info className={`w-4 h-4 ${n.label} flex-shrink-0 mt-0.5`} />
                    <p className={`text-xs ${n.secondary}`}>To change your email or account type, contact your consultant or support.</p>
                </div>
            </Section>

            {/* Activity Summary */}
            <Section icon={Clock} title="Activity Summary" color="bg-amber-600">
                <div className="grid gap-3 md:grid-cols-3">
                    {[
                        { label: "Active Projects", value: String(stats.projects),                       icon: FolderOpen, color: "bg-blue-600" },
                        { label: "Total Hours",     value: fmtHours(stats.totalHours),                  icon: Clock,      color: "bg-emerald-600" },
                        { label: "Member Since",    value: stats.memberSince ? fmtDate(stats.memberSince).split(" ")[0] : "N/A", icon: Calendar, color: "bg-blue-600" },
                    ].map(st => (
                        <div key={st.label} className={`${n.flat} ${n.edgeHover} p-4 rounded-2xl flex items-center gap-4 transition-all`}>
                            <div className={`w-11 h-11 ${st.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                <st.icon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className={`text-xl font-bold ${n.strong}`}>{st.value}</p>
                                <p className={`text-xs ${n.tertiary}`}>{st.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    );
};

export default ClientProfile;